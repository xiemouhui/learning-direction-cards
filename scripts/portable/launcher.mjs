import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, copyFileSync, openSync, closeSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { createRequire } from 'node:module';
import net from 'node:net';
import { spawn, spawnSync } from 'node:child_process';
import { parseEnv } from 'node:util';
import { credentialOperation, keyNames, readCredentialStore, writeCredentialStore, privateDirectory } from './security/credentials.mjs';
import { createBootstrapToken } from './security/local-session.mjs';
import { launchBrowser } from './security/browser.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2), action = args[0] ?? 'start';
const flag = name => { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1]; };
const dataDir = resolve(flag('--data-dir') ?? join(process.env.LOCALAPPDATA ?? join(process.env.USERPROFILE ?? root, 'AppData', 'Local'), 'LearningDirectionCards'));
const port = Number(flag('--port') ?? 32145);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid local port');
const noUi = args.includes('--no-ui');
const origin = `http://127.0.0.1:${port}`;
const pipe = `\\\\.\\pipe\\learning-direction-cards-${createHash('sha256').update(dataDir.toLowerCase()).digest('hex').slice(0, 24)}`;
const controlDir = join(dataDir, '.control');
const stateFile = join(controlDir, 'service.json'), configFile = join(dataDir, '.env');
const credentialStore = join(dataDir, 'security', 'credentials.dpapi');
const appDir = join(root, 'app');
const node = join(root, 'runtime', 'node.exe');
mkdirSync(dataDir, { recursive: true });
if (!existsSync(configFile)) copyFileSync(join(root, 'config.example.env'), configFile);
const sleep = ms => new Promise(r => setTimeout(r, ms));
function readState() { try { return JSON.parse(readFileSync(stateFile, 'utf8')); } catch { return null; } }
function runUi(command, values) { if (!noUi) spawn(command, values, { detached: true, stdio: 'ignore', windowsHide: true }).unref(); }
async function openBrowser(url) { if (!noUi) await launchBrowser(`${url}/#local-access=${createBootstrapToken(join(dataDir, 'security'))}`); }
async function request(command, details = {}) {
  const state = readState();
  if (!state?.token) return null;
  return new Promise(resolveResult => {
    const socket = net.createConnection(pipe); let buffer = '', serverVerified = false;
    const challenge = randomBytes(32).toString('hex');
    const done = value => { socket.destroy(); resolveResult(value); };
    socket.setTimeout(10000, () => done(null));
    socket.on('error', () => done(null));
    socket.on('connect', () => socket.write(JSON.stringify({ hello: challenge }) + '\n'));
    socket.on('data', chunk => {
      buffer += chunk;
      if (buffer.length > 4096) return done(null);
      if (!buffer.includes('\n')) return;
      try {
        const response = JSON.parse(buffer); buffer = '';
        if (!serverVerified) {
          const expected = createHmac('sha256', state.token).update(`server:${challenge}`).digest();
          if (typeof response.proof !== 'string' || !/^[a-f0-9]{64}$/.test(response.proof) || !timingSafeEqual(expected, Buffer.from(response.proof, 'hex'))) return done(null);
          serverVerified = true;
          socket.write(JSON.stringify({ token: state.token, command, ...details }) + '\n');
        } else done(response);
      } catch { done(null); }
    });
  });
}
function environment() {
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (/^(?:NODE_OPTIONS|NODE_PATH|DATABASE_URL|APP_BASE_URL|PORT|HOSTNAME|MOCK_AI|LLM_|DEEPSEEK_|OPENAI_|TAVILY_|SEARCH_PROVIDER|NEXT_PUBLIC_|LDC_)/i.test(key)) delete env[key];
  const allowed = /^(?:MOCK_AI|LLM_PROVIDER|DEEPSEEK_(?:BASE_URL|MODEL|MODELS)|OPENAI_(?:BASE_URL|MODEL|MODELS)|SEARCH_PROVIDER|LDC_(?:ALLOW_CUSTOM_API|TRUSTED_API_ORIGINS|DAILY_MODEL_LIMIT|DAILY_SEARCH_LIMIT|MAX_EXTERNAL_CONCURRENCY))$/;
  const configured = parseEnv(readFileSync(configFile, 'utf8').replace(/^\uFEFF/, ''));
  for (const [key, value] of Object.entries(configured)) if (allowed.test(key)) env[key] = value;
  const saved = readCredentialStore(credentialStore);
  for (const name of keyNames) env[name] = saved[name] ?? '';
  return { ...env, LDC_SESSION_CREDENTIALS: '1', LDC_SECURITY_DIR: join(dataDir, 'security'), LDC_CREDENTIAL_STORE: credentialStore, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1', DATABASE_URL: join(dataDir, 'app.db'), APP_BASE_URL: origin, PORT: String(port), HOSTNAME: '127.0.0.1', MOCK_AI: configured.MOCK_AI === '0' ? '0' : '1' };
}
function migrateLegacyCredentials() {
  const original = readFileSync(configFile, 'utf8'), configured = parseEnv(original);
  const values = Object.fromEntries(keyNames.map(name => [name, configured[name]?.trim() ?? '']).filter(([, value]) => value));
  if (!Object.keys(values).length) return;
  if (Object.values(values).some(value => /[\r\n]/.test(value))) throw new Error('CREDENTIAL_MIGRATION_FAILED');
  writeCredentialStore(credentialStore, { ...readCredentialStore(credentialStore), ...values });
  const verified = readCredentialStore(credentialStore);
  if (Object.entries(values).some(([name, value]) => verified[name] !== value)) throw new Error('CREDENTIAL_MIGRATION_FAILED');
  const cleaned = original.replace(/^(?:export\s+)?(?:DEEPSEEK_API_KEY|OPENAI_API_KEY|TAVILY_API_KEY)\s*=.*$/gm, '');
  if (Object.values(values).some(value => cleaned.includes(value))) throw new Error('CREDENTIAL_MIGRATION_FAILED');
  writeFileSync(configFile, cleaned, { mode: 0o600 });
}
async function serve() {
  privateDirectory(controlDir);
  const token = randomBytes(32).toString('hex');
  let ready = false, shuttingDown = false;
  const control = net.createServer(socket => {
    let buffer = '', introduced = false; socket.setTimeout(10000, () => socket.destroy());
    socket.on('error', () => {});
    socket.on('data', chunk => {
      buffer += chunk; if (buffer.length > 16384) return socket.destroy();
      if (!buffer.includes('\n')) return;
      let command; try { command = JSON.parse(buffer); } catch { return socket.destroy(); }
      buffer = '';
      if (!introduced) {
        if (typeof command.hello !== 'string' || !/^[a-f0-9]{64}$/.test(command.hello)) return socket.destroy();
        socket.write(JSON.stringify({ proof: createHmac('sha256', token).update(`server:${command.hello}`).digest('hex') }) + '\n');
        introduced = true;
        return;
      }
      if (command.token !== token) return socket.destroy();
      if (command.command === 'credentials') {
        try {
          if (!keyNames.includes(command.name) || typeof command.key !== 'string' || command.key.length > 8192 || /[\r\n]/.test(command.key) || typeof command.remember !== 'boolean') throw new Error();
          const saved = readCredentialStore(credentialStore);
          if (command.remember && command.key) saved[command.name] = command.key; else delete saved[command.name];
          writeCredentialStore(credentialStore, saved);
          process.env[command.name] = command.key;
          socket.end(JSON.stringify({ updated: true }) + '\n');
        } catch { socket.end(JSON.stringify({ updated: false }) + '\n'); }
        return;
      }
      socket.end(JSON.stringify({ ready, origin, version: '0.1.0-preview.3', stopping: command.command === 'stop' }) + '\n');
      if (command.command === 'stop' && !shuttingDown) { shuttingDown = true; control.close(); setTimeout(() => { if (readState()?.token === token) { try { unlinkSync(stateFile); } catch {} } if (process.listenerCount('SIGTERM')) process.emit('SIGTERM'); else process.exit(0); setTimeout(() => process.exit(0), 10000).unref(); }, 100); }
    });
  });
  await new Promise((res, rej) => { control.once('error', rej); control.listen(pipe, res); });
  writeFileSync(stateFile, JSON.stringify({ token, pid: process.pid, origin, root }));
  process.on('exit', () => { if (readState()?.token === token) { try { unlinkSync(stateFile); } catch {} } });
  // Verify the fixed application port before modifying the user's database.
  await new Promise((res, rej) => { const probe = net.createServer(); probe.once('error', () => rej(new Error('PORT_BUSY'))); probe.listen(port, '127.0.0.1', () => probe.close(res)); });
  migrateLegacyCredentials();
  const env = environment();
  privateDirectory(join(dataDir, 'security'));
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
  if (action === 'config') {
    const current = await request('status');
    if (!current?.ready || current.version !== '0.1.0-preview.3') throw new Error('START_FIRST');
    const result = noUi ? readFileSync(0, 'utf8') : credentialOperation('Prompt');
    if (!result) return;
    const details = JSON.parse(result);
    if (!(await request('credentials', details))?.updated) throw new Error('CREDENTIAL_UPDATE_FAILED');
    console.log('凭据已在本机更新，网页刷新后可查看配置状态。');
    return;
  }
  if (action === 'settings') { runUi('notepad.exe', [configFile]); return; }
  if (action === 'data') { runUi('explorer.exe', [dataDir]); return; }
  if (action === 'status') { const status = await request('status'); console.log(JSON.stringify(status ? { running: true, ready: status.ready, origin: status.origin } : { running: false })); return; }
  if (action === 'stop') { const status = await request('stop'); if (!status) { console.log('没有正在运行的免安装版服务。'); return; } for (let i = 0; i < 80 && await request('status'); i++) await sleep(250); if (await request('status')) throw new Error('STOP_FAILED'); console.log('免安装版服务已停止；资料保留。'); return; }
  if (action !== 'start') throw new Error('UNKNOWN_ACTION');
  const previous = await request('status');
  if (previous?.ready) { await openBrowser(previous.origin); console.log('现有实例已就绪，已请求默认浏览器打开授权入口。'); return; }
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
    if (current?.ready) { await openBrowser(current.origin); console.log(noUi ? '免安装版已启动。' : '免安装版已启动，已请求默认浏览器打开授权入口。'); return; }
    if (childExited && !current) throw new Error('START_FAILED');
    await sleep(250);
  }
  throw new Error('START_FAILED');
}
main().catch(error => {
  if (action === 'serve' && error.code === 'EADDRINUSE') process.exit(0);
  if (action === 'serve') console.error('Startup failed:', /^[A-Z_]+$/.test(error.code ?? error.message) ? (error.code ?? error.message) : 'INTERNAL_ERROR');
  const message = error.message === 'BROWSER_FAILED' || error.message === 'BROWSER_UNSUPPORTED' ? '服务已就绪，但无法打开浏览器。请检查 Windows 默认浏览器的 HTTP 关联后重新双击启动入口；无需停止服务。手动输入普通网址不会获得授权。' : error.message === 'START_FIRST' ? '请先启动当前安全版本，再配置本机凭据。' : error.message === 'PORT_BUSY' ? '本地端口被占用，请先停止占用本端口的程序。' : '操作未完成。请检查数据目录中的 service.log；可尝试停止后重新启动。';
  writeFileSync(join(dataDir, 'last-error.txt'), `${new Date().toISOString()}\n${message}\n`, 'utf8');
  console.error(message);
  runUi('wscript.exe', [join(root, 'notice.vbs'), message]);
  process.exit(1);
});
