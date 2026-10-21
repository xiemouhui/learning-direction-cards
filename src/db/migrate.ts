import type Database from 'better-sqlite3';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

export function migrate(db: Database.Database) {
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, created_at TEXT NOT NULL)');
  for (const file of readdirSync(resolve('migrations')).filter(f => /^\d{4}\.sql$/.test(f)).sort()) {
    const version = Number(file.slice(0, 4));
    if (db.prepare('SELECT 1 FROM schema_migrations WHERE version=?').get(version)) continue;
    db.transaction(() => {
      db.exec(readFileSync(resolve('migrations', file), 'utf8'));
      db.prepare('INSERT INTO schema_migrations VALUES (?,?)').run(version, new Date().toISOString());
    })();
  }
}
