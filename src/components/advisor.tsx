'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useApp, useAction } from './provider';
import { PageHeading, Badge } from './ui';
import { nodesOf } from '@/core/catalog';
import { SearchReport, CitationList } from './search-report';
import { providerLabels, type Citation, type ChatResult, type SearchMode } from '@/core/services';

export function Advisor() {
  const { state, mutate } = useApp(), { busy, message, run } = useAction();
  const [searchMode, setSearchMode] = useState<SearchMode>('quick');
  const [input, setInput] = useState(''), [topicId, setTopic] = useState(''), [search, setSearch] = useState(false);
  const settings = state?.services.preferences;
  const enabled = state?.mode === 'external_enabled';
  return <><PageHeading eyebrow="围绕方向、知识关系与行动优先级" title="学习顾问" description="顾问解释规则结果、知识关系与下一步。知识自评和路线调整仍须你单独确认。" action={<Link className="button" href="/settings">选择服务商与模型</Link>} />
    <section className="panel"><div className="actions"><Badge tone={enabled ? 'blue' : 'green'}>{enabled && settings ? `${providerLabels[settings.provider]} · ${settings.model}` : '本地模式 · 外部模型未就绪或未启用'}</Badge><Link className="text-link" href="/settings">修改模型与检索设置 →</Link></div>
      <label className="form-field" style={{ marginTop: 20 }}><span>本次讨论的专题</span><select aria-label="本次讨论的专题" value={topicId} onChange={e => setTopic(e.target.value)}><option value="">使用当前活动路线；没有路线则先讨论入口</option>{nodesOf('subdomain').map(n => <option value={n.id} key={n.id}>{n.name}</option>)}</select></label>
      <div className="chat-log" aria-label="顾问对话记录">{state?.records.filter(r => r.kind === 'message').slice(-20).map(r => <div className={`chat-message ${r.body.role === 'user' ? 'user' : ''} ${(r.body.search as ChatResult['search'] | undefined)?.mode === 'compare' ? 'comparison-message' : ''}`} key={r.id}>
        <small>{r.body.role === 'user' ? '你' : r.body.mode === 'ai' ? `${providerLabels[r.body.provider as keyof typeof providerLabels] ?? '外部模型'} · ${String(r.body.model)}` : '本地提示／故障兜底'}</small>{(r.body.search as ChatResult['search'] | undefined)?.mode === 'compare' && r.body.mode === 'ai' && <strong>综合总结</strong>}{String(r.body.content)}
        {!!r.body.notice && <p className="muted">{String(r.body.notice)}</p>}
        {Array.isArray(r.body.questions) && r.body.questions.length > 0 && <ul>{r.body.questions.map((q, i) => <li key={i}>{String(q)}</li>)}</ul>}
        {!!r.body.search && typeof r.body.search === 'object' && <SearchReport value={r.body.search as ChatResult['search']}/>}
        {Array.isArray(r.body.citations) && <CitationList citations={r.body.citations as Citation[]} comparison={(r.body.search as ChatResult['search'] | undefined)?.mode === 'compare'}/>}
      </div>)}</div>
      <label className="form-field"><span>关于下一步的疑问</span><textarea aria-label="关于下一步的疑问" maxLength={2000} value={input} onChange={e => setInput(e.target.value)} placeholder="为什么这一项先验证，而不是重新学习？" /><small>{input.length} / 2000 字 · 每小时最多 20 次顾问请求</small></label>
      <div className="inline-options"><label><input type="checkbox" checked={search} disabled={!settings?.searchEnabled} onChange={e => setSearch(e.target.checked)} />本次联网核对公开专题资料</label></div><p className="muted">联网查询只使用已配置的公开技术词和来源站点，不发送你的提问原文。默认检索 Bilibili、小红书、百度贴吧、抖音的可公开索引内容；可能无法取得需登录的笔记或完整视频。社区经验会单独标注，不会自动改写知识要求。{!settings?.searchEnabled && '请先在设置中启用检索。'}</p>
      <label className="form-field"><span>本次检索方式</span><select aria-label="本次检索方式" disabled={busy || !search || !settings?.searchEnabled} value={searchMode} onChange={e => setSearchMode(e.target.value as SearchMode)}><option value="quick">快速检索 · 日常追问</option><option value="compare">四平台对照检索 · 方向比较</option></select><small>{searchMode === 'compare' ? 'Bilibili、小红书、百度贴吧、抖音各实时搜索一次，最多 4 次搜索 + 1 次模型总结；不使用缓存、不自动重试。无资料时不调用模型总结。' : '使用设置中的范围与优先平台，最多 1 次搜索，可复用缓存；适合日常追问。'}</small>{searchMode === 'compare' && <small>会使用社区四平台，替代本次快速检索的来源设置；只保证逐平台尝试，不保证都有匹配内容。</small>}</label>
      {busy && search && searchMode === 'compare' && <p role="status">正在分两组检索四个平台并汇总，通常比快速检索更久；完成后逐平台显示状态。</p>}
      <button className="button primary" disabled={busy || !input.trim() || !state} onClick={() => void run(async () => { await mutate({ action: 'chat', message: input, ...(topicId ? { topicId } : {}), search: search && !!settings?.searchEnabled, searchMode }); setInput(''); setSearch(false); })}>{busy ? '正在处理顾问请求…' : enabled ? '发送给所选模型' : '查看本地建议'}</button><div role="status" className="status-message">{message}</div>
    </section></>;
}
