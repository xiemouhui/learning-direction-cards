import { test as base, expect } from '@playwright/test';
import { resolve } from 'node:path';
import type { BrowserContext } from '@playwright/test';
import { createBootstrapToken } from '../../scripts/security/local-session.mjs';
export async function authorizeContext(context: BrowserContext) {
  const token = createBootstrapToken(resolve(process.env.LDC_TEST_SECURITY_DIR ?? '.local/e2e-security'));
  const response = await context.request.post('http://127.0.0.1:3001/api/local-session', { headers: { 'x-app-request': '1' }, data: { token } });
  expect(response.status()).toBe(200);
}
export const test = base.extend({ context: async ({ context }, runFixture) => { await authorizeContext(context); await runFixture(context); } });
export { expect };
export type { Page } from '@playwright/test';
