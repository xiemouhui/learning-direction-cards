'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Search, Compass, Network, Route, Check, GraduationCap, Layers3, Sparkles } from 'lucide-react';
import { nodesOf, release } from '@/core/catalog';
import { NodeCard } from './ui';
export function Home() {
    const [query, setQuery] = useState(''), [tab, setTab] = useState<'major' | 'domain'>('major');
    const nodes = nodesOf(tab).filter(n => `${n.name}${n.summary}${JSON.stringify(n.content)}${n.aliases.join(' ')}`.toLowerCase().includes(query.toLowerCase()));
    return <>
 <div className="home-intro"><span className="eyebrow"><span className="small-dash"/> 给正在寻找方向的你</span><span className="edition">探索手册 / {release.id}</span></div>
 <section className="hero"><div className="hero-copy"><div className="hero-kicker"><Compass size={16}/> 不急着决定，先认识可能</div><h1>找到你的方向，<br />从已有的知识出发<span>。</span></h1><p>看见计算机世界的不同路径，梳理你已拥有的基础。<br className="desktop-break"/>用一次真实的小实践，验证值得继续的下一步。</p><div className="hero-actions"><Link className="button primary" href="/assess">梳理我的学习起点 <ArrowRight size={17}/></Link><Link className="text-link" href="/domains">先看看有哪些领域 <ArrowUpRight size={16}/></Link></div><div className="hero-footnote"><Check size={14}/> 无需完整基础 <span>·</span><Check size={14}/> 没有适配总分 <span>·</span><Check size={14}/> 路线由你决定</div></div>
 <div className="hero-map" aria-label="从已有知识到验证行动的示意"><div className="map-orbit orbit-one"/><div className="map-orbit orbit-two"/><div className="map-tag top"><span className="map-icon"><Network size={18}/></span><div><small>你的起点</small><strong>已有知识与经历</strong></div><span className="map-check"><Check size={14}/></span></div><div className="map-connector">↓</div><div className="map-branches"><span>可复用的基础</span><span>值得验证的未知</span></div><div className="map-connector">↓</div><div className="map-tag bottom"><span className="map-icon"><Route size={18}/></span><div><small>你的下一步</small><strong>一条可以开始的路线</strong></div><ArrowUpRight size={18}/></div><span className="map-caption">每一点积累，都可以连接新的可能。</span><span className="map-spark"><Sparkles size={23}/></span></div></section>
 <section className="journey-strip"><div><span className="step-no">01</span><span><strong>认识方向</strong><small>从专业到领域，再到具体专题</small></span></div><ArrowRight size={17}/><div><span className="step-no">02</span><span><strong>看清起点</strong><small>区分已有基础、缺口与未知</small></span></div><ArrowRight size={17}/><div><span className="step-no">03</span><span><strong>用行动验证</strong><small>回报实践，让路线随证据调整</small></span></div></section>
 <section className="catalog-section"><div className="section-heading"><div><span className="eyebrow">打开计算机世界的地图</span><h2>从你感兴趣的地方开始</h2><p>专业是认识世界的入口，领域是你可以自由探索的方向。</p></div><Link className="text-link" href="/compare">放在一起比较 <ArrowUpRight size={16}/></Link></div>
 <div className="catalog-toolbar"><div className="tabs" role="tablist" aria-label="探索入口"><button role="tab" aria-selected={tab === 'major'} className={tab === 'major' ? 'active' : ''} onClick={() => setTab('major')}><GraduationCap size={17}/>本科专业 <span>5</span></button><button role="tab" aria-selected={tab === 'domain'} className={tab === 'domain' ? 'active' : ''} onClick={() => setTab('domain')}><Layers3 size={17}/>技术与研究领域 <span>12</span></button></div><label className="search-box"><Search size={17}/><input aria-label="搜索专业或领域" placeholder="搜索名称、关键词…" value={query} onChange={e => setQuery(e.target.value)}/></label></div>
 <div className="card-grid">{nodes.map((node, index) => <NodeCard node={node} index={index} key={node.id}/>)}</div>{!nodes.length && <div className="empty-state">没有找到匹配项，试试更短的关键词。</div>}
 </section><div className="bottom-note"><span><Network size={20}/><strong>不必从零开始</strong> 网络、编程、数学与工程经验，可能正是你探索新领域的桥梁。</span><Link href="/knowledge">查看我的知识画像 <ArrowRight size={16}/></Link></div>
 </>;
}
