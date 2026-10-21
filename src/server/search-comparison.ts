import type Database from 'better-sqlite3';
import type { SearchResult, ServicePreferences, SearchStatus } from '../core/services';
import { searchWeb, type SearchOptions, type SearchOutput } from './search';

const platforms = [
  { id: 'bilibili', label: 'Bilibili' }, { id: 'xiaohongshu', label: '小红书' },
  { id: 'tieba', label: '百度贴吧' }, { id: 'douyin', label: '抖音' },
] as const;
type Options = SearchOptions & { shouldContinue?: () => boolean; batchTimeoutMs?: number };
export async function searchComparison(db: Database.Database, topicRef: string, settings: ServicePreferences, now: string, options: Options = {}): Promise<SearchOutput> {
  const deadline = AbortSignal.timeout(options.batchTimeoutMs ?? 18000);
  const signal = options.signal ? AbortSignal.any([deadline, options.signal]) : deadline;
  const results: SearchResult[] = [], reports: NonNullable<SearchStatus['platforms']> = [];
  let calls = 0;
  // Two requests at a time. Settled results preserve useful platforms when a peer fails.
  for (let start = 0; start < platforms.length; start += 2) {
    const group = platforms.slice(start, start + 2);
    const settled = await Promise.allSettled(group.map(async platform => {
      if (signal.aborted || options.shouldContinue?.() === false) return { results: [], calls: 0, status: { status: 'cancelled', cached: false, retrievedAt: null } } satisfies SearchOutput;
      return searchWeb(db, topicRef, { ...settings, searchScope: 'community', searchPlatform: platform.id }, now, { ...options, signal, fresh: true });
    }));
    for (const [index, entry] of settled.entries()) {
      const platform = group[index];
      const output: SearchOutput = entry.status === 'fulfilled' ? entry.value : { results: [], calls: 0, status: { status: 'failed', cached: false, retrievedAt: null } };
      const selected = output.results.slice(0, 2);
      results.push(...selected); calls += output.calls;
      reports.push({ platform: platform.id, label: platform.label, status: output.status.status, calls: output.calls, query: output.status.query, retrievedAt: output.status.retrievedAt, receivedCount: output.status.receivedCount ?? 0, selectedCount: selected.length });
    }
  }
  const unique = [...new Map(results.map(r => [r.url, r])).values()];
  const receivedCount = reports.reduce((sum, p) => sum + p.receivedCount, 0);
  const allSucceeded = reports.every(p => p.status === 'success');
  let status: SearchStatus['status'] = unique.length ? allSucceeded ? 'success' : 'partial' : reports.some(p => ['failed', 'timeout', 'cancelled'].includes(p.status)) ? 'failed' : receivedCount ? 'no_relevant_results' : 'empty';
  if (reports.every(p => p.status === 'disabled')) status = 'disabled';
  if (reports.every(p => p.status === 'not_configured')) status = 'not_configured';
  if (reports.every(p => p.status === 'unsupported')) status = 'unsupported';
  return { results: unique, calls, status: { status, mode: 'compare', scope: 'community', selectedPlatform: 'all', cached: false, retrievedAt: calls ? now : null, calls, platforms: reports, receivedCount, filteredCount: receivedCount - unique.length, platformCounts: Object.fromEntries(platforms.map(p => [p.label, unique.filter(r => r.platform === p.label).length])) } };
}
