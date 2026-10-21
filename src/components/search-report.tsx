import { platformSearchLinks } from '@/core/platform-links';
import type { SearchStatus, Citation } from '@/core/services';
const labels: Record<SearchStatus['status'], string> = { success: '已取得经过筛选的参考资料', partial: '部分平台取得匹配资料', empty: '没有搜索结果', no_relevant_results: '未找到匹配的参考资料', unsupported: '专题检索配置待完善，本次未请求', failed: '失败，继续使用本地依据', timeout: '检索超时', cancelled: '已取消，未发出请求', disabled: '未启用', not_configured: '未配置', not_requested: '本次未请求' };
const platformLabels: Record<string, string> = { bilibili: 'Bilibili', xiaohongshu: '小红书', tieba: '百度贴吧', douyin: '抖音' };
export function SearchReport({ value }: { value: SearchStatus }) {
  const comparison = value.mode === 'compare';
  const publicQuery = value.query ?? value.platforms?.find(p => p.query)?.query;
  return <div className="search-report">
    <small>{comparison ? '四平台实时对照' : '快速检索'}</small><small>检索状态：{labels[value.status] ?? '未知'}</small>
    {comparison && value.platforms ? <section aria-label="四平台检索报告"><h4>四平台检索报告</h4><p>本轮实际发出 {value.calls ?? 0} / 4 次检索请求 · 保留 {value.platforms.reduce((sum, p) => sum + p.selectedCount, 0)} 条资料</p>
      {value.platforms.map(p => <div className="source-item" key={p.platform} aria-label={`${p.label} 检索状态`}><strong>{p.label}：{labels[p.status]}</strong><small>请求 {p.calls} 次 · 返回 {p.receivedCount} 条 · 保留 {p.selectedCount} 条</small>{p.query && <details><summary>{p.label} 公开检索词</summary><p>{p.query}</p></details>}</div>)}
      <p className="muted">各平台独立限定域名检索，不读取缓存、不自动重试。没有结果不等于平台没有内容；公开摘要不代表看过完整视频或笔记。</p>
    </section> : <>
      {value.scope && <small>检索范围：{value.scope === 'community' ? platformLabels[value.selectedPlatform ?? ''] ?? 'Bilibili／小红书／百度贴吧／抖音' : '已核验的官方与参考来源'}</small>}
      {value.query && <small>公开检索词：{value.query}</small>}
      {value.receivedCount !== undefined && <small>返回 {value.receivedCount} 条 · 筛除或去重 {value.filteredCount ?? 0} 条{value.cached ? ' · 缓存结果' : ''}</small>}
    </>}
    {value.platformCounts && <small>本次匹配：{Object.entries(value.platformCounts).map(([label, count]) => `${label} ${count} 条`).join(' · ')}</small>}
    {value.scope === 'community' && publicQuery && <details><summary>直接去平台搜索公开专题</summary><p>外部搜索入口，需要时自行登录；打开链接不调用本应用的搜索 API，也不代表已核验结果。</p><div className="actions">{platformSearchLinks(publicQuery).map(link => <a className="button" key={link.label} href={link.url} target="_blank" rel="noreferrer">去{link.label}搜索 ↗</a>)}</div></details>}
  </div>;
}
function Sources({ citations }: { citations: Citation[] }) {
  return <>{citations.map(c => <div key={c.id}><a href={c.url} target="_blank" rel="noopener noreferrer">{c.title} ↗</a><small>{c.kind === 'knowledge' ? '知识库来源' : c.sourceType === 'community' ? `${c.platform ?? '社区平台'} · 社区经验` : '参考来源检索'} · {c.retrievedAt ?? '日期未知'}{c.cached ? ' · 缓存结果' : ''}{c.usedInAnswer === false ? ' · 检索参考，未被回答引用' : ''}</small></div>)}</>;
}
export function CitationList({ citations, comparison }: { citations: Citation[]; comparison: boolean }) {
  if (!comparison) return <div className="chat-citations"><Sources citations={citations}/></div>;
  return <div className="chat-citations"><h4>按平台查看参考资料</h4>{Object.values(platformLabels).map(platform => {
    const group = citations.filter(c => c.platform === platform && c.kind === 'web');
    return group.length > 0 && <details key={platform} aria-label={`${platform} 参考资料`}><summary>{platform} · {group.length} 条参考资料</summary><Sources citations={group}/></details>;
  })}{citations.some(c => c.kind === 'knowledge') && <details><summary>本地知识库依据</summary><Sources citations={citations.filter(c => c.kind === 'knowledge')}/></details>}</div>;
}
