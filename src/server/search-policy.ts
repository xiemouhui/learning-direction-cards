import { z } from 'zod';
import { createHash } from 'node:crypto';
import { isIP } from 'node:net';
import profiles from '../../knowledge/retrieval/2026-10-21.3.json';
import { release } from '../core/catalog';
import { supported } from '../core/graph';
import type { Release } from '../core/schema';
import type { SearchResult } from '../core/services';

const profileSchema = z.object({ topicId: z.string().min(1), queryTerms: z.array(z.string().min(1).max(60)).min(1).max(3), communityTerms: z.array(z.string().min(2).max(20)).min(1).max(2), matchTerms: z.array(z.string().min(2).max(80)).min(2).max(12) });
const documentSchema = z.object({ version: z.string().min(1), knowledgeRelease: z.string(), profiles: z.array(profileSchema) });
export const searchProfileDocument = documentSchema.parse(profiles);
export const SEARCH_POLICY_VERSION = searchProfileDocument.version;
type Anchor = { sourceId: string; host: string; pathPrefix: string; platform?: string };
export const COMMUNITY_PLATFORMS = [
  { label: 'Bilibili', host: 'bilibili.com', paths: ['/video', '/read', '/opus'] },
  { label: '小红书', host: 'xiaohongshu.com', paths: ['/explore', '/discovery/item'] },
  { label: '百度贴吧', host: 'tieba.baidu.com', paths: ['/p'] },
  { label: '抖音', host: 'douyin.com', paths: ['/video', '/note'] },
] as const;
export type SearchScope = 'community' | 'reference';
export type SearchPolicy = { version: string; knowledgeRelease: string; topicId: string; scope: SearchScope; query: string; terms: string[]; anchors: Anchor[]; fingerprint: string };
const hostName = (u: URL) => u.hostname.toLowerCase().replace(/^www\./, '');
// 多租户或共享站点限定至已核验的仓库、课程或栏目，不能信任整个站点。
const sharedHostDepth: Record<string, number> = { 'github.com': 2, 'ocw.mit.edu': 2, 'gov.uk': 1, 'w3.org': 1, 'developers.google.com': 1, 'pdos.csail.mit.edu': 1, 'cse.ust.hk': 2 };

export function publicUrl(value: string) {
  try {
    const u = new URL(value), host = hostName(u);
    if (u.protocol !== 'https:' || u.username || u.password || isIP(host.replace(/^\[|\]$/g, '')) || host === 'localhost' || /\.(?:localhost|local|internal|test)$/.test(host)) return null;
    u.hash = '';
    for (const key of [...u.searchParams.keys()]) if (/^(?:utm_|fbclid$|gclid$|spm_id_from$|spm_id$|vd_source$|share_source$|share_medium$|share_session_id$|share_tag$|from_spmid$)/i.test(key)) u.searchParams.delete(key);
    u.searchParams.sort();
    return u.href;
  } catch { return null; }
}
export function validateSearchProfiles(r: Release, value: unknown = searchProfileDocument) {
  const parsed = documentSchema.safeParse(value);
  if (!parsed.success) return ['检索配置格式不合法。'];
  const doc = parsed.data, errors: string[] = [], seen = new Set<string>();
  if (doc.knowledgeRelease !== r.id) errors.push('检索配置与知识库版本不一致。');
  for (const profile of doc.profiles) {
    if (seen.has(profile.topicId)) errors.push(`检索配置重复：${profile.topicId}`);
    seen.add(profile.topicId);
    if (!r.nodes.some(n => n.id === profile.topicId && n.type === 'subdomain')) errors.push(`检索专题不存在：${profile.topicId}`);
  }
  for (const topic of r.nodes.filter(n => n.type === 'subdomain')) if (!seen.has(topic.id)) errors.push(`专题缺检索配置：${topic.id}`);
  return errors;
}
export function searchPolicy(topicRef: string, scope: SearchScope = 'community', r: Release = release, platform: 'all' | 'bilibili' | 'xiaohongshu' | 'tieba' | 'douyin' = 'all'): SearchPolicy | null {
  if (searchProfileDocument.knowledgeRelease !== r.id) return null;
  const topic = r.nodes.find(n => n.type === 'subdomain' && (n.id === topicRef || n.name === topicRef));
  const profile = searchProfileDocument.profiles.find(p => p.topicId === topic?.id);
  if (!topic || !profile || topic.quality !== 'verified' || !supported(r, topic.sourceClaimIds)) return null;
  const claimIds = new Set([...topic.sourceClaimIds, ...r.requirements.filter(q => q.topicId === topic.id && q.quality === 'verified').flatMap(q => q.sourceClaimIds), ...r.edges.filter(e => e.type === 'prerequisite_of' && e.scope.some(s => s === `${topic.id}:explore` || s === `${topic.id}:deep`) && e.quality === 'verified').flatMap(e => e.sourceClaimIds)]);
  const sourceIds = new Set(r.claims.filter(c => claimIds.has(c.id) && c.quality === 'verified').flatMap(c => c.sourceIds));
  const referenceAnchors = r.sources.filter(s => sourceIds.has(s.id) && s.status === 'verified').flatMap(s => {
    const url = publicUrl(s.url); if (!url) return [];
    const u = new URL(url), host = hostName(u), depth = sharedHostDepth[host];
    const pathPrefix = depth ? '/' + u.pathname.split('/').filter(Boolean).slice(0, depth).join('/') : '/';
    return [{ sourceId: s.id, host, pathPrefix }];
  });
  if (!referenceAnchors.length) return null;
  const platformHosts = { bilibili: 'bilibili.com', xiaohongshu: 'xiaohongshu.com', tieba: 'tieba.baidu.com', douyin: 'douyin.com' };
  const anchors: Anchor[] = scope === 'community' ? COMMUNITY_PLATFORMS.filter(p => platform === 'all' || p.host === platformHosts[platform]).flatMap(p => p.paths.map(pathPrefix => ({ sourceId: '', host: p.host, pathPrefix, platform: p.label }))) : referenceAnchors;
  const hosts = [...new Set(anchors.map(a => a.host))].slice(0, scope === 'community' ? 4 : 2);
  const sites = hosts.map(host => `site:${host}`).join(' OR ');
  let terms = scope === 'community' ? `${profile.communityTerms.join(' ')} 学习路线` : profile.queryTerms.join(' ');
  while ([...`${terms} ${sites}`].length > 128 && terms.includes(' ')) terms = terms.slice(0, terms.lastIndexOf(' '));
  const query = `${terms} ${sites}`;
  if ([...query].length > 128 || !terms) return null;
  const body = { version: SEARCH_POLICY_VERSION, knowledgeRelease: r.id, topicId: topic.id, scope, query, terms: [...new Set([...profile.matchTerms, ...profile.communityTerms.filter(t => !['入门'].includes(t))])], anchors };
  return { ...body, fingerprint: createHash('sha256').update(JSON.stringify(body)).digest('hex') };
}
const normalized = (value: string) => value.normalize('NFKC').toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
function matchesTerm(text: string, term: string) {
  const t = normalized(term);
  if (!/[a-z0-9]/.test(t)) return text.includes(t);
  for (let at = text.indexOf(t); at >= 0; at = text.indexOf(t, at + 1)) {
    const before = text[at - 1] ?? '', after = text[at + t.length] ?? '';
    if (!/[a-z0-9]/.test(before) && !/[a-z0-9]/.test(after)) return true;
  }
  return false;
}
export function rankSearchResults(policy: SearchPolicy, input: SearchResult[]) {
  const accepted = new Map<string, { result: SearchResult; hits: number; priority: number }>();
  for (const row of input) {
    const url = publicUrl(row.url); if (!url) continue;
    const u = new URL(url), path = u.pathname;
    const priority = policy.anchors.findIndex(a => a.host === hostName(u) && (policy.scope === 'community' ? path.startsWith(a.pathPrefix + '/') && path.length > a.pathPrefix.length + 1 : a.pathPrefix === '/' || path === a.pathPrefix || path.startsWith(a.pathPrefix + '/')));
    if (priority < 0) continue;
    let decodedPath = path; try { decodedPath = decodeURIComponent(path); } catch { /* malformed escapes cannot add relevance */ }
    // 摘要不独立证明相关性：匹配信号必须出现在标题或 URL 路径。
    const text = normalized(`${row.title} ${decodedPath}`), hits = policy.terms.filter(term => matchesTerm(text, term)).length;
    if (!hits) continue;
    const result: SearchResult = { ...row, id: `web-${createHash('sha256').update(url).digest('hex').slice(0, 20)}`, url, sourceType: policy.scope, ...(policy.anchors[priority].platform ? { platform: policy.anchors[priority].platform } : {}) };
    const previous = accepted.get(url);
    if (!previous || hits > previous.hits) accepted.set(url, { result, hits, priority });
  }
  const ranked = [...accepted.values()].sort((a, b) => b.hits - a.hits || a.priority - b.priority || a.result.url.localeCompare(b.result.url)).map(x => x.result);
  if (policy.scope === 'reference') return ranked.slice(0, 5);
  // 有匹配结果的平台各保留一项，再填充剩余位置；不伪造未检索到的平台结果。
  const balanced = COMMUNITY_PLATFORMS.flatMap(p => ranked.find(r => r.platform === p.label) ?? []);
  return [...balanced, ...ranked.filter(r => !balanced.includes(r))].slice(0, 5);
}
