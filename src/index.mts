import { WebSocket, WebSocketServer } from 'ws';
import { start as replstart } from 'node:repl';

let socket: WebSocket;
function tome(content: string) {
    socket.send(JSON.stringify({
        action: 'send_private_msg',
        params: {
            user_id: /* config.ADMINID */ 0,
            message: content,
        },
        echo: 'tome',
    }));
}
function togroup(content: string) {
    socket.send(JSON.stringify({
        action: 'send_group_msg',
        params: {
            group_id: /* config.GROUPID */ 0,
            message: content,
        },
        echo: 'togroup',
    }));
}

const wss = new WebSocketServer({ port: 8080 });
wss.on('connection', ws => {
    socket = ws;
    ws.on('message', (data: ArrayBuffer) => {
        const event = JSON.parse(Buffer.from(data).toString()) as CQEvent;
        if (event.post_type == 'meta_event') {
            // console.log('HEARTBEAT, I THINK');
        } else if (event.post_type == 'request') {
            console.log('REQUEST', event);
        } else if (event.post_type == 'notice') {
            console.log('NOTICE', event);
        } else {
            console.log('MESSAGE', event);
        }
    });
    tome('起！');
});

const repl = replstart('> ');
repl.defineCommand('tome', tome);
repl.defineCommand('togroup', togroup);

console.log('wabot start');
