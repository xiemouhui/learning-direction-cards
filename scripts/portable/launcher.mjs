import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, copyFileSync, openSync, closeSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import net from 'node:net';
import { spawn, spawnSync } from 'node:child_process';
import { parseEnv } from 'node:util';

const root = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2), action = args[0] ?? 'start';
const flag = name => { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1]; };
const dataDir = resolve(flag('--data-dir') ?? join(process.env.LOCALAPPDATA ?? join(process.env.USERPROFILE ?? root, 'AppData', 'Local'), 'LearningDirectionCards'));
const port = Number(flag('--port') ?? 32145);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid local port');
const noUi = args.includes('--no-ui');
const origin = `http://127.0.0.1:${port}`;
const pipe = `\\\\.\\pipe\\learning-direction-cards-${createHash('sha256').update(dataDir.toLowerCase()).digest('hex').slice(0, 24)}`;
const stateFile = join(dataDir, 'service.json'), configFile = join(dataDir, '.env');
const appDir = join(root, 'app');
const node = join(root, 'runtime', 'node.exe');
mkdirSync(dataDir, { recursive: true });
if (!existsSync(configFile)) copyFileSync(join(root, 'config.example.env'), configFile);
const sleep = ms => new Promise(r => setTimeout(r, ms));
function readState() { try { return JSON.parse(readFileSync(stateFile, 'utf8')); } catch { return null; } }
function runUi(command, values) { if (!noUi) spawn(command, values, { detached: true, stdio: 'ignore', windowsHide: true }).unref(); }
function openBrowser(url) { runUi('explorer.exe', [url]); }
async function request(command) {
  const state = readState();
  if (!state?.token) return null;
  return new Promise(resolveResult => {
    const socket = net.createConnection(pipe); let buffer = '';
    const done = value => { socket.destroy(); resolveResult(value); };
    socket.setTimeout(1500, () => done(null));
    socket.on('error', () => done(null));
    socket.on('connect', () => socket.write(JSON.stringify({ token: state.token, command }) + '\n'));
    socket.on('data', chunk => { buffer += chunk; if (buffer.length > 4096) done(null); else if (buffer.includes('\n')) { try { done(JSON.parse(buffer)); } catch { done(null); } } });
  });
}
function environment() {
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (/^(?:NODE_OPTIONS|NODE_PATH|DATABASE_URL|APP_BASE_URL|PORT|HOSTNAME|MOCK_AI|LLM_|DEEPSEEK_|OPENAI_|TAVILY_|SEARCH_PROVIDER|NEXT_PUBLIC_)/i.test(key)) delete env[key];
  const allowed = /^(?:MOCK_AI|LLM_PROVIDER|DEEPSEEK_(?:API_KEY|BASE_URL|MODEL|MODELS)|OPENAI_(?:API_KEY|BASE_URL|MODEL|MODELS)|TAVILY_API_KEY|SEARCH_PROVIDER)$/;
  const configured = parseEnv(readFileSync(configFile, 'utf8').replace(/^\uFEFF/, ''));
  for (const [key, value] of Object.entries(configured)) if (allowed.test(key)) env[key] = value;
  return { ...env, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1', DATABASE_URL: join(dataDir, 'app.db'), APP_BASE_URL: origin, PORT: String(port), HOSTNAME: '127.0.0.1', MOCK_AI: configured.MOCK_AI === '0' ? '0' : '1' };
}
async function serve() {
  const token = randomBytes(32).toString('hex');
  let ready = false, shuttingDown = false;
  const control = net.createServer(socket => {
    let buffer = ''; socket.setTimeout(2000, () => socket.destroy());
    socket.on('error', () => {});
    socket.on('data', chunk => {
      buffer += chunk; if (buffer.length > 2048) return socket.destroy();
      if (!buffer.includes('\n')) return;
      let command; try { command = JSON.parse(buffer); } catch { return socket.destroy(); }
      if (command.token !== token) return socket.destroy();
      socket.end(JSON.stringify({ ready, origin, version: '0.1.0-preview.1', stopping: command.command === 'stop' }) + '\n');
      if (command.command === 'stop' && !shuttingDown) { shuttingDown = true; control.close(); setTimeout(() => { if (readState()?.token === token) { try { unlinkSync(stateFile); } catch {} } if (process.listenerCount('SIGTERM')) process.emit('SIGTERM'); else process.exit(0); setTimeout(() => process.exit(0), 10000).unref(); }, 100); }
    });
  });
  await new Promise((res, rej) => { control.once('error', rej); control.listen(pipe, res); });
  writeFileSync(stateFile, JSON.stringify({ token, pid: process.pid, origin, root }));
  process.on('exit', () => { if (readState()?.token === token) { try { unlinkSync(stateFile); } catch {} } });
  const env = environment();
  // Verify the fixed application port before modifying the user's database.
  await new Promise((res, rej) => { const probe = net.createServer(); probe.once('error', () => rej(new Error('PORT_BUSY'))); probe.listen(port, '127.0.0.1', () => probe.close(res)); });
  const require = createRequire(join(appDir, 'package.json'));
  const Database = require('better-sqlite3');
  if (existsSync(env.DATABASE_URL)) {
    const backups = join(dataDir, 'backups'); mkdirSync(backups, { recursive: true });
    const db = new Database(env.DATABASE_URL, { readonly: true });
    try { await db.backup(join(backups, `before-start-${Date.now()}.db`)); } finally { db.close(); }
  }
  for (const operation of ['migrate', 'seed']) {
    const result = spawnSync(node, ['maintenance.cjs', operation], { cwd: appDir, env, windowsHide: true, encoding: 'utf8' });
    if (result.status !== 0) throw new Error('PREPARE_FAILED');
  }
  Object.assign(process.env, env);
  require(join(appDir, 'server.js'));
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(`${origin}/`, { signal: AbortSignal.timeout(1500) })).ok) { ready = true; return; } } catch {}
    await sleep(250);
  }
  throw new Error('START_FAILED');
}
async function main() {
  if (action === 'serve') return serve();
  if (action === 'config') { runUi('notepad.exe', [configFile]); return; }
  if (action === 'data') { runUi('explorer.exe', [dataDir]); return; }
  if (action === 'status') { const status = await request('status'); console.log(JSON.stringify(status ? { running: true, ready: status.ready, origin: status.origin } : { running: false })); return; }
  if (action === 'stop') { const status = await request('stop'); if (!status) { console.log('没有正在运行的免安装版服务。'); return; } for (let i = 0; i < 80 && await request('status'); i++) await sleep(250); if (await request('status')) throw new Error('STOP_FAILED'); console.log('免安装版服务已停止；资料保留。'); return; }
  if (action !== 'start') throw new Error('UNKNOWN_ACTION');
  const previous = await request('status');
  if (previous?.ready) { openBrowser(previous.origin); console.log('已打开现有实例。'); return; }
  let childExited = false;
  if (!previous) {
    const log = openSync(join(dataDir, 'service.log'), 'a');
    const child = spawn(node, [join(root, 'launcher.mjs'), 'serve', '--data-dir', dataDir, '--port', String(port), '--no-ui'], { cwd: root, env: environment(), detached: true, stdio: ['ignore', log, log], windowsHide: true });
    child.on('error', () => { childExited = true; });
    child.on('exit', () => { childExited = true; });
    child.unref(); closeSync(log);
  }
  for (let i = 0; i < 160; i++) {
    const current = await request('status');
    if (current?.ready) { openBrowser(current.origin); console.log('免安装版已启动。'); return; }
    if (childExited && !current) throw new Error('START_FAILED');
    await sleep(250);
  }
  throw new Error('START_FAILED');
}
main().catch(error => {
  if (action === 'serve' && error.code === 'EADDRINUSE') process.exit(0);
  if (action === 'serve') console.error('Startup stage:', error.stack);
  const message = error.message === 'PORT_BUSY' ? '本地端口被占用，请先停止占用 32145 端口的程序。' : '操作未完成。请检查数据目录中的 service.log；可尝试停止后重新启动。';
  writeFileSync(join(dataDir, 'last-error.txt'), `${new Date().toISOString()}\n${message}\n`, 'utf8');
  console.error(message);
  runUi('wscript.exe', [join(root, 'notice.vbs'), message]);
  process.exit(1);
});
