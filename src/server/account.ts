import { z } from 'zod';
import { providerConfig, type Environment } from './config';
import type { AccountInfo, AccountProvider } from '../core/services';
import { credentialValue } from './secrets';

const money = z.string().regex(/^\d+(?:\.\d+)?$/).max(40);
const balanceSchema = z.object({ is_available: z.boolean(), balance_infos: z.array(z.object({ currency: z.enum(['CNY', 'USD']), total_balance: money, granted_balance: money, topped_up_balance: money })).min(1).max(2) });
const count = z.number().finite().nonnegative();
const quotaSchema = z.object({ key: z.object({ usage: count, limit: count.nullable() }), account: z.object({ plan_usage: count, plan_limit: count, paygo_usage: count, paygo_limit: count.nullable() }) });

// Read only, explicit refresh only. Never persist account balances or vendor errors.
export async function accountInfo(provider: AccountProvider, options: { env?: Environment; transport?: typeof fetch } = {}): Promise<AccountInfo> {
  const env = options.env ?? process.env;
  if (provider === 'openai') return { status: 'unsupported', message: '当前普通模型 Key 未接入账户余额查询。官方账户用量接口需单独的管理密钥，请在 OpenAI 控制台核对余额与账单。' };
  const config = providerConfig('deepseek', env);
  const key = provider === 'deepseek' ? config.key : credentialValue('TAVILY_API_KEY', env);
  if (!key) return { status: 'not_configured', message: '尚未配置此服务的 Key。' };
  if (env.MOCK_AI !== '0') return { status: 'disabled', message: '演示模式不请求外部账户信息。' };
  let url: URL;
  if (provider === 'deepseek') {
    if (!config.validEndpoint) return { status: 'unsupported', message: '接口地址无效，无法查询余额。' };
    const base = new URL(config.baseURL);
    if (base.origin !== 'https://api.deepseek.com' || !['/', '/v1', '/v1/'].includes(base.pathname)) return { status: 'unsupported', message: '当前为自定义兼容接口，请到该接口服务商的控制台查询余额。' };
    url = new URL('/user/balance', base);
  } else url = new URL('https://api.tavily.com/usage');
  try {
    const response = await (options.transport ?? fetch)(url, { method: 'GET', headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(10000), redirect: 'error', cache: 'no-store' });
    if (!response.ok) return { status: 'failed', message: response.status === 401 || response.status === 403 ? '查询未获授权，请检查 Key 和账户权限。' : response.status === 429 ? '查询过于频繁，请稍后刷新。' : '账户查询暂未成功，请稍后重试或前往控制台。' };
    const text = await response.text();
    if (text.length > 20000 || text.includes(key)) throw new Error('Invalid account response');
    const raw: unknown = JSON.parse(text);
    const checkedAt = new Date().toISOString();
    if (provider === 'deepseek') {
      const data = balanceSchema.parse(raw);
      return { status: 'success', checkedAt, available: data.is_available, balances: data.balance_infos.map(b => ({ currency: b.currency, total: b.total_balance, granted: b.granted_balance, toppedUp: b.topped_up_balance })) };
    }
    const data = quotaSchema.parse(raw);
    return { status: 'success', checkedAt, quota: { keyUsed: data.key.usage, keyLimit: data.key.limit, planUsed: data.account.plan_usage, planLimit: data.account.plan_limit, paygoUsed: data.account.paygo_usage, paygoLimit: data.account.paygo_limit } };
  } catch { return { status: 'failed', message: '账户查询失败或返回格式不受支持，请稍后重试或前往控制台。' }; }
}
