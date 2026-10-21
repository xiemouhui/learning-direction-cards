import { existsSync, mkdirSync, readFileSync, writeFileSync, cpSync, readdirSync, statSync } from 'node:fs';
import { resolve, join, basename, relative, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';

if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('当前发布器只支持 Windows x64。');
const project = process.cwd();
const version = '0.1.0-preview.2';
const name = `learning-direction-cards-${version}-windows-x64`;
const destination = resolve('dist', name);
const vendor = resolve('.local/vendor/node-v24.19.0-win-x64');
const archiveOnly = process.argv.includes('--archive-only');
if (existsSync(destination) && !archiveOnly && !process.argv.includes('--resume-build')) throw new Error('发布目录已存在，请使用新的空白输出目录，不能覆盖已验收包。');
if (!archiveOnly) {
for (const file of ['.next-portable/standalone/server.js', '.next-portable/BUILD_ID', 'LICENSE', join(vendor, 'node.exe'), join(vendor, 'LICENSE')]) if (!existsSync(file)) throw new Error(`缺少打包输入：${basename(file)}`);
mkdirSync(destination, { recursive: true });
const app = join(destination, 'app');
const forbidden = file => /(?:^|[\\/])(?:\.env(?:\..*)?|\.git|data|\.local|test-results)(?:[\\/]|$)/i.test(relative(resolve('.next-portable/standalone'), file)) || /^node_modules[\\/]\.pnpm(?:[\\/]|$)/.test(relative(resolve('.next-portable/standalone'), file)) || /\.(?:db(?:-wal|-shm)?|sqlite3?|log|tsbuildinfo|dpapi)$/i.test(file);
cpSync(resolve('.next-portable/standalone'), app, { recursive: true, dereference: true, filter: file => !forbidden(file) });
// Windows pnpm junctions point at the original store. Materialize traced packages
// at the portable root so sibling dependencies resolve without that store.
for (const entry of readdirSync(resolve('.next-portable/standalone/node_modules/.pnpm'), { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const at = entry.name.indexOf('@', 1);
  if (at < 0) continue;
  const packageName = entry.name.slice(0, at).replace('+', '/');
  const source = resolve('.next-portable/standalone/node_modules/.pnpm', entry.name, 'node_modules', packageName);
  if (existsSync(source)) cpSync(source, join(app, 'node_modules', packageName), { recursive: true, dereference: true });
}
cpSync(resolve('.next-portable/static'), join(app, '.next-portable/static'), { recursive: true });
if (existsSync('public')) cpSync('public', join(app, 'public'), { recursive: true });
cpSync('migrations', join(app, 'migrations'), { recursive: true });
await build({ absWorkingDir: project, tsconfig: resolve('tsconfig.json'), entryPoints: [resolve('scripts/database.ts')], bundle: true, platform: 'node', target: 'node24', format: 'cjs', external: ['better-sqlite3'], outfile: join(app, 'maintenance.cjs'), logLevel: 'silent' });
const runtime = join(destination, 'runtime'); mkdirSync(runtime);
for (const [from, to] of [['node.exe', 'node.exe'], ['LICENSE', 'LICENSE.txt']]) cpSync(join(vendor, from), join(runtime, to));
cpSync('scripts/portable/launcher.mjs', join(destination, 'launcher.mjs'));
cpSync('scripts/security', join(destination, 'security'), { recursive: true });
cpSync('LICENSE', join(destination, 'LICENSE'));
cpSync('.env.example', join(destination, 'config.example.env'));
cpSync('docs/portable-windows.md', join(destination, '使用说明.md'));
const vbs = (file, text) => writeFileSync(join(destination, file), Buffer.concat([Buffer.from([255, 254]), Buffer.from(text.replaceAll('\n', '\r\n'), 'utf16le')]));
for (const [label, action] of [['启动', 'start'], ['停止', 'stop'], ['配置模型', 'config'], ['高级设置', 'settings'], ['打开数据目录', 'data']]) vbs(`${label}.vbs`, `Option Explicit\nDim sh, fs, root, command\nSet sh = CreateObject("WScript.Shell")\nSet fs = CreateObject("Scripting.FileSystemObject")\nroot = fs.GetParentFolderName(WScript.ScriptFullName)\ncommand = Chr(34) & root & "\\runtime\\node.exe" & Chr(34) & " " & Chr(34) & root & "\\launcher.mjs" & Chr(34) & " ${action}"\nsh.Run command, 0, False\n`);
vbs('notice.vbs', 'If WScript.Arguments.Count > 0 Then MsgBox WScript.Arguments(0), 48, "计算机学习方向卡"\n');
const notices = [];
function licenses(directory) {
  for (const item of readdirSync(directory, { withFileTypes: true })) {
    const file = join(directory, item.name);
    if (item.isDirectory()) licenses(file);
    else if (/^(?:LICENSE(?:\..*)?|COPYING(?:\..*)?|NOTICE(?:\..*)?)$/i.test(item.name)) {
      if (statSync(file).size < 2_000_000) notices.push(`\n===== ${relative(app, file).replaceAll('\\', '/')} =====\n${readFileSync(file, 'utf8')}\n`);
    }
  }
}
licenses(join(app, 'node_modules'));
// Trace output may omit license files. Include notices from installed dependencies, without private project files.
licenses(resolve('node_modules/.pnpm'));
writeFileSync(join(destination, 'THIRD-PARTY-NOTICES.txt'), [...new Set(notices)].join('\n'));
writeFileSync(join(destination, 'release.json'), JSON.stringify({ version, platform: 'win32', arch: 'x64', node: '24.19.0', knowledgeRelease: '2026-10-21.5', dataDirectory: '%LOCALAPPDATA%/LearningDirectionCards', port: 32145, includesUserData: false }, null, 2));
}
// Next's build metadata and pnpm command shims can retain the builder's home path.
// These locations are metadata, not the runtime root (server.js resolves __dirname).
const home = process.env.USERPROFILE;
const privatePrefixes = home ? [home, home.replaceAll('\\', '/'), home.replaceAll('\\', '\\\\')] : [];
function scrub(directory) {
  for (const item of readdirSync(directory, { withFileTypes: true })) {
    const file = join(directory, item.name);
    if (item.isDirectory()) scrub(file);
    else if (/\.(?:json|[cm]?js|cmd|ps1|txt)$/i.test(file) || !item.name.includes('.')) {
      const original = readFileSync(file, 'utf8'); let cleaned = original;
      for (const prefix of privatePrefixes.sort((a, b) => b.length - a.length)) cleaned = cleaned.replaceAll(prefix, prefix.includes('\\\\') ? 'C:\\\\build' : prefix.includes('\\') ? 'C:\\build' : 'C:/build');
      cleaned = cleaned.replace(/C:([\\/]+)Users[\\/]+([^\\/"'\s]+)/gi, (match, slashes, user) => home && user.toLowerCase() === basename(home).toLowerCase() ? `C:${slashes}build` : match);
      if (cleaned !== original) writeFileSync(file, cleaned);
    }
  }
}
scrub(destination);
const files = [];
function inventory(directory) { for (const item of readdirSync(directory, { withFileTypes: true })) { const file = join(directory, item.name); if (item.isDirectory()) inventory(file); else if (item.name !== 'FILES-SHA256.json') files.push({ path: relative(destination, file).replaceAll('\\', '/'), bytes: statSync(file).size, sha256: createHash('sha256').update(readFileSync(file)).digest('hex') }); } }
inventory(destination);
if (files.some(f => /(?:^|\/)\.env(?:\.|$)|\.(?:db|sqlite|log)$/i.test(f.path))) throw new Error('发布包中出现不允许的本地文件。');
writeFileSync(join(destination, 'FILES-SHA256.json'), JSON.stringify(files, null, 2));
const zip = resolve('dist', `${name}.zip`);
execFileSync('tar.exe', ['-a', '-cf', zip, '-C', dirname(destination), basename(destination)], { windowsHide: true, stdio: 'pipe' });
writeFileSync(`${zip}.sha256`, `${createHash('sha256').update(readFileSync(zip)).digest('hex')}  ${basename(zip)}\n`);
console.log(JSON.stringify({ directory: relative(project, destination), zip: relative(project, zip), files: files.length, bytes: statSync(zip).size, includesUserData: false }));
