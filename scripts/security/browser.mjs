import { spawn } from 'node:child_process';
import { join } from 'node:path';

// Pass the capability on stdin, never through shell interpolation or log output.
export async function launchBrowser(url, run = spawn) {
  const target = new URL(url);
  if (target.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname) || target.username || target.password) throw new Error('BROWSER_FAILED');
  if (process.platform !== 'win32') throw new Error('BROWSER_UNSUPPORTED');
  const script = "$ErrorActionPreference='Stop'; try { $u=[Console]::In.ReadToEnd(); $p=[System.Diagnostics.ProcessStartInfo]::new(); $p.FileName=$u; $p.UseShellExecute=$true; [System.Diagnostics.Process]::Start($p) | Out-Null; exit 0 } catch { exit 1 }";
  await new Promise((resolve, reject) => {
    const child = run(join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'), ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, stdio: ['pipe', 'ignore', 'ignore'] });
    const timer = setTimeout(() => { child.kill(); reject(new Error('BROWSER_FAILED')); }, 15000);
    const finish = error => { clearTimeout(timer); if (error) reject(new Error('BROWSER_FAILED')); else resolve(); };
    child.once('error', finish);
    child.once('close', code => finish(code !== 0));
    child.stdin.on('error', () => {});
    child.stdin.end(url);
  });
}
