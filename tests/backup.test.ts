import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../src/db/migrate';
import * as store from '../src/db/store';
import { backupPreview, parseBackup, restoreBackup } from '../src/server/backup';
import { preferences, savePreferences } from '../src/server/preferences';
import { getRelease, release } from '../src/core/catalog';
import { plan } from '../src/core/planner';
import { plannedSchema } from '../src/core/plan-schema';
const now = '2026-10-20T14:00:00.000Z';
let db: Database.Database;
beforeEach(() => { db = new Database(':memory:'); db.pragma('foreign_keys=ON'); migrate(db); for (const id of ['source', 'target', 'other']) store.createProfile(db, id, now); });
afterEach(() => db.close());
function fixture() {
  store.saveAssessment(db, 'source', { schemaVersion: 1, answers: Array(10).fill('虚构备份问卷'), positive: ['智能模型'], negative: [], preference: 'unknown', hours: 3 }, now);
  store.confirmKnowledge(db, 'source', 'c', { level: 3, evidenceType: 'task', evidence: '虚构恢复证据', learningStatus: 'learning', conflict: false }, 1, now);
  const path = store.savePath(db, 'source', { topicId: 'crypto-engineering', mode: 'explore', hours: 3, resources: ['电脑'], startDate: '2026-10-20' }, 2, now);
  store.activatePath(db, 'source', path.pathId, 1, now);
  store.addRecord(db, 'source', 'attempt', { content: '虚构任务', reportedAt: now }, now, path.pathId);
  store.addRecord(db, 'source', 'checkin', { action: 'checkin', pathId: path.pathId, content: '虚构反馈', hours: 1, completion: 3, difficulty: 2, interest: 'same', obstacle: '未知', at: now }, now, path.pathId);
  store.addRecord(db, 'source', 'message', { role: 'user', content: '虚构消息', topicId: 'crypto-engineering' }, now);
  store.propose(db, 'source', path.pathId, now);
  savePreferences(db, 'source', { provider: 'deepseek', model: 'test-model', aiEnabled: true, searchEnabled: true, searchProvider: 'deepseek' }, 0, true, now, { DEEPSEEK_API_KEY: 'test-key', MOCK_AI: '0' });
  return store.exportData(db, 'source', now);
}
describe('备份预览与原子恢复', () => {
  it('完整导出往返恢复到新身份，重映射关联、保留快照、关闭外部开关', () => {
    const backup = fixture(), preview = backupPreview(backup);
    expect(preview).toMatchObject({ pathCount: 1, knowledgeCount: 1 });
    restoreBackup(db, 'target', backup, preview.hash, 0, now);
    const source = store.state(db, 'source'), target = store.state(db, 'target');
    expect(target.knowledge).toEqual(source.knowledge); expect(target.assessment).toEqual(source.assessment);
    expect(target.paths[0].id).not.toBe(source.paths[0].id);
    expect(target.paths[0].versions[0].plan).toEqual(source.paths[0].versions[0].plan);
    expect(target.paths[0].active).toBe(1);
    expect(target.records).toHaveLength(source.records.length);
    expect(target.records.find(r => r.kind === 'checkin')).toMatchObject({ parentId: target.paths[0].id, body: { pathId: target.paths[0].id } });
    const proposal = target.records.find(r => r.kind === 'proposal')!;
    expect(proposal.body.pathId).toBe(target.paths[0].id);
    expect(preferences(db, 'target')).toMatchObject({ aiEnabled: false, searchEnabled: false });
    expect(store.state(db, 'other').records).toHaveLength(0);
    expect(db.pragma('foreign_key_check')).toEqual([]);
    expect(() => store.pathById(db, 'source', target.paths[0].id)).toThrow();
  });
  it('旧 .3 路线保留原内容，不用 .4 重算替换', () => {
    const backup = fixture(), old = plan(getRelease('2026-10-20.3')!, { knowledge: {}, profileVersion: 0, topicId: 'crypto-engineering', mode: 'explore', hours: 1, resources: ['电脑'], startDate: '2026-10-20' });
    backup.paths[0].versions[0].plan = old;
    const preview = backupPreview(backup); restoreBackup(db, 'target', backup, preview.hash, 0, now);
    expect(store.state(db, 'target').paths[0].versions[0].plan).toEqual(old);
    expect(getRelease('2026-10-20.3')!.nodes.find(n => n.id === 'project-crypto-engineering')!.content.example).toBeUndefined();
    expect(release.nodes.find(n => n.id === 'project-crypto-engineering')!.content.example).toBeTruthy();
  });
  it('非空身份拒绝覆盖，原记录保持不变', () => {
    const backup = fixture(), preview = backupPreview(backup), before = store.exportData(db, 'source', now);
    expect(() => restoreBackup(db, 'source', backup, preview.hash, 1, now)).toThrow('空白身份');
    expect(store.exportData(db, 'source', now)).toEqual(before);
  });
  it('预览后文件或身份版本变化必须重新核对', () => {
    const backup = fixture(), preview = backupPreview(backup);
    backup.records.find(r => r.kind === 'message')!.body.content = '虚构文件内容发生变化';
    expect(() => restoreBackup(db, 'target', backup, preview.hash, 0, now)).toThrow('文件已变化');
    expect(() => restoreBackup(db, 'target', backup, backupPreview(backup).hash, 1, now)).toThrow('空白身份');
  });
  it('事务中途失败完整回滚，不留下部分恢复资料', () => {
    const backup = fixture(); db.exec("CREATE TRIGGER fail_restore BEFORE INSERT ON records WHEN NEW.profile_id='target' BEGIN SELECT RAISE(ABORT,'test failure'); END");
    expect(() => restoreBackup(db, 'target', backup, backupPreview(backup).hash, 0, now)).toThrow('test failure');
    expect(store.state(db, 'target')).toMatchObject({ version: 0, assessment: null, knowledge: {}, paths: [], records: [] });
  });
  it('拒绝重复标识、断裂归属、多个活动计划、未知版本与非法引用', () => {
    const original = fixture();
    for (const corrupt of [
      (b: typeof original) => { b.records.push(b.records[0]); },
      (b: typeof original) => { b.records.find(r => r.kind === 'attempt')!.parentId = '00000000-0000-4000-8000-000000000000'; },
      (b: typeof original) => { b.paths[0].versions[0].plan.knowledgeRelease = 'unknown'; },
      (b: typeof original) => { b.paths[0].versions[0].plan.gaps[0].nodeId = 'unknown'; },
      (b: typeof original) => { b.paths[0].version = 999; },
      (b: typeof original) => { b.knowledge.unknown = b.knowledge.c; },
      (b: typeof original) => { b.knowledge.c.level = 4; },
      (b: typeof original) => { b.records.find(r => r.kind === 'message')!.body = { role: 'assistant', content: '虚构', citations: [{ id: 'x', title: 'x', url: 'javascript:alert(1)', kind: 'web', cached: false, retrievedAt: null }] }; },
    ]) { const backup = structuredClone(original); corrupt(backup); expect(() => parseBackup(backup)).toThrow(); }
  });
  it('内部日志/未知文件版本不能恢复，所有当前路线符合恢复契约', () => {
    const backup = fixture(); expect(() => parseBackup({ ...backup, exportSchemaVersion: 99 })).toThrow();
    expect(() => parseBackup({ ...backup, records: [{ ...backup.records[0], kind: 'agentRun' }] })).toThrow();
    for (const topic of release.nodes.filter(n => n.type === 'subdomain')) for (const mode of ['explore', 'deep'] as const) expect(plannedSchema.safeParse(plan(release, { knowledge: {}, profileVersion: 0, topicId: topic.id, mode, hours: 3, resources: ['电脑', '开发板'], startDate: '2026-10-20' })).success).toBe(true);
  });
});
