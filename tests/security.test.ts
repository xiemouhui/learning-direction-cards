import { expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { trustedEndpoint, authenticatedFetch } from '../src/server/endpoint-policy';
import { issueLocalAccess, validLocalAccess, localRequestAllowed } from '../src/server/local-access';
import { reserveInstanceBudget, completeInstanceBudget } from '../src/server/instance-budget';
import { migrate } from '../src/db/migrate';
import { providerConfig, serviceCatalog } from '../src/server/config';
import { containsCredential } from '../src/server/credential-guard';
import { boundedBody } from '../src/server/body-limit';
import configuration from '../next.config';
import { PHASE_PRODUCTION_BUILD, PHASE_PRODUCTION_SERVER, PHASE_DEVELOPMENT_SERVER } from 'next/constants';

const key = 'a'.repeat(64), now = Date.parse('2026-10-21T00:00:00Z');
it('构建和开发不能覆盖当前服务的不可变生产目录', () => {
  vi.stubEnv('LDC_ACTIVE_BUILD_DIR', '.local/production/active'); vi.stubEnv('LDC_BUILD_DIR', '');
  try {
    expect(configuration(PHASE_PRODUCTION_SERVER).distDir).toBe('.local/production/active');
    expect(configuration(PHASE_PRODUCTION_BUILD).distDir).toBe('.next');
    expect(configuration(PHASE_DEVELOPMENT_SERVER).distDir).toBe('.next');
    vi.stubEnv('LDC_BUILD_DIR', '.next-portable');
    expect(configuration(PHASE_PRODUCTION_BUILD).distDir).toBe('.next-portable');
    expect(configuration(PHASE_PRODUCTION_SERVER).distDir).toBe('.local/production/active');
  } finally { vi.unstubAllEnvs(); }
});
it('入站正文按 UTF-8 字节限长，超限立即拒绝', async () => {
  expect(await boundedBody(new Request('http://127.0.0.1', { method: 'POST', body: '你a' }), 4)).toBe('你a');
  await expect(boundedBody(new Request('http://127.0.0.1', { method: 'POST', body: '你ab' }), 4)).rejects.toMatchObject({ status: 413 });
});
it('误粘贴当前 Key 和常见认证格式时阻止保存或模型发送', () => {
  expect(containsCredential('我的问题：fictional-private-key-123', { DEEPSEEK_API_KEY: 'fictional-private-key-123' })).toBe(true);
  expect(containsCredential('sk-abcdefghijklmnopqrstuvwxyz0123456789', {})).toBe(true);
  expect(containsCredential('先核对知识迁移的前置条件', {})).toBe(false);
});
it('本机访问凭据验证签名、实例归属、格式与有效期', () => {
  const cookie = issueLocalAccess(now, key);
  expect(validLocalAccess(cookie, now, key)).toBe(true);
  expect(validLocalAccess(cookie, now + 12 * 3600000, key)).toBe(false);
  expect(validLocalAccess(cookie, now, 'b'.repeat(64))).toBe(false);
  expect(validLocalAccess(cookie.slice(0, -1) + (cookie.endsWith('0') ? '1' : '0'), now, key)).toBe(false);
  expect(validLocalAccess('owner', now, key)).toBe(false);
});
it('严格核对 Host 与 Origin，拒绝 DNS 重绑定和跨端口调用', () => {
  const origin = 'http://127.0.0.1:3000';
  expect(localRequestAllowed(new Headers({ host: '127.0.0.1:3000', origin }), origin)).toBe(true);
  for (const headers of [{ host: 'evil.example:3000' }, { host: '127.0.0.1:3000', origin: 'http://127.0.0.1:3002' }, { host: '127.0.0.1:3000', 'sec-fetch-site': 'cross-site', 'sec-fetch-mode': 'no-cors' }] as Record<string, string>[]) expect(localRequestAllowed(new Headers(headers), origin)).toBe(false);
  expect(localRequestAllowed(new Headers({ host: 'public.example' }), 'https://public.example')).toBe(false);
});
it('仅顶层文档导航允许从外部链接打开本机，不能用于跨站 API 读取', () => {
  expect(localRequestAllowed(new Headers({ host: '127.0.0.1:3000', 'sec-fetch-site': 'cross-site', 'sec-fetch-mode': 'navigate', 'sec-fetch-dest': 'document' }), 'http://127.0.0.1:3000')).toBe(true);
  expect(localRequestAllowed(new Headers({ host: '127.0.0.1:3000', 'sec-fetch-site': 'cross-site', 'sec-fetch-mode': 'navigate', 'sec-fetch-dest': 'iframe' }), 'http://127.0.0.1:3000')).toBe(false);
});
it('默认只信任官方 API 的精确源与已知基础路径', () => {
  expect(trustedEndpoint('deepseek', 'https://api.deepseek.com/v1', {})).toBe(true);
  for (const url of ['https://api.deepseek.com.evil.example', 'https://api.deepseek.com:444', 'http://api.deepseek.com', 'https://user@api.deepseek.com', 'https://api.deepseek.com/?key=foo', 'https://api.deepseek.com/other', 'https://proxy.example/v1', 'http://127.0.0.1:9999']) expect(trustedEndpoint('deepseek', url, {})).toBe(false);
});
it('自定义接口需要本机显式开关和精确白名单，不能仅凭 HTTPS 自动信任', () => {
  const env = { LDC_ALLOW_CUSTOM_API: '1', LDC_TRUSTED_API_ORIGINS: 'https://proxy.example,http://127.0.0.1:9999' };
  expect(trustedEndpoint('openai', 'https://proxy.example/v1', env)).toBe(true);
  expect(trustedEndpoint('openai', 'http://127.0.0.1:9999/v1', env)).toBe(true);
  expect(trustedEndpoint('openai', 'https://proxy.example.evil/v1', env)).toBe(false);
  expect(trustedEndpoint('openai', 'https://proxy.example/v1', { ...env, LDC_ALLOW_CUSTOM_API: '0' })).toBe(false);
});
it('未信任的配置不会发起请求，目录和配置状态不回传 Key', () => {
  const env = { MOCK_AI: '0', DEEPSEEK_API_KEY: 'security-canary-key-secret', DEEPSEEK_BASE_URL: 'https://proxy.example' };
  expect(providerConfig('deepseek', env).configured).toBe(false);
  expect(JSON.stringify(serviceCatalog(env))).not.toContain(env.DEEPSEEK_API_KEY);
});
it('认证传输拒绝改变目的地，强制重定向错误模式', async () => {
  const transport = vi.fn<typeof fetch>(async () => new Response('{}'));
  const secure = authenticatedFetch('https://api.deepseek.com', transport);
  await expect(secure('https://evil.example')).rejects.toThrow('目的地');
  expect(transport).not.toHaveBeenCalled();
  await secure('https://api.deepseek.com/v1/models', { redirect: 'follow' });
  expect(transport.mock.calls[0][1]?.redirect).toBe('error');
});
it('实际 HTTP 重定向不携带认证跳转到第二个端点', async () => {
  let targetCalls = 0;
  const server = createServer((req, res) => { if (req.url === '/target') { targetCalls++; res.end('{}'); } else { res.writeHead(307, { Location: '/target' }); res.end(); } });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address(); if (!address || typeof address === 'string') throw new Error();
  const base = `http://127.0.0.1:${address.port}`;
  try { await expect(authenticatedFetch(base)(base, { headers: { Authorization: 'Bearer fictional-canary' } })).rejects.toThrow(); expect(targetCalls).toBe(0); }
  finally { server.closeAllConnections(); await new Promise<void>(res => server.close(() => res())); }
});
it('实例预算持久预占，跨身份、删除资料与中断均不能重置', () => {
  const db = new Database(':memory:'); migrate(db);
  try {
    const env = { LDC_DAILY_MODEL_LIMIT: '2', LDC_DAILY_SEARCH_LIMIT: '4' }, time = new Date(now).toISOString();
    const first = reserveInstanceBudget(db, 2, 4, time, env);
    expect(() => reserveInstanceBudget(db, 1, 0, time, env)).toThrow('本机今日');
    db.exec('DELETE FROM profiles');
    expect(() => reserveInstanceBudget(db, 0, 1, time, env)).toThrow('本机今日');
    completeInstanceBudget(db, first, 1, 0, time);
    expect(reserveInstanceBudget(db, 1, 4, time, env)).toBeTruthy();
    expect(reserveInstanceBudget(db, 2, 4, new Date(now + 86400000).toISOString(), env)).toBeTruthy();
  } finally { db.close(); }
});
it('实例并发上限生效，非法上限按禁止请求处理', () => {
  const db = new Database(':memory:'); migrate(db);
  try {
    const time = new Date(now).toISOString();
    reserveInstanceBudget(db, 1, 0, time, { LDC_MAX_EXTERNAL_CONCURRENCY: '1' });
    expect(() => reserveInstanceBudget(db, 1, 0, time, { LDC_MAX_EXTERNAL_CONCURRENCY: '1' })).toThrow('处理中');
    expect(() => reserveInstanceBudget(db, 1, 0, time, { LDC_DAILY_MODEL_LIMIT: 'NaN' })).toThrow('本机今日');
  } finally { db.close(); }
});
