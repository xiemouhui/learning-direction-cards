import { z } from 'zod';
import type { Node } from './schema';
export const actionGuideSchema = z.object({
  start: z.string().min(1).max(500),
  prerequisites: z.array(z.string().min(1).max(500)).min(1).max(10),
  deliverables: z.array(z.string().min(1).max(500)).min(1).max(10),
  acceptance: z.array(z.string().min(1).max(500)).min(1).max(10),
  recovery: z.array(z.string().min(1).max(500)).min(1).max(10),
  evidenceNodes: z.array(z.string().min(1)).min(1).max(10),
});
export function actionGuide(project?: Node) {
  const parsed = actionGuideSchema.safeParse(project?.content.actionGuide);
  return parsed.success ? parsed.data : null;
}
