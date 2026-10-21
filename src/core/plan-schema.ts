import { z } from 'zod';
const text = z.string().max(4000), id = z.string().min(1).max(600);
export const gapCategorySchema = z.enum(['reused', 'verify', 'requiredGap', 'recommendedGap', 'optional', 'unresolved']);
export const gapSchema = z.object({ nodeId: id, name: text, category: gapCategorySchema, requiredLevel: z.number().int().min(0).max(4), level: z.number().int().min(0).max(4).nullable(), importance: z.enum(['entry_required', 'stage_required', 'recommended', 'optional']), reason: text, sourceClaimIds: z.array(id).max(100) });
const status = z.enum(['ready', 'partial', 'blocked']), feasibility = z.enum(['feasible', 'limited', 'unscheduled']);
const choices = z.record(id, id).refine(v => Object.keys(v).length <= 32);
export const plannedSchema = z.object({
  schemaVersion: z.literal(1), plannerVersion: id, rubricVersion: id, knowledgeRelease: id, profileVersion: z.number().int().nonnegative(), topicId: id, mode: z.enum(['explore', 'deep']), objectiveKey: id,
  status, feasibility, hours: z.number().min(0).max(80), resources: z.array(text).max(20), startDate: z.string().max(40),
  gaps: z.array(gapSchema).max(1000), steps: z.array(z.object({ nodeId: id, action: text, condition: text, minutes: z.number().nonnegative().nullable() })).max(1000),
  projectId: id.nullable(), issues: z.array(text).max(100), searchLimited: z.boolean(), alternatives: z.array(text).max(1000),
  selectedOptions: choices.optional(), missingResources: z.array(text).max(20).optional(),
  branchGroups: z.array(z.object({ id, targetName: text, selectedEdgeId: id, options: z.array(z.object({ edgeId: id, nodeId: id, name: text, category: gapCategorySchema })).max(100) })).max(32).optional(),
  candidates: z.array(z.object({ id: z.string().max(20000), label: text, choices, reused: z.number().int().nonnegative(), requiredGaps: z.number().int().nonnegative(), diagnostics: z.number().int().nonnegative(), missingResources: z.array(text).max(20), status, feasibility, reason: text })).max(3).optional(),
  checkpoints: z.array(z.object({ day: z.number().int().nonnegative(), date: z.string().max(40), purpose: text })).max(100),
});
