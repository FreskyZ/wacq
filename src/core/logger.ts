import * as fs from 'fs/promises';
import * as path from 'path';
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';

// logging
//
// basic usage:
//     import { log } from './logger';
//     log.info("some message");
//     log.error(some error);
// log files in approot/logs, name YYYYMMDD.log, preserve 1 week
//
// and a special event log
//     log.event(event);
// in approot/log/event, name YYYYMMDD.log, preserve 1 month

// because initialize require utc, while index do not use dayjs, so put it here
dayjs.extend(utc);
// logs are in logs directory, there is no meaning to configure it
const logsDirectory = path.resolve('logs');

interface LoggerOptions {
    readonly postfix: string, // file name postfix
    readonly flushByCount: number,
    readonly flushByInterval: number, // in second, flush when this logger is idle and has something to flush
    readonly reserveDays: number,
}

class Logger {
    private time: dayjs.Dayjs = dayjs.utc();
    private handle: fs.FileHandle = null;
    private notFlushCount: number = 0;
    // not null only when have not flush count
    private notFlushTimeout: NodeJS.Timeout = null;

    constructor(private readonly options: LoggerOptions) {}

    async init() {
        if (this.handle) {
            this.handle.close();
        }
        this.handle = await fs.open(path.join(logsDirectory,
            `${this.time.format('YYYYMMDD')}${this.options.postfix}.log`), 'a');
    }

    async deinit() {
        if (this.handle) {
            await this.flush();
            await this.handle.close();
        }
    }

    async flush() {
        this.notFlushCount = 0;
        await this.handle.sync();

        if (this.notFlushTimeout) {
            // clear timeout incase this flush is triggered by write
            // does not setup new timeout because now not flush count is 0
            clearTimeout(this.notFlushTimeout);
            this.notFlushTimeout = null;
        }
        if (!this.time.isSame(dayjs.utc(), 'date')) {
            this.time = dayjs.utc();
            await this.init(); // do not repeat init file handle
            this.notFlushTimeout = null;
        }
    }

    async cleanup() {
        for (const filename of await fs.readdir(logsDirectory)) {
            const date = dayjs.utc(path.basename(filename).slice(0, 8), 'YYYYMMDD');
            if (date.isValid() && date.add(this.options.reserveDays, 'day').isBefore(dayjs.utc(), 'date')) {
                try {
                    await fs.unlink(path.resolve(logsDirectory, filename));
                } catch {
                    // ignore
                }
            }
        }
    }

    async write(content: string) {
        this.handle.write(`[${dayjs.utc().format('HH:mm:ss')}] ${content}\n`);
        if (this.notFlushCount + 1 > this.options.flushByCount) {
            this.flush();
        } else {
            this.notFlushCount += 1;
            if (this.notFlushCount == 1) {
                this.notFlushTimeout = setTimeout(() => this.flush(), this.options.flushByInterval * 1000);
            }
        }
    }
}

type Level = 'info' | 'error' | 'event';
const levels: Record<Level, LoggerOptions> = {
    // normal log
    info: { postfix: 'I', flushByCount: 11, flushByInterval: 600, reserveDays: 7 },
    // error log, flush immediately, in that case, flush by interval is not used
    error: { postfix: 'X', flushByCount: 0, flushByInterval: 0, reserveDays: 7 },
    // event log, is written frequently, so flush by count is kind of large, preserve longer
    event: { postfix: 'E', flushByCount: 101, flushByInterval: 600, reserveDays: 30 },
};

// @ts-ignore ts does not understand object.entries, actually it does not understand reduce<>(..., {}), too
const loggers: Record<Level, Logger> =
    Object.fromEntries(Object.entries(levels).map(([level, options]) => [level, new Logger(options)]));

// try cleanup outdated logs per hour
// attention: do not promise all them, that's meaningless, just fire and forget
setInterval(() => Object.entries(loggers).map(([_, logger]) => logger.cleanup()), 3600_000).unref();

export async function setupLog() {
    await fs.mkdir('logs', { recursive: true });
    await Promise.all(Object.entries(loggers).map(([_, logger]) => logger.init()));
}
export async function shutdownLog() {
    await Promise.all(Object.entries(loggers).map(([_, logger]) => logger.deinit()));
}
// @ts-ignore again
export const log: Record<Level, (content: string) => Promise<void>> =
    Object.fromEntries(Object.entries(loggers).map(([level, logger]) => [level, logger.write.bind(logger)]));

// log and abort for all uncaught exceptions and unhandled rejections
process.on('uncaughtException', async error => {
    console.log('uncaught exception', error);
    try {
        await log.error(`uncaught exception: ${error.message}`);
    } catch {
        // nothing, this happens when logger initialize have error
    }
    process.exit(103);
});
process.on('unhandledRejection', async reason => {
    console.log('unhandled rejection', reason);
    try {
        await log.error(`unhandled rejection: ${reason}`);
    } catch {
        // nothing, this happens when logger initialize have error
    }
    process.exit(104);
});
