import type Database from 'better-sqlite3';
export function dailyUsage(db: Database.Database, id: string, now: string) {
  const day = new Date(Date.parse(now) + 8 * 3600000).toISOString().slice(0, 10);
  const start = new Date(`${day}T00:00:00+08:00`).toISOString();
  const end = new Date(Date.parse(start) + 86400000).toISOString();
  const rows = db.prepare("SELECT body FROM records WHERE profile_id=? AND kind='agentRun' AND created_at>=? AND created_at<?").all(id, start, end) as { body: string }[];
  const total = { day, modelCalls: 0, searchCalls: 0, modelReserved: 0, searchReserved: 0 };
  for (const row of rows) {
    const body = JSON.parse(row.body) as { calls?: number; searchCalls?: number; status?: string; modelReserved?: number; searchReserved?: number };
    total.modelCalls += body.calls ?? 0; total.searchCalls += body.searchCalls ?? 0;
    if (body.status === 'pending') { total.modelReserved += body.modelReserved ?? 0; total.searchReserved += body.searchReserved ?? 0; }
  }
  return total;
}
