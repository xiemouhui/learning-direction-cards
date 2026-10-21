'use client';
import { attemptContextSchema } from '@/core/task-evidence';
import { getRelease } from '@/core/catalog';
import type { AppState } from '@/db/store';
import type { KnowledgeState } from '@/core/schema';

export function AttemptEvidence({ context }: { context: unknown }) {
  const parsed = attemptContextSchema.safeParse(context);
  if (!parsed.success) return null;
  const { evidence, nodeIds, knowledgeRelease } = parsed.data;
  const archive = getRelease(knowledgeRelease);
  return <div><p>路线版本 {evidence.pathVersion} · 行动 {evidence.stepIndex + 1} · 实际投入 {evidence.minutes} 分钟</p><p>环境与输入：{evidence.environment}</p><p>预期：{evidence.expected}</p><p>实际：{evidence.actual}</p><p>独立范围：{evidence.independent}</p><p>未验证与下一步：{evidence.limits}</p><p>供本人核对的知识：{nodeIds.map(id => archive?.nodes.find(n => n.id === id)?.name ?? id).join('、') || '未关联具体知识'}</p></div>;
}

export function EvidenceAssist({ records, nodeId, draft, onUse }: { records: AppState['records']; nodeId: string; draft: KnowledgeState; onUse: (next: KnowledgeState) => void }) {
  const candidates = records.filter(r => r.kind === 'attempt' && attemptContextSchema.safeParse(r.body.context).data?.nodeIds.includes(nodeId)).slice(-5).reverse();
  if (!candidates.length) return null;
  return <details><summary>可供核对的行动证据（{candidates.length} 条）</summary><p>记录是本人回报，尚未独立核验。采用只替换证据草稿，掌握等级保持原值；仍需预览并确认。</p>{candidates.map(r => <article className="source-item" key={r.id}><AttemptEvidence context={r.body.context}/><button className="button" onClick={() => {
    const c = attemptContextSchema.parse(r.body.context), e = c.evidence;
    onUse({ ...draft, evidenceType: 'task', evidence: `任务回报 ${r.createdAt.slice(0, 10)} · 路线版本 ${e.pathVersion}\n预期：${e.expected}\n实际：${e.actual}\n独立范围：${e.independent}\n局限：${e.limits}`.slice(0, 500) });
  }}>将此回报填入证据草稿</button></article>)}</details>;
}
