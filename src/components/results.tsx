'use client';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { release } from '@/core/catalog';
import { recommend } from '@/core/recommendation';
import { useApp } from './provider';
import { Badge, Empty, PageHeading } from './ui';
export function Results({ id = 'current' }: {
    id?: string;
}) {
    const { state, loading } = useApp();
    if (loading)
        return <div className="loading">正在读取当前画像…</div>;
    if (!state)
        return <Empty title="暂时无法读取个人资料" description="请初始化数据库后重试。"/>;
    const historical = id === 'current' ? null : state.records.find(r => r.id === id && r.kind === 'assessment');
    if (id !== 'current' && !historical)
        return <Empty title="评估不存在或不属于当前资料" description="历史结果需要原浏览器身份。" href="/assess" label="重新梳理起点"/>;
    const data = historical ? historical.body.results as ReturnType<typeof recommend> : recommend(release, state.assessment, state.knowledge), a = historical ? historical.body.assessment as typeof state.assessment : state.assessment, personal = !!a && (a.answers.some(x => x.trim()) || a.positive.length > 0 || a.negative.length > 0 || a.hours !== null || a.preference !== 'unknown');
    return <><PageHeading eyebrow="三项独立判断 · 没有综合适配分" title="看清兴趣、准备与证据" description="依据已确认的活动标签、目标相关知识和约束分别判断。展示顺序是稳定目录顺序，不是适合程度排名。"/>{!personal && <div className="notice">当前是非个性化探索样例。你尚未提供足够信息，可以继续浏览，也可以补问卷和目标相关知识。</div>}{a && <div className="notice">兴趣标签 {a.positive.length} 项正向、{a.negative.length} 项反向；自由文本不会自动转换成兴趣或掌握等级。每周预算：{a.hours ?? '未知'}{a.hours !== null ? ' 小时' : ''}。</div>}
 {data.map(d => <section className="panel" key={d.domain.id}><div className="section-heading"><h2>{d.domain.name}</h2><Badge tone="blue">{d.domain.content.coverage === 'partial' ? '部分入口已覆盖' : '当前已覆盖入口'}</Badge></div><p>入口假设：{d.topic?.name}。可改选该领域其他专题。</p><div className="score-triplet"><div><small>探索优先级</small><strong>{d.interest}</strong></div><div><small>当前准备程度</small><strong>{d.preparation}</strong></div><div><small>证据充分程度</small><strong>{d.evidence}</strong></div></div><p>依据：{d.positive.length ? `正向活动 ${d.positive.join('、')}。` : '尚无已确认的相关正向活动。'}{d.negative.length ? `反证／待核对：${d.negative.join('、')} 当前体验较弱。` : '尚无已确认的反向体验，不能理解为不存在代价。'}</p><p>信息覆盖：兴趣／体验 {d.coverage[0] ? '已提供' : '未知'}；目标相关知识 {d.coverage[1] ? '已评估' : '待补'}；时间约束 {d.coverage[2] ? '已提供' : '未知'}。</p><p className="muted">{d.limitation}</p><p>七天行动：先核对「{d.topic?.name}」入口要求，再在预算内选择一个诊断，记录实际结果。30／90 天检查点在具体路线中按开始日期生成。</p><div className="actions"><Link className="button primary" href={`/transfer?topic=${d.topic?.id}`}>看复用与缺口<ArrowRight size={15}/></Link><Link className="button" href={`/domains/${d.domain.id}`}>改选专题</Link></div></section>)}<Link className="button" href="/assess">返回基础问卷</Link></>;
}
