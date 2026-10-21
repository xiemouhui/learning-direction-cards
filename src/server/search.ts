import type Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { ChatResult, SearchResult, ServicePreferences } from '../core/services';
import { providerConfig, type Environment } from './config';
import { COMMUNITY_PLATFORMS, publicUrl, rankSearchResults, searchPolicy, type SearchScope } from './search-policy';
export { publicUrl } from './search-policy';

export type SearchOutput = { results: SearchResult[]; status: ChatResult['search']; calls: number };
function clean(value: string, limit: number) { return value.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, limit); }
// 只接受已发布专题 ID 或准确名称；不将任意文本或个人信息拼入查询。
export function searchQuery(topicRef: string, legacyYear?: number, scope: SearchScope = 'community') {
  void legacyYear; // 兼容旧调用；基础资料查询不强加年份。
  return searchPolicy(topicRef, scope)?.query ?? null;
}
const rowsSchema = z.array(z.object({ title: z.string().max(10000), url: z.string().max(8192), summary: z.string().max(100000).optional(), snippet: z.string().max(100000).optional(), content: z.string().max(100000).optional() })).max(50);
const cachedSchema = z.object({ policy: z.string(), receivedCount: z.number().int().min(0).max(50), results: z.array(z.object({ id: z.string(), title: z.string(), url: z.string(), summary: z.string(), retrievedAt: z.string().nullable(), cached: z.boolean(), kind: z.literal('web') })).max(5) });
export type SearchOptions = { env?: Environment; transport?: typeof fetch; fresh?: boolean; timeoutMs?: number; signal?: AbortSignal };
export async function searchWeb(db: Database.Database, topicRef: string, settings: ServicePreferences, now: string, options: SearchOptions = {}): Promise<SearchOutput> {
  const env = options.env ?? process.env, transport = options.transport ?? fetch;
  const base = { cached: false, retrievedAt: null };
  if (!settings.searchEnabled) return { results: [], status: { ...base, status: 'disabled' }, calls: 0 };
  const config = providerConfig('deepseek', env), key = settings.searchProvider === 'deepseek' ? config.key : env.TAVILY_API_KEY?.trim();
  if (env.MOCK_AI !== '0' || !key || (settings.searchProvider === 'deepseek' && !config.configured)) return { results: [], status: { ...base, status: 'not_configured' }, calls: 0 };
  const policy = searchPolicy(topicRef, settings.searchScope ?? 'community', undefined, settings.searchPlatform ?? 'all');
  if (!policy) return { results: [], status: { ...base, status: 'unsupported' }, calls: 0 };
  const query = policy.query, metadata = { query, policyVersion: policy.version, scope: policy.scope, selectedPlatform: settings.searchPlatform ?? 'all' };
  const coverage = (results: SearchResult[]) => policy.scope === 'community' ? { platformCounts: Object.fromEntries(COMMUNITY_PLATFORMS.map(p => [p.label, results.filter(r => r.platform === p.label).length])) } : {};
  const cacheKey = createHash('sha256').update(JSON.stringify([settings.searchProvider, settings.searchProvider === 'deepseek' ? config.baseURL : 'tavily', policy.fingerprint])).digest('hex');
  const cached = options.fresh ? undefined : db.prepare('SELECT body,retrieved_at FROM search_cache WHERE key=? AND expires_at>?').get(cacheKey, now) as { body: string; retrieved_at: string } | undefined;
  if (cached) {
    try {
      const parsed = cachedSchema.parse(JSON.parse(cached.body));
      if (parsed.policy === policy.fingerprint && parsed.results.length) {
        const results = rankSearchResults(policy, parsed.results).map(r => ({ ...r, cached: true, retrievedAt: cached.retrieved_at }));
        if (results.length === parsed.results.length && parsed.receivedCount >= results.length) return { results, status: { status: 'success', cached: true, retrievedAt: cached.retrieved_at, ...metadata, ...coverage(results), receivedCount: parsed.receivedCount, filteredCount: parsed.receivedCount - results.length }, calls: 0 };
      }
    } catch { /* old, malformed or untrusted cached bodies cannot bypass current filtering */ }
  }
  const timeout = AbortSignal.timeout(options.timeoutMs ?? 8000);
  const signal = options.signal ? AbortSignal.any([timeout, options.signal]) : timeout;
  if (signal.aborted) return { results: [], status: { ...base, ...metadata, status: 'cancelled' }, calls: 0 };
  try {
    const deepseek = settings.searchProvider === 'deepseek';
    const root = config.baseURL.replace(/\/v1\/?$/, '').replace(/\/$/, '');
    const domains = [...new Set(policy.anchors.map(a => a.host))].slice(0, policy.scope === 'community' ? 4 : 2);
    const response = await transport(deepseek ? `${root}/v1/tools/search` : 'https://api.tavily.com/search', {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, signal, redirect: 'error',
      body: JSON.stringify(deepseek ? { query, count: 5, need_content: false } : { query, max_results: 5, search_depth: 'basic', include_domains: domains, include_domains_mode: 'restrict', auto_parameters: false, include_raw_content: false, include_answer: false }),
    });
    if (!response.ok) throw new Error('检索请求失败');
    const raw = await response.text(); if (raw.length > 200000) throw new Error('检索响应过长');
    const data = z.object({ results: rowsSchema }).parse(JSON.parse(raw));
    const rows: SearchResult[] = data.results.flatMap(row => {
      const url = publicUrl(row.url); return url ? [{ id: '', title: clean(row.title, 160), url, summary: clean(row.summary ?? row.snippet ?? row.content ?? '', 1000), retrievedAt: now, cached: false, kind: 'web' as const }] : [];
    });
    const results = rankSearchResults(policy, rows), receivedCount = data.results.length;
    if (results.length) db.prepare('INSERT INTO search_cache VALUES (?,?,?,?,?,?,?) ON CONFLICT(key) DO UPDATE SET body=excluded.body,retrieved_at=excluded.retrieved_at,expires_at=excluded.expires_at,updated_at=excluded.updated_at').run(cacheKey, settings.searchProvider, JSON.stringify({ policy: policy.fingerprint, receivedCount, results }), now, new Date(Date.parse(now) + 7 * 86400000).toISOString(), now, now);
    return { results, status: { status: results.length ? 'success' : receivedCount ? 'no_relevant_results' : 'empty', cached: false, retrievedAt: now, ...metadata, ...coverage(results), receivedCount, filteredCount: receivedCount - results.length }, calls: 1 };
  } catch { return { results: [], status: { ...base, ...metadata, status: signal.aborted ? 'timeout' : 'failed' }, calls: 1 }; }
}
