import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { AppError } from '../core/errors';
import type { Environment } from './config';

function cap(value: string | undefined, fallback: number) { return value === undefined ? fallback : /^\d{1,6}$/.test(value) ? Number(value) : 0; }
export function instanceBudgetStatus(db: Database.Database, now: string, env: Environment = process.env) {
  const day = new Date(Date.parse(now) + 8 * 3600000).toISOString().slice(0, 10);
  const exists = !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='instance_budgets'").get();
  const usage = exists ? db.prepare('SELECT coalesce(sum(model_calls),0) AS model,coalesce(sum(search_calls),0) AS search FROM instance_budgets WHERE day=?').get(day) as { model: number; search: number } : { model: 0, search: 0 };
  return { day, model: usage.model, search: usage.search, modelLimit: cap(env.LDC_DAILY_MODEL_LIMIT, 80), searchLimit: cap(env.LDC_DAILY_SEARCH_LIMIT, 40), migrationRequired: !exists };
}
export function reserveInstanceBudget(db: Database.Database, model: number, search: number, now: string, env: Environment) {
  if (!model && !search) return null;
  if (instanceBudgetStatus(db, now, env).migrationRequired) throw new AppError('安全预算表尚未初始化，请迁移数据库并重启服务。', 503);
  const day = new Date(Date.parse(now) + 8 * 3600000).toISOString().slice(0, 10);
  const result = db.prepare('SELECT coalesce(sum(model_calls),0) AS model,coalesce(sum(search_calls),0) AS search FROM instance_budgets WHERE day=?').get(day) as { model: number; search: number };
  if (result.model + model > cap(env.LDC_DAILY_MODEL_LIMIT, 80) || result.search + search > cap(env.LDC_DAILY_SEARCH_LIMIT, 40)) throw new AppError('已达到本机今日外部调用上限；切换身份或清 Cookie 不会重置。', 429);
  const pending = db.prepare("SELECT count(*) AS count FROM instance_budgets WHERE status='pending' AND created_at>?").get(new Date(Date.parse(now) - 90000).toISOString()) as { count: number };
  if (pending.count >= cap(env.LDC_MAX_EXTERNAL_CONCURRENCY, 2)) throw new AppError('本机外部请求正在处理中，请稍后再试。', 429);
  const id = randomUUID();
  db.prepare("INSERT INTO instance_budgets VALUES (?,?,?,?,'pending',?,?)").run(id, day, model, search, now, now);
  db.prepare('DELETE FROM instance_budgets WHERE day<?').run(new Date(Date.parse(now) - 31 * 86400000).toISOString().slice(0, 10));
  return id;
}
export function completeInstanceBudget(db: Database.Database, id: string | null, model: number, search: number, now: string) {
  if (id) db.prepare("UPDATE instance_budgets SET model_calls=max(0,min(model_calls,?)),search_calls=max(0,min(search_calls,?)),status='complete',updated_at=? WHERE id=?").run(model, search, now, id);
}
