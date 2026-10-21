import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../src/db/migrate';
import * as store from '../src/db/store';
import { saveAttempt } from '../src/db/task-attempt';
import { release, getRelease } from '../src/core/catalog';
import { actionGuide } from '../src/core/action-guide';
import { validateGraph } from '../src/core/graph';
import { backupPreview, parseBackup, restoreBackup } from '../src/server/backup';
const now = '2026-10-21T04:00:00.000Z';
const evidence = { pathVersion: 1, stepIndex: 0, environment: '虚构本地环境', expected: '预期记录', actual: '实际失败', independent: '独立观察', limits: '尚未验证', minutes: 15 };
function fixture(hours = 3, resources = ['电脑']) {
  const db = new Database(':memory:'); db.pragma('foreign_keys=ON'); migrate(db);
  store.createProfile(db, 'owner', now); store.createProfile(db, 'other', now);
  const path = store.savePath(db, 'owner', { topicId: 'crypto-engineering', mode: 'explore', hours, resources, startDate: '2026-10-21' }, 0, now);
  return { db, path };
}
describe('行动证据与试点任务', () => {
  it('三个试点均具备任务契约，旧发布原文不变，未知知识引用被阻止', () => {
    expect(validateGraph(release)).toEqual([]);
    for (const topic of ['ml-foundations', 'http-basics', 'crypto-engineering']) {
      expect(actionGuide(release.nodes.find(n => n.id === `project-${topic}`))).not.toBeNull();
      expect(actionGuide(getRelease('2026-10-20.4')!.nodes.find(n => n.id === `project-${topic}`))).toBeNull();
    }
    const invalid = structuredClone(release);
    (invalid.nodes.find(n => n.id === 'project-ml-foundations')!.content.actionGuide as { evidenceNodes: string[] }).evidenceNodes.push('unknown');
    expect(validateGraph(invalid).some(s => s.includes('行动契约'))).toBe(true);
  });
  it('服务器记录路线版本与行动关联，回报不提升画像或改变路线', () => {
    const { db, path } = fixture();
    try {
      const before = store.state(db, 'owner');
      saveAttempt(db, 'owner', path.pathId, '虚构行动回报', now, evidence);
      const after = store.state(db, 'owner');
      expect(after.version).toBe(before.version); expect(after.knowledge).toEqual(before.knowledge); expect(after.paths).toEqual(before.paths);
      expect(after.records.at(-1)?.body.context).toMatchObject({ evidence, nodeIds: [path.plan.steps[0].nodeId], knowledgeRelease: release.id });
      const index = path.plan.steps.findIndex(s => s.nodeId === path.plan.projectId);
      saveAttempt(db, 'owner', path.pathId, '虚构项目回报', now, { ...evidence, stepIndex: index });
      expect(store.state(db, 'owner').records.at(-1)?.body.context).toMatchObject({ nodeIds: ['aead'] });
    } finally { db.close(); }
  });
  it('他人路线、陈旧版本、越界行动和非法记录不落库', () => {
    const { db, path } = fixture();
    try {
      expect(() => saveAttempt(db, 'other', path.pathId, '虚构', now, evidence)).toThrow();
      expect(() => saveAttempt(db, 'owner', path.pathId, '虚构', now, { ...evidence, pathVersion: 2 })).toThrow('路线已变化');
      expect(() => saveAttempt(db, 'owner', path.pathId, '虚构', now, { ...evidence, stepIndex: path.plan.steps.length })).toThrow('行动不在');
      expect(() => saveAttempt(db, 'owner', path.pathId, '虚构', now, { ...evidence, actual: '' })).toThrow();
      expect(store.state(db, 'owner').records).toHaveLength(0);
    } finally { db.close(); }
  });
  it('零预算与缺资源阻止结构化行动，仍可保留旧式困难回报', () => {
    for (const [hours, resources] of [[0, ['电脑']], [3, []]] as const) {
      const { db, path } = fixture(hours, [...resources]);
      try { expect(() => saveAttempt(db, 'owner', path.pathId, '虚构', now, evidence)).toThrow('行动条件'); saveAttempt(db, 'owner', path.pathId, '虚构缺项', now); expect(store.state(db, 'owner').records).toHaveLength(1); } finally { db.close(); }
    }
  });
  it('新证据往返恢复保留版本，旧回报兼容，损坏关联拒绝', () => {
    const { db, path } = fixture();
    try {
      saveAttempt(db, 'owner', path.pathId, '虚构结构化', now, evidence); saveAttempt(db, 'owner', path.pathId, '虚构旧回报', now);
      const exported = store.exportData(db, 'owner', now), preview = backupPreview(exported);
      restoreBackup(db, 'other', exported, preview.hash, 0, now);
      expect(store.state(db, 'other').records[0].body.context).toEqual(store.state(db, 'owner').records[0].body.context);
      expect(store.state(db, 'other').records[1].body.content).toBe('虚构旧回报');
      const bad = structuredClone(exported);
      (bad.records[0].body.context as { evidence: { pathVersion: number } }).evidence.pathVersion = 999;
      expect(() => parseBackup(bad)).toThrow('任务证据');
      const wrongNode = structuredClone(exported);
      (wrongNode.records[0].body.context as { nodeIds: string[] }).nodeIds = ['aead'];
      expect(() => parseBackup(wrongNode)).toThrow('所选行动');
    } finally { db.close(); }
  });
});
