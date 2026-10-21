import type { Provider, ServicePreferences } from '../core/services';
import { modelSchema } from '../core/services';

export type Environment = Record<string, string | undefined>;
export function providerConfig(provider: Provider, env: Environment = process.env) {
  const prefix = provider.toUpperCase();
  const legacy = (env.LLM_PROVIDER ?? 'deepseek') === provider;
  const key = env[`${prefix}_API_KEY`]?.trim() || (legacy ? env.LLM_API_KEY?.trim() : '') || '';
  const baseURL = env[`${prefix}_BASE_URL`]?.trim() || (legacy ? env.LLM_BASE_URL?.trim() : '') || (provider === 'deepseek' ? 'https://api.deepseek.com' : 'https://api.openai.com/v1');
  const model = env[`${prefix}_MODEL`]?.trim() || (legacy ? env.LLM_MODEL?.trim() : '') || (provider === 'deepseek' ? 'deepseek-flash' : '');
  const models = [...new Set([model, ...(env[`${prefix}_MODELS`] ?? '').split(','), ...(provider === 'deepseek' ? ['deepseek-flash', 'deepseek-v4-pro'] : [])].map(x => x.trim()).filter(Boolean))];
  let validEndpoint = false;
  try { const url = new URL(baseURL); validEndpoint = !url.username && !url.password && !url.search && !url.hash && (url.protocol === 'https:' || (url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))); } catch { /* invalid server configuration stays local */ }
  return { key, baseURL, model, models, configured: !!key && validEndpoint, validEndpoint, mock: env.MOCK_AI !== '0' };
}
export function defaultPreferences(env: Environment = process.env): ServicePreferences {
  const provider: Provider = env.LLM_PROVIDER === 'openai' ? 'openai' : 'deepseek';
  return { provider, model: providerConfig(provider, env).model, aiEnabled: false, searchEnabled: false, searchProvider: env.SEARCH_PROVIDER === 'tavily' ? 'tavily' : 'deepseek', searchScope: 'community' };
}
export function serviceCatalog(env: Environment = process.env) {
  return {
    mock: env.MOCK_AI !== '0',
    providers: (['deepseek', 'openai'] as const).map(id => { const c = providerConfig(id, env); return { id, configured: c.configured, models: c.models, defaultModel: c.model }; }),
    search: { deepseek: providerConfig('deepseek', env).configured, tavily: !!env.TAVILY_API_KEY?.trim() },
  };
}
// 仅本地配置检查；不回传 Key、端点或用户输入，也不调用外部服务。
export function configurationReport(env: Environment = process.env) {
  const mock = env.MOCK_AI !== '0';
  return {
    externalRequestsMade: false,
    accountVerified: false,
    mock,
    providers: (['deepseek', 'openai'] as const).map(provider => {
      const c = providerConfig(provider, env);
      const modelValid = modelSchema.safeParse(c.model).success;
      return { provider, apiKeyPresent: !!c.key, endpointValid: c.validEndpoint, modelSelected: !!c.model, modelValid, readyForManualTest: c.configured && modelValid && !mock };
    }),
    search: { deepseekKeyPresent: providerConfig('deepseek', env).configured, tavilyKeyPresent: !!env.TAVILY_API_KEY?.trim(), accountVerified: false },
    nextStep: '配置齐备只表示可开始验收；实际账户、额度、模型权限与搜索可用性仍需在明确同意后通过真实请求验证。',
  };
}
