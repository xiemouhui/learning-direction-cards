import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
export const keyNames = ['DEEPSEEK_API_KEY', 'OPENAI_API_KEY', 'TAVILY_API_KEY'];
const script = join(dirname(fileURLToPath(import.meta.url)), 'credentials.ps1');
export function credentialOperation(action, input = '') {
  if (process.platform !== 'win32') throw new Error('系统凭据保护目前只支持 Windows。');
  if (!['Protect', 'Unprotect', 'Prompt'].includes(action)) throw new Error('不支持的凭据操作。');
  const powershell = join(process.env.SystemRoot ?? 'C:/Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
  // Fixed trusted commands, with secret data only on stdin. No execution-policy changes.
  const command = `& {\n${readFileSync(script, 'utf8').replace(/^\uFEFF/, '')}\n} -Action ${action}`;
  const result = spawnSync(powershell, ['-NoProfile', '-NonInteractive', '-Command', command], { input, encoding: 'utf8', windowsHide: true, maxBuffer: 128 * 1024 });
  if (result.status === 2 && action === 'Prompt') return null;
  if (result.status !== 0) throw new Error('系统凭据操作失败；未降级到明文保存。');
  return result.stdout.replace(/^\uFEFF/, '');
}
export function privateDirectory(directory) {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  if (process.platform === 'win32') {
    // Apply only to the dedicated credential directory, never the project or user root.
    const whoami = join(process.env.SystemRoot ?? 'C:/Windows', 'System32/whoami.exe');
    const sid = execFileSync(whoami, ['/user', '/fo', 'csv', '/nh'], { encoding: 'utf8', windowsHide: true }).match(/S-1-\d+(?:-\d+)+/)?.[0];
    if (!sid) throw new Error('无法确认凭据目录所属账户。');
    execFileSync(join(process.env.SystemRoot ?? 'C:/Windows', 'System32/icacls.exe'), [directory, '/inheritance:r', '/grant:r', `*${sid}:(OI)(CI)F`], { windowsHide: true, stdio: 'pipe' });
  }
}
export function readCredentialStore(file) {
  if (!existsSync(file)) return {};
  const text = credentialOperation('Unprotect', readFileSync(file, 'utf8'));
  const value = JSON.parse(text);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('凭据存储损坏。');
  if (Object.entries(value).some(([name, key]) => !keyNames.includes(name) || typeof key !== 'string' || key.length > 8192)) throw new Error('凭据存储格式无效。');
  return value;
}
export function writeCredentialStore(file, value) {
  const serialized = JSON.stringify(value);
  const encrypted = credentialOperation('Protect', serialized);
  if (credentialOperation('Unprotect', encrypted) !== serialized) throw new Error('凭据加密核验失败，原存储未覆盖。');
  privateDirectory(dirname(file));
  const temporary = `${file}.${process.pid}.tmp`;
  writeFileSync(temporary, encrypted, { mode: 0o600 });
  renameSync(temporary, file);
}
