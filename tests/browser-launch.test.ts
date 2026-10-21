import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { expect, it, vi } from 'vitest';
import { launchBrowser } from '../scripts/security/browser.mjs';

it('启动链接通过标准输入交给默认浏览器，不拼入命令且等待退出结果', async () => {
  const child = Object.assign(new EventEmitter(), { stdin: new PassThrough(), kill: vi.fn() });
  const run = vi.fn<typeof spawn>().mockReturnValue(child as unknown as ChildProcessWithoutNullStreams);
  let input = ''; child.stdin.on('data', b => { input += b; });
  const url = 'http://127.0.0.1:3000/#local-access=canary';
  const result = launchBrowser(url, run as unknown as typeof spawn);
  expect(JSON.stringify(run.mock.calls)).not.toContain('canary');
  expect(input).toBe(url);
  child.emit('close', 0);
  await expect(result).resolves.toBeUndefined();
});

it.each(['error', 'exit', 'timeout'])('浏览器 %s 失败不能报告成功，也不泄露授权链接', async failure => {
  vi.useFakeTimers();
  try {
    const child = Object.assign(new EventEmitter(), { stdin: new PassThrough(), kill: vi.fn() });
    const run = vi.fn<typeof spawn>().mockReturnValue(child as unknown as ChildProcessWithoutNullStreams);
    const pending = launchBrowser('http://127.0.0.1:3000/#local-access=secret-canary', run as unknown as typeof spawn);
    const assertion = expect(pending).rejects.toThrow('BROWSER_FAILED');
    if (failure === 'error') child.emit('error', new Error('secret-canary'));
    else if (failure === 'exit') child.emit('close', 1);
    else await vi.advanceTimersByTimeAsync(15000);
    await assertion;
  } finally { vi.useRealTimers(); }
});

it('拒绝向非本机目标发送授权入口', async () => {
  const run = vi.fn();
  await expect(launchBrowser('https://evil.example/#local-access=canary', run)).rejects.toThrow();
  expect(run).not.toHaveBeenCalled();
});
