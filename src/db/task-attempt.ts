import type Database from 'better-sqlite3';
import { z } from 'zod';
import { taskEvidenceSchema } from '../core/task-evidence';
import { getRelease } from '../core/catalog';
import { actionGuide } from '../core/action-guide';
import * as store from './store';

export function saveAttempt(db: Database.Database, profileId: string, pathId: string, content: string, now: string, rawEvidence?: z.infer<typeof taskEvidenceSchema>) {
  const path = store.pathById(db, profileId, pathId);
  if (!rawEvidence) return store.addRecord(db, profileId, 'attempt', { content, reportedAt: now }, now, pathId);
  const evidence = taskEvidenceSchema.parse(rawEvidence);
  if (evidence.pathVersion !== path.version) throw new store.AppError('路线已变化，请刷新后核对本次行动。', 409);
  const version = store.state(db, profileId).paths.find(p => p.id === pathId)!.versions.find(v => v.version === path.version)!;
  const plan = version.plan, archive = getRelease(plan.knowledgeRelease);
  if (!archive || !plan.steps.length || plan.hours <= 0 || plan.status === 'blocked' || plan.missingResources?.length) throw new store.AppError('当前路线尚不具备行动条件；请先核对预算、资源和路线。');
  if (evidence.stepIndex >= plan.steps.length) throw new store.AppError('行动不在当前路线中。');
  const project = archive.nodes.find(n => n.id === plan.projectId);
  const step = plan.steps[evidence.stepIndex];
  const nodeIds = step.nodeId !== plan.projectId ? [step.nodeId] : actionGuide(project)?.evidenceNodes ?? archive.edges.filter(e => e.type === 'validated_by' && e.to === plan.projectId).map(e => e.from);
  return store.addRecord(db, profileId, 'attempt', { content, reportedAt: now, context: { evidence, nodeIds: [...new Set(nodeIds)].filter(id => archive.nodes.some(n => n.id === id && ['knowledge', 'skill'].includes(n.type))), knowledgeRelease: plan.knowledgeRelease, projectId: plan.projectId } }, now, pathId);
}
