'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, Compass, Layers3, Network, Route, LayoutDashboard, ArrowUpRight, Settings2, Info, Menu, X, Sprout } from 'lucide-react';
import { useState, ReactNode } from 'react';
import { useApp } from './provider';
import { providerLabels } from '@/core/services';
const nav = [['/', '探索方向', Compass], ['/domains', '领域与专题', Layers3], ['/knowledge', '我的知识画像', Network], ['/transfer', '知识迁移路线', Route], ['/dashboard', '学习工作台', LayoutDashboard]] as const;
export function Shell({ children }: {
    children: ReactNode;
}) {
    const path = usePathname(), [open, setOpen] = useState(false);
    const { error, refresh, state } = useApp();
    return <div className="app-shell"><a className="skip-link" href="#main">跳到正文</a><div className="mobile-bar"><Link href="/">方向卡</Link><button className="icon-button" aria-label={open ? '关闭导航' : '打开导航'} onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button></div>
 <aside className={`sidebar ${open ? 'is-open' : ''}`}><Link className="brand" href="/" onClick={() => setOpen(false)}><span className="brand-symbol"><BookOpen size={22}/></span><span>方向卡<small>计算机学习探索指南</small></span></Link>
 <div className="sidebar-label">从认知，到行动</div><nav aria-label="主导航">{nav.map(([href, label, Icon]) => <Link key={href} href={href} className={path === href || (href !== '/' && path.startsWith(href)) ? 'nav-link selected' : 'nav-link'} onClick={() => setOpen(false)}><Icon size={19}/>{label}{href === path && <span className="nav-dot"/>}</Link>)}</nav>
 <div className="sidebar-note"><Sprout size={24}/><p>方向不必一次选定。<br />从一次小小的验证开始。</p><Link href="/assess" onClick={() => setOpen(false)}>梳理我的起点 <ArrowUpRight size={16}/></Link></div>
 <div className="sidebar-bottom"><Link href="/compare">方向对比 <ArrowUpRight size={15}/></Link><Link href="/settings"><Settings2 size={17}/>设置与隐私</Link><Link href="/about"><Info size={17}/>方法与来源</Link><div className="local-label"><span /> {state?.mode === 'external_enabled' ? providerLabels[state.services.preferences.provider] + ' 顾问已启用' : '本地模式 · 无需 API Key'}</div></div></aside>
 <div className="main-shell"><header className="topbar"><span>学习是一场不断校准的探索</span><div><Link href="/advisor" className="tiny-status">学习顾问</Link><Link href="/dashboard">我的工作台 <ArrowUpRight size={15}/></Link></div></header>
 <main id="main" tabIndex={-1}>{error && <div className="notice error" role="alert">{error}<button onClick={() => void refresh()}>重试</button></div>}{children}</main><footer>方向卡 · 让已有知识，成为下一步的起点。<span>本地优先 / 证据驱动 / 自主决定</span></footer></div></div>;
}
