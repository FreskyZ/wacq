import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import * as mysql from 'mysql';
import { WebSocket, WebSocketServer } from 'ws';
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
    logfile.write(`[${dayjs().format('hh:mm:ss')}] ${content}\n`);
}

const config: {
    selfid: string,
    selfbotid: string,
    selfgroupid: string,
    database: mysql.PoolConfig,
} = JSON.parse(fs.readFileSync('config', 'utf-8'));

const pool = mysql.createPool({
    ...config.database,
    typeCast: (field, next) => {
        if (field.type == 'BIT' && field.length == 1) {
            return field.buffer()![0] == 1;
        }
        return next();
    },
});
process.on('exit', () => { pool.end(); });

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
let api: API;

const wss = new WebSocketServer({ port: 8080 });
wss.on('connection', ws => {
    api = new API(ws);

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
        } else if (event.post_type == 'message') {
            if (event.message_type == 'guild') {
                // completely discard guild message
                return;
            }

            writelog(`[MESSAGE] ${eventstring}`);
            // CREATE TABLE `Message` (
            // `Id` BIGINT NOT NULL,
            // `Time` DATETIME NOT NULL,
            // `Type` VARCHAR(20) NULL,
            // `UserId` BIGINT NOT NULL,
            // `UserName` VARCHAR(100) NULL,
            // `Content` TEXT NULL,
            // `RawContent` TEXT NULL,
            // `GroupId` BIGINT NULL,
            // CONSTRAINT `PK_Message` PRIMARY KEY (`Id`)
            // );
            // SELECT `Time`, `UserName`, `GroupId`, REPLACE(SUBSTRING(`Content`, 1, 16), '\n', '') `Content` FROM `Message` ORDER BY `Time`;
            // SELECT * FROM `Message` INTO OUTFILE '/var/lib/mysql-files/message.csv' FIELDS ENCLOSED BY '"' TERMINATED BY ';' ESCAPED BY '"' LINES TERMINATED BY '\n';
            pool.query('INSERT INTO `Message` (`Id`, `Time`, `Type`, `UserId`, `UserName`, `Content`, `RawContent`, `GroupId`) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [
                event.message_id,
                dayjs.unix(event.time).format('YYYY-MM-DD HH:mm:ss'),
                event.sub_type,
                event.user_id,
                event.sender?.nickname,
                event.message,
                event.raw_message,
                event.group_id,
            ], (err, _value, _fields) => {
                if (err) {
                    writelog(`[MESSAGE] error: ${err}`);
                }
            });
            api.emit('message', event);
        } else {
            writelog(`[UNKNOWN] ${eventstring}`);
        }
    });

    // api.send_private_message(api.adminid, '起！');

    // new EchoPlugin(api);
});
wss.on('error', error => {
    writelog('wss error: ' + JSON.stringify(error));
});

function shutdown() {
    for (const client of wss.clients) {
        client.close();
    }
    wss.close(error => {
        if (error) { 
            writelog(`close websocket server error: ${error.message}`);
            process.exit(102);
        } else {
            writelog('wacq start');
            console.log('wacq stop');
            process.exit(0);
        }
    });
}

writelog('wacq start');
console.log('wacq start');
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
