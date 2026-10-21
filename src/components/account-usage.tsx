'use client';
import { useState } from 'react';
import type { AccountInfo, AccountProvider } from '@/core/services';
import { useApp } from './provider';

const accounts = [
  { id: 'deepseek', name: 'DeepSeek', url: 'https://platform.deepseek.com/usage' },
  { id: 'openai', name: 'OpenAI', url: 'https://platform.openai.com/usage' },
  { id: 'tavily', name: 'Tavily', url: 'https://app.tavily.com/' },
] as const;
export function AccountUsage() {
  const { state, mutate, refresh } = useApp();
  const [results, setResults] = useState<Partial<Record<AccountProvider, AccountInfo>>>({});
  const [pending, setPending] = useState<AccountProvider | null>(null);
  if (!state) return null;
  const usage = state.services.usage;
  async function load(provider: AccountProvider) {
    if (pending) return;
    setPending(provider);
    // Drop stale values while refreshing; failure never looks like a zero balance.
    setResults(previous => ({ ...previous, [provider]: undefined }));
    try { const result = await mutate<AccountInfo>({ action: 'account', provider }); setResults(previous => ({ ...previous, [provider]: result })); }
    catch { setResults(previous => ({ ...previous, [provider]: { status: 'failed', message: '账户信息读取失败，请稍后重试。' } })); }
    finally { setPending(null); }
  }
  return <div aria-label="API 余额与用量" style={{ marginTop: 24 }}>
    <h3>API 余额与用量</h3>
    <p className="muted">账户数据仅在点击刷新时向对应服务发送认证信息，不发送学习资料或调用模型。余额供本机配置的 Key 所属账户共享；页面刷新后需重新查询。</p>
    <div className="form-grid">{accounts.map(account => {
      const result = results[account.id];
      const configured = account.id === 'tavily' ? state.services.catalog.search.tavily : state.services.catalog.providers.find(p => p.id === account.id)?.configured;
      return <section className="confirmation" key={account.id} aria-label={`${account.name} 账户信息`}>
        <h4>{account.name}{account.id === 'deepseek' ? ' · 模型与搜索共用余额' : account.id === 'tavily' ? ' · 搜索额度' : ' · 模型账户'}</h4>
        <div role="status">{pending === account.id ? <p>正在查询…</p> : result?.status === 'success' ? <>
          {result.balances?.map(b => <div key={b.currency}><p><strong>可用余额 {b.total} {b.currency}</strong></p><p>赠送余额 {b.granted} · 充值余额 {b.toppedUp}</p></div>)}
          {result.available !== undefined && <p>{result.available ? '账户余额可用' : '账户余额不足或暂不可用'}</p>}
          {result.quota && <><p>当前 Key 已用 {result.quota.keyUsed} / {result.quota.keyLimit ?? '未提供上限'} credits</p><p>账户套餐已用 {result.quota.planUsed} / {result.quota.planLimit} credits</p><p>按量额度已用 {result.quota.paygoUsed} / {result.quota.paygoLimit ?? '未提供上限'} credits</p><p className="muted">credits 为服务商额度单位，不是货币余额。</p></>}
          <small>查询时间：{new Date(result.checkedAt).toLocaleString('zh-CN')}</small>
        </> : <p>{result?.message ?? (!configured ? '尚未配置此服务的 Key。' : account.id === 'openai' ? '普通模型 Key 未接入余额查询；官方账户用量接口需管理密钥，请在控制台查看。' : '尚未查询账户信息。')}</p>}</div>
        <div className="actions">{account.id !== 'openai' && <button className="button" disabled={pending !== null || !configured || state.services.catalog.mock} onClick={() => void load(account.id)}>刷新 {account.name} {account.id === 'deepseek' ? '余额' : '额度'}</button>}<a className="button" href={account.url} target="_blank" rel="noreferrer">{account.name} 用量控制台 ↗</a></div>
        {state.services.catalog.mock && account.id !== 'openai' && <small>演示模式不查询外部账户。</small>}
      </section>;
    })}</div>
    <h4>今日用量 · {usage.today.day}（北京时间）</h4><p>模型 {usage.today.modelCalls} / {state.services.preferences.dailyModelLimit ?? 40} 次 · 检索 {usage.today.searchCalls} / {state.services.preferences.dailySearchLimit ?? 20} 次</p>{(usage.today.modelReserved > 0 || usage.today.searchReserved > 0) && <p>请求预占：模型 {usage.today.modelReserved} 次、检索 {usage.today.searchReserved} 次；中断后保守计入当天额度。</p>}<h4>本应用 · 当前身份最近七天用量</h4>
    <p>模型请求 {usage.externalCalls} 次 · 检索请求 {usage.searchCalls} 次 · 已知 token 合计 {usage.knownTokens}</p>
    <p>用量未知的模型请求 {usage.unknownUsageCalls} 次。包含失败请求与格式修正重试，不把本地模板和搜索缓存命中计为外部调用。</p>
    {usage.byProvider.map(row => <p key={row.provider}>{row.provider === 'deepseek' ? 'DeepSeek' : 'OpenAI'} 模型：{row.calls} 次，已知输入 {row.inputTokens} / 输出 {row.outputTokens} tokens；用量未知 {row.unknownCalls} 次。</p>)}
    <p className="muted">这里只统计本应用当前身份的记录，不包含其他工具或身份；未知用量不按零消费计算，不能据此推算完整账单。调用元数据保留 30 天，账户余额不写入数据库。</p>
    <button className="button" onClick={() => void refresh()}>刷新本应用用量</button>
  </div>;
}
