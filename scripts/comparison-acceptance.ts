import Database from 'better-sqlite3';
import { mkdirSync, writeFileSync, openSync, closeSync } from 'node:fs';
import { migrate } from '../src/db/migrate';
import { searchPolicy } from '../src/server/search-policy';
import { searchComparison } from '../src/server/search-comparison';
import { defaultPreferences, providerConfig } from '../src/server/config';

const topics = ['crypto-engineering', 'ml-foundations', 'http-basics'];
const platforms = ['bilibili', 'xiaohongshu', 'tieba', 'douyin'] as const;
async function main() {
  const plan = topics.map(topicId => ({ topicId, queries: platforms.map(platform => ({ platform, query: searchPolicy(topicId, 'community', undefined, platform)?.query })) }));
  if (!plan.every(p => p.queries.every(q => q.query))) throw new Error('公开查询计划不完整。');
  if (!process.argv.includes('--execute-approved-twelve-searches')) {
    console.log(JSON.stringify({ dryRun: true, maximumSearchRequests: 12, modelRequests: 0, retries: 0, includesPersonalData: false, plan }, null, 2)); return;
  }
  const config = providerConfig('deepseek', process.env);
  if (process.env.MOCK_AI !== '0' || !config.configured || new URL(config.baseURL).hostname !== 'api.deepseek.com') throw new Error('需官方真实检索配置。');
  mkdirSync('.local', { recursive: true });
  closeSync(openSync('.local/comparison-acceptance-twelve-requests.lock', 'wx'));
  const db = new Database(':memory:'); migrate(db);
  const settings = { ...defaultPreferences(), aiEnabled: false, searchEnabled: true, searchProvider: 'deepseek' as const };
  const report: unknown[] = [];
  let calls = 0;
  const save = () => writeFileSync('.local/comparison-acceptance-results.json', JSON.stringify({ checkedAt: new Date().toISOString(), requests: calls, modelRequests: 0, report }, null, 2));
  try {
    for (const test of plan) {
      const responses: { status: number }[] = [];
      const result = await searchComparison(db, test.topicId, settings, new Date().toISOString(), { transport: async (url, options) => {
        if (calls >= 12) throw new Error('授权次数已用完');
        calls++; save(); // Persist attempts before network I/O; never resume or retry this batch.
        const response = await fetch(url, options);
        responses.push({ status: response.status });
        return response;
      } });
      report.push({ topicId: test.topicId, responses, result, review: result.results.map(r => ({ id: r.id, url: r.url, relevance: 'pending', reachable: 'pending', summarySupported: 'pending', beginnerUseful: 'pending' })) });
      save();
      console.log(JSON.stringify({ topicId: test.topicId, calls: result.calls, status: result.status.status, platforms: result.status.platforms, retained: result.results.length }));
    }
  } finally { save(); db.close(); }
}
void main().catch(() => { console.error('验收未完成；无自动重试，不输出密钥或供应商原始错误。'); process.exitCode = 1; });
