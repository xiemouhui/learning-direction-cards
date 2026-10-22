import { describe, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';
import { accountInfo } from '../src/server/account';
import { usageSummary } from '../src/server/preferences';
import { migrate } from '../src/db/migrate';
import * as store from '../src/db/store';
const env = { MOCK_AI: '0', DEEPSEEK_API_KEY: 'secret-test-key', TAVILY_API_KEY: 'secret-test-tavily' };
const balance = { is_available: true, balance_infos: [{ currency: 'CNY', total_balance: '12.34', granted_balance: '2.00', topped_up_balance: '10.34' }] };
describe('账户余额与额度只读查询', () => {
  it('仅请求官方余额端点，白名单返回金额，不回传 Key 或额外字段', async () => {
    const transport = vi.fn<typeof fetch>(async () => Response.json({ ...balance, ignored: 'vendor private metadata' }));
    const result = await accountInfo('deepseek', { env, transport });
    expect(result).toMatchObject({ status: 'success', available: true, balances: [{ currency: 'CNY', total: '12.34', granted: '2.00', toppedUp: '10.34' }] });
    expect(transport).toHaveBeenCalledTimes(1);
    expect(String(transport.mock.calls[0][0])).toBe('https://api.deepseek.com/user/balance');
    expect(transport.mock.calls[0][1]).toMatchObject({ method: 'GET', headers: { Authorization: 'Bearer secret-test-key' }, redirect: 'error', cache: 'no-store' });
    expect(JSON.stringify(result)).not.toMatch(/secret|ignored|metadata/);
  });
  it('零余额与不可用状态真实保留，不能与失败混淆', async () => {
    const result = await accountInfo('deepseek', { env, transport: async () => Response.json({ is_available: false, balance_infos: [{ currency: 'USD', total_balance: '0', granted_balance: '0', topped_up_balance: '0' }] }) });
    expect(result).toMatchObject({ status: 'success', available: false, balances: [{ total: '0', currency: 'USD' }] });
  });
  it('演示、缺 Key、ChatGPT 与自定义代理都不外发认证信息', async () => {
    const transport = vi.fn<typeof fetch>();
    expect((await accountInfo('deepseek', { env: {}, transport })).status).toBe('not_configured');
    expect((await accountInfo('deepseek', { env: { ...env, MOCK_AI: '1' }, transport })).status).toBe('disabled');
    expect((await accountInfo('openai', { env, transport })).status).toBe('unsupported');
    expect((await accountInfo('deepseek', { env: { ...env, DEEPSEEK_BASE_URL: 'https://proxy.example/v1' }, transport })).status).toBe('unsupported');
    expect(transport).not.toHaveBeenCalled();
  });
  it('Tavily 分清当前 Key、账户套餐和按量额度，不当作货币余额', async () => {
    const transport = vi.fn<typeof fetch>(async () => Response.json({ key: { usage: 15, limit: null }, account: { plan_usage: 30, plan_limit: 1000, paygo_usage: 0, paygo_limit: 100 } }));
    expect(await accountInfo('tavily', { env, transport })).toMatchObject({ status: 'success', quota: { keyUsed: 15, keyLimit: null, planUsed: 30, planLimit: 1000, paygoUsed: 0, paygoLimit: 100 } });
    expect(String(transport.mock.calls[0][0])).toBe('https://api.tavily.com/usage');
  });
  it('认证错误、限流、网络失败、异常金额与敏感响应均不泄漏也不重试', async () => {
    for (const response of [new Response('secret-test-key', { status: 401 }), new Response('private', { status: 429 }), Response.json({ ...balance, secret: env.DEEPSEEK_API_KEY }), Response.json({ ...balance, balance_infos: [{ ...balance.balance_infos[0], total_balance: '<script>' }] })]) {
      const transport = vi.fn<typeof fetch>(async () => response);
      const result = await accountInfo('deepseek', { env, transport });
      expect(result.status).toBe('failed');
      expect(JSON.stringify(result)).not.toMatch(/secret-test|<script>|private/);
      expect(transport).toHaveBeenCalledTimes(1);
    }
    expect((await accountInfo('deepseek', { env, transport: async () => { throw new Error('secret-test-key'); } })).status).toBe('failed');
  });
  it('本地用量按身份、时间、服务商隔离，并计入失败与重试', () => {
    const db = new Database(':memory:'); db.pragma('foreign_keys=ON'); migrate(db);
    const now = '2026-10-20T12:00:00.000Z';
    try {
      store.createProfile(db, 'owner', now); store.createProfile(db, 'other', now);
      store.addRecord(db, 'owner', 'agentRun', { provider: 'deepseek', calls: 2, searchCalls: 1, usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } }, now);
      store.addRecord(db, 'owner', 'agentRun', { provider: 'openai', calls: 1, usage: null }, now);
      store.addRecord(db, 'owner', 'agentRun', { provider: 'deepseek', calls: 99, usage: { totalTokens: 999 } }, '2026-10-01T00:00:00.000Z');
      store.addRecord(db, 'other', 'agentRun', { provider: 'deepseek', calls: 99, usage: { totalTokens: 999 } }, now);
      expect(usageSummary(db, 'owner', now)).toMatchObject({ externalCalls: 3, searchCalls: 1, knownTokens: 30, unknownUsageCalls: 1, byProvider: [{ provider: 'deepseek', calls: 2, inputTokens: 10, outputTokens: 20, unknownCalls: 0 }, { provider: 'openai', calls: 1, unknownCalls: 1 }] });
    } finally { db.close(); }
  });
});
