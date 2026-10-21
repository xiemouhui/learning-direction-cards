import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
export function openDatabase(file = process.env.DATABASE_URL ?? 'data/app.db', migrate = false) {
    const path = resolve(file);
    if (!migrate && !existsSync(path))
        throw new Error('数据库未初始化，请运行 pnpm db:migrate 和 pnpm db:seed。');
    if (migrate)
        mkdirSync(dirname(path), { recursive: true });
    const db = new Database(path);
    db.pragma('foreign_keys = ON');
    db.pragma('journal_mode = WAL');
    db.pragma('busy_timeout = 5000');
    return db;
}
let connection: Database.Database | undefined;
export function database() { connection ??= openDatabase(); return connection; }
export function orm() { return drizzle(database()); }
