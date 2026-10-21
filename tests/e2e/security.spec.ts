import { test, expect } from './fixtures';
import { createBootstrapToken } from '../../scripts/security/local-session.mjs';
import { resolve } from 'node:path';

test('本地 API 需启动入口授权，直接访问首页不会自动授权，CSP 可正常水合', async ({ request, page }) => {
  expect((await request.get('/api/app')).status()).toBe(401);
  await request.get('/');
  expect((await request.get('/api/app')).status()).toBe(401);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect((await page.request.get('/api/app')).status()).toBe(200);
  const cookies = await page.context().cookies();
  const auth = cookies.find(c => c.name === 'direction_local_access');
  expect(auth?.httpOnly).toBe(true); expect(auth?.sameSite).toBe('Strict');
  const response = await page.request.get('/');
  const policy = response.headers()['content-security-policy'];
  expect(policy).toContain("frame-ancestors 'none'");
  expect(policy).not.toContain("script-src 'self' 'unsafe-inline'");
  const nonce = policy.match(/'nonce-([^']+)'/)?.[1]; expect(nonce).toBeTruthy();
  expect(await response.text()).toContain(`nonce="${nonce}"`);
  await page.getByRole('link', { name: '设置与隐私', exact: true }).first().click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('设置与隐私');
});

test('启动器的一次性片段授权可建立会话，地址立即清除且不能重放', async ({ page }) => {
  await page.context().clearCookies({ name: 'direction_local_access' });
  const token = createBootstrapToken(resolve(process.env.LDC_TEST_SECURITY_DIR ?? '.local/e2e-security'));
  await page.goto(`/#local-access=${token}`);
  await expect.poll(async () => (await page.request.get('/api/app')).status()).toBe(200);
  await expect(page).toHaveURL('http://127.0.0.1:3001/');
  const replay = await page.request.post('/api/local-session', { headers: { 'x-app-request': '1' }, data: { token } });
  expect(replay.status()).toBe(401);
});

test('跨站、伪造 Host 与其他 localhost 端口不能访问 API', async ({ page }) => {
  await page.goto('/');
  for (const headers of [{ origin: 'https://evil.example' }, { host: 'evil.example:3001' }, { origin: 'http://127.0.0.1:3002' }, { 'sec-fetch-site': 'cross-site' }] as Record<string, string>[]) {
    expect((await page.request.get('/api/app', { headers })).status()).toBe(403);
  }
  const tampered = await page.context().cookies();
  await page.context().addCookies(tampered.map(c => c.name === 'direction_local_access' ? { ...c, value: 'forged' } : c));
  expect((await page.request.get('/api/app')).status()).toBe(401);
});

test('误粘贴 Key 的请求不会保存到对话、导出或返回原文', async ({ page }) => {
  await page.goto('/');
  const response = await page.request.post('/api/app', { headers: { 'x-app-request': '1', 'idempotency-key': crypto.randomUUID() }, data: { action: 'chat', message: 'fixture-deepseek-key' } });
  expect(response.status()).toBe(400);
  expect(await response.text()).not.toContain('fixture-deepseek-key');
  const exported = await page.request.get('/api/app?export=1');
  expect(exported.ok()).toBe(true);
  expect(await exported.text()).not.toContain('fixture-deepseek-key');
});
