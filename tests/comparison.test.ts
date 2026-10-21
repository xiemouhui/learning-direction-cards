import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { migrate } from '../src/db/migrate';
import { searchComparison } from '../src/server/search-comparison';
import { searchWeb } from '../src/server/search';
import { chat } from '../src/server/advisor';
import { savePreferences, usageSummary } from '../src/server/preferences';
import * as store from '../src/db/store';
import { parseBackup, restoreBackup, backupPreview } from '../src/server/backup';
import type { ServicePreferences, SearchResult } from '../src/core/services';
import type { generateExplanation } from '../src/server/llm';
const now = '2026-10-20T15:00:00.000Z';
const env = { MOCK_AI: '0', DEEPSEEK_API_KEY: 'fixture-test-secret', TAVILY_API_KEY: 'fixture-tavily-secret' };
const prefs: ServicePreferences = { provider: 'deepseek', model: 'fixture', aiEnabled: true, searchEnabled: true, searchScope: 'reference', searchProvider: 'deepseek', searchPlatform: 'tieba' };
const sites = ['bilibili.com', 'xiaohongshu.com', 'tieba.baidu.com', 'douyin.com'];
const paths: Record<string, string> = { 'bilibili.com': '/video/BVfixture', 'xiaohongshu.com': '/explore/fixture', 'tieba.baidu.com': '/p/12345678', 'douyin.com': '/video/12345678' };
function rows(host: string) { return Array.from({ length: 3 }, (_, i) => ({ title: `虚构 AEAD 认证加密学习体验 ${i}`, url: `https://${host}${paths[host]}${i}`, summary: '虚构验收资料，不是真实帖子。' })); }
const requestHost = (options?: RequestInit) => String(JSON.parse(String(options?.body)).query).match(/site:([^\s]+)/)?.[1] ?? '';
const transport = vi.fn<typeof fetch>(async (_url, options) => Response.json({ results: rows(requestHost(options)) }));
const generate = vi.fn<typeof generateExplanation>(async input => ({ draft: { explanation: '虚构跨平台总结：记录各来源的验证建议与局限，不保证平台用户达成一致。', sourceIds: [(input.context as { webResults: SearchResult[] }).webResults[0].id], evidenceIds: [], questions: [] }, usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 }, calls: 1, reason: null }));
let db: Database.Database;
beforeEach(() => { db = new Database(':memory:'); db.pragma('foreign_keys=ON'); migrate(db); store.createProfile(db, 'owner', now); transport.mockClear(); generate.mockClear(); });
afterEach(() => db.close());
const compare = () => searchComparison(db, 'crypto-engineering', prefs, now, { env, transport });
const comparisonDeps = { env, generate, compareSearch: (database: Database.Database, topic: string, settings: ServicePreferences, time: string, options: Parameters<typeof searchComparison>[4]) => searchComparison(database, topic, settings, time, { ...options, transport }), now: () => now };
const input = { action: 'chat' as const, message: '虚构私密提问标记，不得进入搜索词', topicId: 'crypto-engineering', search: true, searchMode: 'compare' as const };
describe('四平台实时对照', () => {
  it('分别发出四次单站请求，每站保留两条，不受快速来源设置影响', async () => {
    const output = await compare();
    expect(output.calls).toBe(4); expect(output.results).toHaveLength(8);
    expect(output.status).toMatchObject({ status: 'success', mode: 'compare', scope: 'community', cached: false, calls: 4 });
    expect(output.status.platforms?.map(p => p.selectedCount)).toEqual([2, 2, 2, 2]);
    expect(transport.mock.calls.map(([, options]) => requestHost(options)).sort()).toEqual([...sites].sort());
    for (const [, options] of transport.mock.calls) { const body = JSON.parse(String(options?.body)); expect(body.query.match(/site:/g)).toHaveLength(1); expect(body.ori_question).toBeUndefined(); }
  });
  it('已有单站缓存时仍实时发出四次，对照后快速检索仍可用缓存', async () => {
    await searchWeb(db, 'crypto-engineering', { ...prefs, searchScope: 'community', searchPlatform: 'bilibili' }, now, { env, transport });
    await compare(); expect(transport).toHaveBeenCalledTimes(5);
    const quick = await searchWeb(db, 'crypto-engineering', { ...prefs, searchScope: 'community', searchPlatform: 'bilibili' }, now, { env, transport });
    expect(quick.calls).toBe(0); expect(quick.status.cached).toBe(true);
    await compare(); expect(transport).toHaveBeenCalledTimes(9);
  });
  it('Tavily 的每个子请求都只限制一个站点，不自动提升深度或追加查询', async () => {
    await searchComparison(db, 'crypto-engineering', { ...prefs, searchProvider: 'tavily' }, now, { env, transport });
    expect(transport).toHaveBeenCalledTimes(4);
    for (const [, options] of transport.mock.calls) expect(JSON.parse(String(options?.body))).toMatchObject({ include_domains: [requestHost(options)], include_domains_mode: 'restrict', search_depth: 'basic', auto_parameters: false });
  });
  it('部分成功、空结果、偏题、HTTP 失败分别记录，不伪造覆盖或重试', async () => {
    const mixed = vi.fn<typeof fetch>(async (_url, options) => {
      const host = requestHost(options);
      return host === 'douyin.com' ? new Response('fixture-secret-error', { status: 429 }) : Response.json({ results: host === 'bilibili.com' ? rows(host) : host === 'xiaohongshu.com' ? [] : [{ title: '偏题 Spring', url: 'https://archive.org/fixture' }] });
    });
    const output = await searchComparison(db, 'crypto-engineering', prefs, now, { env, transport: mixed });
    expect(output.calls).toBe(4); expect(output.status.status).toBe('partial');
    expect(output.status.platforms?.map(p => p.status)).toEqual(['success', 'empty', 'no_relevant_results', 'failed']);
    expect(output.results).toHaveLength(2); expect(output.results.every(r => r.platform === 'Bilibili')).toBe(true);
    expect(JSON.stringify(output)).not.toContain('fixture-secret-error'); expect(mixed).toHaveBeenCalledTimes(4);
  });
  it('至多两路并发，四项都完成后返回', async () => {
    let active = 0, maximum = 0, completed = 0;
    await searchComparison(db, 'crypto-engineering', prefs, now, { env, transport: async (_url, options) => {
      active++; maximum = Math.max(maximum, active); await new Promise(resolve => setTimeout(resolve, 5)); active--; completed++;
      return Response.json({ results: rows(requestHost(options)) });
    } });
    expect(maximum).toBe(2); expect(completed).toBe(4);
  });
  it('子请求超时有独立状态，总截止后不继续发出剩余两项', async () => {
    const hanging = vi.fn<typeof fetch>(async (_url, options) => new Promise((_resolve, reject) => options?.signal?.addEventListener('abort', () => reject(options.signal?.reason), { once: true })));
    const timed = await searchComparison(db, 'crypto-engineering', prefs, now, { env, transport: hanging, timeoutMs: 5, batchTimeoutMs: 1000 });
    expect(timed.calls).toBe(4); expect(timed.status.platforms?.every(p => p.status === 'timeout')).toBe(true);
    hanging.mockClear();
    const expired = await searchComparison(db, 'crypto-engineering', prefs, now, { env, transport: hanging, timeoutMs: 1000, batchTimeoutMs: 5 });
    expect(expired.calls).toBe(2); expect(expired.status.platforms?.slice(2).map(p => p.status)).toEqual(['cancelled', 'cancelled']);
    expect(hanging).toHaveBeenCalledTimes(2);
  });
  it('第一组完成后设置撤销，剩余两站不发送且实际只计两次', async () => {
    let authorized = true;
    const output = await searchComparison(db, 'crypto-engineering', prefs, now, { env, shouldContinue: () => authorized, transport: async (_url, options) => {
      await Promise.resolve(); authorized = false; return Response.json({ results: rows(requestHost(options)) });
    } });
    expect(output.calls).toBe(2); expect(output.status.platforms?.slice(2).map(p => p.calls)).toEqual([0, 0]);
    expect(output.status.status).toBe('partial');
  });
  it('缺 Key、演示、关闭或非法专题不发送任何请求', async () => {
    for (const options of [{ env: {} }, { env: { ...env, MOCK_AI: '1' } }]) expect((await searchComparison(db, 'crypto-engineering', prefs, now, { ...options, transport })).calls).toBe(0);
    expect((await searchComparison(db, 'crypto-engineering', { ...prefs, searchEnabled: false }, now, { env, transport })).calls).toBe(0);
    expect((await searchComparison(db, input.message, prefs, now, { env, transport })).status.status).toBe('unsupported');
    expect(transport).not.toHaveBeenCalled();
  });
});
describe('对照顾问与费用记录', () => {
  it('外发前已经预占四次搜索和一次总结，完成后释放预占', async () => {
    savePreferences(db, 'owner', prefs, 0, true, now, env);
    const compareSearch: typeof searchComparison = (database, topic, settings, time, options) => searchComparison(database, topic, settings, time, { ...options, transport: async (_url, init) => {
      expect(usageSummary(db, 'owner', now).today).toMatchObject({ searchReserved: 4, modelReserved: 1 });
      return Response.json({ results: rows(requestHost(init)) });
    } });
    await chat(db, 'owner', randomUUID(), input, { ...comparisonDeps, compareSearch });
    expect(usageSummary(db, 'owner', now).today).toMatchObject({ searchReserved: 0, modelReserved: 0, searchCalls: 4, modelCalls: 1 });
  });
  it('总结未引用本轮网页时拒绝作为 AI 总结，不追加模型调用', async () => {
    savePreferences(db, 'owner', prefs, 0, true, now, env);
    const localOnly = vi.fn<typeof generateExplanation>(async () => ({ draft: { explanation: '虚构无网页引用总结', sourceIds: ['aead'], evidenceIds: [], questions: [] }, usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 }, calls: 1, reason: null }));
    const result = await chat(db, 'owner', randomUUID(), input, { ...comparisonDeps, generate: localOnly });
    expect(result.mode).toBe('local'); expect(result.notice).toContain('没有引用本次网页资料');
    expect(result.reply).not.toContain('虚构无网页引用总结'); expect(result.citations.filter(c => c.kind === 'web')).toHaveLength(8);
    expect(localOnly).toHaveBeenCalledTimes(1);
  });
  it('第一组期间删除身份，不发送第二组或模型，不复活资料', async () => {
    savePreferences(db, 'owner', prefs, 0, true, now, env);
    let count = 0;
    const compareSearch: typeof searchComparison = (database, topic, settings, time, options) => searchComparison(database, topic, settings, time, { ...options, transport: async (_url, init) => {
      count++; await Promise.resolve(); db.prepare('DELETE FROM profiles WHERE id=?').run('owner');
      return Response.json({ results: rows(requestHost(init)) });
    } });
    await expect(chat(db, 'owner', randomUUID(), input, { ...comparisonDeps, compareSearch })).rejects.toThrow('资料已删除');
    expect(count).toBe(2); expect(generate).not.toHaveBeenCalled(); expect(db.prepare('SELECT * FROM records').all()).toEqual([]);
  });
  it('四次检索后只总结一次，重复请求不会重搜，历史和备份保留逐平台状态', async () => {
    savePreferences(db, 'owner', prefs, 0, true, now, env);
    const key = randomUUID(), result = await chat(db, 'owner', key, input, comparisonDeps);
    expect(result.mode).toBe('ai'); expect(result.citations.filter(c => c.kind === 'web')).toHaveLength(8);
    expect(generate).toHaveBeenCalledTimes(1); expect(generate.mock.calls[0][1]?.maxCalls).toBe(1);
    expect(generate.mock.calls[0][0].context).toMatchObject({ searchOutcome: { mode: 'compare', calls: 4 } });
    expect(transport.mock.calls.every(([, options]) => !String(options?.body).includes(input.message))).toBe(true);
    await chat(db, 'owner', key, input, comparisonDeps); expect(transport).toHaveBeenCalledTimes(4); expect(generate).toHaveBeenCalledTimes(1);
    expect(usageSummary(db, 'owner', now)).toMatchObject({ externalCalls: 1, searchCalls: 4, today: { modelReserved: 0, searchReserved: 0 } });
    const backup = store.exportData(db, 'owner', now), parsed = parseBackup(backup);
    expect(parsed.records.find(r => r.body.role === 'assistant')?.body.search).toMatchObject({ mode: 'compare', calls: 4 });
    store.createProfile(db, 'restored', now); restoreBackup(db, 'restored', backup, backupPreview(backup).hash, 0, now);
    expect(store.state(db, 'restored').records.find(r => r.body.role === 'assistant')?.body.search).toEqual(result.search);
  });
  it('不足四次额度整批拒绝，不先发一部分；快速检索仍可用', async () => {
    savePreferences(db, 'owner', { ...prefs, dailySearchLimit: 3 }, 0, true, now, env);
    await expect(chat(db, 'owner', randomUUID(), input, comparisonDeps)).rejects.toThrow('预留 4 次');
    expect(transport).not.toHaveBeenCalled(); expect(generate).not.toHaveBeenCalled(); expect(store.state(db, 'owner').records).toHaveLength(0);
  });
  it('四平台全部无资料时不调用模型，四次实际请求仍计数', async () => {
    savePreferences(db, 'owner', prefs, 0, true, now, env);
    const compareSearch: typeof searchComparison = (database, topic, settings, time, options) => searchComparison(database, topic, settings, time, { ...options, transport: async () => Response.json({ results: [] }) });
    const result = await chat(db, 'owner', randomUUID(), input, { ...comparisonDeps, compareSearch });
    expect(result.mode).toBe('local'); expect(result.reply).toContain('不调用模型总结'); expect(generate).not.toHaveBeenCalled();
    expect(usageSummary(db, 'owner', now)).toMatchObject({ externalCalls: 0, searchCalls: 4, today: { modelReserved: 0, searchReserved: 0 } });
  });
  it('请求中撤销设置不再启动第二组或模型，并丢弃旧回答', async () => {
    savePreferences(db, 'owner', prefs, 0, true, now, env);
    let saved = false;
    const compareSearch: typeof searchComparison = (database, topic, settings, time, options) => searchComparison(database, topic, settings, time, { ...options, transport: async (_url, init) => {
      await Promise.resolve(); if (!saved) { saved = true; savePreferences(db, 'owner', { ...prefs, aiEnabled: false, searchEnabled: false }, 1, false, now, env); }
      return Response.json({ results: rows(requestHost(init)) });
    } });
    const result = await chat(db, 'owner', randomUUID(), input, { ...comparisonDeps, compareSearch });
    expect(generate).not.toHaveBeenCalled(); expect(result.reply).toContain('资料或服务设置'); expect(result.citations).toEqual([]);
    expect(usageSummary(db, 'owner', now).searchCalls).toBe(2);
  });
});
