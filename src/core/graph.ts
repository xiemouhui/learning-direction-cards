import { Release, releaseSchema } from './schema';
import { actionGuideSchema } from './action-guide';
export function validateGraph(input: unknown): string[] {
    const parsed = releaseSchema.safeParse(input);
    if (!parsed.success)
        return parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`);
    const r = parsed.data, errors: string[] = [], nodes = new Map(r.nodes.map(n => [n.id, n]));
    for (const [label, items] of [['节点', r.nodes], ['关系', r.edges], ['要求', r.requirements], ['来源', r.sources], ['主张', r.claims], ['条件组', r.clauses]] as const) {
        const ids = new Set<string>();
        for (const item of items) {
            if (ids.has(item.id))
                errors.push(`${label}重复：${item.id}`);
            ids.add(item.id);
        }
    }
    const sourceIds = new Set(r.sources.map(s => s.id)), claims = new Map(r.claims.map(c => [c.id, c]));
    for (const c of r.claims)
        if (!c.sourceIds.length || c.sourceIds.some(s => !sourceIds.has(s)))
            errors.push(`主张缺来源：${c.id}`);
    const checkClaims = (ids: string[], label: string) => { if (!ids.length || ids.some(c => !claims.has(c)))
        errors.push(`缺主张：${label}`); };
    for (const n of r.nodes) {
        if (n.content.actionGuide !== undefined) {
            const guide = actionGuideSchema.safeParse(n.content.actionGuide);
            if (n.type !== 'project' || !guide.success || guide.data.evidenceNodes.some(id => !['knowledge', 'skill'].includes(nodes.get(id)?.type ?? ''))) errors.push(`行动契约不合法：${n.id}`);
        }
        if (n.releaseId !== r.id)
            errors.push(`跨版本节点：${n.id}`);
        checkClaims(n.sourceClaimIds, n.id);
    }
    const semantics = new Set<string>();
    for (const e of r.edges) {
        const a = nodes.get(e.from), b = nodes.get(e.to);
        if (!a || !b) {
            errors.push(`悬空关系：${e.id}`);
            continue;
        }
        if (e.from === e.to)
            errors.push(`自环：${e.id}`);
        if (e.releaseId !== r.id)
            errors.push(`跨版本关系：${e.id}`);
        checkClaims(e.sourceClaimIds, e.id);
        const pair = e.type === 'related_to' ? [e.from, e.to].sort() : [e.from, e.to];
        const signature = JSON.stringify([e.type, pair, [...e.scope].sort()]);
        if (semantics.has(signature))
            errors.push(`语义重复：${e.id}`);
        semantics.add(signature);
        if (['prerequisite_of', 'applied_in', 'validated_by'].includes(e.type) && (!['knowledge', 'skill'].includes(a.type) || !['knowledge', 'skill', 'project'].includes(b.type)))
            errors.push(`关系类型错误：${e.id}`);
        if (e.type === 'validated_by' && (b.type !== 'project' || !e.rubric.length))
            errors.push(`验证缺 rubric：${e.id}`);
        if (e.type === 'prerequisite_of' && !e.scope.length)
            errors.push(`硬前置缺适用范围：${e.id}`);
        if (e.type === 'belongs_to' && !((a.type === 'domain' && b.type === 'major') || (a.type === 'subdomain' && b.type === 'domain') || (['knowledge', 'skill', 'project'].includes(a.type) && ['domain', 'subdomain'].includes(b.type))))
            errors.push(`导航类型错误：${e.id}`);
        if (e.type === 'related_to' && !((a.type === 'domain' && b.type === 'domain') || (['knowledge', 'skill'].includes(a.type) && ['knowledge', 'skill'].includes(b.type))))
            errors.push(`关联类型错误：${e.id}`);
    }
    for (const req of r.requirements) {
        if (nodes.get(req.topicId)?.type !== 'subdomain' || !['knowledge', 'skill'].includes(nodes.get(req.nodeId)?.type ?? ''))
            errors.push(`目标要求端点错误：${req.id}`);
        checkClaims(req.sourceClaimIds, req.id);
        if (['entry_required', 'stage_required'].includes(req.importance)) {
            const projectIds = r.edges.filter(e => e.type === 'belongs_to' && e.to === req.topicId && nodes.get(e.from)?.type === 'project').map(e => e.from);
            if (!r.edges.some(e => e.type === 'prerequisite_of' && e.from === req.nodeId && projectIds.includes(e.to) && e.scope.includes(req.objectiveKey)))
                errors.push(`必要要求缺硬前置关系：${req.id}`);
        }
    }
    for (const c of r.clauses) {
        if (!nodes.has(c.targetId))
            errors.push(`条件目标不存在：${c.id}`);
        for (const option of c.options) {
            const e = r.edges.find(e => e.id === option);
            if (!e || e.type !== 'prerequisite_of' || e.to !== c.targetId || !e.scope.includes(c.scope))
                errors.push(`条件选项不合法：${c.id}`);
        }
    }
    for (const scope of new Set(r.edges.filter(e => e.type === 'prerequisite_of').flatMap(e => e.scope))) {
        const edges = r.edges.filter(e => e.type === 'prerequisite_of' && e.scope.includes(scope));
        const visiting = new Set<string>(), done = new Set<string>();
        function visit(key: string, path: string[]) { if (visiting.has(key)) {
            errors.push(`硬前置循环 ${scope}：${[...path, key].join(' → ')}`);
            return;
        } if (done.has(key))
            return; visiting.add(key); for (const e of edges.filter(e => e.from === key))
            visit(e.to, [...path, key]); visiting.delete(key); done.add(key); }
        for (const n of nodes.keys())
            visit(n, []);
    }
    // 新版入口覆盖声明必须有实际内容；旧版归档没有此声明，继续按原规则读取。
    for (const domain of r.nodes.filter(n => n.type === 'domain' && n.content.coverageTopicIds !== undefined)) {
        const topicIds = domain.content.coverageTopicIds;
        if (!Array.isArray(topicIds) || !topicIds.length || new Set(topicIds).size !== topicIds.length || !String(domain.content.coverageScope ?? '').trim() || !Array.isArray(domain.content.remainingAreas) || !domain.content.remainingAreas.length) {
            errors.push(`覆盖声明不完整：${domain.id}`);
            continue;
        }
        const actual = r.edges.filter(e => e.type === 'belongs_to' && e.to === domain.id && nodes.get(e.from)?.type === 'subdomain').map(e => e.from);
        if (actual.some(id => !topicIds.includes(id)) || topicIds.some(id => !actual.includes(id)))
            errors.push(`覆盖专题与导航不一致：${domain.id}`);
        for (const topicId of topicIds) {
            const topic = nodes.get(topicId);
            const projects = r.edges.filter(e => e.type === 'belongs_to' && e.to === topicId).map(e => nodes.get(e.from)).filter(n => n?.type === 'project');
            const validProject = projects.some(p => p && supported(r, p.sourceClaimIds) && ['input', 'output', 'limits'].every(k => typeof p.content[k] === 'string' && String(p.content[k]).trim()) && Array.isArray(p.content.rubric) && p.content.rubric.length > 0);
            if (!topic || topic.content.domain !== domain.id || !supported(r, topic.sourceClaimIds) || !validProject)
                errors.push(`覆盖专题缺来源或验证项目：${topicId}`);
            for (const mode of ['explore', 'deep']) {
                const requirements = r.requirements.filter(q => q.topicId === topicId && q.mode === mode);
                if (!String(topic?.content[mode] ?? '').trim() || !requirements.length || requirements.some(q => q.quality !== 'verified' || !supported(r, q.sourceClaimIds)))
                    errors.push(`覆盖专题缺目标或已核验要求：${topicId}:${mode}`);
            }
        }
    }
    return [...new Set(errors)];
}
export function supported(r: Release, ids: string[]) { return ids.length > 0 && ids.every(id => { const c = r.claims.find(c => c.id === id); return c?.quality === 'verified' && c.sourceIds.length > 0 && c.sourceIds.every(s => r.sources.find(x => x.id === s)?.status === 'verified'); }); }
