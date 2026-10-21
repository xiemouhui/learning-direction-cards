import { mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { openDatabase } from '../src/db/client';
async function main() {
  const directory = resolve('.local/backups'); mkdirSync(directory, { recursive: true });
  const destination = resolve(directory, `app-${new Date().toISOString().replace(/[:.]/g, '-')}.db`);
  if (existsSync(destination)) throw new Error('备份目标已存在，不覆盖。');
  const db = openDatabase();
  try { await db.backup(destination); console.log('数据库在线一致性备份完成，保存在本项目 .local/backups（包含个人资料，已被 Git 忽略）。'); }
  finally { db.close(); }
}
void main().catch(() => { console.error('数据库备份失败；原数据库未被替换。'); process.exitCode = 1; });
