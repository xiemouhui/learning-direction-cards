import Link from 'next/link';
import { ArrowUpRight, ArrowRight, Check, HelpCircle, FileText } from 'lucide-react';
import type { Node } from '@/core/schema';
import { contentList, release as defaultRelease, getRelease } from '@/core/catalog';
import type { ReactNode } from 'react';
export function PageHeading({ eyebrow, title, description, action }: {
    eyebrow: string;
    title: string;
    description: string;
    action?: ReactNode;
}) { return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action}</div>; }
export function Badge({ children, tone = 'neutral' }: {
    children: ReactNode;
    tone?: string;
}) { return <span className={`badge ${tone}`}>{children}</span>; }
export const coverageLabels: Record<string, string> = { complete: '本版入口已覆盖', partial: '部分覆盖', planned: '待扩充' };
export function NodeCard({ node, index = 0 }: {
    node: Node;
    index?: number;
}) { const link = node.type === 'major' ? `/directions/${node.id}` : node.type === 'domain' ? `/domains/${node.id}` : `/topics/${node.id}`; return <Link className={`node-card tone-${index % 5}`} href={link}><div className="card-top"><span className="card-number">{String(index + 1).padStart(2, '0')}</span><ArrowUpRight size={20}/></div><h3>{node.name}</h3><p>{node.summary}</p><div className="card-tags">{contentList(node.content.abilities ?? node.content.tags).slice(0, 3).map(x => <span key={x}>{x}</span>)}</div><div className="card-bottom">{node.type === 'major' ? '认识这个专业' : node.type === 'domain' ? coverageLabels[String(node.content.coverage)] : '查看专题与验证项目'}<ArrowRight size={16}/></div></Link>; }
export function SourceList({ node, version = defaultRelease.id }: {
    node?: Node;
    version?: string;
}) { const release = getRelease(version) ?? defaultRelease; const claimIds = node ? [...node.sourceClaimIds, ...release.requirements.filter(q => q.topicId === node.id).flatMap(q => q.sourceClaimIds)] : release.claims.map(c => c.id); const claims = release.claims.filter(c => claimIds.includes(c.id)); return <section className="panel sources"><h2><FileText size={19}/> 来源与核验范围</h2><p>版本 {release.id}。行为等级、项目与学习顺序是应用设计，来源支持范围以具体主张为准。</p>{node && <Badge tone={node.quality === 'verified' ? 'green' : 'amber'}>{node.quality === 'verified' ? '节点说明已核验' : '节点说明待核验'}</Badge>}{claims.map(c => <div className="source-item" key={c.id}><p>{c.text}</p>{c.sourceIds.map(id => { const s = release.sources.find(s => s.id === id); return s ? <a key={id} href={s.url} target="_blank" rel="noopener noreferrer">{s.title} · {s.publisher} <ArrowUpRight size={14}/></a> : null; })}<small>取回日期：{release.sources.find(s => s.id === c.sourceIds[0])?.accessedAt ?? '未核验'} · {c.note}</small></div>)}</section>; }
export function Empty({ title, description, href, label }: {
    title: string;
    description: string;
    href?: string;
    label?: string;
}) { return <div className="empty-state"><HelpCircle size={30}/><h2>{title}</h2><p>{description}</p>{href && <Link className="button primary" href={href}>{label ?? '开始探索'}<ArrowRight size={16}/></Link>}</div>; }
export function BulletList({ items }: {
    items: string[];
}) { return <ul className="check-list">{items.map(x => <li key={x}><Check size={16}/><span>{x}</span></li>)}</ul>; }
