import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync, readdirSync, cpSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import net from 'node:net';

const name = 'learning-direction-cards-0.1.0-preview.1-windows-x64';
const zip = resolve('dist', `${name}.zip`);
const sha = createHash('sha256').update(readFileSync(zip)).digest('hex');
assert.equal(sha, readFileSync(`${zip}.sha256`, 'utf8').split(' ')[0]);
const folder = mkdtempSync(resolve('.local', 'portable-check-'));
execFileSync('tar.exe', ['-xf', zip, '-C', folder], { windowsHide: true });
const root = join(folder, name), data = join(folder, '中文 个人资料'), node = join(root, 'runtime/node.exe');
for (const entry of JSON.parse(readFileSync(join(root, 'FILES-SHA256.json')))) assert.equal(createHash('sha256').update(readFileSync(join(root, entry.path))).digest('hex'), entry.sha256, `Manifest mismatch: ${entry.path}`);
const port = await new Promise(res => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const origin = `http://127.0.0.1:${port}`;
const run = (action, location = root, dir = data, p = port) => new Promise((res, rej) => {
  const child = spawn(node, [join(location, 'launcher.mjs'), action, '--data-dir', dir, '--port', String(p), '--no-ui'], { windowsHide: true, env: { ...process.env, PATH: '', DEEPSEEK_API_KEY: 'portable-test-host-canary', DATABASE_URL: join(folder, 'must-not-exist.db') } });
  let output = ''; child.stdout.on('data', b => output += b); child.stderr.on('data', b => output += b);
  child.on('error', rej); child.on('exit', code => { console.log(JSON.stringify({ action, code, output: output.trim() })); return code === 0 ? res(output.trim()) : rej(new Error(`${action} failed: ${output}`)); });
});
const waitClosed = async () => { for (let i = 0; i < 80; i++) { try { await fetch(origin, { signal: AbortSignal.timeout(300) }); } catch { return; } await new Promise(res => setTimeout(res, 100)); } throw new Error('HTTP service did not stop'); };
let running = false;
try {
  await run('start'); running = true;
  console.log('Checking initial HTTP'); assert.equal((await fetch(origin)).status, 200);
  const first = JSON.parse(readFileSync(join(data, 'service.json')));
  await run('start'); assert.equal(JSON.parse(readFileSync(join(data, 'service.json'))).pid, first.pid);
  console.log('Checking personal API'); const initial = await fetch(`${origin}/api/app`); assert.equal(initial.status, 200);
  const cookie = initial.headers.get('set-cookie').split(';')[0];
  const state = await initial.json(); assert.equal(state.paths.length, 0);
  const post = async body => { const r = await fetch(`${origin}/api/app`, { method: 'POST', headers: { cookie, origin, 'content-type': 'application/json', 'x-app-request': '1', 'idempotency-key': randomUUID() }, body: JSON.stringify(body) }); assert.equal(r.status, 200, await r.clone().text()); return r.json(); };
  const saved = await post({ action: 'savePath', topicId: 'crypto-engineering', mode: 'explore', hours: 3, resources: ['电脑'], startDate: '2026-10-21', baseVersion: 0 });
  assert.ok(saved.pathId);
  const settings = await (await fetch(`${origin}/settings`)).text();
  assert.ok(!settings.includes('portable-test-host-canary'));
  assert.ok(!existsSync(join(folder, 'must-not-exist.db')));
  await run('stop'); await waitClosed(); running = false;
  const moved = join(folder, '升级 模拟目录'); cpSync(root, moved, { recursive: true });
  await run('start', moved); running = true;
  console.log('Checking upgraded API'); const restored = await (await fetch(`${origin}/api/app`, { headers: { cookie } })).json();
  assert.ok(restored.paths.some(p => p.id === saved.pathId));
  assert.ok(readdirSync(join(data, 'backups')).some(f => f.endsWith('.db')));
  await run('stop', moved); await waitClosed(); running = false;
  const blocker = net.createServer(); await new Promise(res => blocker.listen(port, '127.0.0.1', res));
  try { await assert.rejects(run('start', root, join(folder, '端口冲突空白资料'))); assert.ok(!existsSync(join(folder, '端口冲突空白资料', 'app.db'))); assert.ok(blocker.listening); } finally { blocker.close(); }
  assert.deepEqual(JSON.parse(await run('status')), { running: false });
  console.log(JSON.stringify({ passed: true, zipChecksum: sha, checks: ['actual ZIP extraction', 'bundled runtime with empty PATH', 'Chinese/spaced data path', 'fresh database', 'duplicate launch', 'save route', 'clean host environment', 'stop HTTP listener', 'new-folder upgrade preserves route', 'online backup', 'port conflict preserves other process'] }));
} finally { if (running) await run('stop').catch(() => {}); }
