'use client';
import Link from 'next/link';
import { ProjectChecks } from './project-checks';
import { useState } from 'react';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { children, contentList, findNode, nodesOf, parents, release } from '@/core/catalog';
import { Badge, BulletList, coverageLabels, Empty, NodeCard, PageHeading, SourceList } from './ui';
export function DomainList() {
    const [status, setStatus] = useState('all');
    const domains = nodesOf('domain'), topics = nodesOf('subdomain');
    const covered = domains.filter(n => n.content.coverage === 'complete').length;
    const statuses = ['complete', 'partial', 'planned'].filter(value => domains.some(n => n.content.coverage === value));
    return <><PageHeading eyebrow="由问题出发，探索相邻的可能" title="领域与专题" description="十二个领域均可进入具体专题，查看知识要求、验证项目和学习路线。领域详情说明本版任务范围与进阶方向。"/>
    <div className="notice" data-testid="catalog-coverage">领域入口覆盖 {covered} / {domains.length} · 可探索专题 {topics.length} 个 · 内容版本 {release.id}</div>
    <div className="filter-row"><label className="form-field">内容覆盖<select value={status} onChange={e => setStatus(e.target.value)}><option value="all">全部领域（{domains.length}）</option>{statuses.map(value => <option value={value} key={value}>{coverageLabels[value]}（{domains.filter(n => n.content.coverage === value).length}）</option>)}</select></label></div>
    <div className="card-grid">{domains.filter(n => status === 'all' || n.content.coverage === status).map((node, i) => <NodeCard key={node.id} node={node} index={i}/>)}</div></>;
}
export function CatalogDetail({ type, id }: {
    type: 'major' | 'domain' | 'subdomain';
    id: string;
}) {
    const node = findNode(id);
    if (!node || node.type !== type)
        return <Empty title="没有找到这张方向卡" description="可以从目录重新选择。" href="/domains"/>;
    const domain = type === 'subdomain' ? parents(id)[0] : null;
    if (type === 'domain' && node.content.coverage === 'planned')
        return <><PageHeading eyebrow="领域目录" title={node.name} description="这个领域尚未扩充，目前仅展示目录名称，不生成个人判断或空白路线。"/><Empty title="内容正在等待核验" description="可以先从当前已覆盖领域选择具体入口。" href="/domains" label="返回领域目录"/></>;
    const requirements = release.requirements.filter(q => q.topicId === id && q.mode === 'explore'), project = children(id).find(n => n.type === 'project');
    return <><div className="breadcrumb"><Link href="/">探索方向</Link><span>/</span><Link href="/domains">领域与专题</Link>{domain && <><span>/</span><Link href={`/domains/${domain.id}`}>{domain.name}</Link></>}<span>/</span><span>{node.name}</span></div>
 <PageHeading eyebrow={type === 'major' ? '本科专业 · 认知入口' : type === 'domain' ? '技术与研究领域' : '具体专题 · 从这里开始验证'} title={node.name} description={node.summary} action={<Badge tone={node.quality === 'verified' ? 'green' : 'amber'}>{type === 'domain' ? coverageLabels[String(node.content.coverage)] : node.quality === 'verified' ? '说明已核验' : '部分内容待核验'}</Badge>}/>
 {type === 'major' ? <><section className="panel"><h2>概览</h2><p>{String(node.content.cost)}</p><BulletList items={contentList(node.content.abilities)}/><div className="actions">{contentList(node.content.intensity).map((x, i) => <Badge key={i}>{['数学', '编程', '工程'][i]}投入：{x}（认知描述）</Badge>)}</div></section><section className="panel"><h2>学什么</h2><BulletList items={contentList(node.content.courses)}/><p className="muted">课程仅为通用认知示例，各校实际培养方案不同。此卡 {node.quality === 'draft' ? '尚待本科专业一手来源逐项补全' : '不替代具体学校培养方案'}。</p></section><section className="panel"><h2>关联方向</h2><p>这些是导航关系，不表示该专业独占这些领域。</p><div className="card-grid">{children(id).map((n, i) => <NodeCard key={n.id} node={n} index={i}/>)}</div></section><div className="panel-grid"><section className="panel"><h2>通用路径</h2><BulletList items={contentList(node.content.path)}/><Link href="/knowledge" className="text-link">从个人画像规划 <ArrowRight size={16}/></Link></section><section className="panel"><h2>发展出口</h2><p>{String(node.content.outlets)}</p><p>出口描述用于认识问题范围，不构成就业或升学承诺。</p></section></div><section className="panel"><h2>常见误区</h2><BulletList items={contentList(node.content.misconceptions)}/></section></> : null}
 {type === 'domain' ? <><section className="panel"><h2>本版可以探索什么</h2><p>已覆盖范围：{String(node.content.coverageScope ?? node.summary)}</p><p className="muted">{String(node.content.coverageCriteria ?? '本版仅覆盖下列专题。')}</p><div className="card-grid">{children(id).filter(n => n.type === 'subdomain').map((n, i) => <NodeCard key={n.id} node={n} index={i}/>)}</div><h3>尚未覆盖的方向</h3><BulletList items={contentList(node.content.remainingAreas)}/></section><section className="panel"><h2>领域交叉与专业关系</h2><div className="actions">{parents(id).map(n => <Link key={n.id} className="button" href={`/directions/${n.id}`}>{n.name}<ArrowUpRight size={15}/></Link>)}{release.edges.filter(e => e.type === 'related_to' && (e.from === id || e.to === id)).map(e => { const n = findNode(e.from === id ? e.to : e.from)!; return <Link className="button" href={`/domains/${n.id}`} key={e.id}>{n.name}<ArrowUpRight size={15}/></Link>; })}</div><p className="muted">关联用于导航，不自动成为学习前置条件。</p></section></> : null}
 {type === 'subdomain' ? <><div className="panel-grid"><section className="panel"><h2>要解决的问题与常见方法</h2><p>{node.summary}</p><BulletList items={contentList(node.content.methods)}/></section><section className="panel"><h2>投入与目标边界</h2><p>{String(node.content.cost)}</p><p>{String(node.content.limitations)}</p><p>探索：{String(node.content.explore)}</p><p>深入：{String(node.content.deep)}</p></section></div><section className="panel"><h2>相关知识与入口要求</h2><div className="gap-grid">{requirements.map(q => <div className="gap-card" key={q.id}><Badge tone={q.quality === 'draft' ? 'amber' : 'green'}>{q.importance === 'entry_required' ? '入口必要' : q.importance === 'stage_required' ? '后续阶段必要' : '可选拓展'}</Badge><h3>{findNode(q.nodeId)?.name}</h3><p>目标等级 {q.requiredLevel} · {q.quality === 'verified' ? '来源已核对，等级是本应用的行为标准' : '前置要求待核验'}</p></div>)}</div></section>{project && <section className="panel"><h2>验证项目：{project.name}</h2><p>输入：{String(project.content.input)}</p><p>产出：{String(project.content.output)}</p><BulletList items={contentList(project.content.rubric).filter(item => !contentList(project.content.failureChecks).includes(item))}/><ProjectChecks project={project}/><p className="muted">无法证明：{String(project.content.limits)}</p></section>}<section className="panel"><h2>选择探索意图</h2><p>探索与深入使用不同目标要求；未知知识先诊断，具体缺口由画像与任务共同决定。</p><div className="actions"><Link className="button primary" href={`/transfer?topic=${id}&mode=explore`}>规划探索路线<ArrowRight size={16}/></Link><Link className="button" href={`/transfer?topic=${id}&mode=deep`}>查看深入目标<ArrowUpRight size={16}/></Link><Link className="text-link" href={`/knowledge?topic=${id}`}>先核对相关知识</Link></div></section></> : null}
 <SourceList node={node}/></>;
}
