import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { issueLocalAccess, validLocalAccess, localRequestAllowed, localCookie, consumeBootstrap } from './server/local-access';
import { boundedBody } from './server/body-limit';

// Instance-wide anonymous request pressure limit; outbound fee limits are persisted separately.
let windowStart = Date.now(), requests = 0;
export async function proxy(request: NextRequest) {
  const origin = process.env.APP_BASE_URL ?? 'http://127.0.0.1:3000';
  const api = request.nextUrl.pathname.startsWith('/api/');
  if (!localRequestAllowed(request.headers, origin)) return NextResponse.json({ error: '只接受本机入口与可信来源。' }, { status: 403 });
  if (Date.now() - windowStart > 60000) { windowStart = Date.now(); requests = 0; }
  if (api && ++requests > 300) return NextResponse.json({ error: '本机请求过于频繁，请稍后重试。' }, { status: 429, headers: { 'Retry-After': '60' } });
  if (request.nextUrl.pathname === '/api/local-session') {
    if (request.method !== 'POST' || request.headers.get('x-app-request') !== '1') return NextResponse.json({ error: '授权请求无效。' }, { status: 403 });
    try {
      const data = JSON.parse(await boundedBody(request, 1024));
      if (!consumeBootstrap(data.token)) return NextResponse.json({ error: '本机授权已失效，请重新使用启动入口。' }, { status: 401 });
      const response = NextResponse.json({ authorized: true }, { headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
      response.cookies.set(localCookie, issueLocalAccess(), { httpOnly: true, sameSite: 'strict', path: '/', maxAge: 12 * 3600 });
      return response;
    } catch { return NextResponse.json({ error: '授权请求无效。' }, { status: 400 }); }
  }
  const authenticated = validLocalAccess(request.cookies.get(localCookie)?.value);
  if (api && !authenticated) return NextResponse.json({ error: '本地访问尚未授权，请通过本机启动入口重新打开，或在源码根目录运行 pnpm open。' }, { status: 401 });
  const nonce = randomBytes(18).toString('base64');
  const development = process.env.NODE_ENV === 'development';
  const csp = `default-src 'self'; script-src 'self' 'nonce-${nonce}'${development ? " 'unsafe-eval'" : ''}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'${development ? ' ws://127.0.0.1:* ws://localhost:*' : ''}; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'`;
  const headers = new Headers(request.headers);
  headers.set('Content-Security-Policy', csp);
  headers.set('x-nonce', nonce);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
