'use client';
import { useState } from 'react';
import Link from 'next/link';
import { providerLabels, type Provider, type ServicePreferences } from '@/core/services';
import { useAction, useApp } from './provider';
import { Badge } from './ui';
import { AccountUsage } from './account-usage';

export function ServiceSettings() {
  const { state } = useApp();
  if (!state) return <section className="panel"><h2>模型与检索设置</h2><p>正在读取服务设置…</p></section>;
  return <ServiceForm key={state.services.preferences.revision} initial={state.services.preferences} />;
}
function ServiceForm({ initial }: { initial: ServicePreferences & { revision: number; migrationRequired: boolean } }) {
  const { state, mutate } = useApp(), { busy, message, setMessage, run } = useAction();
  const [draft, setDraft] = useState<ServicePreferences>(initial), [acknowledged, setAcknowledged] = useState(false);
  const [models, setModels] = useState<Partial<Record<Provider, string[]>>>({});
  if (!state) return null;
  const catalog = state.services.catalog, selected = catalog.providers.find(p => p.id === draft.provider)!;
  const choices = [...new Set([...selected.models, ...(models[draft.provider] ?? []), draft.model].filter(Boolean))];
  function change(patch: Partial<ServicePreferences>) { setDraft({ ...draft, ...patch }); setAcknowledged(false); }
  return <section className="panel"><h2>模型与检索设置</h2>
    <div className="actions"><Badge tone={state.mode === 'external_enabled' ? 'blue' : 'green'}>{state.mode === 'external_enabled' ? `${providerLabels[initial.provider]} 外部顾问已启用` : '本地模式'}</Badge><Badge>{catalog.mock ? 'MOCK_AI 未设为 0，不发送外部请求' : '服务器允许外部调用；仍需本人启用'}</Badge></div>
    {initial.migrationRequired && <div className="notice">需要更新数据库：在根目录运行 pnpm db:migrate，再重启服务。原有个人资料会保留。</div>}
    <div className="form-grid" style={{ marginTop: 20 }}>
      <label className="form-field"><span>模型服务商</span><select aria-label="模型服务商" value={draft.provider} onChange={e => { const provider = e.target.value as Provider; change({ provider, model: catalog.providers.find(p => p.id === provider)?.defaultModel ?? '' }); }}><option value="deepseek">DeepSeek</option><option value="openai">OpenAI</option></select><small>{selected.configured ? '该服务的本地 Key 与接口已配置；有效性需实际调用验证。' : '尚未配置该服务的本地 Key。'}</small></label>
      <label className="form-field"><span>具体模型</span><select aria-label="具体模型" value={draft.model} onChange={e => change({ model: e.target.value })}><option value="">请选择或手动填写模型 ID</option>{choices.map(id => <option key={id} value={id}>{id}</option>)}</select><small>候选名称不代表账户权限，也不代表支持文本顾问。</small></label>
      <label className="form-field"><span>手动填写模型 ID</span><input aria-label="手动填写模型 ID" value={draft.model} maxLength={100} onChange={e => change({ model: e.target.value })} placeholder="从服务商控制台复制完整模型 ID" /></label>
      <div><p className="muted">可读取所选服务账户的模型清单。此操作只向该服务发送认证信息，不发送个人画像。</p><button className="button" disabled={busy || !selected.configured || catalog.mock} onClick={() => void run(async () => { const provider = draft.provider; const result = await mutate<{ models: string[] }>({ action: 'models', provider }); setModels(previous => ({ ...previous, [provider]: result.models })); setMessage(`已读取 ${result.models.length} 个账户模型，可在上方选择。`); })}>读取账户模型列表</button></div>
    </div>
    <fieldset><legend>外部服务开关</legend><div className="inline-options"><label><input type="checkbox" checked={draft.aiEnabled} onChange={e => change({ aiEnabled: e.target.checked })} />启用所选模型的真实 AI 顾问</label><label><input type="checkbox" checked={draft.searchEnabled} onChange={e => change({ searchEnabled: e.target.checked })} />允许顾问在我明确勾选时联网检索</label></div></fieldset>
    <label className="form-field"><span>检索服务（与模型选择独立）</span><select aria-label="检索服务" value={draft.searchProvider} onChange={e => change({ searchProvider: e.target.value as ServicePreferences['searchProvider'] })}><option value="deepseek">DeepSeek 搜索 · 使用 DeepSeek Key</option><option value="tavily">Tavily · 使用独立 Tavily Key</option></select><small>{catalog.search[draft.searchProvider] ? '检索 Key 已配置，权限需实际请求验证。' : '尚未配置该检索服务的 Key。'}</small></label>
    <label className="form-field"><span>检索内容范围</span><select aria-label="检索内容范围" value={draft.searchScope ?? 'community'} onChange={e => change({ searchScope: e.target.value as ServicePreferences['searchScope'] })}><option value="community">学习体验 · Bilibili／小红书／百度贴吧／抖音</option><option value="reference">基础核对 · 已核验的官方与参考来源</option></select><small>默认检索四个平台可公开索引的视频、笔记和讨论。可能无法取得需登录的内容或完整视频；个人经验仅作探索参考。</small></label>
    {(draft.searchScope ?? 'community') === 'community' && <label className="form-field"><span>优先检索平台（快速模式）</span><select aria-label="优先检索平台" value={draft.searchPlatform ?? 'all'} onChange={e => change({ searchPlatform: e.target.value as ServicePreferences['searchPlatform'] })}><option value="all">四平台一起检索</option><option value="bilibili">只检索 Bilibili</option><option value="xiaohongshu">只检索小红书</option><option value="tieba">只检索百度贴吧</option><option value="douyin">只检索抖音</option></select><small>快速模式最多一次检索，可指定平台；顾问页另有四平台对照模式，各站独立实时查询一次。不保证有匹配结果。</small></label>}
    <fieldset><legend>每日调用上限（当前身份，北京时间）</legend><div className="form-grid"><label className="form-field"><span>每日模型请求上限</span><input aria-label="每日模型请求上限" type="number" min={0} max={200} step={1} value={draft.dailyModelLimit ?? 40} onChange={e => change({ dailyModelLimit: Number(e.target.value) })}/></label><label className="form-field"><span>每日检索请求上限</span><input aria-label="每日检索请求上限" type="number" min={0} max={200} step={1} value={draft.dailySearchLimit ?? 20} onChange={e => change({ dailySearchLimit: Number(e.target.value) })}/></label></div><p className="muted">模型格式修正重试计入次数，0 表示不允许该类新请求。四平台对照每轮需预留 4 次检索额度，正常最多 1 次模型总结。此处限制调用次数，不是金额预算；其他身份和工具不受此上限控制。中断请求可能保留预占至当天结束。</p></fieldset>
    <div className="confirmation"><h3>发送范围与费用</h3><p>启用模型后，当前提问、最近最多 20 条顾问对话、所选专题、相关已确认等级与证据类型、活动标签和规则路线摘要会发送给 <strong>{providerLabels[draft.provider]}</strong>。不会发送完整问卷原文、课程／项目证据原文或数据库。</p><p>每次检索还需在顾问页单独勾选；只发送公开技术词与所选来源站点，不发送提问原文。模型与检索可能按服务商规则产生费用。关闭后不再发起新请求；已发送内容无法撤回。</p>{(draft.aiEnabled || draft.searchEnabled) && <div className="inline-options"><label><input aria-label="我理解发送范围和可能产生的 API 费用" type="checkbox" checked={acknowledged} onChange={e => setAcknowledged(e.target.checked)} />我理解发送范围和可能产生的 API 费用</label></div>}</div>
    <div className="actions"><button className="button primary" disabled={busy || initial.migrationRequired || ((draft.aiEnabled || draft.searchEnabled) && !acknowledged)} onClick={() => void run(async () => { await mutate({ action: 'services', preferences: draft, baseRevision: initial.revision, acknowledged }); })}>保存模型与检索设置</button><Link className="button" href="/advisor">打开学习顾问</Link></div><div className="status-message" role="status">{message}</div>
    <AccountUsage />
  </section>;
}
