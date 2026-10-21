import { test, expect, type Page } from '@playwright/test';
async function enable(page: Page, searchLimit = 20) {
  await page.goto('/settings');
  await page.getByLabel('检索内容范围').selectOption('reference');
  await page.getByLabel('每日检索请求上限', { exact: true }).fill(String(searchLimit));
  await page.getByLabel('启用所选模型的真实 AI 顾问').check();
  await page.getByLabel('允许顾问在我明确勾选时联网检索').check();
  await page.getByLabel('我理解发送范围和可能产生的 API 费用').check();
  await page.getByRole('button', { name: '保存模型与检索设置' }).click();
  await expect(page.getByText('DeepSeek 外部顾问已启用', { exact: true })).toBeVisible();
  await page.goto('/advisor');
}
async function send(page: Page, topic: string) {
  await page.getByLabel('本次讨论的专题').selectOption(topic);
  await page.getByLabel('本次联网核对公开专题资料').check();
  await page.getByLabel('本次检索方式', { exact: true }).selectOption('compare');
  await page.getByLabel('关于下一步的疑问').fill('虚构验收：比较四个平台的公开学习体验。');
  await page.getByRole('button', { name: '发送给所选模型' }).click();
}
test('快速与四平台模式独立，四次实时请求一次总结，刷新保留报告', async ({ page }) => {
  await enable(page);
  await expect(page.getByLabel('本次检索方式', { exact: true })).toHaveValue('quick');
  await send(page, 'crypto-engineering');
  const report = page.getByRole('region', { name: '四平台检索报告', exact: true });
  await expect(report.getByText('本轮实际发出 4 / 4 次检索请求 · 保留 4 条资料', { exact: true })).toBeVisible();
  await expect(page.getByText('综合总结', { exact: true })).toBeVisible();
  for (const platform of ['Bilibili', '小红书', '百度贴吧', '抖音']) await expect(report.getByText(`${platform}：已取得经过筛选的参考资料`, { exact: true })).toBeVisible();
  await page.locator('details[aria-label="小红书 参考资料"] > summary').click();
  await expect(page.getByRole('link', { name: '虚构小红书资料：AEAD学习经验 ↗', exact: true })).toBeVisible();
  const state = await (await page.request.get('/api/app')).json();
  expect(state.services.usage.searchCalls).toBe(4); expect(state.services.usage.externalCalls).toBe(1);
  expect(state.records.find((r: { body: { search?: { mode?: string } } }) => r.body.search?.mode === 'compare').body.search.platforms).toHaveLength(4);
  await page.setViewportSize({ width: 375, height: 1000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await report.screenshot({ path: '.local/four-platform-report-375.png', style: '.chat-log{max-height:none!important;overflow:visible!important}' });
  await send(page, 'crypto-engineering');
  await expect(page.getByRole('region', { name: '四平台检索报告', exact: true })).toHaveCount(2);
  const again = await (await page.request.get('/api/app')).json();
  expect(again.services.usage.searchCalls).toBe(8); expect(again.services.usage.externalCalls).toBe(2);
  await page.reload();
  await expect(page.getByRole('region', { name: '四平台检索报告', exact: true })).toHaveCount(2);
  await expect(page.getByLabel('本次检索方式', { exact: true })).toHaveValue('quick');
  expect((await (await page.request.get('/api/app')).json()).services.usage.searchCalls).toBe(8);
});
test('部分平台无结果或失败独立显示，下一轮额度不足时不发请求', async ({ page }) => {
  await enable(page, 4);
  await send(page, 'sql-basics');
  const report = page.getByRole('region', { name: '四平台检索报告', exact: true });
  await expect(report.getByText('小红书：失败，继续使用本地依据', { exact: true })).toBeVisible();
  await expect(report.getByText('百度贴吧：没有搜索结果', { exact: true })).toBeVisible();
  await expect(page.getByText('检索状态：部分平台取得匹配资料', { exact: true })).toBeVisible();
  await expect(page.getByText(/虚构四平台对照总结：本轮有资料的平台为Bilibili、抖音/)).toBeVisible();
  await send(page, 'sql-basics');
  await expect(page.getByText(/四平台对照需要预留 4 次检索额度/)).toBeVisible();
  const state = await (await page.request.get('/api/app')).json();
  expect(state.services.usage.searchCalls).toBe(4); expect(state.services.usage.externalCalls).toBe(1);
});
test('四个平台全部偏题时保留状态，无模型总结或虚构引用', async ({ page }) => {
  await enable(page);
  await send(page, 'http-basics');
  const report = page.getByRole('region', { name: '四平台检索报告', exact: true });
  await expect(report.getByText('本轮实际发出 4 / 4 次检索请求 · 保留 0 条资料', { exact: true })).toBeVisible();
  await expect(page.getByText(/四平台对照未取得可用于总结的网页资料，本次不调用模型总结/)).toBeVisible();
  await expect(page.getByRole('link', { name: /虚构偏题资料/ })).toHaveCount(0);
  const state = await (await page.request.get('/api/app')).json();
  expect(state.services.usage.searchCalls).toBe(4); expect(state.services.usage.externalCalls).toBe(0);
});
