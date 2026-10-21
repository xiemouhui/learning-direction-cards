import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import * as s from '../src/db/store';
const now = '2026-10-20T08:00:00.000Z', input = { topicId: 'crypto-engineering', mode: 'explore' as const, hours: 5, resources: ['电脑'], startDate: '2026-10-20' };
let db: Database.Database;
beforeEach(() => { db = new Database(':memory:'); db.pragma('foreign_keys=ON'); db.exec(readFileSync('migrations/0001.sql', 'utf8')); s.createProfile(db, 'owner', now); s.createProfile(db, 'other', now); });
afterEach(() => db.close());
describe('持久化与隐私', () => {
    it('保存与重算保留显式语言支路，旧版本保持不变', () => {
        const before = s.makePlan(db, 'owner', input);
        const python = before.candidates!.find(c => c.label === 'Python 基础')!;
        const saved = s.savePath(db, 'owner', { ...input, choices: python.choices }, 0, now);
        expect(saved.plan.gaps.some(g => g.nodeId === 'python')).toBe(true);
        s.confirmKnowledge(db, 'owner', 'c', { level: 4, evidenceType: 'task', evidence: '虚构 C 实践', learningStatus: 'not_started', conflict: false }, 0, now);
        const proposal = s.propose(db, 'owner', saved.pathId, now);
        expect(proposal.next.selectedOptions).toEqual(python.choices);
        expect(proposal.next.gaps.some(g => g.nodeId === 'c')).toBe(false);
        s.applyProposal(db, 'owner', proposal.proposalId, true, now);
        const path = s.state(db, 'owner').paths[0];
        expect(path.versions).toHaveLength(2);
        expect(path.versions[0].plan).toEqual(saved.plan);
        expect(path.versions[1].plan.selectedOptions).toEqual(python.choices);
    });
    it('非法支路不能保存成另一条默认路线', () => {
        expect(() => s.savePath(db, 'owner', { ...input, branch: 'missing' }, 0, now)).toThrow('当前路线无法执行');
        expect(s.state(db, 'owner').paths).toEqual([]);
    });
    it('新路线提案不擅自补资源，旧评估快照不改写', () => {
        const a = { schemaVersion: 1 as const, answers: Array(10).fill(''), positive: ['软硬结合'], negative: [], preference: 'unknown' as const, hours: 2 };
        const assessmentId = s.saveAssessment(db, 'owner', a, now), before = s.state(db, 'owner').records.find(r => r.id === assessmentId)!.body;
        const p = s.savePath(db, 'owner', { ...input, topicId: 'embedded-basics', resources: [] }, 1, now), proposal = s.propose(db, 'owner', p.pathId, now);
        expect(proposal.next.resources).toEqual([]);
        expect(proposal.next.feasibility).toBe('limited');
        s.saveAssessment(db, 'owner', { ...a, positive: [] }, now);
        expect(s.state(db, 'owner').records.find(r => r.id === assessmentId)!.body).toEqual(before);
    });
    it('确认追加事件快照，回报本身不提高等级', () => { s.confirmKnowledge(db, 'owner', 'c', { level: 3, evidenceType: 'self', evidence: '虚构 C 项目', learningStatus: 'learning', conflict: false }, 0, now); const p = s.savePath(db, 'owner', input, 1, now); s.addRecord(db, 'owner', 'attempt', { content: '虚构完成记录' }, now, p.pathId); expect(s.knowledge(db, 'owner').c.level).toBe(3); expect(s.state(db, 'owner').records.filter(r => r.kind === 'event')).toHaveLength(1); expect(() => s.confirmKnowledge(db, 'owner', 'c', { level: 4, evidenceType: 'self', evidence: '', learningStatus: 'learning', conflict: false }, 0, now)).toThrow('画像已变化'); });
    it('个人归属不允许跨身份操作', () => { const p = s.savePath(db, 'owner', input, 0, now); expect(() => s.pathById(db, 'other', p.pathId)).toThrow('不属于'); expect(() => s.deletePath(db, 'other', p.pathId)).toThrow(); expect(s.state(db, 'other').paths).toEqual([]); });
    it('最多一个活动计划，切换保持历史', () => { const a = s.savePath(db, 'owner', input, 0, now), b = s.savePath(db, 'owner', input, 0, now); s.activatePath(db, 'owner', a.pathId, 1, now); s.activatePath(db, 'owner', b.pathId, 1, now); expect(s.state(db, 'owner').paths.filter(p => p.active)).toHaveLength(1); expect(s.state(db, 'owner').paths).toHaveLength(2); });
    it('知识与路线两次确认，拒绝不变更，接受保留历史', () => { const p = s.savePath(db, 'owner', input, 0, now); s.confirmKnowledge(db, 'owner', 'programming', { level: 3, evidenceType: 'task', evidence: '虚构任务记录', learningStatus: 'not_started', conflict: false }, 0, now); expect(s.state(db, 'owner').paths[0].version).toBe(1); const one = s.propose(db, 'owner', p.pathId, now); s.applyProposal(db, 'owner', one.proposalId, false, now); expect(s.state(db, 'owner').paths[0].version).toBe(1); const two = s.propose(db, 'owner', p.pathId, now); s.applyProposal(db, 'owner', two.proposalId, true, now); expect(s.state(db, 'owner').paths[0].versions).toHaveLength(2); expect(() => s.applyProposal(db, 'owner', two.proposalId, true, now)).toThrow('已处理'); });
    it('过期与基础版本变化不能应用提案', () => { const p = s.savePath(db, 'owner', input, 0, now), proposal = s.propose(db, 'owner', p.pathId, now); expect(() => s.applyProposal(db, 'owner', proposal.proposalId, true, '2026-10-22T08:00:00.000Z')).toThrow('过期'); });
    it('幂等键重复不重复事件；内容不同冲突；异常回滚', () => { const key = randomUUID(); const fn = () => { s.addRecord(db, 'owner', 'message', { content: '虚构' }, now); return { saved: true }; }; s.idempotent(db, 'owner', key, { a: 1 }, now, fn); s.idempotent(db, 'owner', key, { a: 1 }, now, fn); expect(s.state(db, 'owner').records).toHaveLength(1); expect(() => s.idempotent(db, 'owner', key, { a: 2 }, now, fn)).toThrow('不一致'); expect(() => s.idempotent(db, 'owner', randomUUID(), {}, now, () => { s.addRecord(db, 'owner', 'message', {}, now); throw new Error('回滚'); })).toThrow(); expect(s.state(db, 'owner').records).toHaveLength(1); });
    it('单路线级联清理记录但保留共享知识，全部删除隔离他人', () => { s.confirmKnowledge(db, 'owner', 'c', { level: 3, evidenceType: 'self', evidence: '虚构', learningStatus: 'not_started', conflict: false }, 0, now); const a = s.savePath(db, 'owner', input, 1, now); s.addRecord(db, 'owner', 'attempt', {}, now, a.pathId); s.deletePath(db, 'owner', a.pathId); expect(s.knowledge(db, 'owner').c.level).toBe(3); expect(s.state(db, 'owner').records.some(r => r.kind === 'attempt')).toBe(false); s.addRecord(db, 'other', 'message', { content: '另一虚构身份' }, now); db.prepare('DELETE FROM profiles WHERE id=?').run('owner'); expect(db.prepare('SELECT * FROM knowledge_states').all()).toEqual([]); expect(s.state(db, 'other').records).toHaveLength(1); });
    it('导出白名单排除调用日志和身份秘密', () => { s.addRecord(db, 'owner', 'agentRun', { tokens: null }, now); s.addRecord(db, 'owner', 'message', { content: '虚构消息' }, now); const e = s.exportData(db, 'owner', now); expect(e.exportSchemaVersion).toBe(1); expect(e.records.some(r => r.kind === 'agentRun')).toBe(false); expect(JSON.stringify(e)).not.toContain('profile_id'); expect(e).not.toHaveProperty('idempotency'); });
});
