import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, readdirSync, lstatSync } from 'node:fs';
import { resolve, join, relative, basename } from 'node:path';
import { parseEnv } from 'node:util';

// Publish only tracked source plus these explicitly reviewed release files.
const additions = ['LICENSE', 'docs/portable-windows.md', 'docs/release-checklist.md', 'scripts/package-windows.mjs', 'scripts/test-portable.mjs', 'scripts/audit-release.mjs', 'scripts/portable/launcher.mjs'];
const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const files = [...new Set([...tracked, ...additions])].filter(f => existsSync(f)).sort();
const local = existsSync('.env.local') ? parseEnv(readFileSync('.env.local', 'utf8')) : {};
const secrets = Object.entries(local).filter(([k, v]) => /(?:KEY|TOKEN|SECRET|PASSWORD)/i.test(k) && v.length >= 12).map(([, v]) => v);
const violations = [];
const localUser = basename(process.env.USERPROFILE ?? '');
function inspect(file, label) {
  const b = readFileSync(file), text = b.toString('utf8');
  if (secrets.some(value => b.includes(Buffer.from(value)))) violations.push(`${label}: local credential`);
  if ([...text.matchAll(/C:[\\/]+Users[\\/]+([^\\/"'\s]+)/gi)].some(m => localUser && m[1].toLowerCase() === localUser.toLowerCase())) violations.push(`${label}: private absolute path`);
}
for (const file of files) {
  if (/(?:^|\/)(?:\.local|dist|data|node_modules|\.env(?:\.(?!example$).*)?)(?:\/|$)|\.(?:db|sqlite|log)$/i.test(file)) violations.push(`${file}: private file`);
  inspect(file, file);
}
if (process.argv.includes('--bundle')) {
  const directory = resolve('dist/learning-direction-cards-0.1.0-preview.1-windows-x64');
  const walk = dir => { for (const item of readdirSync(dir)) { const file = join(dir, item); if (lstatSync(file).isDirectory()) walk(file); else inspect(file, relative(directory, file)); } };
  walk(directory);
}
if (violations.length) { console.error(JSON.stringify({ passed: false, violations })); process.exit(1); }
if (process.argv.includes('--files')) process.stdout.write(files.join('\n'));
else console.log(JSON.stringify({ passed: true, sourceFiles: files.length, localCredentialsChecked: secrets.length, bundleChecked: process.argv.includes('--bundle'), privateHistoryPublished: false }));
