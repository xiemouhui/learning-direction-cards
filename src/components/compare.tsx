'use client';
import { useState } from 'react';
import Link from 'next/link';
import { contentList, nodesOf } from '@/core/catalog';
import type { Node } from '@/core/schema';
import { PageHeading } from './ui';
const dimensions: {
    label: string;
    read: (n: Node) => string;
}[] = [
    { label: '问题范围', read: n => n.summary },
    { label: '典型活动', read: n => contentList(n.content.abilities ?? n.content.tags ?? n.content.methods).join('、') || '目录待扩充' },
    { label: '投入与代价', read: n => String(n.content.cost ?? '以具体专题和目标要求为准') },
    { label: '准备与验证', read: n => n.type === 'subdomain' ? '核对目标要求与项目 rubric；未知先验证' : '专业与领域没有统一的个人起步门槛，请选择具体专题' },
    { label: '边界', read: n => n.content.coverage === 'planned' ? '尚未扩充，不提供个性化判断' : n.quality === 'draft' ? '部分说明待核验' : '仅代表本版已覆盖内容，不能推出职业准备充分' }
];
export function Compare() {
    const [kind, setKind] = useState('major'), [selected, setSelected] = useState(['cs', 'net']);
    const nodes = nodesOf(kind), items = nodes.filter(n => selected.includes(n.id));
    return <><PageHeading eyebrow="理解差异，保留选择" title="放在一起比较" description="选择同一层级的 2–3 项，用统一维度看问题范围、活动、代价和准备方式。没有适合程度总分。"/>
 <section className="panel"><label className="form-field"><span>对比层级</span><select value={kind} onChange={e => { setKind(e.target.value); setSelected([]); }}><option value="major">本科专业</option><option value="domain">技术与研究领域</option><option value="subdomain">具体专题</option></select></label><div className="inline-options">{nodes.map(n => <label key={n.id}><input type="checkbox" checked={selected.includes(n.id)} disabled={!selected.includes(n.id) && selected.length >= 3} onChange={() => setSelected(selected.includes(n.id) ? selected.filter(x => x !== n.id) : [...selected, n.id])}/>{n.name}</label>)}</div></section>
 {items.length < 2 ? <div className="notice">请选择至少 2 项，最多 3 项。</div> : <section className="panel"><div className="table-scroll"><table><thead><tr><th>比较维度</th>{items.map(n => <th key={n.id}>{n.name}</th>)}</tr></thead><tbody>{dimensions.map(d => <tr key={d.label}><th>{d.label}</th>{items.map(n => <td key={n.id}>{d.read(n)}</td>)}</tr>)}<tr><th>继续探索</th>{items.map(n => <td key={n.id}><Link className="text-link" href={kind === 'major' ? `/directions/${n.id}` : kind === 'domain' ? `/domains/${n.id}` : `/topics/${n.id}`}>打开方向卡 →</Link></td>)}</tr></tbody></table></div></section>}
 </>;
}
