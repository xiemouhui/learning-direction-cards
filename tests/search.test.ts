import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import Database from 'better-sqlite3';
import { release } from '../src/core/catalog';
import { migrate } from '../src/db/migrate';
import { searchWeb, searchQuery, publicUrl } from '../src/server/search';
import { rankSearchResults, searchPolicy, searchProfileDocument, validateSearchProfiles } from '../src/server/search-policy';
import type { SearchResult, ServicePreferences } from '../src/core/services';
import offTopic from './fixtures/search-off-topic.json';
import acceptance from './fixtures/community-acceptance.json';
import { platformSearchLinks } from '../src/core/platform-links';

const now = '2026-10-20T13:00:00.000Z';
const env = { MOCK_AI: '0', DEEPSEEK_API_KEY: 'fixture-secret', TAVILY_API_KEY: 'fixture-tavily' };
const prefs: ServicePreferences = { provider: 'deepseek', model: 'fixture', aiEnabled: false, searchEnabled: true, searchProvider: 'deepseek', searchScope: 'reference' };
const url = 'https://cryptography.io/en/latest/hazmat/primitives/aead/';
const good = { title: 'Authenticated encryption — AEAD', url, summary: '<b>认证加密</b>' };
const result = (patch: Partial<SearchResult> = {}): SearchResult => ({ id: 'unused', title: good.title, url, summary: 'public fixture', retrievedAt: now, cached: false, kind: 'web', ...patch });
let db: Database.Database;
beforeEach(() => { db = new Database(':memory:'); migrate(db); });
afterEach(() => db.close());
const response = (rows: unknown[]) => new Response(JSON.stringify({ results: rows }));

describe('专题检索策略', () => {
    it('三次真实样例的离线回放不伪造其他平台覆盖，并去掉实测跟踪参数', () => {
        for (const sample of acceptance.samples) {
            const results = rankSearchResults(searchPolicy(sample.topicId)!, sample.rows.map(row => result(row)));
            expect(results).toHaveLength(sample.acceptedCount);
            expect(results.every(row => row.platform === 'Bilibili')).toBe(true);
            expect(results.every(row => !row.url.includes('spm_id_from'))).toBe(true);
        }
    });
    it('单平台查询限定来源，缓存策略与四平台不同；外部入口仅携带公开词', () => {
        const all = searchPolicy('crypto-engineering')!;
        for (const platform of ['bilibili', 'xiaohongshu', 'tieba', 'douyin'] as const) {
            const p = searchPolicy('crypto-engineering', 'community', release, platform)!;
            expect(p.query.match(/site:/g)).toHaveLength(1); expect(p.fingerprint).not.toBe(all.fingerprint);
            expect(new Set(p.anchors.map(a => a.host)).size).toBe(1);
        }
        const links = platformSearchLinks(all.query);
        expect(links).toHaveLength(4); expect(links.every(link => link.url.startsWith('https://'))).toBe(true);
        expect(decodeURIComponent(links[0].url)).toContain('AEAD 认证加密 学习路线');
        expect(links.every(link => !link.url.includes('site%3A'))).toBe(true);
    });
    it('二十六专题均有可核对来源、技术词与短查询；不硬加年份', () => {
        expect(validateSearchProfiles(release)).toEqual([]);
        expect(searchProfileDocument.profiles).toHaveLength(26);
        for (const topic of release.nodes.filter(n => n.type === 'subdomain')) {
            const p = searchPolicy(topic.id)!;
            expect(p).not.toBeNull(); expect([...p.query].length).toBeLessThanOrEqual(128);
            expect(p.anchors.length).toBeGreaterThan(0); expect(p.query).toContain('site:');
            expect(searchQuery(topic.id, 2035)).toBe(searchQuery(topic.name, 2026));
        }
        expect(searchQuery('crypto-engineering', undefined, 'reference')).toBe('AEAD authenticated encryption site:cryptography.io OR site:docs.openssl.org');
        expect(searchQuery('PRIVATE_QUESTIONNAIRE')).toBeNull();
    });
    it('拒绝缺专题、重复与跨知识发布的检索配置', () => {
        const p = structuredClone(searchProfileDocument); p.profiles.pop(); p.profiles.push(p.profiles[0]); p.knowledgeRelease = 'other';
        const errors = validateSearchProfiles(release, p).join(' ');
        expect(errors).toContain('缺检索配置'); expect(errors).toContain('重复'); expect(errors).toContain('版本不一致');
    });
    it('回放上次真实搜索的三条偏题结果，全部排除', () => {
        const rows = offTopic.results.map(row => result(row));
        expect(rankSearchResults(searchPolicy('crypto-engineering', 'reference')!, rows)).toEqual([]);
    });
    it('只接纳已核对站点与标题/路径匹配；摘要堆词、伪子域无效', () => {
        const p = searchPolicy('crypto-engineering', 'reference')!;
        const ranked = rankSearchResults(p, [result(), result({ url: 'https://cryptography.io/irrelevant/', title: 'Other page', summary: 'AEAD authenticated encryption nonce' }), result({ url: 'https://cryptography.io.evil.example/aead/' }), result({ url: 'https://evil.cryptography.io/aead/' }), result({ url: 'https://example.com/aead/' })]);
        expect(ranked).toHaveLength(1); expect(ranked[0].url).toBe(url);
    });
    it('共享站点限定仓库和课程，不能信任整个 GitHub/MIT 域名', () => {
        const image = searchPolicy('image-operations', 'reference')!;
        const rows = [result({ title: 'OpenCV basic operations', url: 'https://github.com/opencv/opencv/blob/4.x/doc/py_tutorials/py_core/py_basic_ops/py_basic_ops.markdown' }), result({ title: 'OpenCV basic operations', url: 'https://github.com/someone/opencv/blob/main/basic_ops.md' }), result({ title: 'OpenCV basic operations', url: 'https://github.com/opencv/opencv-other/basic_ops.md' })];
        expect(rankSearchResults(image, rows)).toHaveLength(1);
        const algorithm = searchPolicy('algorithm-basics', 'reference')!;
        expect(rankSearchResults(algorithm, [result({ title: 'Algorithms', url: 'https://ocw.mit.edu/courses/unrelated-course/syllabus/' })])).toHaveLength(0);
    });
    it('规范化锚点与跟踪参数去重，保留内容参数；阻止 IP 和本地 URL', () => {
        const p = searchPolicy('crypto-engineering', 'reference')!;
        const rows = [result({ url: url + '?utm_source=a#section' }), result({ url: url + '?utm_source=b#other' })];
        expect(rankSearchResults(p, rows)).toHaveLength(1);
        expect(rankSearchResults(p, rows)[0].url).toBe(url);
        expect(publicUrl(url + '?page=2&utm_source=a#section')).toBe(url + '?page=2');
        for (const value of ['https://127.0.0.1/', 'https://[::1]/', 'https://[2001:db8::1]/', 'https://localhost/', 'https://device.local/', 'https://user:pass@cryptography.io/aead/', 'javascript:alert(1)']) expect(publicUrl(value)).toBeNull();
    });
    it('英文短词使用边界匹配，不把 HTTPa 等字符串当 HTTP', () => {
        const p = searchPolicy('http-basics', 'reference')!;
        expect(rankSearchResults(p, [result({ title: 'HTTPalpha', url: 'https://developer.mozilla.org/irrelevant' })])).toEqual([]);
    });
});

describe('请求、缓存与资料不足', () => {
    const communityRows = [
        { title: 'AEAD 认证加密学习路线', url: 'https://www.bilibili.com/video/BVfixtureAead/', summary: '虚构平台经验' },
        { title: 'AEAD 自学笔记', url: 'https://www.xiaohongshu.com/explore/fixture-aead', summary: '虚构笔记' },
        { title: '认证加密怎么入门', url: 'https://tieba.baidu.com/p/123456789', summary: '虚构讨论' },
        { title: 'AEAD 入门经验', url: 'https://www.douyin.com/video/123456789', summary: '虚构视频摘要' },
    ];
    it('默认四平台查询、社区来源标签与覆盖计数，不冒充完整浏览内容', async () => {
        const transport = vi.fn<typeof fetch>(async () => response([...communityRows, good]));
        const output = await searchWeb(db, 'crypto-engineering', { ...prefs, searchScope: undefined }, now, { env, transport });
        const body = JSON.parse(String(transport.mock.calls[0][1]?.body));
        for (const host of ['bilibili.com', 'xiaohongshu.com', 'tieba.baidu.com', 'douyin.com']) expect(body.query).toContain(`site:${host}`);
        expect(body.query).toContain('AEAD 认证加密'); expect([...body.query].length).toBeLessThanOrEqual(128);
        expect(body.query).not.toContain('cryptography.io');
        expect(output.results.map(r => r.platform)).toEqual(['Bilibili', '小红书', '百度贴吧', '抖音']);
        expect(output.results.every(r => r.sourceType === 'community')).toBe(true);
        expect(output.status).toMatchObject({ scope: 'community', receivedCount: 5, filteredCount: 1, platformCounts: { Bilibili: 1, 小红书: 1, 百度贴吧: 1, 抖音: 1 } });
        const cached = await searchWeb(db, 'crypto-engineering', { ...prefs, searchScope: 'community' }, now, { env, transport });
        expect(cached.status.cached).toBe(true); expect(cached.results[0].platform).toBe('Bilibili');
        expect(transport).toHaveBeenCalledTimes(1);
    });
    it('社区范围与官方范围不共用缓存，Tavily 也限定四平台', async () => {
        const transport = vi.fn<typeof fetch>(async () => response([...communityRows, good]));
        await searchWeb(db, 'crypto-engineering', prefs, now, { env, transport });
        const output = await searchWeb(db, 'crypto-engineering', { ...prefs, searchProvider: 'tavily', searchScope: 'community' }, now, { env, transport });
        expect(output.calls).toBe(1); expect(transport).toHaveBeenCalledTimes(2);
        const body = JSON.parse(String(transport.mock.calls[1][1]?.body));
        expect(body.include_domains).toEqual(['bilibili.com', 'xiaohongshu.com', 'tieba.baidu.com', 'douyin.com']);
        expect(body.include_domains_mode).toBe('restrict'); expect(body.auto_parameters).toBe(false);
    });
    it('过滤平台搜索页、广告企业站、假后缀和只含“入门”的无关帖子', () => {
        const policy = searchPolicy('crypto-engineering')!;
        const rows = [
            result({ title: '认证加密学习', url: 'https://search.bilibili.com/all?keyword=aead' }),
            result({ title: 'AEAD', url: 'https://ir.bilibili.com/media/example.pdf' }),
            result({ title: 'AEAD', url: 'https://bilibili.com.evil.example/video/fixture' }),
            result({ title: '入门学习路线', url: 'https://www.bilibili.com/video/BVnotRelated/' }),
            result({ title: 'AEAD', url: 'https://www.bilibili.com/video' }),
        ];
        expect(rankSearchResults(policy, rows)).toEqual([]);
    });
    it('结果尽量覆盖已有匹配的平台，不凭空补齐缺少的平台', async () => {
        const transport = vi.fn<typeof fetch>(async () => response([...Array.from({ length: 4 }, (_, i) => ({ ...communityRows[0], url: `https://www.bilibili.com/video/BVfixture${i}/` })), communityRows[1], communityRows[2], communityRows[3]]));
        const output = await searchWeb(db, 'crypto-engineering', { ...prefs, searchScope: 'community' }, now, { env, transport });
        expect(output.results).toHaveLength(5); expect(new Set(output.results.map(r => r.platform)).size).toBe(4);
        const onlyOne = await searchWeb(db, 'http-basics', { ...prefs, searchScope: 'community' }, now, { env, transport: async () => response([{ ...communityRows[0], title: 'HTTP 请求响应学习' }]) });
        expect(onlyOne.status.platformCounts).toEqual({ Bilibili: 1, 小红书: 0, 百度贴吧: 0, 抖音: 0 });
    });
    it('首次请求筛选并缓存，重读继续筛选，七天后更新', async () => {
        const transport = vi.fn<typeof fetch>(async () => response([good, ...offTopic.results, { ...good, url: url + '#duplicate' }]));
        const first = await searchWeb(db, 'crypto-engineering', prefs, now, { env, transport });
        expect(first.results).toHaveLength(1); expect(first.results[0].summary).toBe('认证加密');
        expect(first.status).toMatchObject({ status: 'success', receivedCount: 5, filteredCount: 4 });
        const cached = await searchWeb(db, 'crypto-engineering', prefs, now, { env, transport });
        expect(cached.status.cached).toBe(true); expect(cached.calls).toBe(0);
        await searchWeb(db, 'crypto-engineering', prefs, '2026-10-28T13:00:00.000Z', { env, transport });
        expect(transport).toHaveBeenCalledTimes(2);
    });
    it('偏题不缓存、不自动再付费尝试；空结果与无相关结果区分', async () => {
        const transport = vi.fn<typeof fetch>(async () => response(offTopic.results));
        const output = await searchWeb(db, 'crypto-engineering', prefs, now, { env, transport });
        expect(output.status).toMatchObject({ status: 'no_relevant_results', receivedCount: 3, filteredCount: 3 });
        expect(output.results).toEqual([]); expect(transport).toHaveBeenCalledTimes(1);
        expect(db.prepare('SELECT * FROM search_cache').all()).toEqual([]);
        const empty = await searchWeb(db, 'crypto-engineering', prefs, now, { env, transport: async () => response([]) });
        expect(empty.status.status).toBe('empty');
    });
    it('旧查询缓存不能绕过新规则或污染新查询', async () => {
        const oldKey = createHash('sha256').update('deepseek:https://api.deepseek.com:密码工程应用入门 官方文档 入门 要求 2026').digest('hex');
        db.prepare('INSERT INTO search_cache VALUES (?,?,?,?,?,?,?)').run(oldKey, 'deepseek', JSON.stringify(offTopic.results), now, '2026-10-25T00:00:00.000Z', now, now);
        const transport = vi.fn<typeof fetch>(async () => response([good]));
        const output = await searchWeb(db, 'crypto-engineering', prefs, now, { env, transport });
        expect(transport).toHaveBeenCalledTimes(1); expect(output.results[0].url).toBe(url); expect(output.status.cached).toBe(false);
    });
    it('缓存损坏或被塞入不合来源内容时，拒绝当作有效缓存', async () => {
        const transport = vi.fn<typeof fetch>(async () => response([good]));
        await searchWeb(db, 'crypto-engineering', prefs, now, { env, transport });
        const row = db.prepare('SELECT key,body FROM search_cache').get() as { key: string; body: string };
        const body = JSON.parse(row.body); body.results[0].url = 'https://evil.example/aead';
        db.prepare('UPDATE search_cache SET body=? WHERE key=?').run(JSON.stringify(body), row.key);
        const output = await searchWeb(db, 'crypto-engineering', prefs, now, { env, transport });
        expect(transport).toHaveBeenCalledTimes(2); expect(output.results[0].url).toBe(url);
    });
    it('未知专题不发送任意文本；Tavily 限定来源且关闭自动参数升级', async () => {
        const transport = vi.fn<typeof fetch>(async () => response([good]));
        expect((await searchWeb(db, 'PRIVATE_QUESTION', prefs, now, { env, transport })).status.status).toBe('unsupported');
        expect(transport).not.toHaveBeenCalled();
        const output = await searchWeb(db, 'crypto-engineering', { ...prefs, searchProvider: 'tavily' }, now, { env, transport });
        const body = JSON.parse(String(transport.mock.calls[0][1]?.body));
        expect(body.include_domains).toEqual(['cryptography.io', 'docs.openssl.org']);
        expect(body).toMatchObject({ include_domains_mode: 'restrict', auto_parameters: false, search_depth: 'basic', include_answer: false });
        expect(JSON.stringify(body)).not.toContain('PRIVATE_'); expect(output.results).toHaveLength(1);
    });
});
