import { describe, it, expect } from 'vitest';
import { release } from '../src/core/catalog';
import { validateGraph } from '../src/core/graph';
import { classify, plan } from '../src/core/planner';
import { Knowledge, KnowledgeState, Assessment } from '../src/core/schema';
import { recommend } from '../src/core/recommendation';
import { reminders, weekKey } from '../src/core/checkins';
const input = { knowledge: {}, profileVersion: 0, topicId: 'crypto-engineering', mode: 'explore' as const, hours: 5, resources: ['电脑'], startDate: '2026-10-20' };
const state = (level: number | null, evidenceType: KnowledgeState['evidenceType'] = 'self'): KnowledgeState => ({ level, evidenceType, evidence: '虚构测试记录', learningStatus: 'not_started', conflict: false });
describe('知识图发布约束', () => {
    it('种子全量结构合法', () => expect(validateGraph(release)).toEqual([]));
    it('拒绝重复节点、悬空和自环', () => { const r = structuredClone(release); r.nodes.push(r.nodes[0]); r.edges[0].from = 'missing'; r.edges[1].from = r.edges[1].to; const e = validateGraph(r).join(' '); expect(e).toContain('重复'); expect(e).toContain('悬空'); expect(e).toContain('自环'); });
    it('拒绝跨版本和错误关系类型', () => { const r = structuredClone(release); r.nodes[0].releaseId = 'other'; r.edges[0].type = 'validated_by'; expect(validateGraph(r).join(' ')).toContain('跨版本'); expect(validateGraph(r).join(' ')).toContain('类型错误'); });
    it('硬前置环必须定位路径；一般关联环允许', () => { const r = structuredClone(release), template = r.edges.find(e => e.type === 'prerequisite_of')!; r.edges.push({ ...template, id: 'a-b', from: 'c', to: 'python', scope: ['test'] }, { ...template, id: 'b-a', from: 'python', to: 'c', scope: ['test'] }); expect(validateGraph(r).join(' ')).toContain('硬前置循环'); const s = structuredClone(release); s.edges.push({ ...template, id: 'r1', from: 'c', to: 'python', type: 'related_to', scope: [] }, { ...template, id: 'r2', from: 'python', to: 'network', type: 'related_to', scope: [] }, { ...template, id: 'r3', from: 'network', to: 'c', type: 'related_to', scope: [] }); expect(validateGraph(s)).toEqual([]); });
    it('OR 选项必须引用真实且适用的边', () => { const r = structuredClone(release); r.clauses[0].options = ['missing']; expect(validateGraph(r).join(' ')).toContain('选项不合法'); });
});
describe('缺口与规划', () => {
    it('未知、零基础和已有基础具有不同起点', () => { const branch = release.edges.find(e => e.type === 'prerequisite_of' && e.from === 'c' && e.scope.includes('crypto-engineering:explore'))!.id; const pinned = { ...input, branch }; const unknown = plan(release, pinned), zero = plan(release, { ...pinned, knowledge: { c: state(0) } }), known = plan(release, { ...pinned, knowledge: { c: state(3) } }); expect(unknown.gaps.find(g => g.nodeId === 'c')?.category).toBe('verify'); expect(zero.gaps.find(g => g.nodeId === 'c')?.category).toBe('requiredGap'); expect(known.gaps.find(g => g.nodeId === 'c')?.category).toBe('reused'); expect(known.steps.some(s => s.nodeId === 'c')).toBe(false); });
    it('自述达标但需实践证据时仍待验证', () => { const req = release.requirements.find(r => r.topicId === 'crypto-engineering' && r.mode === 'deep')!; expect(classify(release, req, { [req.nodeId]: state(4) }).category).toBe('verify'); expect(classify(release, req, { [req.nodeId]: state(4, 'task') }).category).toBe('reused'); });
    it('冲突保留等级但转待核对，未知不等于零', () => { const req = release.requirements.find(r => r.topicId === 'ml-foundations' && r.importance === 'entry_required')!; const s = state(3); s.conflict = true; const g = classify(release, req, { [req.nodeId]: s }); expect(g.category).toBe('verify'); expect(g.level).toBe(3); });
    it('缺来源是资料不足，不能归咎用户', () => { const r = structuredClone(release); r.requirements.find(q => q.topicId === input.topicId)!.sourceClaimIds = []; const p = plan(r, input); expect(p.status).not.toBe('ready'); expect(p.gaps.some(g => g.category === 'unresolved')).toBe(true); });
    it('没有项目或依赖循环时阻塞', () => { const r = structuredClone(release); r.nodes = r.nodes.filter(n => n.id !== 'project-crypto-engineering'); expect(plan(r, input).status).toBe('blocked'); });
    it('零小时没有正时长行动，时间检查点无重复', () => { const p = plan(release, { ...input, hours: 0 }); expect(p.steps).toEqual([]); expect(p.feasibility).toBe('unscheduled'); expect(p.checkpoints[0].date).toBe('2026-11-18'); expect(p.checkpoints[1].date).toBe('2027-01-17'); });
    it('只展开适用目标的硬前置', () => { const r = structuredClone(release); const e = r.edges.find(e => e.type === 'prerequisite_of')!; r.edges.push({ ...e, id: 'irrelevant', from: 'number-theory', to: 'programming', scope: ['other:deep'] }); expect(plan(r, input).gaps.some(g => g.nodeId === 'number-theory')).toBe(false); });
    it('AND 保留认证要求；OR 优先已满足的语言分支', () => { const p = plan(release, { ...input, knowledge: { c: state(3), python: state(0) } }); expect(p.gaps.some(g => g.nodeId === 'c' && g.category === 'reused')).toBe(true); expect(p.gaps.some(g => g.nodeId === 'aead')).toBe(true); expect(p.gaps.some(g => g.nodeId === 'python')).toBe(false); });
});
describe('三维判断与反馈', () => {
    const a: Assessment = { schemaVersion: 1, answers: Array(10).fill(''), positive: ['智能模型'], negative: [], preference: 'research', hours: 0 };
    it('知识低和零预算不会降低兴趣；无总分', () => { const k: Knowledge = { python: state(0) }; const one = recommend(release, a, k)[0], two = recommend(release, { ...a, hours: 20 }, { python: state(4) })[0]; expect(one.interest).toBe(two.interest); expect(one.preparation).not.toBe(two.preparation); expect(one).not.toHaveProperty('score'); });
    it('正反向同时存在为待补信息，不判长期不适合', () => expect(recommend(release, { ...a, negative: ['智能模型'] }, {})[0].interest).toBe('待补信息'));
    it('自由文本专业身份不自动认定知识', () => { const x = recommend(release, { ...a, answers: ['网工', ...Array(9).fill('')] }, {}); expect(x.every(v => v.gaps.every(g => g.level === null))).toBe(true); });
    it('上海周一边界、同周覆盖、缺周打断', () => { expect(weekKey('2026-10-18T16:00:00Z')).toBe('2026-10-19'); const base = { completion: 1, difficulty: 5, interest: 'down' as const, content: '虚构', hours: 1, obstacle: '未知' }; expect(reminders([{ ...base, at: '2026-10-05T00:00:00Z' }, { ...base, at: '2026-10-19T00:00:00Z' }])).toEqual([]); const seq = [5, 12, 19].map(day => ({ ...base, at: `2026-10-${String(day).padStart(2, '0')}T00:00:00Z` })); expect(reminders(seq)).toHaveLength(3); expect(reminders([...seq, { ...base, completion: 5, difficulty: 1, interest: 'up', at: '2026-10-20T00:00:00Z' }])).toEqual([]); });
});
