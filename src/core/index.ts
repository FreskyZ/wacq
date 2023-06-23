
import * as fs from 'fs';
import type { PoolConfig } from 'mysql';
import { setupDatabaseConnection } from '../adk/database';
import { setupLog, shutdownLog, log } from './logger';
import { setupBackend, shutdownBackend, BackendConfig } from './backend';
import { setupWebInterface, shutdownWebInterface } from './web-interface';

const config: {
    backend: BackendConfig,
    database: PoolConfig,
    socketpath: string,
} = JSON.parse(fs.readFileSync('config', 'utf-8'));

setupLog().then(() => {
    setupDatabaseConnection(config.database);
    setupBackend(config.backend).then(() => {
        setupWebInterface(config.socketpath);
        log.info('wacq core start');
        console.log('wacq core start');
    });
});

let shuttingdown = false;
function shutdown() {
    if (shuttingdown) return;
    shuttingdown = true; // prevent reentry

    setTimeout(() => {
        console.log('wacq core shutdown timeout, abort');
        process.exit(105);
    }, 30_000);

    // wait all server close
    Promise.all([
        shutdownWebInterface(),
        shutdownBackend(),
    ]).then(() => {
        log.info('wacq core shutdown')
        shutdownLog().then(() => {
            console.log('wacq core shutdown');
            process.exit(0);
        });
    }, error => {
        console.log('wacq core shutdown error: ' + error);
        process.exit(102);
    });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
