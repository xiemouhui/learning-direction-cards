import { Assessment, Knowledge, Release } from './schema';
import { plan } from './planner';
export function recommend(r: Release, a: Assessment | null, k: Knowledge) {
    return r.nodes.filter(n => n.type === 'domain' && n.content.coverage !== 'planned').map(domain => {
        const tags = (domain.content.tags as string[]) ?? [], positive = tags.filter(t => a?.positive.includes(t)), negative = tags.filter(t => a?.negative.includes(t));
        const interest = positive.length && negative.length ? '待补信息' : positive.length ? (a?.preference !== 'unknown' && a?.preference ? '优先尝试' : '可以尝试') : negative.length ? '当前兴趣较弱' : '待补信息';
        const topic = r.nodes.find(n => n.type === 'subdomain' && n.content.domain === domain.id);
        const gaps = topic ? plan(r, { knowledge: k, profileVersion: 0, topicId: topic.id, mode: 'explore', hours: a?.hours ?? 0, resources: [], startDate: r.createdAt.slice(0, 10) }).gaps.filter(g => g.importance === 'entry_required') : [];
        const preparation = gaps.some(g => g.category === 'requiredGap') ? '建议先补相关基础' : gaps.some(g => ['verify', 'unresolved'].includes(g.category)) ? '需要进一步验证／补信息' : '可开始当前验证任务';
        const interestKnown = positive.length + negative.length > 0, knowledgeKnown = gaps.length > 0 && gaps.every(g => g.level !== null), constraintKnown = a?.hours !== null && a?.hours !== undefined;
        const coverage = [interestKnown, knowledgeKnown, constraintKnown];
        return { domain, topic, interest, preparation, evidence: coverage.every(Boolean) ? '相对充分' : coverage.some(Boolean) ? '部分' : '不足', positive, negative, gaps, coverage, limitation: '课程与自述不等于独立实践证明；本判断仅针对展示的具体入口。' };
    });
}
