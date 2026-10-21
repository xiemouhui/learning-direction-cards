import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { openDatabase } from '../src/db/client';
import * as store from '../src/db/store';
import { release } from '../src/core/catalog';
import { plan } from '../src/core/planner';
import type { KnowledgeState } from '../src/core/schema';
const now = '2026-10-20T08:00:00.000Z', db = openDatabase('data/demo.db'), id = randomBytes(32).toString('hex');
const input = { topicId: 'crypto-engineering', mode: 'explore' as const, hours: 5, resources: ['电脑'], startDate: '2026-10-20' };
try {
    db.transaction(() => {
        store.createProfile(db, id, now);
        store.saveAssessment(db, id, { schemaVersion: 1, answers: ['虚构演示：网络工程背景', ...Array(9).fill('')], positive: ['安全攻防'], negative: [], preference: 'engineering', hours: 5 }, now);
        const s = (level: number, evidence: string): KnowledgeState => ({ level, evidenceType: 'self', evidence, learningStatus: 'not_started', conflict: false });
        for (const [node, state] of [['network', s(3, '虚构网络实验：能解释协议分层，不代表全部网络能力')], ['c', s(3, '虚构 C 项目：能够修改简单程序和检查结果')], ['discrete', s(1, '只接触集合与逻辑，不推定数论和概率')]] as const)
            store.confirmKnowledge(db, id, node, state, store.profile(db, id).version, now);
        const saved = store.savePath(db, id, input, store.profile(db, id).version, now);
        store.activatePath(db, id, saved.pathId, 1, now);
        store.addRecord(db, id, 'attempt', { content: '虚构验证回报：记录成熟库正常输入与篡改输入的结果，尚未确认等级。' }, now, saved.pathId);
        const beforeConfirmation = store.knowledge(db, id).aead ?? null;
        store.confirmKnowledge(db, id, 'aead', { ...s(2, '虚构任务：能解释 nonce、认证标签与失败处理；未做生产安全审计'), evidenceType: 'task' }, store.profile(db, id).version, now);
        const proposal = store.propose(db, id, saved.pathId, now);
        store.applyProposal(db, id, proposal.proposalId, true, now);
        const unknown = plan(release, { ...input, profileVersion: 0, knowledge: {} }), zero = plan(release, { ...input, profileVersion: 0, knowledge: { c: s(0, '虚构零基础'), python: s(0, '虚构零基础') } });
        const output = { notice: '全部为虚构验收资料，不是真实用户结论。', beforeConfirmation, initial: saved.plan, unknown, zero, changes: proposal.changes, final: store.state(db, id).paths[0], eventCount: store.state(db, id).records.filter(r => r.kind === 'event').length };
        mkdirSync('.local', { recursive: true });
        writeFileSync('.local/cryptography-demo.json', JSON.stringify(output, null, 2));
        console.log('密码工程闭环演示完成：C 基础复用；未知先验证；零基础先补充；回报不自动升级；单独确认知识和路线；保留版本 1 与 2。');
        console.log('虚构演示结果：.local/cryptography-demo.json；只写 data/demo.db。');
    })();
}
finally {
    db.close();
}
