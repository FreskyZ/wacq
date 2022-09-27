import { EventEmitter } from 'events';
import * as dayjs from 'dayjs';
import { v4 as uuid } from 'uuid';
import { WebSocket, WebSocketServer } from 'ws';
import { query } from '../adk/database';
import { log } from './logger';

// interaction with base serivce (go-cqhttp)

export interface MetaEvent {
    time: number,
    self_id: number,
    post_type: 'meta_event',
    meta_event_type: string,
}
export interface RequestEvent {
    time: number,
    self_id: number,
    post_type: 'request',
    request_type: string, 
}
export interface NoticeEvent {
    time: number,
    self_id: number,
    post_type: 'notice',
    notice_type: string,
}
export interface MessageEvent {
    time: number,
    self_id: number,
    post_type: 'message' | 'message_sent',
    message_type: 'group' | 'private' | 'guild',
    sub_type: 'friend' | 'group' | 'group_self' | 'other' | 'normal' | 'anonymous' | 'notice',
    message_id: number,
    user_id: number,
    message: string,
    raw_message: string,
    font: number,
    group_id: number,
    anonymous: any,
    sender: MessageSender,
}

export interface MessageSender {
    user_id: number,
    nickname: string,
    sex: string,
    age: number,
    card?: string, // nickname in group
    area?: string,
    level?: string,
    role?: string,
    title?: string,
}

export interface ResponseOkEvent {
    status: 'ok',
    retcode: 0,
    data: any,
    echo?: string,
}

export interface ResponseAsyncEvent {
    status: 'async',
    retcode: 1,
    echo?: string,
}

export interface ResponseFailedEvent {
    status: 'failed',
    retcode: number,
    msg: string,
    workding: string,
    data: any,
    echo?: string,
}

export type ResponseEvent = ResponseOkEvent | ResponseAsyncEvent | ResponseFailedEvent;
export type Event = MetaEvent | RequestEvent | NoticeEvent | MessageEvent | ResponseEvent;

// interface MyClassEvents {
//     'add': (el: string, wasNew: boolean) => void;
//     'delete': (changedCount: number) => void;
//   }
// declare interface MyClass {
//     on<U extends keyof MyClassEvents>(
//         event: U, listener: MyClassEvents[U]
//     ): this;

//     emit<U extends keyof MyClassEvents>(
//         event: U, ...args: Parameters<MyClassEvents[U]>
//     ): boolean;
// }

export declare interface Backend {
    call(action: 'send_private_msg', params: { user_id: number, message: string }): Promise<{ message_id: number }>;
    call(action: 'send_group_msg', params: { group_id: number, message: string }): Promise<{ message_id: number }>;
}

export class Backend extends EventEmitter {
    constructor(
        private readonly mainConnection: WebSocket,
        // @ts-ignore not used for now
        private readonly botoConnection: WebSocket,
    ) { super(); }

    public async call(action: string, params: any): Promise<any> {
        // uuid can be an u128 if it is binary protocol, but this is json protocol and bigint need to
        // be converted to string then that's no difference (or even more complex) compare to uuid string format
        const requestId = uuid();
        this.mainConnection.send(JSON.stringify({ action, params, echo: requestId }));
        // TODO wait response event or timeout
    }
}

function handleBackendEvent(this: BackendConfig, payload: ArrayBuffer) {
    const eventstring = Buffer.from(payload).toString();
    const event = JSON.parse(eventstring) as Event;

    if ('retcode' in event) {
        log.event(`[RESPONSE] ${eventstring}`);
    } else if (event.post_type == 'meta_event') {
        // console.log('HEARTBEAT, I THINK');
        // actually there is other meta event like connected
        // but the amount of heartbeat event is too much so completely ignored
    } else if (event.post_type == 'request') {
        log.event(`[REQUEST] ${eventstring}`);
    } else if (event.post_type == 'notice') {
        if ('guild_id' in event) {
            // this is about guild, also discard
            return;
        }
        log.event(`[NOTICE] ${eventstring}`);
    } else if (event.post_type == 'message' || event.post_type == 'message_sent') {
        if (event.message_type == 'guild') {
            // completely discard guild message
            return;
        }

        // duplicate and remove empty/common values
        const logevent = { ...event };
        delete logevent.post_type;
        delete logevent.self_id; // self id is config.mainid
        delete logevent.time; // should be near log time and can be omitted
        delete logevent.message; // nearly exactly same as raw_message and can be omitted
        if (logevent.message_type == 'group') { delete logevent.message_type; }
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
        log.event(`[MESSAGE] ${JSON.stringify(logevent)}`);
        
        // ignore bot account's main group message, because bot is also in this group
        if (event.self_id == this.botoid && event.group_id == this.groupid) {
            return;
        }

        event.message = event.message.replaceAll('&amp;', '&').replaceAll('&#91;', '[').replaceAll('&#93;', ']').replaceAll('&#44;', ',');
        event.raw_message = event.raw_message.replaceAll('&amp;', '&').replaceAll('&#91;', '[').replaceAll('&#93;', ']').replaceAll('&#44;', ',');

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
        ).catch(error => log.error(`[MESSAGE] error: ${error}`));
        // api.emit('message', event);
    } else {
        log.event(`[UNKNOWN] ${eventstring}`);
    }
}

export interface BackendConfig {
    port: number,
    mainid: number,
    botoid: number,
    groupid: number,
}

export let backend: Backend;
let socketServer: WebSocketServer;
let mainConnection: WebSocket = null;
let botoConnection: WebSocket = null;

export async function setupBackend(config: BackendConfig): Promise<void> {
    return new Promise((resolve, reject) => {
        // 30 second connection timeout, which means backend gocq service may error
        setTimeout(() => reject(new Error('backend connection timeout')), 30_000);

        socketServer = new WebSocketServer({ port: config.port });
        socketServer.on('error', error => {
            log.error(`websocket server error: ${error.message}`);
        });
        socketServer.on('connection', (connection, underlyingRequest) => {
            log.info(`backend connected from ${underlyingRequest.url}`);
            if (underlyingRequest.url == '/main/') {
                mainConnection = connection;
            } else if (underlyingRequest.url == '/boto/') {
                botoConnection = connection;
            }
            if (mainConnection && botoConnection) {
                backend = new Backend(mainConnection, botoConnection);
                resolve();
            }
            connection.on('message', handleBackendEvent.bind(config));
        });
    });
}

export async function shutdownBackend(): Promise<void> {
    for (const connections of socketServer.clients) {
        connections.close();
    }
    return new Promise((resolve, reject) => {
        socketServer.close(error => {
            if (error) {
                log.error(`failed to close websocket server: ${error.message}`);
                reject();
            } else {
                resolve();
            }
        });
    });
}
