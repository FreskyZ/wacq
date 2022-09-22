// this file is not very adk, but if I don't include this in adk, I need to copy the content every time

import * as mysql from 'mysql';

let pool: mysql.Pool;
export function setupDatabaseConnection(config: mysql.PoolConfig) {
    pool = mysql.createPool({
        ...config,
        typeCast: (field, next) => {
            if (field.type == 'BIT' && field.length == 1) {
                return field.buffer()[0] == 1;
            }
            return next();
        },
    });
}

export const QueryDateTimeFormat = {
    datetime: 'YYYY-MM-DD HH:mm:ss',
    date: 'YYYY-MM-DD',
};

// query result except array of data
export interface QueryResult {
    insertId?: number,
    affectedRows?: number,
    changedRows?: number,
}

// promisify
export async function query<T = any>(sql: string, ...params: any[]): Promise<{ fields: mysql.FieldInfo[], value: T }> {
    return await new Promise<{ fields: mysql.FieldInfo[], value: T }>((resolve, reject) => params.length == 0
        ? pool.query(sql, (err, value, fields) => err ? reject(err) : resolve({ value, fields }))
        : pool.query(sql, params, (err, value, fields) => err ? reject(err) : resolve({ value, fields })));
}
