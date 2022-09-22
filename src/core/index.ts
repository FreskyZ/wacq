import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import * as mysql from 'mysql';
import { WebSocket, WebSocketServer } from 'ws';
import { query, setupDatabaseConnection } from '../adk/database';
import { setupWebInterface, shutdownWebInterface } from '../api/server';
import type { Message as APIMessage } from '../api/types';
import type { CQEvent } from './types';

dayjs.extend(utc);
// although this log infrastructure is very primitive,
// but still need to be aware that this script will be run for days even months or years
if (!fs.existsSync('logs')) { fs.mkdirSync('logs'); }
let logdate = dayjs();
function createlogfile() { return fs.createWriteStream(`logs/${logdate.format('YYYY-MM-DD')}.log`, { flags: 'a+' }); }
let logfile = createlogfile();
process.on('exit', () => { logfile.write('wabot stop'); logfile.end(); });
function writelog(content: string) {
    const today = dayjs();
    if (!today.isSame(logdate, 'date')) {
        logfile.end();
        logdate = today;
        logfile = createlogfile();
    }
    logfile.write(`[${dayjs().format('hh:mm:ss')}]${content}\n`);
}

const config: {
    selfid: number,
    selfbotid: number,
    selfgroupid: number,
    database: mysql.PoolConfig,
    socketpath: string,
} = JSON.parse(fs.readFileSync('config', 'utf-8'));

setupDatabaseConnection(config.database);

interface DBMessage {
    Id: number,
    Time: string,
    UserId: number,
    UserName: string,
    NickName: string,
    Content: string,
}
// temp web interface impl
setupWebInterface(config.socketpath,  {
    default: {
        getRecentGroups: async () => {
            const { value }: { value: { GroupId: number }[] } = await query('SELECT DISTINCT `GroupId` FROM `Message202209`;');
            return value.map(v => v.GroupId);
        },
        getRecentPrivates: async () => {
            return [2];
        },
        getGroupRecentMessages: async (_ctx, groupId) => {
            // I completely don't understand why if missing the type assertion,
            // mouse hover, cursor stop (highlight property def and use) and akari work correctly for 'value' variable but still gives red underline
            const { value }: { value: DBMessage[] } = await query<DBMessage[]>(
                'SELECT `Id`, `Time`, `UserId`, `UserName`, `NickName`, `Content` FROM `Message202209` WHERE `GroupId` = ? ORDER BY `Time` DESC LIMIT 100;', groupId);
            return value.map<APIMessage>(m => ({ id: m.Id, sender: `${m.NickName || m.UserName} (${m.UserId}, ${m.UserName}) at ${m.Time}`, content: m.Content }));
        },
        getPrivateRecentMessages: async (_ctx, _privateId) => {
            return [];
        },
        sendGroupMessage: async (_ctx, message) => {
            mainapi.send_group_message(message.groupId, message.content);
            return message;
        },
        sendPrivateMessage: async (_ctx, message) => {
            return message;
        }
    }
});

export class API extends EventEmitter {
    public constructor(
        private readonly socket: WebSocket,
    ) { super(); }

    private send(action: string, parameters: any) {
        this.socket.send(JSON.stringify({ action, params: parameters, echo: 'echo' }));
    }
    public send_private_message(user_id: number, message: string, complex: boolean = false) {
        this.send('send_private_msg', { user_id, message, auto_escape: complex });
    }
    public send_group_message(group_id: number, message: string, complex: boolean = false) {
        this.send('send_group_msg', { group_id, message, auto_escape: complex });
    }
}
let mainapi: API;
// @ts-ignore not used for now
let botoapi: API;

const wss = new WebSocketServer({ port: 8080 });
wss.on('connection', (ws, underlying) => {

    if (underlying.url == '/main/') {
        mainapi = new API(ws);
    } else if (underlying.url == '/boto/') {
        botoapi = new API(ws);
    }
    writelog('connected, url: ' + underlying.url);

    ws.on('message', (data: ArrayBuffer) => {
        const eventstring = Buffer.from(data).toString();
        const event = JSON.parse(eventstring) as CQEvent;

        if ('retcode' in event) {
            writelog(`[RESPONSE] ${eventstring}`);
        } else if (event.post_type == 'meta_event') {
            // console.log('HEARTBEAT, I THINK');
            // actually there is other meta event like connected
            // but the amount of heartbeat event is too much so completely ignored
        } else if (event.post_type == 'request') {
            writelog(`[REQUEST] ${eventstring}`);
        } else if (event.post_type == 'notice') {
            if ('guild_id' in event) {
                // this is about guild, also discard
                return;
            }
            writelog(`[NOTICE] ${eventstring}`);
        } else if (event.post_type == 'message' || event.post_type == 'message_sent') {
            if (event.message_type == 'guild') {
                // completely discard guild message
                return;
            }

            // duplicate and remove empty/common values
            const logevent = { ...event };
            delete logevent.time; // should be near log time and can be omitted
            delete logevent.message; // nearly exactly same as raw_message and can be omitted
            if (logevent.sub_type == 'normal') { delete logevent.sub_type; }
            if (!logevent.anonymous) { delete logevent.anonymous; }
            if (!logevent.font) { delete logevent.font; }
            if (logevent.sender) {
                const logsender = { ...logevent.sender };
                if (!logsender.age) { delete logsender.age; }
                if (!logsender.area) { delete logsender.area; }
                if (logsender.user_id == logevent.user_id) { delete logevent.user_id; }
                if (!logsender.level) { delete logsender.level; }
                if (!logsender.card) { delete logsender.card; }
                if (logsender.role == 'member') { delete logsender.role; }
                if (logsender.sex == 'unknown') { delete logsender.sex; }
                if (!logsender.title) { delete logsender.title; }
                logevent.sender = logsender;
            }
            writelog(`[MESSAGE] ${JSON.stringify(logevent)}`);
            
            // ignore bot account's main group message, because bot is also in this group
            if (event.self_id == config.selfbotid && event.group_id == config.selfgroupid) {
                return;
            }

            // CREATE TABLE `Message202209` (
            // `Id` BIGINT NOT NULL,
            // `Time` DATETIME NOT NULL,
            // `Type` VARCHAR(20) NULL,
            // `UserId` BIGINT NOT NULL,
            // `UserName` VARCHAR(100) NULL,
            // `NickName` VARCHAR(100) NULL,
            // `Content` TEXT NULL,
            // `RawContent` TEXT NULL,
            // `GroupId` BIGINT NULL,
            // CONSTRAINT `PK_Message` PRIMARY KEY (`Id`)
            // );
            // SELECT `Time`, `UserName`, `GroupId`, REPLACE(SUBSTRING(`Content`, 1, 16), '\n', '') `Content` FROM `Message` ORDER BY `Time`;
            // SELECT * FROM `Message` INTO OUTFILE '/var/lib/mysql-files/message.csv' FIELDS ENCLOSED BY '"' TERMINATED BY ';' ESCAPED BY '"' LINES TERMINATED BY '\n';
            query('INSERT INTO `Message202209` (`Id`, `Time`, `Type`, `UserId`, `UserName`, `NickName`, `Content`, `RawContent`, `GroupId`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                event.message_id,
                dayjs.unix(event.time).format('YYYY-MM-DD HH:mm:ss'),
                event.sub_type,
                event.user_id,
                event.sender?.nickname,
                event.sender?.card,
                event.message,
                // remove raw message from database if they are same
                event.raw_message == event.message ? null : event.raw_message,
                event.group_id,
            ).catch(error => writelog(`[MESSAGE] error: ${error}`));
            // api.emit('message', event);
        } else {
            writelog(`[UNKNOWN] ${eventstring}`);
        }
    });
});
wss.on('error', error => {
    writelog('wss error: ' + JSON.stringify(error));
});

let shuttingdown = false;
function shutdown() {
    if (shuttingdown) return; shuttingdown = true; // prevent reentry
    
    for (const client of wss.clients) {
        client.close();
    }

    // wait all server close
    Promise.all([
        shutdownWebInterface(),
        new Promise<void>((resolve, reject) => wss.close(error => {
            if (error) { console.log(`failed to close websocket server: ${error.message}`); reject(); }
            else { resolve(); }
        })),
    ]).then(() => {
        writelog('wacq core shutdown')
        console.log('wacq core shutdown');
        process.exit(0);
    }, () => {
        console.log('wacq core shutdown with error');
        process.exit(102);
    });
}

writelog('wacq core start');
console.log('wacq core start');
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
