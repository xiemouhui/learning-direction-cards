import type Database from 'better-sqlite3';
import { servicePreferencesSchema, type ServicePreferences } from '../core/services';
import { defaultPreferences, providerConfig, type Environment } from './config';
import { dailyUsage } from './usage-limits';
import { AppError } from '../core/errors';

export function preferences(db: Database.Database, id: string, env: Environment = process.env) {
  // Read-only pages remain usable before the explicit v2 migration.
  const exists = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='service_preferences'").get();
  if (!exists) return { ...defaultPreferences(env), revision: 0, migrationRequired: true };
  const row = db.prepare('SELECT body,revision FROM service_preferences WHERE profile_id=?').get(id) as { body: string; revision: number } | undefined;
  const value = row ? servicePreferencesSchema.parse(JSON.parse(row.body)) : defaultPreferences(env);
  return { ...value, searchScope: value.searchScope ?? 'community' as const, searchPlatform: value.searchPlatform ?? 'all' as const, revision: row?.revision ?? 0, migrationRequired: false };
}
export function savePreferences(db: Database.Database, id: string, next: ServicePreferences, baseRevision: number, acknowledged: boolean, now: string, env: Environment = process.env) {
  if (!db.prepare('SELECT 1 FROM profiles WHERE id=?').get(id)) throw new AppError('当前身份已失效。', 401);
  const old = preferences(db, id, env);
  if (old.migrationRequired) throw new AppError('请先运行 pnpm db:migrate，再重启服务。', 503);
  if (old.revision !== baseRevision) throw new AppError('服务设置已变化，请刷新后重新核对。', 409);
  if ((next.aiEnabled || next.searchEnabled) && !acknowledged) throw new AppError('请先核对发送范围与外部服务调用费用。');
  if (next.aiEnabled && (!providerConfig(next.provider, env).configured || !next.model)) throw new AppError('所选服务尚未配置有效 Key、接口或模型；请在本机 .env.local 配置并重启。');
  if (next.searchEnabled && !(next.searchProvider === 'deepseek' ? providerConfig('deepseek', env).configured : !!env.TAVILY_API_KEY?.trim())) throw new AppError('所选检索服务缺少本地 Key 配置。');
  db.prepare('INSERT INTO service_preferences VALUES (?,?,?,1,?,?) ON CONFLICT(profile_id) DO UPDATE SET body=excluded.body,revision=excluded.revision,consent_version=1,updated_at=excluded.updated_at').run(id, JSON.stringify({ ...next, searchScope: next.searchScope ?? old.searchScope, searchPlatform: next.searchPlatform ?? old.searchPlatform, dailyModelLimit: next.dailyModelLimit ?? old.dailyModelLimit ?? 40, dailySearchLimit: next.dailySearchLimit ?? old.dailySearchLimit ?? 20 }), old.revision + 1, now, now);
  return { saved: true };
}
export function usageSummary(db: Database.Database, id: string, now: string) {
  const rows = db.prepare("SELECT body FROM records WHERE profile_id=? AND kind='agentRun' AND created_at>=? ORDER BY created_at DESC").all(id, new Date(Date.parse(now) - 7 * 86400000).toISOString()) as { body: string }[];
  const calls = rows.map(r => JSON.parse(r.body) as { provider?: string; model?: string; status?: string; calls?: number; usage?: { inputTokens?: number | null; outputTokens?: number | null; totalTokens: number | null }; searchCalls?: number });
  const usageKnown = calls.filter(c => c.calls && c.usage?.totalTokens !== null && c.usage?.totalTokens !== undefined);
  const byProvider = (['deepseek', 'openai'] as const).map(provider => {
    const selected = calls.filter(c => c.provider === provider);
    return { provider, calls: selected.reduce((sum, c) => sum + (c.calls ?? 0), 0), inputTokens: selected.reduce((sum, c) => sum + (c.usage?.inputTokens ?? 0), 0), outputTokens: selected.reduce((sum, c) => sum + (c.usage?.outputTokens ?? 0), 0), unknownCalls: selected.reduce((sum, c) => sum + (c.calls && c.usage?.totalTokens == null ? c.calls : 0), 0) };
  });
  return { today: dailyUsage(db, id, now), byProvider, externalCalls: calls.reduce((sum, c) => sum + (c.calls ?? 0), 0), searchCalls: calls.reduce((sum, c) => sum + (c.searchCalls ?? 0), 0), knownTokens: usageKnown.reduce((sum, c) => sum + (c.usage?.totalTokens ?? 0), 0), unknownUsageCalls: calls.reduce((sum, c) => sum + (c.calls && c.usage?.totalTokens == null ? c.calls : 0), 0), recent: calls.slice(0, 10).map(c => ({ provider: c.provider ?? null, model: c.model ?? null, status: c.status ?? 'local', calls: c.calls ?? 0 })) };
}
