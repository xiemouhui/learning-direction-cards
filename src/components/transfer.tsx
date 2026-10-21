'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ProjectChecks } from './project-checks';
import { useRouter } from 'next/navigation';
import { ArrowRight, GitCompareArrows } from 'lucide-react';
import { Planned } from '@/core/planner';
import { categoryLabels } from '@/core/schema';
import { contentList, findNode, nodesOf, getRelease } from '@/core/catalog';
import { useAction, useApp } from './provider';
import { Badge, BulletList, Empty, PageHeading, SourceList } from './ui';
const statusLabels = { ready: '可执行起点', partial: '部分可规划', blocked: '当前无法规划' };
function CandidateChooser({ value, busy, onChoose }: { value: Planned; busy: boolean; onChoose: (choices: Record<string, string>) => void }) {
    const selected = JSON.stringify(Object.entries(value.selectedOptions ?? {}).sort(([a], [b]) => a.localeCompare(b)));
    return <section className="panel"><h2>比较候选路线</h2><p>优先复用已达标基础，再比较资源条件、必要缺口和待验证项。每次最多展开三条候选，展示顺序不代表长期适合程度。</p>
    <div className="table-scroll route-candidates" role="region" aria-label="候选路线对比表，可横向滚动" tabIndex={0}><table><thead><tr><th>路线</th><th>可复用</th><th>必要缺口</th><th>待验证</th><th>资源条件</th><th>选择</th></tr></thead><tbody>{value.candidates?.map(candidate => <tr key={candidate.id}><td><strong>{candidate.label}</strong><p>{statusLabels[candidate.status]}</p></td><td>{candidate.reused} 项</td><td>{candidate.requiredGaps} 项</td><td>{candidate.diagnostics} 项</td><td>{candidate.missingResources.length ? `待确认：${candidate.missingResources.join('、')}` : '所需资源已确认'}</td><td><button className="button" aria-pressed={candidate.id === selected} disabled={busy || candidate.id === selected} onClick={() => onChoose(candidate.choices)}>{candidate.id === selected ? '当前选择' : `选择${candidate.label}路线`}</button></td></tr>)}</tbody></table></div>
    {value.status !== 'blocked' && value.candidates?.length === 1 && <p className="muted">当前已定义的要求只有这一条候选路线。</p>}
    {(value.branchGroups ?? []).map((group, index) => <label className="form-field" key={group.id}><span>可选前置 {index + 1}：{group.targetName}</span><select aria-label={`可选前置 ${index + 1}`} disabled={busy} value={group.selectedEdgeId} onChange={e => onChoose({ ...value.selectedOptions, [group.id]: e.target.value })}>{group.options.map(option => <option key={option.edgeId} value={option.edgeId}>{option.name} · {categoryLabels[option.category]}</option>)}</select></label>)}
    {value.searchLimited && <div className="notice">本次候选展开已达上限，可能还有其他组合。可通过“可选前置”选择尚未展示的支路并重新分析；这不代表全局无路。</div>}
    <p className="muted">选择后会重新计算整条路线；保存只记录当前选择，设为活动计划仍需另行确认。</p></section>;
}
export function PlanView({ value }: {
    value: Planned;
}) {
    const history = getRelease(value.knowledgeRelease), getNode = (id: string) => history?.nodes.find(n => n.id === id);
    const project = getNode(value.projectId ?? ''), topic = getNode(value.topicId);
    return <>
 <section className="panel"><div className="section-heading"><h2>{topic?.name} · {value.mode === 'explore' ? '探索' : '深入'}路线</h2><Badge tone={value.status === 'ready' ? 'green' : 'amber'}>{statusLabels[value.status]}</Badge></div><p>目标：{String(value.mode === 'explore' ? topic?.content.explore : topic?.content.deep)}</p>{(value.branchGroups?.length ?? 0) > 0 && <p>已保存的前置选择：{value.branchGroups!.map(group => group.options.find(option => option.edgeId === group.selectedEdgeId)?.name).join('、')}</p>}<div className="actions"><Badge>{value.feasibility === 'feasible' ? '资源已确认' : value.feasibility === 'limited' ? '资源有限' : '尚未安排活动'}</Badge><Badge>每周预算上界 {value.hours} 小时</Badge><Badge>画像版本 {value.profileVersion}</Badge></div><p className="muted">任务规模尚未实测，不提供完成工期。首次行动是在预算内选择一个诊断并记录实际耗时，未完成可续接下一周。</p>{value.issues.map(x => <div className="notice" key={x}>{x}</div>)}{value.searchLimited && <div className="notice">候选路线采用有限搜索，未宣称全局最优。可在重新分析时选择其他已核验支路。</div>}</section>
 <section className="panel"><h2>已有基础 → 复用与验证 → 目标项目</h2><p>可复用项免重复学习；必要缺口按入口与后续阶段区分。点击知识项可阅读要求与来源。</p><div className="gap-grid">{value.gaps.map(g => <details className="gap-card" key={g.nodeId}><summary><Badge tone={g.category === 'reused' ? 'green' : g.category === 'unresolved' ? 'red' : 'amber'}>{categoryLabels[g.category]}</Badge><h3>{g.name}</h3><small>当前 {g.level ?? '未知'} → 目标 {g.requiredLevel}</small></summary><p>{g.reason}</p><p>{g.importance === 'entry_required' ? '入口必要要求' : g.importance === 'stage_required' ? '后续阶段必要要求' : '拓展项'}</p><p>{getNode(g.nodeId)?.summary}</p><p>验证动作：{String(getNode(g.nodeId)?.content.diagnostic ?? '待补充')}</p><Link className="text-link" href={`/knowledge?topic=${value.topicId}`}>核对该目标知识 <ArrowRight size={14}/></Link></details>)}</div></section>
 <section className="panel"><h2>条件性行动路线</h2>{!value.steps.length ? <p>{value.hours === 0 ? '当前预算为 0，保存目标和检查点，不安排正时长行动。' : '当前路线没有可执行行动，请先处理上方列出的资料或支路问题。'}</p> : <div className="timeline">{value.steps.map((s, i) => <div className="timeline-item" key={s.nodeId}><h3>{String(i + 1).padStart(2, '0')} · {s.action}</h3><p>{s.condition}</p>{s.minutes !== null && <p>本周先尝试至多 {s.minutes} 分钟，记录实际耗时；这不是完成时限。其余任务暂不排入本周。</p>}<small className="muted">产出：诊断记录、可重复检查的结果与仍不明确的问题。任务规模待测。</small></div>)}</div>}<p className="muted">以上是依赖顺序；同一入口中互无依赖的诊断可以并行。不自动把可选拓展加入关键路径。</p></section>
 {project && <section className="panel"><h2>验证项目：{project.name}</h2><p>输入条件：{String(project.content.input)}</p><p>产出：{String(project.content.output)}</p><BulletList items={contentList(project.content.rubric).filter(item => !contentList(project.content.failureChecks).includes(item))}/><ProjectChecks project={project}/><p className="muted">无法证明：{String(project.content.limits)}</p></section>}
 <section className="panel"><h2>检查点，不是掌握期限</h2>{value.checkpoints.map(c => <p key={c.day}><Badge>{c.date}</Badge> {c.purpose}</p>)}<p>6–12 个月仅作条件性展望：根据验证记录、兴趣与实际投入，重新选择下一阶段。</p><p className="muted">知识库 {value.knowledgeRelease} · 规划器 {value.plannerVersion} · rubric {value.rubricVersion}</p></section>{topic && <SourceList node={topic} version={value.knowledgeRelease}/>}</>;
}
export function Transfer() {
    const { state, mutate } = useApp(), { busy, message, run } = useAction(), router = useRouter();
    const [topic, setTopic] = useState('crypto-engineering'), [mode, setMode] = useState<'explore' | 'deep'>('explore'), [hours, setHours] = useState(5), [resources, setResources] = useState(['电脑']), [startDate, setStartDate] = useState(''), [preview, setPreview] = useState<Planned | null>(null);
    useEffect(() => { const q = new URLSearchParams(window.location.search); if (nodesOf('subdomain').some(n => n.id === q.get('topic')))
        setTopic(q.get('topic')!); if (q.get('mode') === 'deep')
        setMode('deep'); setStartDate(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())); }, []);
    const input = { topicId: topic, mode, hours, resources, startDate };
    const chooseRoute = (choices: Record<string, string>) => void run(async () => setPreview(await mutate<Planned>({ action: 'preview', ...input, choices })));
    return <><PageHeading eyebrow="把积累连接到新的目标" title="知识迁移路线" description="先选择具体专题与意图，再比较已确认知识和目标要求。路线是可以修正的假设，资料不足会明确标出。"/><section className="panel"><h2>为哪一个目标做准备？</h2><div className="form-grid"><label className="form-field"><span>目标专题</span><select aria-label="目标专题" value={topic} onChange={e => { setTopic(e.target.value); setPreview(null); }}>{nodesOf('subdomain').map(n => <option key={n.id} value={n.id}>{n.name}</option>)}</select></label><label className="form-field"><span>探索意图</span><select aria-label="探索意图" value={mode} onChange={e => { setMode(e.target.value as 'explore' | 'deep'); setPreview(null); }}><option value="explore">探索 · 用小验证澄清起点</option><option value="deep">深入 · 系统补基础与复杂任务</option></select></label><label className="form-field"><span>每周预算（小时）</span><input aria-label="每周预算" type="number" min={0} max={80} value={hours} onChange={e => { setHours(Number(e.target.value)); setPreview(null); }}/></label><label className="form-field"><span>开始日期</span><input aria-label="开始日期" type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setPreview(null); }}/></label></div><fieldset><legend>确认可用资源</legend><div className="inline-options">{['电脑', '开发板'].map(x => <label key={x}><input type="checkbox" checked={resources.includes(x)} onChange={() => { setResources(resources.includes(x) ? resources.filter(r => r !== x) : [...resources, x]); setPreview(null); }}/>{x}</label>)}</div></fieldset><div className="actions"><button className="button primary" disabled={busy || !state || !startDate} onClick={() => void run(async () => setPreview(await mutate<Planned>({ action: 'preview', ...input })))}>{busy ? '正在计算缺口…' : '分析复用与知识缺口'}<ArrowRight size={16}/></button><Link className="text-link" href={`/knowledge?topic=${topic}`}>先完善目标相关知识</Link></div></section><div className="status-message" role="status">{message}</div>
 {preview && <><CandidateChooser value={preview} busy={busy} onChoose={chooseRoute}/><PlanView value={preview}/><div className="actions"><button className="button primary" disabled={busy || !state} onClick={() => void run(async () => { const r = await mutate<{
        pathId: string;
    }>({ action: 'savePath', ...input, choices: preview.selectedOptions, baseVersion: preview.profileVersion }); router.push(`/transfer/${r.pathId}`); })}>保存路线版本<ArrowRight size={16}/></button><p className="muted">保存后再明确选择是否作为活动计划。</p></div></>}
 </>;
}
export function PathDetail({ id }: {
    id: string;
}) {
    const { state, loading, mutate } = useApp(), { busy, message, run } = useAction();
    if (loading)
        return <div className="loading">正在读取路线…</div>;
    const path = state?.paths.find(p => p.id === id);
    if (!path)
        return <Empty title="路线不存在或不属于当前资料" description="历史链接需要原浏览器身份。也可以从当前画像创建新路线。" href="/transfer" label="规划新路线"/>;
    const version = path.versions.find(v => v.version === path.version)!;
    return <><PageHeading eyebrow={`路线版本 ${path.version} · ${path.active ? '活动计划' : '已保存'}`} title={findNode(path.topic_id)?.name ?? '学习路线'} description="历史内容按当时画像与知识库版本保留。新画像不会覆盖旧路线，调整需要单独确认。"/><div className="actions" style={{ marginBottom: 24 }}>{!path.active && <button className="button primary" disabled={busy} onClick={() => void run(async () => { await mutate({ action: 'activate', pathId: id, baseVersion: path.version }); })}>设为活动计划</button>}<Link className="button" href="/dashboard">进入学习工作台<ArrowRight size={16}/></Link><button className="button" disabled={busy} onClick={() => void run(async () => { await mutate({ action: 'propose', pathId: id }); })}><GitCompareArrows size={16}/>生成新旧路线差异</button></div><div className="status-message" role="status">{message}</div><PlanView value={version.plan}/><ProposalList pathId={id}/><section className="panel"><h2>路线历史</h2>{path.versions.map(v => <details key={v.version}><summary>版本 {v.version} · 画像 {v.plan.profileVersion} · {new Date(v.createdAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</summary><PlanView value={v.plan}/></details>)}</section></>;
}
export function ProposalList({ pathId }: {
    pathId: string;
}) { const { state, mutate } = useApp(), { busy, message, run } = useAction(); const proposals = state?.records.filter(r => r.kind === 'proposal' && r.parentId === pathId) ?? []; return <section className="panel"><h2>路线变更提案</h2>{!proposals.length ? <p>确认知识后，可以生成路线差异。查看或拒绝提案不会更改活动路线。</p> : proposals.slice().reverse().map(p => { const changes = p.body.changes as {
    nodeId: string;
    name: string;
    before: keyof typeof categoryLabels | null;
    after: keyof typeof categoryLabels | null;
    reason: string;
}[], next = p.body.next as Planned; return <div className="confirmation" key={p.id}><h3>基于路线版本 {Number(p.body.basePathVersion)} → 新版本</h3><p>采用画像 {Number(p.body.baseProfileVersion)} · 状态：{p.body.status === 'pending' ? '待确认' : p.body.status === 'accepted' ? '已应用' : '已拒绝'}</p>{changes.length ? changes.map(c => <div className="comparison-row" key={c.nodeId}><span>{c.name}：{c.before ? categoryLabels[c.before] : '未列入'}</span><ArrowRight size={14}/><span>{c.after ? categoryLabels[c.after] : '不再列入当前路线'}</span></div>) : <p>当前知识缺口分类没有变化。新版本只记录当前画像引用，不增加已掌握知识。</p>}<p>影响：重排待验证与补充行动；每周预算仍为 {next.hours} 小时。旧版本保留。</p>{p.body.status === 'pending' && <div className="actions"><button className="button primary" disabled={busy} onClick={() => void run(async () => { await mutate({ action: 'proposal', proposalId: p.id, accept: true }); })}>确认应用新路线</button><button className="button" disabled={busy} onClick={() => void run(async () => { await mutate({ action: 'proposal', proposalId: p.id, accept: false }); })}>拒绝，保留当前路线</button></div>}</div>; })}<div className="status-message" role="status">{message}</div></section>; }
