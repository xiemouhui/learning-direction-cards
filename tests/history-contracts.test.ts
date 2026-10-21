import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { getTableName } from 'drizzle-orm';
import * as schema from '../src/db/schema';
import { migrate } from '../src/db/migrate';
import * as store from '../src/db/store';
import { replayKnowledge, revertKnowledge } from '../src/db/knowledge-history';
import { dailyUsage } from '../src/server/usage-limits';
const now = '2026-10-20T14:00:00.000Z';
const first = { level: 2, evidenceType: 'self' as const, evidence: '虚构第一次', learningStatus: 'learning' as const, conflict: false };
describe('撤销、事件重放与数据契约', () => {
  it('撤销恢复完整旧值并追加事件，旧路线保留，重放等于当前投影', () => {
    const db = new Database(':memory:'); db.pragma('foreign_keys=ON'); migrate(db);
    try {
      store.createProfile(db, 'owner', now);
      store.confirmKnowledge(db, 'owner', 'c', first, 0, now);
      const path = store.savePath(db, 'owner', { topicId: 'crypto-engineering', mode: 'explore', hours: 3, resources: ['电脑'], startDate: '2026-10-20' }, 1, now);
      const originalPlan = store.state(db, 'owner').paths[0].versions[0].plan;
      store.confirmKnowledge(db, 'owner', 'c', { ...first, level: 4, evidence: '虚构第二次', conflict: true }, 1, now);
      const target = store.state(db, 'owner').records.filter(r => r.kind === 'event').at(-1)!;
      expect(() => revertKnowledge(db, 'owner', target.id, 1, now)).toThrow('画像已变化');
      revertKnowledge(db, 'owner', target.id, 2, now);
      expect(store.knowledge(db, 'owner').c).toEqual(first);
      expect(replayKnowledge(db, 'owner')).toEqual(store.knowledge(db, 'owner'));
      expect(store.state(db, 'owner').records.filter(r => r.kind === 'event')).toHaveLength(3);
      expect(store.pathById(db, 'owner', path.pathId).version).toBe(1);
      expect(store.state(db, 'owner').paths[0].versions[0].plan).toEqual(originalPlan);
      expect(() => revertKnowledge(db, 'owner', target.id, 3, now)).toThrow('最近一次');
    } finally { db.close(); }
  });
  it('首次确认撤销到未评估，跨身份和陈旧事件不能撤销', () => {
    const db = new Database(':memory:'); db.pragma('foreign_keys=ON'); migrate(db);
    try {
      store.createProfile(db, 'owner', now); store.createProfile(db, 'other', now);
      store.confirmKnowledge(db, 'owner', 'c', first, 0, now);
      const event = store.state(db, 'owner').records.find(r => r.kind === 'event')!;
      expect(() => revertKnowledge(db, 'other', event.id, 0, now)).toThrow('不属于');
      revertKnowledge(db, 'owner', event.id, 1, now);
      expect(store.knowledge(db, 'owner')).toEqual({}); expect(replayKnowledge(db, 'owner')).toEqual({});
      expect(store.state(db, 'other').version).toBe(0);
    } finally { db.close(); }
  });
  it('北京时间跨日重置统计，未完成请求保守保留预占', () => {
    const db = new Database(':memory:'); migrate(db);
    try {
      store.createProfile(db, 'owner', now);
      store.addRecord(db, 'owner', 'agentRun', { calls: 2, searchCalls: 1 }, '2026-10-20T15:59:59.000Z');
      store.addRecord(db, 'owner', 'agentRun', { status: 'pending', calls: 0, modelReserved: 2, searchReserved: 1 }, '2026-10-20T16:00:00.000Z');
      expect(dailyUsage(db, 'owner', '2026-10-20T15:59:59.000Z')).toMatchObject({ day: '2026-10-20', modelCalls: 2, searchCalls: 1, modelReserved: 0 });
      expect(dailyUsage(db, 'owner', '2026-10-20T16:00:01.000Z')).toMatchObject({ day: '2026-10-21', modelCalls: 0, modelReserved: 2, searchReserved: 1 });
    } finally { db.close(); }
  });
  it('全部 Drizzle 表、列、复合外键及级联规则匹配实际迁移', () => {
    const db = new Database(':memory:'); db.pragma('foreign_keys=ON'); migrate(db);
    try {
      const tables = Object.values(schema).map(table => getTableConfig(table));
      const actual = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[];
      expect(tables.map(t => t.name).sort()).toEqual(actual.map(t => t.name).sort());
      for (const table of tables) {
        const columns = db.prepare(`PRAGMA table_info("${table.name}")`).all() as { name: string }[];
        expect(table.columns.map(c => c.name).sort()).toEqual(columns.map(c => c.name).sort());
        const fks = db.prepare(`PRAGMA foreign_key_list("${table.name}")`).all() as { id: number; seq: number; table: string; from: string; to: string; on_delete: string }[];
        const expected = table.foreignKeys.flatMap(fk => { const ref = fk.reference(); return ref.columns.map((col, seq) => `${getTableName(ref.foreignTable)}:${col.name}:${ref.foreignColumns[seq].name}:${(fk.onDelete ?? 'no action').toUpperCase()}`); }).sort();
        expect(fks.map(fk => `${fk.table}:${fk.from}:${fk.to}:${fk.on_delete}`).sort()).toEqual(expected);
      }
    } finally { db.close(); }
  });
});
