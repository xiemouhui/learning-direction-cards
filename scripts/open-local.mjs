import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { createBootstrapToken } from './security/local-session.mjs';
import { launchBrowser } from './security/browser.mjs';
try {
  const configured = existsSync('.env.local') ? parseEnv(readFileSync('.env.local', 'utf8')) : {};
  const origin = new URL(process.env.APP_BASE_URL ?? configured.APP_BASE_URL ?? 'http://127.0.0.1:3000');
  if (origin.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname)) throw new Error();
  try { if (!(await fetch(origin.origin, { signal: AbortSignal.timeout(5000), redirect: 'error' })).ok) throw new Error(); }
  catch { throw new Error('SERVICE_UNAVAILABLE'); }
  const token = createBootstrapToken(resolve(process.env.LDC_SECURITY_DIR ?? configured.LDC_SECURITY_DIR ?? '.local/security'));
  await launchBrowser(`${origin.origin}/#local-access=${token}`);
  console.log('已向 Windows 默认浏览器发送本机授权入口。若未出现页面，请检查默认浏览器的 HTTP 关联后重新运行 pnpm open；手动输入普通网址不会获得授权。');
} catch (error) {
  console.error(error.message === 'SERVICE_UNAVAILABLE' ? '本地服务尚未就绪。请先运行 pnpm dev（或 pnpm start），保持该终端运行，再在另一个终端执行 pnpm open。' : '无法启动本机授权入口。请检查 Windows 默认浏览器的 HTTP 关联，并在项目根目录重新运行 pnpm open。不要复制旧授权链接；普通网址不能代替授权入口。');
  process.exitCode = 1;
}
