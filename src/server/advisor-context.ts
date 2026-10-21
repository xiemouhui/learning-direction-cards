import { release } from '../core/catalog';
import { plan } from '../core/planner';
import { AppError } from '../core/errors';
import type { Citation } from '../core/services';
import type { AppState } from '../db/store';

export function advisorContext(state: AppState, message: string, selectedTopic: string | undefined, now: string) {
  const active = state.paths.find(p => p.active);
  const topicId = selectedTopic || active?.topic_id;
  const topic = release.nodes.find(n => n.id === topicId && n.type === 'subdomain');
  if (selectedTopic && !topic) throw new AppError('请选择已覆盖的具体专题。');
  const last = active && topic && active.topic_id === topic.id ? active.versions.find(v => v.version === active.version)?.plan : null;
  const requirements = release.requirements.filter(q => q.topicId === topic?.id);
  const baseline = topic ? plan(release, { knowledge: state.knowledge, profileVersion: state.version, topicId: topic.id, mode: last?.mode === 'deep' ? 'deep' : 'explore', resources: last?.resources ?? [], hours: last?.hours ?? state.assessment?.hours ?? 0, startDate: now.slice(0, 10), choices: last?.selectedOptions }) : null;
  const ids = new Set([...(topic?.sourceClaimIds ?? []), ...requirements.flatMap(r => r.sourceClaimIds), ...(baseline?.gaps.flatMap(g => g.sourceClaimIds) ?? [])]);
  const claims = release.claims.filter(c => ids.has(c.id));
  const sources: Citation[] = release.sources.filter(s => claims.some(c => c.sourceIds.includes(s.id))).map(s => ({ id: s.id, title: s.title, url: s.url, retrievedAt: s.accessedAt, cached: false, kind: 'knowledge' }));
  const allowedNodes = new Set(baseline?.gaps.map(g => g.nodeId) ?? requirements.map(q => q.nodeId));
  const evidence = state.records.filter(r => r.kind === 'event' && allowedNodes.has(String(r.body.nodeId))).slice(-12).map(r => ({ id: r.id, nodeId: r.body.nodeId, confirmedAt: r.createdAt }));
  return {
    topic, sources, evidenceIds: evidence.map(e => e.id), baseline,
    context: {
      question: message,
      topic: topic ? { id: topic.id, name: topic.name, summary: topic.summary } : null,
      availableTopics: topic ? [] : release.nodes.filter(n => n.type === 'subdomain').map(n => ({ id: n.id, name: n.name })),
      baseline: baseline ? { status: baseline.status, feasibility: baseline.feasibility, hours: baseline.hours, gaps: baseline.gaps, issues: baseline.issues, profileVersion: baseline.profileVersion, knowledgeRelease: baseline.knowledgeRelease } : null,
      confirmedKnowledge: Object.entries(state.knowledge).filter(([nodeId]) => allowedNodes.has(nodeId)).map(([nodeId, s]) => ({ nodeId, level: s.level, evidenceType: s.evidenceType, conflict: s.conflict, learningStatus: s.learningStatus })),
      activityPreferences: state.assessment ? { positive: state.assessment.positive, negative: state.assessment.negative, preference: state.assessment.preference } : null,
      evidence, // IDs and confirmation metadata only; course/project original descriptions are excluded.
      recentMessages: state.records.filter(r => r.kind === 'message').slice(-20).map(r => ({ role: r.body.role, content: String(r.body.content).slice(0, 4000) })),
      sources: sources.map(s => ({ id: s.id, title: s.title, claims: claims.filter(c => c.sourceIds.includes(s.id)).map(c => c.text) })),
    },
  };
}
