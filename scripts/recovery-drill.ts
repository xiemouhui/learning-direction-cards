import Database from 'better-sqlite3';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { migrate } from '../src/db/migrate';
import * as store from '../src/db/store';
import { getRelease } from '../src/core/catalog';
import { plan } from '../src/core/planner';

async function main() {
  const root = resolve('.local/recovery-drills'); mkdirSync(root, { recursive: true });
  const directory = resolve(root, randomUUID());
  assert.ok(directory.startsWith(root + '/'.replace('/', process.platform === 'win32' ? '\\' : '/')));
  mkdirSync(directory);
  const source = resolve(directory, 'synthetic-legacy.db'), backup = resolve(directory, 'snapshot.db'), target = resolve(directory, 'restored.db');
  let db = new Database(source);
  const digest = (connection: Database.Database, tables: string[]) => createHash('sha256').update(JSON.stringify(tables.map(table => [table, connection.prepare(`SELECT * FROM "${table}" ORDER BY rowid`).all()]))).digest('hex');
  try {
    db.pragma('foreign_keys=ON'); db.pragma('journal_mode=WAL');
    db.exec(readFileSync(resolve('migrations/0001.sql'), 'utf8'));
    const now = '2026-10-21T04:00:00.000Z';
    db.prepare('INSERT INTO schema_migrations VALUES (1,?)').run(now);
    for (const id of ['synthetic-owner', 'synthetic-other']) store.createProfile(db, id, now);
    store.confirmKnowledge(db, 'synthetic-owner', 'c', { level: 2, evidenceType: 'task', evidence: '虚构旧库演练记录', learningStatus: 'learning', conflict: false }, 0, now);
    const saved = store.savePath(db, 'synthetic-owner', { topicId: 'crypto-engineering', mode: 'explore', hours: 3, resources: ['电脑'], startDate: '2026-10-21' }, 1, now);
    const oldPlan = plan(getRelease('2026-10-20.4')!, { knowledge: store.knowledge(db, 'synthetic-owner'), profileVersion: 1, topicId: 'crypto-engineering', mode: 'explore', hours: 3, resources: ['电脑'], startDate: '2026-10-21' });
    db.prepare('UPDATE path_versions SET body=? WHERE path_id=?').run(JSON.stringify(oldPlan), saved.pathId);
    store.activatePath(db, 'synthetic-owner', saved.pathId, 1, now);
    store.addRecord(db, 'synthetic-owner', 'attempt', { content: '虚构旧式回报', reportedAt: now }, now, saved.pathId);
    const oldTables = (db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name<>'schema_migrations' ORDER BY name").all() as { name: string }[]).map(r => r.name);
    const oldDigest = digest(db, oldTables);
    migrate(db); migrate(db);
    assert.equal(digest(db, oldTables), oldDigest);
    assert.equal((db.prepare('SELECT count(*) AS n FROM schema_migrations').get() as { n: number }).n, 2);
    assert.deepEqual(store.state(db, 'synthetic-owner').paths[0].versions[0].plan, oldPlan);
    const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as { name: string }[]).map(r => r.name);
    const expected = digest(db, tables);
    await db.backup(backup);
    db.prepare('DELETE FROM profiles WHERE id=?').run('synthetic-owner');
    assert.equal(store.state(db, 'synthetic-other').paths.length, 0);
    db.close();
    db = new Database(backup, { readonly: true });
    await db.backup(target); db.close();
    db = new Database(target); db.pragma('foreign_keys=ON');
    assert.equal(digest(db, tables), expected);
    assert.deepEqual(db.pragma('foreign_key_check'), []);
    assert.equal(db.pragma('integrity_check', { simple: true }), 'ok');
    assert.equal(store.state(db, 'synthetic-owner').paths[0].active, 1);
    assert.equal(store.state(db, 'synthetic-other').records.length, 0);
    assert.deepEqual(store.state(db, 'synthetic-owner').paths[0].versions[0].plan, oldPlan);
    const report = { checkedAt: new Date().toISOString(), syntheticOnly: true, legacyMigration: '0001 to 0002', migrationIdempotent: true, oldTableContentsPreserved: true, onlineBackupRestore: true, restoredTablesMatch: true, integrity: 'ok', foreignKeys: true, externalRequests: 0, productionDatabaseOpened: false };
    writeFileSync(resolve(directory, 'report.json'), JSON.stringify(report, null, 2));
    writeFileSync(resolve(root, 'latest.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
  } finally { if (db.open) db.close(); }
}
void main().catch(() => { console.error('隔离恢复演练失败；正式数据库未被打开或替换。'); process.exitCode = 1; });
