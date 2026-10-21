import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { spawn } from 'node:child_process';
import { createBootstrapToken } from './security/local-session.mjs';
try {
  const configured = existsSync('.env.local') ? parseEnv(readFileSync('.env.local', 'utf8')) : {};
  const origin = new URL(process.env.APP_BASE_URL ?? configured.APP_BASE_URL ?? 'http://127.0.0.1:3000');
  if (origin.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname)) throw new Error();
  const token = createBootstrapToken(resolve('.local/security'));
  spawn('explorer.exe', [`${origin.origin}/#local-access=${token}`], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
  console.log('已打开本机授权入口；授权链接不会写入日志。');
} catch { console.error('本机授权入口打开失败。'); process.exit(1); }
