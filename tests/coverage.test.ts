import { describe, expect, it } from 'vitest';
import { getRelease, release } from '../src/core/catalog';
import { validateGraph } from '../src/core/graph';
import { plan } from '../src/core/planner';
import type { Knowledge } from '../src/core/schema';

describe('领域入口发布与路线', () => {
    it('原十专题有独立样例、对照和失败检查，全部项目有阶段产出', () => {
        const old = getRelease('2026-10-20.3')!;
        const original = getRelease('2026-10-20.2')!.nodes.filter(n => n.type === 'project');
        for (const project of original) {
            const content = release.nodes.find(n => n.id === project.id)!.content;
            expect(content.example).toBeTruthy(); expect(content.expected).toBeTruthy();
            expect((content.failureChecks as string[]).length).toBeGreaterThanOrEqual(3);
            expect(old.nodes.find(n => n.id === project.id)!.content.example).toBeUndefined();
        }
        for (const project of release.nodes.filter(n => n.type === 'project')) expect((project.content.stages as unknown[]).length).toBe(3);
    });
    it('保留旧发布的真实覆盖状态与专题数', () => {
        const previous = getRelease('2026-10-20.2')!;
        expect(previous.nodes.filter(n => n.type === 'subdomain')).toHaveLength(10);
        expect(previous.nodes.find(n => n.id === 'robotics')?.content.coverage).toBe('planned');
        expect(previous.nodes.find(n => n.id === 'security-crypto')?.content.coverage).toBe('partial');
        expect(getRelease('2026-10-20.1')).toBeDefined();
    });

    it('十二领域的覆盖声明均有真实专题与明确边界', () => {
        const domains = release.nodes.filter(n => n.type === 'domain');
        expect(domains).toHaveLength(12);
        expect(release.nodes.filter(n => n.type === 'subdomain')).toHaveLength(26);
        for (const domain of domains) {
            expect(domain.content.coverageTopicIds).toBeInstanceOf(Array);
            expect((domain.content.coverageTopicIds as string[]).length).toBeGreaterThanOrEqual(2);
            expect(domain.content.coverageScope).toBeTruthy();
            expect(domain.content.remainingAreas).not.toEqual([]);
        }
    });

    it('删除项目、目标要求或来源时拒绝声明完整入口', () => {
        for (const field of ['project', 'requirements', 'source']) {
            const r = structuredClone(release);
            if (field === 'project') r.nodes = r.nodes.filter(n => n.id !== 'project-http-basics');
            if (field === 'requirements') r.requirements = r.requirements.filter(q => !(q.topicId === 'http-basics' && q.mode === 'deep'));
            if (field === 'source') r.sources.find(s => s.id === 'http')!.status = 'draft';
            expect(validateGraph(r).join(' '), field).toContain('覆盖专题');
        }
    });

    it('覆盖清单和真实导航必须一致', () => {
        const r = structuredClone(release);
        r.nodes.find(n => n.id === 'robotics')!.content.coverageTopicIds = ['http-basics'];
        expect(validateGraph(r).join(' ')).toContain('覆盖专题与导航不一致');
    });

    for (const topic of release.nodes.filter(n => n.type === 'subdomain')) {
        it(`${topic.name}：双模式可规划，未知先诊断，实践证据可复用，零预算不排任务`, () => {
            for (const mode of ['explore', 'deep'] as const) {
                const input = { topicId: topic.id, mode, knowledge: {}, profileVersion: 0, hours: 3, resources: ['电脑', '开发板'], startDate: '2026-10-20' };
                const unknown = plan(release, input);
                expect(unknown.status).toBe('ready');
                expect(unknown.projectId).toBe(`project-${topic.id}`);
                expect(unknown.gaps.some(g => g.category === 'verify')).toBe(true);
                const knowledge: Knowledge = Object.fromEntries(release.nodes.filter(n => ['skill', 'knowledge'].includes(n.type)).map(n => [n.id, { level: 4, evidenceType: 'task', evidence: '虚构局部实践证据', learningStatus: 'not_started', conflict: false }]));
                const known = plan(release, { ...input, knowledge });
                expect(known.gaps.every(g => ['reused', 'optional'].includes(g.category))).toBe(true);
                expect(plan(release, { ...input, hours: 0 }).steps).toEqual([]);
            }
            const explore = release.requirements.filter(q => q.topicId === topic.id && q.mode === 'explore');
            const deep = release.requirements.filter(q => q.topicId === topic.id && q.mode === 'deep');
            expect(deep.some(q => q.minimumEvidence === 'practice')).toBe(true);
            expect(deep.some(q => q.requiredLevel > (explore.find(x => x.nodeId === q.nodeId)?.requiredLevel ?? 0))).toBe(true);
        });
    }
});
