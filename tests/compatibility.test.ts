import { it, expect } from 'vitest';
import { migrateLegacy } from '../src/core/legacy';
import { plan } from '../src/core/planner';
import { release } from '../src/core/catalog';
it('虚构旧数据保留分数与计划，仅显式映射专题，不从课程推定掌握', () => {
    const old = { majorId: 'net', score: 81, plan: { text: '虚构旧计划' }, subdirectionId: 'old-crypto', courses: ['C语言'], derivedTags: ['数学好'] };
    const next = migrateLegacy(old, {});
    expect(next.legacySnapshot).toEqual(old);
    expect(next.knowledge).toEqual({});
    expect(next.topicId).toBeNull();
    expect(next.needsConfirmation).toBe(true);
    expect(migrateLegacy(old, { 'old-crypto': 'modern-crypto' }).topicId).toBe('modern-crypto');
});
it('有限候选截断提示不能宣称全局无路，非法支路不采用', () => {
    const r = structuredClone(release);
    const template = r.edges.find(e => e.type === 'prerequisite_of' && e.from === 'c' && e.scope.includes('crypto-engineering:explore'))!;
    const clause = r.clauses.find(c => c.scope === 'crypto-engineering:explore' && c.options.includes(template.id))!;
    for (const node of ['programming', 'network', 'linux']) {
        r.edges.push({ ...template, id: `extra:${node}`, from: node });
        clause.options.push(`extra:${node}`);
    }
    const result = plan(r, { knowledge: {}, profileVersion: 0, topicId: 'crypto-engineering', mode: 'explore', hours: 0, resources: [], startDate: '2026-10-20' });
    expect(result.searchLimited).toBe(true);
    expect(result.status).not.toBe('blocked');
    expect(result.steps).toEqual([]);
});
it('缺少必要关系必须安全降级，零点五小时的尝试时间不越预算', () => {
    const r = structuredClone(release);
    r.edges = r.edges.filter(e => !(e.type === 'prerequisite_of' && e.from === 'aead'));
    const result = plan(r, { knowledge: {}, profileVersion: 0, topicId: 'crypto-engineering', mode: 'explore', hours: .5, resources: ['电脑'], startDate: '2026-10-20' });
    expect(result.status).not.toBe('ready');
    expect(result.issues.some(x => x.includes('缺硬前置'))).toBe(true);
    expect(result.steps.reduce((sum, s) => sum + (s.minutes ?? 0), 0)).toBeLessThanOrEqual(30);
});
