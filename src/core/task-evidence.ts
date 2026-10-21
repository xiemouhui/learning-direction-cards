import { z } from 'zod';
export const taskEvidenceSchema = z.object({
  pathVersion: z.number().int().positive(),
  stepIndex: z.number().int().min(0).max(1000),
  environment: z.string().trim().min(1).max(500),
  expected: z.string().trim().min(1).max(500),
  actual: z.string().trim().min(1).max(500),
  limits: z.string().trim().min(1).max(500),
  independent: z.string().trim().min(1).max(500),
  minutes: z.number().min(0).max(10080),
});
export const attemptContextSchema = z.object({
  evidence: taskEvidenceSchema,
  nodeIds: z.array(z.string().min(1).max(100)).max(50),
  knowledgeRelease: z.string().min(1).max(100),
  projectId: z.string().nullable(),
});
