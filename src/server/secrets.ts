import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import type { Environment } from './config';
let cached: { file: string; stamp: number; keys: Record<string, string> } | undefined;
export function credentialValue(name: string, env: Environment): string {
  if (env[name]?.trim() || env.LDC_SESSION_CREDENTIALS === '1') return env[name]?.trim() ?? '';
  if (env !== process.env) return '';
  const file = resolve(env.LDC_CREDENTIAL_STORE ?? '.local/security/credentials.dpapi');
  if (!existsSync(file)) return '';
  const stamp = statSync(file).mtimeMs;
  if (!cached || cached.file !== file || cached.stamp !== stamp) {
    if (process.platform !== 'win32') return '';
    const script = resolve(env.LDC_CREDENTIAL_HELPER ?? 'scripts/security/credentials.ps1');
    const powershell = join(process.env.SystemRoot ?? 'C:/Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
    const command = `& {\n${readFileSync(script, 'utf8').replace(/^\uFEFF/, '')}\n} -Action Unprotect`;
    const result = spawnSync(powershell, ['-NoProfile', '-NonInteractive', '-Command', command], { input: readFileSync(file, 'utf8'), encoding: 'utf8', windowsHide: true, maxBuffer: 128 * 1024 });
    if (result.status !== 0) return '';
    try {
      const keys: unknown = JSON.parse(result.stdout.replace(/^\uFEFF/, ''));
      if (!keys || typeof keys !== 'object' || Array.isArray(keys) || Object.entries(keys).some(([k, v]) => !['DEEPSEEK_API_KEY', 'OPENAI_API_KEY', 'TAVILY_API_KEY'].includes(k) || typeof v !== 'string' || v.length > 8192)) return '';
      cached = { file, stamp, keys: keys as Record<string, string> };
    } catch { return ''; }
  }
  return cached.keys[name]?.trim() ?? '';
}
