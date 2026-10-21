import { Knowledge, Release, Requirement } from './schema';
import { supported, validateGraph } from './graph';
export type GapCategory = 'reused' | 'verify' | 'requiredGap' | 'recommendedGap' | 'optional' | 'unresolved';
export type Gap = {
    nodeId: string;
    name: string;
    category: GapCategory;
    requiredLevel: number;
    level: number | null;
    importance: Requirement['importance'];
    reason: string;
    sourceClaimIds: string[];
};
export type PlanInput = {
    knowledge: Knowledge;
    profileVersion: number;
    topicId: string;
    mode: 'explore' | 'deep';
    hours: number;
    resources: string[];
    startDate: string;
    branch?: string;
    choices?: Record<string, string>;
};
export const PLANNER_VERSION = '1.1.0';
export type BranchGroup = {
    id: string; targetName: string; selectedEdgeId: string;
    options: { edgeId: string; nodeId: string; name: string; category: GapCategory }[];
};
export type Candidate = {
    id: string; label: string; choices: Record<string, string>;
    reused: number; requiredGaps: number; diagnostics: number; missingResources: string[];
    status: Planned['status']; feasibility: Planned['feasibility']; reason: string;
};
export type Planned = {
    schemaVersion: 1;
    plannerVersion: string;
    rubricVersion: string;
    knowledgeRelease: string;
    profileVersion: number;
    topicId: string;
    mode: string;
    objectiveKey: string;
    status: 'ready' | 'partial' | 'blocked';
    feasibility: 'feasible' | 'limited' | 'unscheduled';
    hours: number;
    resources: string[];
    startDate: string;
    gaps: Gap[];
    steps: {
        nodeId: string;
        action: string;
        condition: string;
        minutes: number | null;
    }[];
    projectId: string | null;
    issues: string[];
    searchLimited: boolean;
    alternatives: string[];
    selectedOptions?: Record<string, string>;
    branchGroups?: BranchGroup[];
    candidates?: Candidate[];
    missingResources?: string[];
    checkpoints: {
        day: number;
        date: string;
        purpose: string;
    }[];
};
export function classify(r: Release, req: Requirement, knowledge: Knowledge): Gap {
    const n = r.nodes.find(n => n.id === req.nodeId), state = knowledge[req.nodeId], level = state?.level ?? null;
    let category: GapCategory, reason: string;
    if (!n || req.quality !== 'verified' || n.quality !== 'verified' || !supported(r, req.sourceClaimIds)) {
        category = 'unresolved';
        reason = '要求或来源尚未核验；这是资料缺项。';
    }
    else if (req.importance === 'optional') {
        category = 'optional';
        reason = '可按兴趣选择，不阻塞目标。';
    }
    else if (req.importance === 'recommended' && (level === null || level < req.requiredLevel)) {
        category = 'recommendedGap';
        reason = '有帮助，但不阻塞当前任务。';
    }
    else if (level === null || state?.conflict) {
        category = 'verify';
        reason = state?.conflict ? '存在冲突，保留最后确认值，先核对。' : '尚未评估；先诊断，不把未知当不会。';
    }
    else if (level < req.requiredLevel) {
        category = 'requiredGap';
        reason = '已确认等级低于此项目标要求。';
    }
    else if (req.minimumEvidence === 'practice' && (!['task', 'project', 'external'].includes(state.evidenceType) || !state.evidence.trim())) {
        category = 'verify';
        reason = '自述等级足够，但此目标需要具体实践记录。';
    }
    else {
        category = 'reused';
        reason = ['self', 'course'].includes(state.evidenceType) ? '达到该任务要求；依据仍是自述或课程经历，存在验证局限。' : '达到该任务要求；实践记录仅验证描述的范围。';
    }
    return { nodeId: req.nodeId, name: n?.name ?? req.nodeId, category, requiredLevel: req.requiredLevel, level, importance: req.importance, reason, sourceClaimIds: req.sourceClaimIds };
}

const choiceKey = (choices: Record<string, string>) => JSON.stringify(Object.entries(choices).sort(([a], [b]) => a.localeCompare(b)));
const required = (g: Gap) => ['entry_required', 'stage_required'].includes(g.importance);

// 只展开适用硬前置。每次保留完整合法组合，最多计算三个候选；不声称全局最优。
export function plan(r: Release, input: PlanInput): Planned {
    const scope = `${input.topicId}:${input.mode}`, graphErrors = validateGraph(r);
    const nodes = new Map(r.nodes.map(n => [n.id, n]));
    const edges = new Map(r.edges.map(e => [e.id, e]));
    const requirements = r.requirements.filter(q => q.topicId === input.topicId && q.mode === input.mode);
    const project = r.nodes.find(n => n.type === 'project' && r.edges.some(e => e.type === 'belongs_to' && e.from === n.id && e.to === input.topicId));
    const clauses = r.clauses.filter(c => c.scope === scope);
    const validOptions = (c: typeof clauses[number]) => c.options.map(id => edges.get(id)).filter(e => e && e.type === 'prerequisite_of' && e.to === c.targetId && e.scope.includes(scope) && e.quality === 'verified' && supported(r, e.sourceClaimIds) && nodes.get(e.from)?.quality === 'verified');
    const edgeGap = (e: NonNullable<ReturnType<typeof edges.get>>) => {
        const req = requirements.find(q => q.nodeId === e.from);
        return classify(r, { id: e.id, topicId: input.topicId, mode: input.mode, objectiveKey: scope, nodeId: e.from, requiredLevel: Math.max(e.requiredLevel, req?.requiredLevel ?? 0), importance: req?.importance === 'stage_required' ? 'stage_required' : 'entry_required', minimumEvidence: req?.minimumEvidence ?? (input.mode === 'deep' ? 'practice' : 'self'), sourceClaimIds: [...new Set([...e.sourceClaimIds, ...(req?.sourceClaimIds ?? [])])], quality: req?.quality === 'draft' ? 'draft' : e.quality }, input.knowledge);
    };
    const resourceMissing = (nodeId: string) => { const value = nodes.get(nodeId)?.content.resource; return typeof value === 'string' && !input.resources.includes(value) ? [value] : []; };
    // 用有依据的前置闭包估计各选项代价；已达标项不重新展开其学习前置。
    const rankCache = new Map<string, number[]>();
    const optionRank = (edgeId: string, visited = new Set<string>()): number[] => {
        const cached = rankCache.get(edgeId);
        if (cached) return cached;
        const e = edges.get(edgeId);
        if (!e || visited.has(e.from)) return [1, 1, 1, 1];
        const gap = edgeGap(e);
        if (gap.category === 'reused') return [0, 0, 0, 0];
        const next = new Set(visited).add(e.from);
        let missing = resourceMissing(e.from).length, gaps = gap.category === 'requiredGap' ? 1 : 0, verify = gap.category === 'verify' ? 1 : 0;
        for (const c of clauses.filter(c => c.targetId === e.from)) {
            const scores = validOptions(c).map(option => optionRank(option!.id, next));
            scores.sort(compareNumbers);
            const best = scores[0];
            if (best) { missing += best[1]; gaps += best[2]; verify += best[3]; }
            else { missing++; gaps++; }
        }
        const result = [1, missing, gaps, verify];
        rankCache.set(edgeId, result);
        return result;
    };
    const sortedOptions = (c: typeof clauses[number]) => validOptions(c).sort((a, b) => compareNumbers(optionRank(a!.id), optionRank(b!.id)) || a!.id.localeCompare(b!.id));
    const requested = { ...input.choices };
    if (input.branch) {
        const group = clauses.find(c => c.options.includes(input.branch!));
        if (group) requested[group.id] = input.branch;
    }
    const selectionErrors: string[] = [];
    if (input.branch && !clauses.some(c => validOptions(c).some(e => e!.id === input.branch))) selectionErrors.push('所选支路不存在、未核验或不适用于当前目标。');
    for (const [key, edgeId] of Object.entries(requested)) {
        const group = clauses.find(c => c.id === key);
        if (!group || !validOptions(group).some(e => e!.id === edgeId)) selectionErrors.push(`所选支路不合法：${key}`);
    }

    function build(choices: Record<string, string>): Planned {
        const issues = [...graphErrors, ...selectionErrors], gaps = requirements.map(q => classify(r, q, input.knowledge));
        const order: string[] = [], expanded = new Set<string>(), selectedOptions: Record<string, string> = {}, branchGroups: BranchGroup[] = [];
        const alternatives = new Set<string>();
        if (!requirements.length) issues.push('目标缺少要求配置。');
        if (!project) issues.push('目标缺少验证项目。');
        function expand(target: string) {
            if (expanded.has(target)) return;
            expanded.add(target);
            const groups = clauses.filter(c => c.targetId === target).sort((a, b) => {
                const stage = (c: typeof a) => Math.min(...c.options.map(id => requirements.find(q => q.nodeId === edges.get(id)?.from)?.importance === 'stage_required' ? 1 : 0));
                return stage(a) - stage(b) || a.id.localeCompare(b.id);
            });
            for (const c of groups) {
                const options = sortedOptions(c);
                if (!options.length) { issues.push(`无已核实合法选项：${c.id}`); continue; }
                for (const option of options) alternatives.add(option!.id);
                const e = choices[c.id] ? options.find(e => e!.id === choices[c.id]) : options[0];
                if (!e) { issues.push(`所选支路不可执行：${c.id}`); continue; }
                if (c.options.length > 1) {
                    selectedOptions[c.id] = e.id;
                    branchGroups.push({ id: c.id, targetName: nodes.get(target)?.name ?? target, selectedEdgeId: e.id, options: options.map(e => ({ edgeId: e!.id, nodeId: e!.from, name: nodes.get(e!.from)?.name ?? e!.from, category: edgeGap(e!).category })) });
                }
                const candidateGap = edgeGap(e), index = gaps.findIndex(g => g.nodeId === e.from);
                // 同一知识被多个必要条件引用时，保留更高要求及更严格的证据结果。
                const severity = { reused: 0, optional: 1, recommendedGap: 2, verify: 3, requiredGap: 4, unresolved: 5 };
                if (index < 0) gaps.push(candidateGap);
                else if (candidateGap.requiredLevel > gaps[index].requiredLevel || severity[candidateGap.category] > severity[gaps[index].category]) gaps[index] = candidateGap;
                const gap = gaps.find(g => g.nodeId === e.from)!;
                if (gap.category !== 'reused') {
                    expand(e.from);
                    if (!order.includes(e.from)) order.push(e.from);
                }
            }
        }
        if (!graphErrors.length && !selectionErrors.length) {
            if (project) expand(project.id);
            for (const gap of gaps.filter(g => required(g) && ['requiredGap', 'verify'].includes(g.category))) {
                expand(gap.nodeId);
                if (!order.includes(gap.nodeId)) order.push(gap.nodeId);
            }
        }
        if (gaps.some(g => g.category === 'unresolved')) issues.push('部分目标要求未核验。');
        const topicResource = String(nodes.get(input.topicId)?.content.resource ?? '电脑');
        const missingResources = [...new Set([...(input.resources.includes(topicResource) ? [] : [topicResource]), ...gaps.filter(g => required(g) && g.category !== 'reused').flatMap(g => resourceMissing(g.nodeId))])].sort();
        for (const resource of missingResources) issues.push(`缺少已确认资源：${resource}。`);
        const status = graphErrors.length || selectionErrors.length || !project || !requirements.length ? 'blocked' : issues.length ? 'partial' : 'ready';
        const steps: Planned['steps'] = order.map(nodeId => { const gap = gaps.find(g => g.nodeId === nodeId)!; return { nodeId, action: gap.category === 'verify' ? `先验证：${gap.name}` : `补充并验证：${gap.name}`, condition: gap.importance === 'entry_required' ? '开始验证项目之前' : '后续阶段之前；可先完成入口诊断', minutes: null }; });
        if (project && status !== 'blocked') steps.push({ nodeId: project.id, action: project.name, condition: '所有适用必要要求验证达标后执行', minutes: null });
        if (steps.length && input.hours > 0) steps[0].minutes = Math.min(30, input.hours * 60);
        if (input.hours === 0) issues.push('预算为 0：仅保存路线，不安排正时长行动。');
        return { schemaVersion: 1, plannerVersion: PLANNER_VERSION, rubricVersion: '1.0.0', knowledgeRelease: r.id, profileVersion: input.profileVersion, topicId: input.topicId, mode: input.mode, objectiveKey: scope, status, feasibility: input.hours === 0 ? 'unscheduled' : missingResources.length ? 'limited' : 'feasible', hours: input.hours, resources: input.resources, startDate: input.startDate, gaps, steps: input.hours === 0 ? [] : steps, projectId: project?.id ?? null, issues: [...new Set(issues)], searchLimited: false, alternatives: [...alternatives], selectedOptions, branchGroups, missingResources, checkpoints: [{ day: 30, purpose: '第 1–30 天：检查证据、兴趣和实际投入' }, { day: 90, purpose: '第 31–90 天：依据新证据重新规划' }].map(x => ({ ...x, date: new Date(Date.parse(`${input.startDate}T00:00:00Z`) + (x.day - 1) * 86400000).toISOString().slice(0, 10) })) };
    }

    const first = build(requested), routes = [first], seen = new Set([choiceKey(first.selectedOptions ?? {})]);
    const queue: Record<string, string>[] = [], queued = new Set<string>();
    function enqueue(p: Planned) {
        for (const group of p.branchGroups ?? []) for (const option of group.options) {
            if (option.edgeId === group.selectedEdgeId) continue;
            const next = { ...p.selectedOptions, [group.id]: option.edgeId }, key = choiceKey(next);
            if (!seen.has(key) && !queued.has(key)) { queued.add(key); queue.push(next); }
        }
    }
    if (first.status !== 'blocked') enqueue(first);
    // 仅丢弃未到达分支的重复选择不会产生新候选；设置总迭代上限防止畸形输入耗尽请求。
    let attempts = 0;
    while (queue.length && routes.length < 3 && attempts++ < 24) {
        const next = build(queue.shift()!), key = choiceKey(next.selectedOptions ?? {});
        if (seen.has(key)) continue;
        seen.add(key); routes.push(next); enqueue(next);
    }
    // 比较同一个目标的入口选择，避免复杂支路因为多出几个已知的下层节点而反超已达标入口。
    const rank = (p: Planned) => [p.status === 'blocked' ? 1 : 0, -(p.branchGroups ?? []).filter(g => clauses.find(c => c.id === g.id)?.targetId === project?.id && g.options.find(o => o.edgeId === g.selectedEdgeId)?.category === 'reused').length, (p.missingResources ?? []).length, p.gaps.filter(g => required(g) && g.category === 'requiredGap').length, p.gaps.filter(g => required(g) && g.category === 'verify').length];
    routes.sort((a, b) => compareNumbers(rank(a), rank(b)) || choiceKey(a.selectedOptions ?? {}).localeCompare(choiceKey(b.selectedOptions ?? {})));
    const explicit = Object.keys(requested).length > 0 || !!input.branch;
    const chosen = explicit ? first : routes[0];
    const candidates: Candidate[] = routes.map(p => {
        const reused = p.gaps.filter(g => required(g) && g.category === 'reused').length;
        const requiredGaps = p.gaps.filter(g => required(g) && g.category === 'requiredGap').length;
        const diagnostics = p.gaps.filter(g => required(g) && g.category === 'verify').length;
        return { id: choiceKey(p.selectedOptions ?? {}), label: (p.branchGroups ?? []).map(g => g.options.find(o => o.edgeId === g.selectedEdgeId)!.name).join(' + ') || '当前目标路线', choices: p.selectedOptions ?? {}, reused, requiredGaps, diagnostics, missingResources: p.missingResources ?? [], status: p.status, feasibility: p.feasibility, reason: `可复用 ${reused} 项，必要缺口 ${requiredGaps} 项，待验证 ${diagnostics} 项；${p.missingResources?.length ? `待确认资源：${p.missingResources.join('、')}` : '所需资源已确认'}。` };
    });
    return { ...chosen, candidates, searchLimited: queue.some(c => !seen.has(choiceKey(c))) };
}

function compareNumbers(a: number[], b: number[]) {
    for (let i = 0; i < Math.max(a.length, b.length); i++) { const diff = (a[i] ?? 0) - (b[i] ?? 0); if (diff) return diff; }
    return 0;
}
