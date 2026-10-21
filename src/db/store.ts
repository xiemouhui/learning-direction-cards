import { createHash, randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import { Assessment, Knowledge, KnowledgeState } from '../core/schema';
import { plan, Planned, PlanInput, PLANNER_VERSION } from '../core/planner';
import { release } from '../core/catalog';
import { recommend } from '../core/recommendation';
import { AppError } from '../core/errors';
export { AppError } from '../core/errors';
import { preferences, usageSummary } from '../server/preferences';
import { serviceCatalog } from '../server/config';
import { instanceBudgetStatus } from '../server/instance-budget';
type Row = {
    id: string;
    kind: string;
    parent_id: string | null;
    body: string;
    created_at: string;
};
export type PathRow = {
    id: string;
    topic_id: string;
    active: number;
    version: number;
    created_at: string;
    updated_at: string;
};
export type PathView = PathRow & {
    versions: {
        version: number;
        plan: Planned;
        createdAt: string;
    }[];
};
export function createProfile(db: Database.Database, id: string, now: string) { db.prepare('INSERT INTO profiles(id,version,created_at,updated_at) VALUES (?,0,?,?)').run(id, now, now); }
export function profile(db: Database.Database, id: string) { const row = db.prepare('SELECT * FROM profiles WHERE id=?').get(id) as {
    id: string;
    version: number;
    assessment: string | null;
    created_at: string;
} | undefined; if (!row)
    throw new AppError('资料不存在，请刷新页面。', 404); return row; }
export function knowledge(db: Database.Database, id: string): Knowledge {
    const rows = db.prepare('SELECT * FROM knowledge_states WHERE profile_id=?').all(id) as {
        node_id: string;
        level: number | null;
        evidence_type: KnowledgeState['evidenceType'];
        evidence: string;
        learning_status: KnowledgeState['learningStatus'];
        conflict: number;
    }[];
    return Object.fromEntries(rows.map(s => [s.node_id, { level: s.level, evidenceType: s.evidence_type, evidence: s.evidence, learningStatus: s.learning_status, conflict: !!s.conflict }]));
}
export function addRecord(db: Database.Database, id: string, kind: string, body: unknown, now: string, parentId: string | null = null) { const key = randomUUID(); db.prepare('INSERT INTO records VALUES (?,?,?,?,?,?,?)').run(key, id, kind, parentId, JSON.stringify(body), now, now); return key; }
export function snapshot(db: Database.Database, id: string, now: string) { const p = profile(db, id); return addRecord(db, id, 'snapshot', { version: p.version, knowledge: knowledge(db, id), assessment: p.assessment ? JSON.parse(p.assessment) : null, knowledgeRelease: release.id }, now); }
export function pathById(db: Database.Database, id: string, pathId: string) { const row = db.prepare('SELECT * FROM paths WHERE id=? AND profile_id=?').get(pathId, id) as PathRow | undefined; if (!row)
    throw new AppError('路线不存在或不属于当前资料。', 404); return row; }
export function state(db: Database.Database, id: string) {
    const p = profile(db, id);
    const rows = db.prepare("SELECT * FROM records WHERE profile_id=? AND kind NOT IN ('agentRun','idempotency') ORDER BY rowid").all(id) as Row[];
    const paths = (db.prepare('SELECT * FROM paths WHERE profile_id=? ORDER BY created_at DESC').all(id) as PathRow[]).map(path => ({ ...path, versions: (db.prepare('SELECT version,body,created_at FROM path_versions WHERE profile_id=? AND path_id=? ORDER BY version').all(id, path.id) as {
            version: number;
            body: string;
            created_at: string;
        }[]).map(v => ({ version: v.version, plan: JSON.parse(v.body) as Planned, createdAt: v.created_at })) }));
    const services = { preferences: preferences(db, id), catalog: serviceCatalog(), usage: usageSummary(db, id, new Date().toISOString()), instanceBudget: instanceBudgetStatus(db, new Date().toISOString()) };
    return { version: p.version, assessment: (p.assessment ? JSON.parse(p.assessment) : null) as Assessment | null, knowledge: knowledge(db, id), paths, records: rows.map(row => ({ id: row.id, kind: row.kind, parentId: row.parent_id, body: JSON.parse(row.body) as Record<string, unknown>, createdAt: row.created_at })), services, mode: services.preferences.aiEnabled && !services.catalog.mock && services.catalog.providers.some(p => p.id === services.preferences.provider && p.configured) && services.preferences.model ? 'external_enabled' : 'local', release: release.id };
}
export type AppState = ReturnType<typeof state>;
export function saveAssessment(db: Database.Database, id: string, a: Assessment, now: string) {
    db.prepare('UPDATE profiles SET assessment=?,version=version+1,updated_at=? WHERE id=?').run(JSON.stringify(a), now, id);
    const assessmentId = addRecord(db, id, 'assessment', { assessment: a, knowledge: knowledge(db, id), results: recommend(release, a, knowledge(db, id)), versions: { schema: 1, questionnaire: 1, engine: '1.0.0', planner: PLANNER_VERSION, rubric: '1.0.0', graph: release.id, profile: profile(db, id).version }, mode: 'local' }, now);
    snapshot(db, id, now);
    return assessmentId;
}
export function confirmKnowledge(db: Database.Database, id: string, nodeId: string, next: KnowledgeState, baseVersion: number, now: string) {
    if (profile(db, id).version !== baseVersion)
        throw new AppError('画像已变化，请刷新后重新核对。', 409);
    if (!release.nodes.some(n => n.id === nodeId && ['knowledge', 'skill'].includes(n.type)))
        throw new AppError('只能确认知识或技能节点。');
    const previous = knowledge(db, id)[nodeId] ?? null;
    db.prepare('INSERT INTO knowledge_states VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(profile_id,node_id) DO UPDATE SET level=excluded.level,evidence_type=excluded.evidence_type,evidence=excluded.evidence,learning_status=excluded.learning_status,conflict=excluded.conflict,updated_at=excluded.updated_at').run(id, nodeId, next.level, next.evidenceType, next.evidence, next.learningStatus, Number(next.conflict), now, now);
    addRecord(db, id, 'event', { nodeId, previous, next, confirmedAt: now, kind: 'confirmed-self-assessment' }, now);
    db.prepare('UPDATE profiles SET version=version+1,updated_at=? WHERE id=?').run(now, id);
    snapshot(db, id, now);
}
export function makePlan(db: Database.Database, id: string, input: Omit<PlanInput, 'knowledge' | 'profileVersion'>) { return plan(release, { ...input, knowledge: knowledge(db, id), profileVersion: profile(db, id).version }); }
export function savePath(db: Database.Database, id: string, input: Omit<PlanInput, 'knowledge' | 'profileVersion'>, baseVersion: number, now: string) {
    if (profile(db, id).version !== baseVersion)
        throw new AppError('画像已变化，请重新生成路线。', 409);
    const result = makePlan(db, id, input), pathId = randomUUID();
    if (result.status === 'blocked') throw new AppError('当前路线无法执行，请处理所选支路或资料问题后重新分析。');
    db.prepare('INSERT INTO paths VALUES (?,?,?,0,1,?,?)').run(pathId, id, input.topicId, now, now);
    db.prepare('INSERT INTO path_versions VALUES (?,?,?,?,?,?,?)').run(randomUUID(), id, pathId, 1, JSON.stringify(result), now, now);
    return { pathId, plan: result };
}
export function activatePath(db: Database.Database, id: string, pathId: string, baseVersion: number, now: string) { const p = pathById(db, id, pathId); if (p.version !== baseVersion)
    throw new AppError('路线版本已变化，请重新核对。', 409); db.prepare('UPDATE paths SET active=0,updated_at=? WHERE profile_id=?').run(now, id); db.prepare('UPDATE paths SET active=1,updated_at=? WHERE profile_id=? AND id=?').run(now, id, pathId); }
export function propose(db: Database.Database, id: string, pathId: string, now: string) {
    const p = pathById(db, id, pathId);
    const old = db.prepare('SELECT body FROM path_versions WHERE path_id=? AND profile_id=? AND version=?').get(pathId, id, p.version) as {
        body: string;
    };
    const before = JSON.parse(old.body) as Planned;
    const next = makePlan(db, id, { topicId: p.topic_id, mode: before.mode as 'explore' | 'deep', hours: before.hours, startDate: before.startDate, resources: before.resources ?? [], choices: before.selectedOptions });
    const changes: { nodeId: string; name: string; before: string | null; after: string | null; reason: string }[] = next.gaps.flatMap(g => { const prev = before.gaps.find(x => x.nodeId === g.nodeId); return prev?.category === g.category ? [] : [{ nodeId: g.nodeId, name: g.name, before: prev?.category ?? null, after: g.category, reason: g.reason }]; });
    changes.push(...before.gaps.filter(g => !next.gaps.some(n => n.nodeId === g.nodeId)).map(g => ({ nodeId: g.nodeId, name: g.name, before: g.category, after: null, reason: '当前路线不再采用此项；原路线和知识记录保留。' })));
    const body = { basePathVersion: p.version, baseProfileVersion: profile(db, id).version, pathId, before, next, changes, status: 'pending', expiresAt: new Date(Date.parse(now) + 86400000).toISOString() };
    const proposalId = addRecord(db, id, 'proposal', body, now, pathId);
    return { proposalId, ...body };
}
export function applyProposal(db: Database.Database, id: string, proposalId: string, accept: boolean, now: string) {
    const row = db.prepare("SELECT * FROM records WHERE id=? AND profile_id=? AND kind='proposal'").get(proposalId, id) as Row | undefined;
    if (!row)
        throw new AppError('提案不存在。', 404);
    const body = JSON.parse(row.body) as {
        pathId: string;
        basePathVersion: number;
        baseProfileVersion: number;
        status: string;
        expiresAt: string;
        next: Planned;
    };
    if (body.status !== 'pending')
        throw new AppError('提案已处理，请查看路线历史。', 409);
    const path = pathById(db, id, body.pathId);
    if (accept && (path.version !== body.basePathVersion || profile(db, id).version !== body.baseProfileVersion || now > body.expiresAt))
        throw new AppError('提案已过期或基础版本变化，请重新生成差异。', 409);
    if (accept) {
        db.prepare('INSERT INTO path_versions VALUES (?,?,?,?,?,?,?)').run(randomUUID(), id, path.id, path.version + 1, JSON.stringify(body.next), now, now);
        db.prepare('UPDATE paths SET version=version+1,updated_at=? WHERE id=? AND profile_id=?').run(now, path.id, id);
    }
    db.prepare('UPDATE records SET body=?,updated_at=? WHERE id=? AND profile_id=?').run(JSON.stringify({ ...body, status: accept ? 'accepted' : 'rejected' }), now, proposalId, id);
}
export function deletePath(db: Database.Database, id: string, pathId: string) { pathById(db, id, pathId); db.prepare('DELETE FROM records WHERE profile_id=? AND parent_id=?').run(id, pathId); db.prepare('DELETE FROM paths WHERE profile_id=? AND id=?').run(id, pathId); }
export function idempotent<T>(db: Database.Database, id: string, key: string, request: unknown, now: string, fn: () => T): T {
    const hash = createHash('sha256').update(JSON.stringify(request)).digest('hex');
    return db.transaction(() => {
        const old = db.prepare('SELECT body,request_hash FROM idempotency WHERE profile_id=? AND key=?').get(id, key) as {
            body: string;
            request_hash: string;
        } | undefined;
        if (old) {
            if (old.request_hash !== hash)
                throw new AppError('重复请求标识与内容不一致。', 409);
            return JSON.parse(old.body) as T;
        }
        const result = fn();
        db.prepare('INSERT INTO idempotency VALUES (?,?,?,?,?,?)').run(id, key, hash, JSON.stringify(result), now, now);
        return result;
    })();
}
export function exportData(db: Database.Database, id: string, now: string) { const s = state(db, id); const citedIds = new Set(release.nodes.filter(n => s.knowledge[n.id] || s.paths.some(p => p.topic_id === n.id)).flatMap(n => n.sourceClaimIds)); return { exportSchemaVersion: 1, exportedAt: now, timezone: 'Asia/Shanghai', profile: { createdAt: profile(db, id).created_at, version: s.version }, knowledge: s.knowledge, assessment: s.assessment, paths: s.paths, records: s.records, sources: release.sources.filter(source => release.claims.some(c => citedIds.has(c.id) && c.sourceIds.includes(source.id))), versions: { knowledgeRelease: release.id, planner: PLANNER_VERSION }, servicePreferences: s.services.preferences, browserDraft: null }; }
