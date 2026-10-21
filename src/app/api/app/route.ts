import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { database } from '@/db/client';
import * as store from '@/db/store';
import { assessmentSchema, stateSchema } from '@/core/schema';
import { providerSchema, servicePreferencesSchema, searchModeSchema } from '@/core/services';
import { savePreferences } from '@/server/preferences';
import { accountModels } from '@/server/llm';
import { chat } from '@/server/advisor';
import { accountInfo } from '@/server/account';
import { backupPreview, restoreBackup } from '@/server/backup';
import { revertKnowledge } from '@/db/knowledge-history';
import { taskEvidenceSchema } from '@/core/task-evidence';
import { saveAttempt } from '@/db/task-attempt';
import { containsCredential } from '@/server/credential-guard';
import { boundedBody } from '@/server/body-limit';
export const runtime = 'nodejs';
const cookie = 'direction_profile';
const planFields = { topicId: z.string().max(100), mode: z.enum(['explore', 'deep']), hours: z.number().min(0).max(80), resources: z.array(z.enum(['电脑', '开发板'])).max(2), startDate: z.iso.date(), branch: z.string().min(1).max(600).optional(), choices: z.record(z.string().min(1).max(600), z.string().min(1).max(600)).refine(value => Object.keys(value).length <= 32).optional() };
const actionSchema = z.discriminatedUnion('action', [
    z.object({ action: z.literal('assessment'), assessment: assessmentSchema }),
    z.object({ action: z.literal('knowledge'), nodeId: z.string(), state: stateSchema, baseVersion: z.number().int() }),
    z.object({ action: z.literal('revertKnowledge'), eventId: z.uuid(), baseVersion: z.number().int().nonnegative() }),
    z.object({ action: z.literal('preview'), ...planFields }), z.object({ action: z.literal('savePath'), ...planFields, baseVersion: z.number().int() }),
    z.object({ action: z.literal('activate'), pathId: z.uuid(), baseVersion: z.number().int() }),
    z.object({ action: z.literal('propose'), pathId: z.uuid() }), z.object({ action: z.literal('proposal'), proposalId: z.uuid(), accept: z.boolean() }),
    z.object({ action: z.literal('attempt'), pathId: z.uuid(), content: z.string().trim().min(1).max(2000), evidence: taskEvidenceSchema.optional() }),
    z.object({ action: z.literal('checkin'), pathId: z.uuid(), content: z.string().max(500), hours: z.number().min(0).max(168), completion: z.number().int().min(1).max(5), difficulty: z.number().int().min(1).max(5), interest: z.enum(['up', 'same', 'down']), obstacle: z.string().max(100) }),
    z.object({ action: z.literal('deletePath'), pathId: z.uuid() }), z.object({ action: z.literal('deleteAll'), confirmation: z.literal('删除全部个人资料') }),
    z.object({ action: z.literal('services'), preferences: servicePreferencesSchema, baseRevision: z.number().int().min(0), acknowledged: z.boolean() }),
    z.object({ action: z.literal('models'), provider: providerSchema }),
    z.object({ action: z.literal('account'), provider: z.enum(['deepseek', 'openai', 'tavily']) }),
    z.object({ action: z.literal('restorePreview'), backup: z.unknown() }),
    z.object({ action: z.literal('restore'), backup: z.unknown(), hash: z.string().regex(/^[a-f0-9]{64}$/), baseVersion: z.number().int().nonnegative(), confirmation: z.literal('恢复到空白身份') }),
    z.object({ action: z.literal('chat'), message: z.string().trim().min(1).max(2000), topicId: z.string().max(100).optional(), search: z.boolean().optional(), searchMode: searchModeSchema.optional() })
]);
function identity(request: NextRequest, create: boolean) {
    const db = database(), value = request.cookies.get(cookie)?.value;
    if (value && /^[a-f0-9]{64}$/.test(value)) {
        const exists = db.prepare('SELECT id FROM profiles WHERE id=?').get(value);
        if (exists)
            return { db, id: value, fresh: false };
    }
    if (!create)
        throw new store.AppError('当前身份失效，请刷新页面后重试。', 401);
    const id = randomBytes(32).toString('hex');
    store.createProfile(db, id, new Date().toISOString());
    return { db, id, fresh: true };
}
function response(data: unknown, id?: string) { const result = NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } }); if (id)
    result.cookies.set(cookie, id, { httpOnly: true, sameSite: 'lax', path: '/', secure: process.env.APP_BASE_URL?.startsWith('https://') ?? false, maxAge: 365 * 86400 }); return result; }
function errorResponse(error: unknown) { if (error instanceof z.ZodError)
    return responseError('输入格式不正确，请核对长度、等级和日期。', 400); if (error instanceof store.AppError)
    return responseError(error.message, error.status); return responseError('操作未完成。请确认数据库已迁移，并重试；资料不会自动重建。', 503); }
function responseError(error: string, status: number) { return NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } }); }
export async function GET(request: NextRequest) { try {
    const { db, id, fresh } = identity(request, true);
    if (request.nextUrl.searchParams.get('export') === '1')
        return response(store.exportData(db, id, new Date().toISOString()), fresh ? id : undefined);
    return response(store.state(db, id), fresh ? id : undefined);
}
catch (e) {
    return errorResponse(e);
} }
export async function POST(request: NextRequest) {
    try {
        if (request.headers.get('x-app-request') !== '1')
            return responseError('请求来源不正确。', 403);
        const origin = request.headers.get('origin');
        if (origin && origin !== request.nextUrl.origin && origin !== process.env.APP_BASE_URL)
            return responseError('不接受跨站写入。', 403);
        const raw = await boundedBody(request, 5 * 1024 * 1024);
        if (Buffer.byteLength(raw) > 5 * 1024 * 1024)
            return responseError('输入内容过长。', 413);
        let json: unknown;
        try {
            json = JSON.parse(raw);
        }
        catch {
            return responseError('请求不是有效 JSON。', 400);
        }
        if (containsCredential(JSON.stringify(json), process.env)) return responseError('输入疑似包含 API Key 或认证凭据，未保存或发送。请移除后重试。', 400);
        const action = actionSchema.parse(json), { db, id } = identity(request, false), now = new Date().toISOString();
        if (!['restore', 'restorePreview'].includes(action.action) && Buffer.byteLength(raw) > 16000) return responseError('输入内容过长。', 413);
        if (action.action === 'deleteAll') {
            db.transaction(() => db.prepare('DELETE FROM profiles WHERE id=?').run(id))();
            const result = response({ deleted: true });
            result.cookies.set(cookie, '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 });
            return result;
        }
        const key = z.uuid().parse(request.headers.get('idempotency-key'));
        if (action.action === 'restorePreview') return response(backupPreview(action.backup));
        if (action.action === 'restore') return response(store.idempotent(db, id, key, action, now, () => restoreBackup(db, id, action.backup, action.hash, action.baseVersion, now)));
        if (action.action === 'account') return response(await accountInfo(action.provider));
        if (action.action === 'chat') return response(await chat(db, id, key, action));
        if (action.action === 'models') {
            try { return response({ provider: action.provider, models: await accountModels(action.provider) }); }
            catch (error) { throw new store.AppError(error instanceof Error ? error.message : '无法读取账户模型。'); }
        }
        const result = store.idempotent(db, id, key, action, now, () => {
            switch (action.action) {
                case 'revertKnowledge': return revertKnowledge(db, id, action.eventId, action.baseVersion, now);
                case 'services': return savePreferences(db, id, action.preferences, action.baseRevision, action.acknowledged, now);
                case 'assessment': return { assessmentId: store.saveAssessment(db, id, action.assessment, now) };
                case 'knowledge':
                    store.confirmKnowledge(db, id, action.nodeId, action.state, action.baseVersion, now);
                    return { confirmed: true };
                case 'preview': return store.makePlan(db, id, action);
                case 'savePath': return store.savePath(db, id, action, action.baseVersion, now);
                case 'activate':
                    store.activatePath(db, id, action.pathId, action.baseVersion, now);
                    return { active: true };
                case 'propose': return store.propose(db, id, action.pathId, now);
                case 'proposal':
                    store.applyProposal(db, id, action.proposalId, action.accept, now);
                    return { applied: action.accept };
                case 'attempt':
                    return { attemptId: saveAttempt(db, id, action.pathId, action.content, now, action.evidence) };
                case 'checkin':
                    store.pathById(db, id, action.pathId);
                    return { checkinId: store.addRecord(db, id, 'checkin', { ...action, at: now }, now, action.pathId) };
                case 'deletePath':
                    store.deletePath(db, id, action.pathId);
                    return { deleted: true };
            }
        });
        return response(result);
    }
    catch (e) {
        return errorResponse(e);
    }
}
