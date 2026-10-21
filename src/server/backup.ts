import { z } from 'zod';
import { createHash, randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import { assessmentSchema, stateSchema, nodeSchema } from '../core/schema';
import { plannedSchema, gapSchema, gapCategorySchema } from '../core/plan-schema';
import { getRelease, release } from '../core/catalog';
import { AppError } from '../core/errors';
import { servicePreferencesSchema, searchStatusSchema } from '../core/services';
import { defaultPreferences } from './config';
import { publicUrl } from './search-policy';
import { attemptContextSchema } from '../core/task-evidence';
import { actionGuide } from '../core/action-guide';

const id = z.uuid(), date = z.iso.datetime({ offset: true }), text = z.string().max(10000);
const knowledge = z.record(z.string().min(1).max(100), stateSchema).refine(k => Object.keys(k).length <= 1000);
const citation = z.object({ id: text, title: text, url: z.url().refine(v => publicUrl(v) !== null), retrievedAt: z.string().nullable(), cached: z.boolean(), kind: z.enum(['knowledge', 'web']), sourceType: z.enum(['community', 'reference']).optional(), platform: text.optional(), usedInAnswer: z.boolean().optional() });
const search = searchStatusSchema;
const result = z.object({ domain: nodeSchema, topic: nodeSchema.optional(), interest: text, preparation: text, evidence: text, positive: z.array(text).max(15), negative: z.array(text).max(15), gaps: z.array(gapSchema).max(1000), coverage: z.array(z.boolean()).length(3), limitation: text });
const versions = z.record(z.string(), z.union([text, z.number()]));
const bodies = {
  snapshot: z.object({ version: z.number().int().nonnegative(), knowledge, assessment: assessmentSchema.nullable(), knowledgeRelease: text }),
  event: z.object({ nodeId: text, previous: stateSchema.nullable(), next: stateSchema.nullable(), confirmedAt: date, kind: z.enum(['confirmed-self-assessment', 'reverted-self-assessment']), revertsEventId: id.optional() }),
  assessment: z.object({ assessment: assessmentSchema, knowledge, results: z.array(result).max(50), versions, mode: z.literal('local') }),
  attempt: z.object({ content: z.string().max(2000), reportedAt: date, context: attemptContextSchema.optional() }),
  checkin: z.object({ action: z.literal('checkin').optional(), pathId: id.optional(), content: z.string().max(500), hours: z.number().min(0).max(168), completion: z.number().int().min(1).max(5), difficulty: z.number().int().min(1).max(5), interest: z.enum(['up', 'same', 'down']), obstacle: z.string().max(100), at: date }),
  message: z.object({ role: z.enum(['user', 'assistant']), content: text, topicId: text.nullable().optional(), mode: z.enum(['local', 'ai']).optional(), provider: z.enum(['deepseek', 'openai']).nullable().optional(), model: text.nullable().optional(), citations: z.array(citation).max(30).optional(), questions: z.array(text).max(3).optional(), notice: text.nullable().optional(), search: search.optional() }),
  proposal: z.object({ basePathVersion: z.number().int().positive(), baseProfileVersion: z.number().int().nonnegative(), pathId: id, before: plannedSchema, next: plannedSchema, changes: z.array(z.object({ nodeId: text, name: text, before: gapCategorySchema.nullable(), after: gapCategorySchema.nullable(), reason: text })).max(1000), status: z.enum(['pending', 'accepted', 'rejected']), expiresAt: date }),
};
const backupSchema = z.object({
  exportSchemaVersion: z.literal(1), exportedAt: date, timezone: z.literal('Asia/Shanghai'),
  profile: z.object({ createdAt: date, version: z.number().int().nonnegative() }), knowledge, assessment: assessmentSchema.nullable(),
  paths: z.array(z.object({ id, topic_id: text, active: z.union([z.literal(0), z.literal(1)]), version: z.number().int().positive(), created_at: date, updated_at: date, versions: z.array(z.object({ version: z.number().int().positive(), plan: plannedSchema, createdAt: date })).min(1).max(500) })).max(100),
  records: z.array(z.object({ id, kind: z.enum(['snapshot', 'event', 'assessment', 'attempt', 'checkin', 'message', 'proposal']), parentId: id.nullable(), createdAt: date, body: z.record(z.string(), z.unknown()) })).max(10000),
  versions: z.object({ knowledgeRelease: text, planner: text }), servicePreferences: servicePreferencesSchema.extend({ revision: z.number().int().nonnegative().optional(), migrationRequired: z.boolean().optional() }).optional(),
  browserDraft: assessmentSchema.nullable().optional(),
});
function validatePlan(plan: z.infer<typeof plannedSchema>) {
  const r = getRelease(plan.knowledgeRelease);
  if (!r || !r.nodes.some(n => n.id === plan.topicId && n.type === 'subdomain') || plan.gaps.some(g => !r.nodes.some(n => n.id === g.nodeId)) || plan.steps.some(s => !r.nodes.some(n => n.id === s.nodeId)) || (plan.projectId && !r.nodes.some(n => n.id === plan.projectId && n.type === 'project'))) throw new AppError('备份包含未知知识版本或路线节点。');
}
function validateKnowledge(value: z.infer<typeof knowledge>) {
  if (Object.keys(value).some(key => !release.nodes.some(n => n.id === key && ['knowledge', 'skill'].includes(n.type)))) throw new AppError('备份包含未知知识节点，无法安全恢复。');
}
export function parseBackup(raw: unknown) {
  let data: z.infer<typeof backupSchema>;
  try { data = backupSchema.parse(raw); } catch { throw new AppError('备份格式、版本或字段不正确；请选择本应用导出的 JSON。'); }
  if (!getRelease(data.versions.knowledgeRelease)) throw new AppError('备份知识版本不受支持，请保留原文件。');
  validateKnowledge(data.knowledge);
  const allIds = [...data.paths.map(p => p.id), ...data.records.map(r => r.id)];
  if (new Set(allIds).size !== allIds.length || data.paths.filter(p => p.active).length > 1) throw new AppError('备份有重复标识或多个活动计划。');
  const pathIds = new Set(data.paths.map(p => p.id));
  for (const p of data.paths) {
    if (!p.versions.some(v => v.version === p.version) || new Set(p.versions.map(v => v.version)).size !== p.versions.length) throw new AppError('备份路线版本缺失或重复。');
    for (const v of p.versions) { validatePlan(v.plan); if (v.plan.topicId !== p.topic_id) throw new AppError('备份路线专题不一致。'); }
  }
  for (const record of data.records) {
    if (record.parentId && !pathIds.has(record.parentId)) throw new AppError('备份记录引用了不存在的路线。');
    try { record.body = bodies[record.kind].parse(record.body); } catch { throw new AppError(`备份中的 ${record.kind} 记录格式不正确。`); }
    if (['attempt', 'checkin', 'proposal'].includes(record.kind) && !record.parentId) throw new AppError('备份的路线关联不完整。');
    if (record.kind === 'attempt' && record.body.context) {
      const context = attemptContextSchema.parse(record.body.context), archive = getRelease(context.knowledgeRelease);
      const path = data.paths.find(p => p.id === record.parentId), plan = path?.versions.find(v => v.version === context.evidence.pathVersion)?.plan;
      if (!archive || !plan || plan.knowledgeRelease !== context.knowledgeRelease || plan.projectId !== context.projectId || context.evidence.stepIndex >= plan.steps.length || context.nodeIds.some(id => !archive.nodes.some(n => n.id === id && ['knowledge', 'skill'].includes(n.type)))) throw new AppError('备份任务证据的路线版本或知识关联不完整。');
      const step = plan.steps[context.evidence.stepIndex];
      const expected = step.nodeId !== plan.projectId ? [step.nodeId] : actionGuide(archive.nodes.find(n => n.id === plan.projectId))?.evidenceNodes ?? archive.edges.filter(e => e.type === 'validated_by' && e.to === plan.projectId).map(e => e.from);
      const ids = [...new Set(expected)].filter(id => archive.nodes.some(n => n.id === id && ['knowledge', 'skill'].includes(n.type)));
      if (JSON.stringify(ids) !== JSON.stringify(context.nodeIds)) throw new AppError('备份任务证据与所选行动不一致。');
    }
    if (record.kind === 'snapshot' || record.kind === 'assessment') validateKnowledge(record.body.knowledge as z.infer<typeof knowledge>);
    if (record.kind === 'snapshot' && !getRelease(String(record.body.knowledgeRelease))) throw new AppError('画像快照版本未知。');
    if (record.kind === 'event' && !release.nodes.some(n => n.id === record.body.nodeId && ['knowledge', 'skill'].includes(n.type))) throw new AppError('知识事件节点未知。');
    if (record.kind === 'proposal') { validatePlan(record.body.before as z.infer<typeof plannedSchema>); validatePlan(record.body.next as z.infer<typeof plannedSchema>); }
    if ((record.kind === 'checkin' || record.kind === 'proposal') && record.body.pathId && record.body.pathId !== record.parentId) throw new AppError('备份记录的路线归属不一致。');
  }
  const projection: z.infer<typeof knowledge> = {};
  const events = new Map<string, (typeof data.records)[number]>();
  const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  for (const record of data.records.filter(r => r.kind === 'event')) {
    const event = record.body, nodeId = String(event.nodeId);
    if (!equal(projection[nodeId] ?? null, event.previous)) throw new AppError('备份知识事件链不连续，请保留原文件并核对。');
    if (event.kind === 'reverted-self-assessment') {
      const original = events.get(String(event.revertsEventId));
      if (!original || original.body.nodeId !== nodeId || original.body.kind !== 'confirmed-self-assessment' || !equal(original.body.previous, event.next)) throw new AppError('备份撤销事件引用不正确。');
    } else if (event.next === null) throw new AppError('知识确认事件缺少新值。');
    if (event.next === null) delete projection[nodeId]; else projection[nodeId] = event.next as z.infer<typeof stateSchema>;
    events.set(record.id, record);
  }
  const keys = Object.keys(projection).sort();
  if (!equal(keys, Object.keys(data.knowledge).sort()) || keys.some(key => !equal(projection[key], data.knowledge[key]))) throw new AppError('备份知识事件与当前画像不一致，无法安全恢复。');
  return data;
}
export function backupPreview(raw: unknown) {
  const data = parseBackup(raw);
  return { hash: createHash('sha256').update(JSON.stringify(data)).digest('hex'), exportedAt: data.exportedAt, knowledgeCount: Object.keys(data.knowledge).length, pathCount: data.paths.length, recordCount: data.records.length, knowledgeRelease: data.versions.knowledgeRelease };
}
export function restoreBackup(db: Database.Database, profileId: string, raw: unknown, expectedHash: string, baseVersion: number, now: string) {
  const data = parseBackup(raw), preview = backupPreview(raw);
  if (preview.hash !== expectedHash) throw new AppError('文件已变化，请重新预览。', 409);
  return db.transaction(() => {
    const profile = db.prepare('SELECT version,assessment FROM profiles WHERE id=?').get(profileId) as { version: number; assessment: string | null } | undefined;
    const counts = ['records', 'paths', 'knowledge_states', 'external_requests'].map(table => (db.prepare(`SELECT count(*) AS n FROM ${table} WHERE profile_id=?`).get(profileId) as { n: number }).n);
    if (!profile || profile.version !== baseVersion || profile.assessment || counts.some(Boolean)) throw new AppError('仅允许恢复到空白身份；现有资料不会被覆盖。请在新的浏览器身份中恢复。', 409);
    const ids = new Map([...data.paths.map(p => p.id), ...data.records.map(r => r.id)].map(old => [old, randomUUID()]));
    function remap(value: unknown, key = ''): unknown {
      if (typeof value === 'string' && ['id', 'pathId', 'proposalId', 'eventId', 'revertsEventId', 'parentId'].includes(key)) return ids.get(value) ?? value;
      if (Array.isArray(value)) return value.map(v => remap(v));
      if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, remap(v, k)]));
      return value;
    }
    db.prepare('UPDATE profiles SET version=?,assessment=?,created_at=?,updated_at=? WHERE id=?').run(data.profile.version, data.assessment ? JSON.stringify(data.assessment) : null, data.profile.createdAt, now, profileId);
    for (const [nodeId, k] of Object.entries(data.knowledge)) db.prepare('INSERT INTO knowledge_states VALUES (?,?,?,?,?,?,?,?,?)').run(profileId, nodeId, k.level, k.evidenceType, k.evidence, k.learningStatus, Number(k.conflict), now, now);
    for (const p of data.paths) {
      const newId = ids.get(p.id)!;
      db.prepare('INSERT INTO paths VALUES (?,?,?,?,?,?,?)').run(newId, profileId, p.topic_id, p.active, p.version, p.created_at, p.updated_at);
      for (const v of p.versions) db.prepare('INSERT INTO path_versions VALUES (?,?,?,?,?,?,?)').run(randomUUID(), profileId, newId, v.version, JSON.stringify(v.plan), v.createdAt, v.createdAt);
    }
    for (const r of data.records) db.prepare('INSERT INTO records VALUES (?,?,?,?,?,?,?)').run(ids.get(r.id), profileId, r.kind, r.parentId ? ids.get(r.parentId) : null, JSON.stringify(remap(r.body)), r.createdAt, r.createdAt);
    const settings = { ...(data.servicePreferences ?? defaultPreferences()), aiEnabled: false, searchEnabled: false };
    db.prepare('INSERT INTO service_preferences VALUES (?,?,1,1,?,?) ON CONFLICT(profile_id) DO UPDATE SET body=excluded.body,revision=service_preferences.revision+1,updated_at=excluded.updated_at').run(profileId, JSON.stringify(settings), now, now);
    return { restored: true, ...preview, browserDraft: data.browserDraft ?? null };
  })();
}
