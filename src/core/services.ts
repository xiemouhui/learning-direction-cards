import { z } from 'zod';

export const providerSchema = z.enum(['deepseek', 'openai']);
export type Provider = z.infer<typeof providerSchema>;
export type AccountProvider = Provider | 'tavily';
export type AccountInfo = { status: 'success'; checkedAt: string; available?: boolean; balances?: { currency: string; total: string; granted: string; toppedUp: string }[]; quota?: { keyUsed: number; keyLimit: number | null; planUsed: number; planLimit: number; paygoUsed: number; paygoLimit: number | null } } | { status: 'unsupported' | 'not_configured' | 'disabled' | 'failed'; message: string };
export const providerLabels = { deepseek: 'DeepSeek', openai: 'ChatGPT' };
export const modelSchema = z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,99}$/, '请输入有效模型 ID。');
export const servicePreferencesSchema = z.object({
  provider: providerSchema,
  model: z.union([modelSchema, z.literal('')]),
  aiEnabled: z.boolean(),
  searchEnabled: z.boolean(),
  searchProvider: z.enum(['deepseek', 'tavily']),
  searchScope: z.enum(['community', 'reference']).optional(),
  searchPlatform: z.enum(['all', 'bilibili', 'xiaohongshu', 'tieba', 'douyin']).optional(),
  dailyModelLimit: z.number().int().min(0).max(200).optional(),
  dailySearchLimit: z.number().int().min(0).max(200).optional(),
});
export type ServicePreferences = z.infer<typeof servicePreferencesSchema>;
export const draftSchema = z.object({
  explanation: z.string().trim().min(1).max(4000),
  sourceIds: z.array(z.string().max(120)).max(8),
  evidenceIds: z.array(z.string().max(120)).max(12),
  questions: z.array(z.string().max(200)).max(3),
}).strict();
export type AdvisorDraft = z.infer<typeof draftSchema>;
export type Citation = { id: string; title: string; url: string; retrievedAt: string | null; cached: boolean; kind: 'knowledge' | 'web'; sourceType?: 'community' | 'reference'; platform?: string; usedInAnswer?: boolean };
export type SearchResult = Citation & { summary: string };
export type Usage = { inputTokens: number | null; outputTokens: number | null; totalTokens: number | null };
export const searchModeSchema = z.enum(['quick', 'compare']);
export const searchStateSchema = z.enum(['not_requested', 'disabled', 'not_configured', 'success', 'partial', 'empty', 'failed', 'timeout', 'cancelled', 'unsupported', 'no_relevant_results']);
export const platformSearchSchema = z.object({
  platform: z.enum(['bilibili', 'xiaohongshu', 'tieba', 'douyin']), label: z.string().max(30), status: searchStateSchema,
  calls: z.number().int().min(0).max(1), query: z.string().max(128).optional(), retrievedAt: z.string().nullable(),
  receivedCount: z.number().int().min(0).max(50), selectedCount: z.number().int().min(0).max(2),
});
export const searchStatusSchema = z.object({
  status: searchStateSchema, cached: z.boolean(), retrievedAt: z.string().nullable(), query: z.string().max(10000).optional(), policyVersion: z.string().max(100).optional(), scope: z.enum(['community', 'reference']).optional(), selectedPlatform: z.string().max(100).optional(),
  receivedCount: z.number().int().nonnegative().optional(), filteredCount: z.number().int().nonnegative().optional(), platformCounts: z.record(z.string().max(30), z.number().int().nonnegative()).optional(),
  mode: searchModeSchema.optional(), calls: z.number().int().min(0).max(4).optional(), platforms: z.array(platformSearchSchema).length(4).optional(),
});
export type SearchMode = z.infer<typeof searchModeSchema>;
export type SearchStatus = z.infer<typeof searchStatusSchema>;
export type ChatResult = {
  reply: string; mode: 'local' | 'ai'; provider: Provider | null; model: string | null;
  questions: string[]; citations: Citation[]; notice: string | null;
  search: SearchStatus;
};
