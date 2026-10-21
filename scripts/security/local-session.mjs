import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHmac, randomBytes } from 'node:crypto';
import { privateDirectory } from './private-directory.mjs';
export function createBootstrapToken(directory) {
  directory = resolve(directory); privateDirectory(directory);
  const file = join(directory, 'web-auth.key');
  if (!existsSync(file)) { try { writeFileSync(file, randomBytes(32).toString('hex'), { flag: 'wx', mode: 0o600 }); } catch { if (!existsSync(file)) throw new Error('无法创建本机授权凭据。'); } }
  const key = readFileSync(file, 'utf8');
  if (!/^[a-f0-9]{64}$/.test(key)) throw new Error('本机授权凭据无效。');
  const pending = join(directory, 'bootstrap'); mkdirSync(pending, { recursive: true, mode: 0o700 });
  for (const name of readdirSync(pending)) if (/^[a-f0-9]{48}(?:\.used)?$/.test(name)) { const old = join(pending, name); if (Date.now() - statSync(old).mtimeMs > 120000) { try { unlinkSync(old); } catch {} } }
  const nonce = randomBytes(24).toString('hex'), expires = Date.now() + 60000;
  writeFileSync(join(pending, nonce), String(expires), { mode: 0o600, flag: 'wx' });
  const body = `${nonce}.${expires}`;
  return `${body}.${createHmac('sha256', key).update(`bootstrap:${body}`).digest('hex')}`;
}
