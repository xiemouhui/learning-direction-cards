import type { Environment } from './config';
import { credentialValue } from './secrets';
export function containsCredential(text: string, env: Environment) {
  if (/(?:\bsk-[A-Za-z0-9_-]{16,}|\btvly-[A-Za-z0-9_-]{16,}|\bBearer\s+[A-Za-z0-9_.-]{20,})/.test(text)) return true;
  return ['DEEPSEEK_API_KEY', 'OPENAI_API_KEY', 'TAVILY_API_KEY', 'LLM_API_KEY'].some(name => { const key = credentialValue(name, env); return key.length >= 8 && text.includes(key); });
}
