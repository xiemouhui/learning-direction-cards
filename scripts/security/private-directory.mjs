import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
export function privateDirectory(directory) {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  if (process.platform !== 'win32') return;
  const system = join(process.env.SystemRoot ?? 'C:/Windows', 'System32');
  const sid = execFileSync(join(system, 'whoami.exe'), ['/user', '/fo', 'csv', '/nh'], { encoding: 'utf8', windowsHide: true }).match(/S-1-\d+(?:-\d+)+/)?.[0];
  if (!sid) throw new Error('无法确认凭据目录所属账户。');
  execFileSync(join(system, 'icacls.exe'), [directory, '/inheritance:r', '/grant:r', `*${sid}:(OI)(CI)F`], { windowsHide: true, stdio: 'pipe' });
}
