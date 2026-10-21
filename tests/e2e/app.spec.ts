import { test, expect, authorizeContext } from './fixtures';
import type { Page } from '@playwright/test';
import catalog from '../../knowledge/releases/2026-10-21.5.json';
async function confirm(page: Page, name: string, level: string, evidence: string) {
    const card = page.locator('.knowledge-item').filter({ has: page.getByRole('heading', { name, exact: true }) });
    await card.getByRole('button', { name: '核对与修改' }).click();
    const editor = page.locator('#knowledge-editor');
    await editor.getByLabel('掌握等级').selectOption(level);
    await editor.getByLabel('证据与局限').fill(evidence);
    await editor.getByRole('button', { name: '预览知识变化' }).click();
    await editor.getByRole('button', { name: '确认知识变化' }).click();
    await expect(editor).toHaveCount(0);
}

test('十二领域显示覆盖边界，新增专题可进入路线分析', async ({ page }) => {
    await page.goto('/domains');
    const main = page.getByRole('main');
    await expect(main.getByTestId('catalog-coverage')).toHaveText('领域入口覆盖 12 / 12 · 可探索专题 26 个 · 内容版本 2026-10-21.5');
    await expect(main.getByLabel('内容覆盖').locator('option')).toHaveCount(2);
    await expect(main.locator('.node-card').filter({ hasText: /待扩充|部分覆盖|待补充/ })).toHaveCount(0);
    await expect(main.locator('.node-card')).toHaveCount(12);
    await main.getByLabel('内容覆盖').selectOption('complete');
    await expect(main.locator('.node-card')).toHaveCount(12);
    for (const domain of catalog.nodes.filter(n => n.type === 'domain')) {
        await page.goto(`/domains/${domain.id}`);
        await expect(page.getByRole('heading', { name: domain.name, exact: true })).toBeVisible();
        await expect(page.getByText('尚未覆盖的方向', { exact: true })).toBeVisible();
        await expect(page.getByText(`已覆盖范围：${domain.content.coverageScope}`)).toBeVisible();
        const topics = catalog.nodes.filter(n => n.type === 'subdomain' && n.content.domain === domain.id);
        await expect(main.locator('.node-card')).toHaveCount(topics.length);
    }
    for (const topic of catalog.nodes.filter(n => n.type === 'subdomain' && ['robotics', 'graphics-visual', 'hci-media', 'theory-algorithms', 'networks', 'software-systems', 'data-science-systems'].includes(String(n.content.domain)))) {
        await page.goto(`/topics/${topic.id}`);
        await expect(page.getByRole('heading', { name: new RegExp('验证项目：') })).toBeVisible();
        await expect(page.getByRole('link', { name: '规划探索路线' })).toHaveAttribute('href', `/transfer?topic=${topic.id}&mode=explore`);
    }
    await page.goto('/transfer?topic=http-basics&mode=deep');
    await page.getByRole('button', { name: '分析复用与知识缺口' }).click();
    await expect(page.getByText('HTTP 请求与响应', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '保存路线版本' })).toBeVisible();
});
test('网工 → 密码工程 → 回报 → 确认知识 → 新路线版本', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /找到你的方向/ })).toBeVisible();
    await page.getByRole('link', { name: '梳理我的学习起点' }).click();
    await page.getByRole('textbox').fill('虚构验收用户：网络工程，课程与等级独立核对');
    await page.getByRole('button', { name: '用当前信息看结果' }).click();
    await expect(page).toHaveURL(/result\/[a-f0-9-]+/);
    await expect(page.getByText('三项独立判断 · 没有综合适配分')).toBeVisible();
    await page.goto('/knowledge');
    await confirm(page, '计算机网络基础', '3', '虚构网络课程实验，能够解释链路与协议，未验证全部网络能力');
    await confirm(page, 'C / C++ 基础', '3', '虚构 C 项目，能够修改简单程序，未做密码设计');
    await confirm(page, '离散数学基础', '1', '仅接触集合与逻辑，不代表数论或概率掌握');
    await page.goto('/transfer?topic=crypto-engineering');
    await page.getByRole('button', { name: '分析复用与知识缺口' }).click();
    await expect(page.locator('.gap-card').getByText('可复用', { exact: true })).toBeVisible();
    await expect(page.locator('.gap-card').getByRole('heading', { name: 'C / C++ 基础', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '保存路线版本' }).click();
    await expect(page).toHaveURL(/transfer\/[a-f0-9-]+$/);
    await page.getByRole('button', { name: '设为活动计划' }).click();
    await page.getByRole('link', { name: '进入学习工作台' }).click();
    await page.getByLabel('实践回报').fill('虚构验收：使用成熟库记录正常输入与被篡改输入，理解认证失败，未证明生产安全');
    await page.getByRole('button', { name: '保存任务回报' }).click();
    await expect(page.getByText('任务回报已保存，知识等级尚未改变。')).toBeVisible();
    await page.getByRole('link', { name: '核对并确认掌握自评' }).click();
    await confirm(page, '认证加密与安全使用', '2', '虚构任务记录：能够解释机密性、完整性、nonce 与标签验证失败；并非外部认证');
    await page.goto('/dashboard');
    await page.getByRole('button', { name: '比较当前画像下的新路线' }).click();
    await expect(page.getByText('基于路线版本 1 → 新版本')).toBeVisible();
    await page.getByRole('button', { name: '确认应用新路线' }).click();
    await expect(page.getByText('活动计划 · 版本 2')).toBeVisible();
    await page.reload();
    await expect(page.getByText('活动计划 · 版本 2')).toBeVisible();
    await page.goto('/settings');
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: '下载个人资料 JSON' }).click();
    expect((await download).suggestedFilename()).toContain('个人资料');
    await page.getByRole('button', { name: '开始删除全部资料' }).click();
    await page.getByRole('textbox', {name:'输入“删除全部个人资料”继续'}).fill('删除全部个人资料');
    await page.getByRole('button', { name: '确认永久删除' }).click();
    await expect(page.getByText('全部个人资料已删除；当前浏览器已获得新的空白身份。')).toBeVisible();
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: '还没有活动计划' })).toBeVisible();
});
test('草稿刷新、跳过与零预算', async ({ page }) => {
    await page.goto('/assess');
    await page.getByRole('textbox').fill('虚构草稿');
    await page.reload();
    await expect(page.getByRole('textbox')).toHaveValue('虚构草稿');
    await page.getByRole('button', { name: '暂时跳过' }).click();
    await expect(page.getByText('第 2 / 10 题')).toBeVisible();
    await page.goto('/transfer');
    await page.getByLabel('每周预算', { exact: true }).fill('0');
    await page.getByRole('button', { name: '分析复用与知识缺口' }).click();
    await expect(page.getByText('当前预算为 0，保存目标和检查点，不安排正时长行动。')).toBeVisible();
});

test('比较语言路线、切换、保存与刷新后保留支路', async ({ page }) => {
    await page.goto('/transfer?topic=crypto-engineering');
    await page.getByRole('button', { name: '分析复用与知识缺口' }).click();
    const comparison = page.locator('section').filter({ has: page.getByRole('heading', { name: '比较候选路线', exact: true }) });
    await expect(comparison.locator('tbody tr')).toHaveCount(2);
    await expect(comparison.getByText('C / C++ 基础', { exact: true })).toBeVisible();
    await expect(comparison.getByText('Python 基础', { exact: true })).toBeVisible();
    await page.setViewportSize({ width: 375, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    expect(await comparison.locator('.route-candidates').evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true);
    await comparison.screenshot({ path: '.local/route-candidates-375.png' });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await comparison.getByRole('button', { name: '选择Python 基础路线', exact: true }).click();
    await expect(page.locator('.gap-card').filter({ has: page.getByRole('heading', { name: 'Python 基础', exact: true }) })).toHaveCount(1);
    await expect(page.locator('.gap-card').filter({ has: page.getByRole('heading', { name: 'C / C++ 基础', exact: true }) })).toHaveCount(0);
    const select = comparison.getByLabel('可选前置 1');
    const cOption = await select.locator('option').filter({ hasText: 'C / C++ 基础' }).getAttribute('value');
    await select.selectOption(cOption!);
    await expect(page.locator('.gap-card').filter({ has: page.getByRole('heading', { name: 'C / C++ 基础', exact: true }) })).toHaveCount(1);
    await comparison.getByRole('button', { name: '选择Python 基础路线', exact: true }).click();
    await page.getByRole('button', { name: '保存路线版本', exact: true }).click();
    await expect(page).toHaveURL(/transfer\/[a-f0-9-]+$/);
    await expect(page.getByText('已保存的前置选择：Python 基础', { exact: true }).first()).toBeVisible();
    await page.reload();
    await expect(page.getByText('已保存的前置选择：Python 基础', { exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: '生成新旧路线差异', exact: true }).click();
    await expect(page.getByRole('button', { name: '确认应用新路线', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '确认应用新路线', exact: true }).click();
    await expect(page.getByText('路线版本 2 · 已保存', { exact: true })).toBeVisible();
    const data = await (await page.request.get('/api/app')).json();
    const path = data.paths[0];
    expect(path.versions).toHaveLength(2);
    for (const version of path.versions) expect(Object.values(version.plan.selectedOptions)[0]).toContain(':python:');
});
test('匿名隔离、越权、限长和跨站写入', async ({ page, browser }) => {
    await page.goto('/');
    await expect.poll(async () => (await page.request.get('/api/app')).status()).toBe(200);
    const body = { action: 'savePath', topicId: 'crypto-engineering', mode: 'explore', hours: 3, resources: ['电脑'], startDate: '2026-10-20', baseVersion: 0 };
    const a = await page.request.post('/api/app', { headers: { 'x-app-request': '1', 'idempotency-key': crypto.randomUUID() }, data: body });
    expect(a.ok()).toBeTruthy();
    const path = (await a.json()).pathId;
    const other = await browser.newContext(); await authorizeContext(other);
    const otherPage = await other.newPage();
    await otherPage.goto('/');
    await otherPage.request.get('/api/app');
    const result = await otherPage.request.post('/api/app', { headers: { 'x-app-request': '1', 'idempotency-key': crypto.randomUUID() }, data: { action: 'deletePath', pathId: path } });
    expect(result.status()).toBe(404);
    const forged = await page.request.post('/api/app', { headers: { 'x-app-request': '1', 'Origin': 'https://example.invalid', 'idempotency-key': crypto.randomUUID() }, data: body });
    expect(forged.status()).toBe(403);
    const long = await page.request.post('/api/app', { headers: { 'x-app-request': '1', 'idempotency-key': crypto.randomUUID() }, data: { action: 'chat', message: '字'.repeat(2001) } });
    expect(long.status()).toBe(400);
    await other.close();
});
test('375 / 768 / 1440 无横向溢出，首页五卡生产测量', async ({ page }) => {
    const sizes = [375, 768, 1440], routes = ['/', '/domains', '/topics/crypto-engineering', '/knowledge', '/transfer', '/dashboard', '/compare', '/settings'];
    for (const width of sizes) {
        await page.setViewportSize({ width, height: 1000 });
        for (const route of routes) {
            await page.goto(route);
            await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
            const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
            expect(overflow, `${width} ${route}`).toBe(false);
        }
        await page.goto('/');
        await page.screenshot({ path: `.local/home-${width}.png`, fullPage: true });
    }
    const samples = [];
    for (let i = 0; i < 3; i++) {
        await page.goto('/');
        await expect(page.locator('.node-card')).toHaveCount(5);
        samples.push(await page.evaluate(() => performance.now()));
    }
    console.log('生产首页五卡可见（ms）：', JSON.stringify(samples));
});
