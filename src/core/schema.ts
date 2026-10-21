import { z } from 'zod';
export const quality = z.enum(['verified', 'draft']);
export const kind = z.enum(['major', 'domain', 'subdomain', 'knowledge', 'skill', 'project']);
export const nodeSchema = z.object({
    id: z.string().min(1), type: kind, name: z.string(), summary: z.string(), aliases: z.array(z.string()),
    sourceClaimIds: z.array(z.string()), quality, verifiedAt: z.string().nullable(), releaseId: z.string(),
    content: z.record(z.string(), z.unknown())
});
export const edgeSchema = z.object({
    id: z.string(), from: z.string(), to: z.string(), type: z.enum(['belongs_to', 'related_to', 'prerequisite_of', 'useful_for', 'applied_in', 'validated_by']),
    explanation: z.string(), scope: z.array(z.string()), requiredLevel: z.number().int().min(0).max(4),
    sourceClaimIds: z.array(z.string()), quality, verifiedAt: z.string().nullable(), releaseId: z.string(), rubric: z.array(z.string())
});
export const requirementSchema = z.object({ id: z.string(), topicId: z.string(), mode: z.enum(['explore', 'deep']), objectiveKey: z.string(), nodeId: z.string(), requiredLevel: z.number().int().min(0).max(4),
    importance: z.enum(['entry_required', 'stage_required', 'recommended', 'optional']), minimumEvidence: z.enum(['self', 'practice']), sourceClaimIds: z.array(z.string()), quality });
export const releaseSchema = z.object({ id: z.string(), schemaVersion: z.literal(1), createdAt: z.string(), nodes: z.array(nodeSchema), edges: z.array(edgeSchema), requirements: z.array(requirementSchema),
    clauses: z.array(z.object({ id: z.string(), targetId: z.string(), scope: z.string(), options: z.array(z.string()).min(1) })),
    sources: z.array(z.object({ id: z.string(), title: z.string(), url: z.url(), publisher: z.string(), accessedAt: z.string().nullable(), tier: z.enum(['primary', 'reliable']), status: quality })),
    claims: z.array(z.object({ id: z.string(), text: z.string(), sourceIds: z.array(z.string()), quality, note: z.string() })) });
export type Release = z.infer<typeof releaseSchema>;
export type Node = z.infer<typeof nodeSchema>;
export type Requirement = z.infer<typeof requirementSchema>;
export const levelSchema = z.number().int().min(0).max(4).nullable();
export const stateSchema = z.object({ level: levelSchema, evidenceType: z.enum(['self', 'course', 'project', 'task', 'external']), evidence: z.string().max(500), learningStatus: z.enum(['not_started', 'learning', 'paused']), conflict: z.boolean().default(false) });
export type KnowledgeState = z.infer<typeof stateSchema>;
export type Knowledge = Record<string, KnowledgeState>;
export const assessmentSchema = z.object({ schemaVersion: z.literal(1), answers: z.array(z.string().max(500)).length(10), positive: z.array(z.string()).max(15), negative: z.array(z.string()).max(15), preference: z.enum(['research', 'engineering', 'unknown']), hours: z.number().min(0).max(80).nullable() });
export type Assessment = z.infer<typeof assessmentSchema>;
export const levels = ['未了解', '初步接触', '理解基础概念', '能够实际应用', '能够独立完成相关任务'];
export const categoryLabels = { reused: '可复用', verify: '待验证', requiredGap: '必要缺口', recommendedGap: '建议补充', optional: '可选拓展', unresolved: '资料不足' };
