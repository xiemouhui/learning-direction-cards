import type { Provider } from '../core/services';
import type { Environment } from './config';

export function trustedEndpoint(provider: Provider, value: string, env: Environment): boolean {
  try {
    const url = new URL(value);
    if (url.username || url.password || url.search || url.hash) return false;
    const official = provider === 'deepseek' ? 'https://api.deepseek.com' : 'https://api.openai.com';
    if (url.origin === official && ['/', '/v1', '/v1/'].includes(url.pathname)) return true;
    if (env.LDC_ALLOW_CUSTOM_API !== '1') return false;
    const origins = (env.LDC_TRUSTED_API_ORIGINS ?? '').split(',').map(x => x.trim()).filter(Boolean);
    const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
    return (url.protocol === 'https:' || (url.protocol === 'http:' && loopback)) && origins.includes(url.origin);
  } catch { return false; }
}

// SDK calls must not follow even a same-origin redirect carrying authentication.
export function authenticatedFetch(base: string, transport: typeof fetch = fetch): typeof fetch {
  const origin = new URL(base).origin;
  return async (input, init) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
    if (url.origin !== origin || url.username || url.password) throw new Error('不允许的认证请求目的地。');
    return transport(input, { ...init, redirect: 'error' });
  };
}
