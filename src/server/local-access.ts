import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, renameSync, unlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { preparePrivateDirectory } from './private-directory';

export const localCookie = 'direction_local_access';
let secret: string | undefined;
function signingKey() {
  if (secret) return secret;
  const file = resolve(process.env.LDC_SECURITY_DIR ?? '.local/security', 'web-auth.key');
  preparePrivateDirectory(dirname(file));
  try { writeFileSync(file, randomBytes(32).toString('hex'), { flag: 'wx', mode: 0o600 }); } catch (e) { if (!existsSync(file)) throw e; }
  const value = readFileSync(file, 'utf8');
  if (!/^[a-f0-9]{64}$/.test(value)) throw new Error('本地访问凭据无效。');
  secret = value;
  return value;
}
export function issueLocalAccess(now = Date.now(), key = signingKey()) {
  const body = `${randomBytes(24).toString('hex')}.${now + 12 * 3600000}`;
  return `${body}.${createHmac('sha256', key).update(body).digest('hex')}`;
}
export function validLocalAccess(value: string | undefined, now = Date.now(), key?: string): boolean {
  if (!value || !/^[a-f0-9]{48}\.\d{13}\.[a-f0-9]{64}$/.test(value)) return false;
  const [nonce, expires, signature] = value.split('.');
  if (Number(expires) <= now || Number(expires) > now + 12 * 3600000) return false;
  const expected = createHmac('sha256', key ?? signingKey()).update(`${nonce}.${expires}`).digest();
  return timingSafeEqual(Buffer.from(signature, 'hex'), expected);
}
export function consumeBootstrap(value: unknown, now = Date.now()) {
  const reject = (code: string) => { if (process.env.LDC_AUTH_DIAGNOSTICS === '1') console.warn('Local authorization:', code); return false; };
  if (typeof value !== 'string' || !/^[a-f0-9]{48}\.\d{13}\.[a-f0-9]{64}$/.test(value)) return reject('FORMAT');
  const [nonce, expires, signature] = value.split('.');
  if (Number(expires) <= now) return reject('EXPIRED');
  if (Number(expires) > now + 60000) {
    if (process.env.LDC_AUTH_DIAGNOSTICS === '1') console.warn('Local authorization clock lead (ms):', Number(expires) - now - 60000);
    return reject('EXPIRY_AHEAD');
  }
  const expected = createHmac('sha256', signingKey()).update(`bootstrap:${nonce}.${expires}`).digest();
  if (!timingSafeEqual(expected, Buffer.from(signature, 'hex'))) return reject('SIGNATURE');
  const file = resolve(process.env.LDC_SECURITY_DIR ?? '.local/security', 'bootstrap', nonce);
  try {
    if (readFileSync(file, 'utf8') !== expires) return reject('NONCE');
    renameSync(file, `${file}.used`);
    try { unlinkSync(`${file}.used`); } catch {}
    return true;
  } catch (error) { return reject((error as NodeJS.ErrnoException).code ?? 'IO_ERROR'); }
}
export function localRequestAllowed(headers: Headers, configuredOrigin: string) {
  try {
    const expected = new URL(configuredOrigin);
    if (expected.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(expected.hostname)) return false;
    if (headers.get('host') !== expected.host) return false;
    // Forwarded headers are not trusted; this is a local-only application.
    const origin = headers.get('origin');
    if (origin && origin !== expected.origin) return false;
    const site = headers.get('sec-fetch-site');
    if (site && !['same-origin', 'none'].includes(site)) {
      return headers.get('sec-fetch-mode') === 'navigate' && headers.get('sec-fetch-dest') === 'document' && !origin;
    }
    return true;
  } catch { return false; }
}
