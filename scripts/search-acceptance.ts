import Database from 'better-sqlite3';
import { mkdirSync, writeFileSync, openSync, closeSync } from 'node:fs';
import { migrate } from '../src/db/migrate';
import { searchPolicy } from '../src/server/search-policy';
import { searchWeb } from '../src/server/search';
import { defaultPreferences } from '../src/server/config';

const topics = ['crypto-engineering', 'ml-foundations', 'http-basics'];
async function main() {
  const plan = topics.map(topicId => ({ topicId, query: searchPolicy(topicId, 'community')?.query }));
  if (!plan.every(p => p.query)) throw new Error('检索验收样例缺少公开查询。');
  if (!process.argv.includes('--execute-approved-three-searches')) { console.log(JSON.stringify({ dryRun: true, maximumSearchRequests: 3, modelRequests: 0, plan }, null, 2)); return; }
  if (process.env.MOCK_AI !== '0' || !process.env.DEEPSEEK_API_KEY?.trim()) throw new Error('真实检索配置未就绪。');
  mkdirSync('.local', { recursive: true });
  // Exclusive ledger prevents accidentally repeating an approved batch, even after interruption.
  closeSync(openSync('.local/search-acceptance-three-requests.lock', 'wx'));
  const db = new Database(':memory:'); migrate(db);
  const settings = { ...defaultPreferences(), aiEnabled: false, searchEnabled: true, searchProvider: 'deepseek' as const, searchScope: 'community' as const };
  const report: { topicId: string; query?: string; result: unknown; publicRows: unknown[] }[] = [];
  let calls = 0;
  try {
    for (const test of plan) {
      const publicRows: unknown[] = [];
      const result = await searchWeb(db, test.topicId, settings, new Date().toISOString(), { transport: async (url, options) => {
        if (++calls > 3) throw new Error('授权次数已用完');
        const response = await fetch(url, options);
        if (response.ok) {
          const data = await response.clone().json() as { results?: { title: string; url: string }[] };
          publicRows.push(...(data.results ?? []).map(row => ({ title: String(row.title).slice(0, 160), url: String(row.url).slice(0, 2000) })));
        }
        return response;
      } });
      report.push({ ...test, result, publicRows });
      writeFileSync('.local/search-acceptance-results.json', JSON.stringify({ checkedAt: new Date().toISOString(), requests: calls, modelRequests: 0, report }, null, 2));
      console.log(JSON.stringify({ topicId: test.topicId, status: result.status, accepted: result.results.map(r => ({ title: r.title, url: r.url, platform: r.platform })) }));
    }
  } finally { db.close(); }
}
void main().catch(() => { console.error('检索验收未完成；不自动重试。请检查本地验收记录与授权次数。'); process.exitCode = 1; });
