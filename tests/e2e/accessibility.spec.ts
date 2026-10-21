import { test, expect } from './fixtures';
test('键盘跳转、手机导航与减少动效', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: '跳到正文' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#main')).toBeFocused();
    await page.setViewportSize({ width: 375, height: 900 });
    await expect(page.getByRole('navigation', { name: '主导航' })).toBeHidden();
    await page.getByRole('button', { name: '打开导航' }).click();
    await expect(page.getByRole('navigation', { name: '主导航' })).toBeVisible();
    await page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: '领域与专题' }).click();
    await expect(page).toHaveURL('/domains');
    await expect(page.getByRole('navigation', { name: '主导航' })).toBeHidden();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const transition = await page.locator('.node-card').first().evaluate(el => getComputedStyle(el).transitionDuration);
    expect(transition).toBe('0s');
});
test('主要页面实际可见文字对比度达到 AA 阈值', async ({ page }) => {
    for (const route of ['/', '/domains', '/topics/crypto-engineering', '/assess', '/knowledge', '/transfer', '/dashboard', '/compare', '/settings']) {
        await page.goto(route);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        const failures = await page.evaluate(() => {
            const color = (s: string) => s.match(/[\d.]+/g)!.map(Number);
            const luminance = (c: number[]) => c.slice(0, 3).map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((s, v, i) => s + v * [.2126, .7152, .0722][i], 0);
            const result: {
                text: string;
                ratio: number;
            }[] = [];
            for (const el of document.querySelectorAll('main *,aside *,header *,footer *')) {
                if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent?.trim()) || !el.getClientRects().length)
                    continue;
                const style = getComputedStyle(el);
                if (style.visibility === 'hidden' || style.display === 'none')
                    continue;
                let ancestor: Element | null = el, bg = [255, 255, 255];
                while (ancestor) {
                    const next = color(getComputedStyle(ancestor).backgroundColor);
                    if (next.length === 3 || next[3] === 1) {
                        bg = next;
                        break;
                    }
                    ancestor = ancestor.parentElement;
                }
                const fg = luminance(color(style.color)), background = luminance(bg), ratio = (Math.max(fg, background) + .05) / (Math.min(fg, background) + .05);
                const large = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.66 && Number(style.fontWeight) >= 700);
                if (ratio < (large ? 3 : 4.5))
                    result.push({ text: el.textContent!.trim().slice(0, 30), ratio });
            }
            return result;
        });
        expect(failures, route).toEqual([]);
    }
});
