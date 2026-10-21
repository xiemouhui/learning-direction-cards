import { describe, expect, it } from 'vitest';
import { release } from '../src/core/catalog';
import { plan } from '../src/core/planner';
import { validateGraph } from '../src/core/graph';
import type { KnowledgeState } from '../src/core/schema';

const input = { knowledge: {}, profileVersion: 0, topicId: 'crypto-engineering', mode: 'explore' as const, hours: 3, resources: ['电脑'], startDate: '2026-10-20' };
const state = (level: number, evidenceType: KnowledgeState['evidenceType'] = 'self'): KnowledgeState => ({ level, evidenceType, evidence: '虚构测试证据', conflict: false, learningStatus: 'not_started' });
const language = release.clauses.find(c => c.scope === 'crypto-engineering:explore' && c.id.endsWith(':language'))!;
const option = (nodeId: string) => language.options.find(id => release.edges.find(e => e.id === id)?.from === nodeId)!;

describe('有限候选与显式支路', () => {
    it('两条完整语言路线均保留 AND 条件，只包含所选 OR 分支', () => {
        const p = plan(release, input);
        expect(p.candidates).toHaveLength(2);
        expect(p.searchLimited).toBe(false);
        for (const candidate of p.candidates!) {
            const chosen = plan(release, { ...input, choices: candidate.choices });
            expect(chosen.selectedOptions).toEqual(candidate.choices);
            expect(chosen.gaps.some(g => g.nodeId === 'aead')).toBe(true);
            expect(chosen.gaps.filter(g => ['c', 'python'].includes(g.nodeId))).toHaveLength(1);
        }
    });
    it('默认减少已知必要缺口，但显式选择仍保留原语言', () => {
        const knowledge = { c: state(0) };
        const p = plan(release, { ...input, knowledge });
        expect(p.selectedOptions?.[language.id]).toBe(option('python'));
        const pinned = plan(release, { ...input, knowledge, choices: { [language.id]: option('c') } });
        expect(pinned.gaps.find(g => g.nodeId === 'c')?.category).toBe('requiredGap');
        expect(pinned.selectedOptions?.[language.id]).toBe(option('c'));
    });
    it('深入目标按所需实践证据判断达标，不能只比较自评等级', () => {
        const p = plan(release, { ...input, mode: 'deep', knowledge: { c: state(4), python: state(3, 'task') } });
        expect(p.gaps.find(g => g.nodeId === 'python')?.category).toBe('reused');
        expect(p.candidates!.find(c => c.label === 'C / C++ 基础')!.diagnostics).toBeGreaterThan(p.candidates!.find(c => c.label === 'Python 基础')!.diagnostics);
    });
    it('优先资源可用分支，并逐候选保留缺失资源', () => {
        const r = structuredClone(release);
        r.nodes.find(n => n.id === 'c')!.content.resource = '开发板';
        const p = plan(r, input);
        expect(p.selectedOptions?.[language.id]).toBe(option('python'));
        expect(p.candidates!.find(c => c.label === 'C / C++ 基础')!.missingResources).toEqual(['开发板']);
        expect(p.candidates!.find(c => c.label === 'C / C++ 基础')!.feasibility).toBe('limited');
    });
    it('比较前置闭包新增缺口；达标节点不强制重学其前置', () => {
        const r = structuredClone(release), e = r.edges.find(e => e.id === option('c'))!;
        r.edges.push({ ...e, id: 'extra-linux-c', from: 'linux', to: 'c' });
        r.clauses.push({ id: 'extra-linux-clause', targetId: 'c', scope: 'crypto-engineering:explore', options: ['extra-linux-c'] });
        expect(validateGraph(r)).toEqual([]);
        const p = plan(r, { ...input, knowledge: { linux: state(0) } });
        expect(p.selectedOptions?.[language.id]).toBe(option('python'));
        const reused = plan(r, { ...input, knowledge: { c: state(3), linux: state(0) } });
        expect(reused.gaps.some(g => g.nodeId === 'linux')).toBe(false);
    });
    it('多个 OR 组保留完整组合，截断后仍可显式选择任一合法组合', () => {
        const r = structuredClone(release), e = r.edges.find(e => e.id === option('c'))!;
        r.edges.push({ ...e, id: 'extra-language', from: 'programming' });
        r.clauses.find(c => c.id === language.id)!.options.push('extra-language');
        const options = ['linux', 'network', 'probability'].map(from => { const id = `extra-second-${from}`; r.edges.push({ ...e, id, from }); return id; });
        const second = { id: 'extra-second', targetId: e.to, scope: 'crypto-engineering:explore', options };
        r.clauses.push(second);
        expect(validateGraph(r)).toEqual([]);
        const p = plan(r, input);
        expect(p.candidates).toHaveLength(3);
        expect(new Set(p.candidates!.map(c => c.id)).size).toBe(3);
        expect(p.searchLimited).toBe(true);
        for (const c of p.candidates!) expect(Object.keys(c.choices)).toHaveLength(2);
        const chosen = { [language.id]: 'extra-language', [second.id]: options[2] };
        const outside = plan(r, { ...input, choices: chosen });
        expect(outside.selectedOptions).toEqual(chosen);
        expect(outside.candidates!.some(c => JSON.stringify(c.choices) === JSON.stringify(outside.selectedOptions))).toBe(true);
        expect(outside.gaps.some(g => g.nodeId === 'aead')).toBe(true);
        expect(outside.gaps.some(g => g.nodeId === 'probability')).toBe(true);
    });
    it('不因陌生入口下有更多已知基础，就放弃已经达标的入口', () => {
        const r = structuredClone(release), template = r.edges.find(e => e.id === option('python'))!;
        for (const [index, pair] of [['linux', 'network'], ['probability', 'discrete']].entries()) {
            const options = pair.map(from => { const id = `nested-${index}-${from}`; r.edges.push({ ...template, id, from, to: 'python' }); return id; });
            r.clauses.push({ id: `nested-${index}`, targetId: 'python', scope: 'crypto-engineering:explore', options });
        }
        expect(validateGraph(r)).toEqual([]);
        const knowledge = Object.fromEntries(['c', 'linux', 'network', 'probability', 'discrete'].map(id => [id, state(3)]));
        expect(plan(r, { ...input, knowledge }).selectedOptions?.[language.id]).toBe(option('c'));
    });
    it('非法、跨模式或未核验支路阻塞，不能静默替换', () => {
        const bad = plan(release, { ...input, choices: { [language.id]: 'not-an-option' } });
        expect(bad.status).toBe('blocked'); expect(bad.steps).toEqual([]);
        expect(plan(release, { ...input, mode: 'deep', choices: { [language.id]: option('c') } }).status).toBe('blocked');
        const r = structuredClone(release); r.sources.find(s => s.id === 'openssl')!.status = 'draft';
        expect(plan(r, { ...input, choices: { [language.id]: option('c') } }).status).toBe('blocked');
    });
    it('候选、顺序与 ID 稳定，零预算不安排任何行动', () => {
        const a = plan(release, { ...input, hours: 0 }), b = plan(release, { ...input, hours: 0 });
        expect(a).toEqual(b);
        for (const candidate of a.candidates!) expect(plan(release, { ...input, hours: 0, choices: candidate.choices }).steps).toEqual([]);
    });
});
