// server side web interface common

import * as fs from 'fs';
import * as net from 'net';
import * as dayjs from 'dayjs';
import { FineError } from './error';
import { UserCredential } from './auth';

export const dateFormat = 'YYYYMMDD';
export const timeFormat = 'YYYYMMDDHHmmdd';

export interface Context {
    user: UserCredential,
}

export interface ForwardContext {
    method: string,
    // GET api.domain.com/app1/v1/getsomething
    //           this part:   ^^^^^^^^^^^^^^^^
    path: string,
    body: any,
    state: Context,
    status?: number,
    error?: FineError,
}

export function validateNumber(name: string, raw: string): number {
    const result = parseInt(raw);
    if (isNaN(result)) {
        throw new FineError('common', `invalid parameter ${name} value ${raw}`);
    }
    return result;
}

export function validateId(name: string, raw: string): number {
    const result = parseInt(raw);
    if (isNaN(result) || result <= 0) {
        throw new FineError('common', `invalid parameter ${name} value ${raw}`);
    }
    return result;
}

export function validateDate(name: string, raw: string): dayjs.Dayjs {
    const result = dayjs(raw, dateFormat);
    if (!result.isValid()) {
        throw new FineError('common', `invalid parameter ${name} value ${raw}`);
    }
    return result;
}

export function validateTime(name: string, raw: string): dayjs.Dayjs {
    const result = dayjs(raw, timeFormat);
    if (!result.isValid()) {
        throw new FineError('common', `invalid parameter ${name} value ${raw}`);
    }
    return result;
}

export function validateBody<T>(body: any): T {
    if (!body || Object.keys(body).length == 0) {
        throw new FineError('common', 'invalid empty body');
    }
    return body;
}

let server: net.Server;
const connections: net.Socket[] = [];

export function setupWebInterface<T>(path: string, dispatch: (ctx: ForwardContext, impl: T) => Promise<void>, impl: T) {
    server = net.createServer();
    server.on('error', error => {
        console.log(`socket server error: ${error.message}`);
    });
    server.on('connection', connection => {
        connections.push(connection);

        connection.on('close', () => {
            connections.splice(connections.indexOf(connection), 1);
        });
        connection.on('error', error => {
            console.log(`socket connection error: ${error.message}`);
        });
        connection.on('data', async data => {
            const payload = data.toString('utf-8');

            let ctx = {} as ForwardContext;
            try {
                ctx = JSON.parse(payload);
            } catch {
                console.log('socket server failed to parse payload: ' + payload);
            }

            try {
                await dispatch(ctx, impl);
            } catch (error) {
                if (error instanceof FineError) {
                    ctx.error = error;
                } else {
                    console.log(error);
                    ctx.error = new FineError('internal', error.message);
                }
            } finally {
                delete ctx.path;
                delete ctx.state;
                delete ctx.method;
                connection.write(JSON.stringify(ctx));
            }
        });
    });
    if (fs.existsSync(path)) {
        fs.unlinkSync(path);
    }
    server.listen(path);
}

export function shutdownWebInterface(): Promise<void> {
    for (const socket of connections) {
        socket.destroy();
    }
    return new Promise<void>((resolve, reject) => server.close(error => {
        if (error) { console.log(`failed to close socket server: ${error.message}`); reject(); }
        else { resolve(); }
    }));
}
