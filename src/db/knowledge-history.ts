import type Database from 'better-sqlite3';
import { stateSchema, type Knowledge } from '../core/schema';
import { AppError } from '../core/errors';
import { addRecord, knowledge, profile, snapshot } from './store';
type Event = { id: string; body: string };
export function replayKnowledge(db: Database.Database, id: string): Knowledge {
  const rows = db.prepare("SELECT id,body FROM records WHERE profile_id=? AND kind='event' ORDER BY rowid").all(id) as Event[];
  const projection: Knowledge = {};
  for (const row of rows) {
    const event = JSON.parse(row.body) as { nodeId: string; next: unknown };
    if (event.next === null) delete projection[event.nodeId];
    else projection[event.nodeId] = stateSchema.parse(event.next);
  }
  return projection;
}
export function revertKnowledge(db: Database.Database, id: string, eventId: string, baseVersion: number, now: string) {
  return db.transaction(() => {
    if (profile(db, id).version !== baseVersion) throw new AppError('画像已变化，请刷新后重新核对。', 409);
    const events = db.prepare("SELECT id,body FROM records WHERE profile_id=? AND kind='event' ORDER BY rowid").all(id) as Event[];
    const target = events.find(e => e.id === eventId);
    if (!target) throw new AppError('知识事件不存在或不属于当前身份。', 404);
    const event = JSON.parse(target.body) as { nodeId: string; kind: string; previous: unknown; next: unknown };
    const latest = events.filter(e => JSON.parse(e.body).nodeId === event.nodeId).at(-1);
    if (event.kind !== 'confirmed-self-assessment' || latest?.id !== eventId) throw new AppError('只能撤销该知识项最近一次确认，旧历史保持不变。', 409);
    const current = knowledge(db, id)[event.nodeId] ?? null;
    if (JSON.stringify(current) !== JSON.stringify(event.next)) throw new AppError('知识投影与事件不一致，请先核对资料。', 409);
    const next = event.previous === null ? null : stateSchema.parse(event.previous);
    if (next === null) db.prepare('DELETE FROM knowledge_states WHERE profile_id=? AND node_id=?').run(id, event.nodeId);
    else db.prepare('UPDATE knowledge_states SET level=?,evidence_type=?,evidence=?,learning_status=?,conflict=?,updated_at=? WHERE profile_id=? AND node_id=?').run(next.level, next.evidenceType, next.evidence, next.learningStatus, Number(next.conflict), now, id, event.nodeId);
    const newEventId = addRecord(db, id, 'event', { nodeId: event.nodeId, previous: current, next, kind: 'reverted-self-assessment', revertsEventId: eventId, confirmedAt: now }, now);
    db.prepare('UPDATE profiles SET version=version+1,updated_at=? WHERE id=?').run(now, id);
    snapshot(db, id, now);
    return { reverted: true, eventId: newEventId };
  })();
}
