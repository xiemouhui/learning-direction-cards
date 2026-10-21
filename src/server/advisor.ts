import type Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import * as store from '../db/store';
import { AppError } from '../core/errors';
import type { ChatResult, SearchResult, Usage, SearchMode } from '../core/services';
import { preferences } from './preferences';
import { providerConfig, type Environment } from './config';
import { advisorContext } from './advisor-context';
import { generateExplanation } from './llm';
import { searchWeb } from './search';
import { dailyUsage } from './usage-limits';
import { searchComparison } from './search-comparison';
import { reserveInstanceBudget, completeInstanceBudget } from './instance-budget';
import { containsCredential } from './credential-guard';

export type ChatInput = { action: 'chat'; message: string; topicId?: string; search?: boolean; searchMode?: SearchMode };
type Dependencies = { env?: Environment; generate?: typeof generateExplanation; search?: typeof searchWeb; compareSearch?: typeof searchComparison; now?: () => string };
function localReply(hasTopic: boolean, outside: boolean) {
  if (outside) return '顾问负责方向、知识关系和行动优先级。可以先选定专题，再核对已有知识与验证任务。';
  return hasTopic ? '先核对当前专题的可复用、待验证和必要缺口。未知知识先做诊断；任务回报不会自动提高等级。知识自评确认后，再单独比较新旧路线并选择是否采用。' : '先选择一个具体专题，再比较当前画像与任务要求。专业名称不代表已掌握知识；可以用低成本验证任务澄清起点。';
}
export async function chat(db: Database.Database, id: string, key: string, input: ChatInput, deps: Dependencies = {}): Promise<ChatResult> {
  const env = deps.env ?? process.env, now = deps.now ?? (() => new Date().toISOString()), startedAt = now();
  if (containsCredential(input.message, env)) throw new AppError('输入疑似包含 API Key 或认证凭据，未保存或发送。请移除凭据后重试。');
  const deadline = Date.now() + 45000;
  const settings = preferences(db, id, env);
  if (settings.migrationRequired) throw new AppError('顾问需要数据库更新，请先运行 pnpm db:migrate，再重启服务。', 503);
  const state = store.state(db, id), prepared = advisorContext(state, input.message, input.topicId, startedAt);
  const outside = /(?:解题|代写|写代码|调试代码|心理诊断|薪资保证|刷题)/.test(input.message);
  const configuration = providerConfig(settings.provider, env);
  const wantsModel = !outside && settings.aiEnabled && configuration.configured && !configuration.mock && !!settings.model;
  const wantsSearch = !outside && input.search && settings.searchEnabled && !!prepared.topic;
  const comparison = input.search === true && input.searchMode === 'compare';
  const requiredSearchCalls = comparison ? 4 : 1;
  let allowedModelCalls = 2;
  const requestHash = createHash('sha256').update(JSON.stringify(input)).digest('hex');
  const reservation = db.transaction(() => {
    const previous = db.prepare('SELECT request_hash,status,body,created_at FROM external_requests WHERE profile_id=? AND key=?').get(id, key) as { request_hash: string; status: string; body: string | null; created_at: string } | undefined;
    if (previous) {
      if (previous.request_hash !== requestHash) throw new AppError('重复请求标识与内容不一致。', 409);
      if (previous.status === 'complete' && previous.body) return { cached: JSON.parse(previous.body) as ChatResult, runId: null, budgetId: null };
      throw new AppError(Date.parse(startedAt) - Date.parse(previous.created_at) > 90000 ? '上次请求已中断，请用新的请求重试。' : '该顾问请求仍在处理中，请稍后查看对话。', 409);
    }
    const count = db.prepare("SELECT count(*) AS count FROM records WHERE profile_id=? AND kind='agentRun' AND created_at>=?").get(id, new Date(Date.parse(startedAt) - 3600000).toISOString()) as { count: number };
    if (count.count >= 20) throw new AppError('每小时最多 20 次顾问请求；浏览、保存、导出和删除仍可使用。', 429);
    const pending = db.prepare("SELECT count(*) AS count FROM external_requests WHERE profile_id=? AND status='pending' AND created_at>?").get(id, new Date(Date.parse(startedAt) - 90000).toISOString()) as { count: number };
    if (pending.count) throw new AppError('上一条顾问请求仍在处理中，请稍后再试。', 409);
    const daily = dailyUsage(db, id, startedAt);
    const modelRemaining = (settings.dailyModelLimit ?? 40) - daily.modelCalls - daily.modelReserved;
    const searchRemaining = (settings.dailySearchLimit ?? 20) - daily.searchCalls - daily.searchReserved;
    if (wantsModel && modelRemaining <= 0) throw new AppError('已达到本身份今日模型调用上限；可关闭 AI 使用本地建议，或在设置中调整上限。', 429);
    if (wantsSearch && searchRemaining < requiredSearchCalls) throw new AppError(comparison ? '四平台对照需要预留 4 次检索额度，今日剩余额度不足；可改用快速检索或调整上限。' : '已达到本身份今日检索调用上限；可取消本次联网检索。', 429);
    allowedModelCalls = wantsModel ? Math.min(comparison ? 1 : 2, modelRemaining) : 0;
    const budgetId = reserveInstanceBudget(db, allowedModelCalls, wantsSearch ? requiredSearchCalls : 0, startedAt, env);
    db.prepare("INSERT INTO external_requests VALUES (?,?,?,'pending',NULL,?,?)").run(id, key, requestHash, startedAt, startedAt);
    store.addRecord(db, id, 'message', { role: 'user', content: input.message, topicId: prepared.topic?.id ?? null }, startedAt);
    const runId = store.addRecord(db, id, 'agentRun', { status: 'pending', provider: settings.provider, model: settings.model, calls: 0, usage: null, modelReserved: allowedModelCalls, searchReserved: wantsSearch ? requiredSearchCalls : 0, searchMode: comparison ? 'compare' : 'quick' }, startedAt);
    return { cached: null, runId, budgetId };
  })();
  if (reservation.cached) return reservation.cached;
  let result: ChatResult = { reply: localReply(!!prepared.topic, outside), mode: 'local', provider: null, model: null, questions: [], citations: prepared.sources, notice: null, search: { status: 'not_requested', cached: false, retrievedAt: null } };
  let results: SearchResult[] = [], searchCalls = 0, calls = 0, usage: Usage = { inputTokens: null, outputTokens: null, totalTokens: null };
  if (!outside && input.search) {
    if (!settings.searchEnabled) { result.search.status = 'disabled'; result.notice = '检索尚未启用，本次继续使用本地依据。'; }
    else if (!prepared.topic) result.notice = '联网检索前请选择具体专题；查询只使用公开专题名称，不发送你的提问原文。';
    else {
      const shouldContinue = () => !!db.prepare('SELECT 1 FROM profiles WHERE id=?').get(id) && preferences(db, id, env).revision === settings.revision && store.profile(db, id).version === state.version;
      const searched = comparison ? await (deps.compareSearch ?? searchComparison)(db, prepared.topic.id, settings, startedAt, { env, shouldContinue }) : await (deps.search ?? searchWeb)(db, prepared.topic.id, settings, startedAt, { env });
      results = searched.results; result.search = { ...searched.status, mode: comparison ? 'compare' : 'quick', calls: searched.calls }; searchCalls = searched.calls;
      result.citations.push(...results.map(r => ({ id: r.id, title: r.title, url: r.url, retrievedAt: r.retrievedAt, cached: r.cached, kind: r.kind, sourceType: r.sourceType, platform: r.platform })));
      if (['failed', 'timeout', 'cancelled', 'not_configured', 'disabled'].includes(searched.status.status)) result.notice = '本次未获得可用实时资料，请核对各平台状态；本地规划仍可使用。';
      else if (searched.status.status === 'partial') result.notice = '本次只有部分平台取得匹配资料；总结仅依据这些资料，不代表四个平台共识。';
      else if (searched.status.status === 'no_relevant_results') result.notice = '返回内容未通过来源和相关性筛选，未作为网页依据；继续使用本地知识库。';
      else if (searched.status.status === 'unsupported') result.notice = '当前专题缺少有效的检索配置或来源；本次未发送检索请求。';
      else if (searched.status.status === 'empty') result.notice = '本次检索没有返回结果；继续使用本地知识库，不补造网页资料。';
    }
  }
  const stillAuthorized = !!db.prepare('SELECT 1 FROM profiles WHERE id=?').get(id) && preferences(db, id, env).revision === settings.revision && store.profile(db, id).version === state.version;
  if (comparison && results.length > 0) result.reply = `本轮取得 ${results.length} 条匹配资料，来源为${[...new Set(results.map(r => r.platform))].join('、')}。尚未生成通过校验的模型总结，请按平台查看资料与状态；学习路线保持原规则。`;
  if (comparison && results.length === 0) result.reply = '四平台对照未取得可用于总结的网页资料，本次不调用模型总结。请查看各平台状态；可继续使用本地路线，或自行打开平台搜索入口核对。';
  if (!outside && stillAuthorized && (!comparison || results.length > 0) && settings.aiEnabled && configuration.configured && !configuration.mock && settings.model) {
    const explanation = await (deps.generate ?? generateExplanation)({ provider: settings.provider, model: settings.model, context: { ...prepared.context, searchOutcome: result.search, webResults: results.map(r => ({ id: r.id, title: r.title, summary: r.summary, retrievedAt: r.retrievedAt, cached: r.cached, sourceType: r.sourceType, platform: r.platform })) }, sourceIds: result.citations.map(s => s.id), evidenceIds: prepared.evidenceIds }, { env, deadline, maxCalls: allowedModelCalls });
    calls = explanation.calls; usage = explanation.usage;
    if (explanation.draft && (!comparison || results.some(s => explanation.draft!.sourceIds.includes(s.id)))) result = { ...result, reply: explanation.draft.explanation, questions: explanation.draft.questions, citations: result.citations.filter(s => explanation.draft!.sourceIds.includes(s.id) || s.sourceType === 'community').map(s => ({ ...s, usedInAnswer: explanation.draft!.sourceIds.includes(s.id) })), mode: 'ai', provider: settings.provider, model: settings.model };
    else if (explanation.draft && comparison) result.notice = [result.notice, '总结没有引用本次网页资料，已保留检索结果并使用本地提示。'].filter(Boolean).join(' ');
    else result.notice = [result.notice, explanation.reason].filter(Boolean).join(' ');
  } else if (!outside && !(comparison && results.length === 0)) result.notice = [result.notice, settings.aiEnabled ? '外部模型尚未就绪或处于演示模式，当前使用本地提示。' : '尚未启用外部模型，当前使用本地提示。'].filter(Boolean).join(' ');

  return db.transaction(() => {
    completeInstanceBudget(db, reservation.budgetId, calls, searchCalls, now());
    // Deletion, provider changes, revocation, or a new profile version during I/O invalidates output.
    if (!db.prepare('SELECT 1 FROM profiles WHERE id=?').get(id)) throw new AppError('资料已删除，本次结果已丢弃。', 409);
    const current = preferences(db, id, env), finishedAt = now();
    if (current.revision !== settings.revision || store.profile(db, id).version !== state.version) result = { ...result, reply: '资料或服务设置在请求期间发生变化，请核对当前状态后重新提问。', mode: 'local', provider: null, model: null, citations: [], questions: [], notice: '旧上下文的外部回答已丢弃；已发出的请求无法撤回。' };
    const assistantTime = new Date(Math.max(Date.parse(finishedAt), Date.parse(startedAt) + 1)).toISOString();
    store.addRecord(db, id, 'message', { role: 'assistant', content: result.reply, mode: result.mode, provider: result.provider, model: result.model, citations: result.citations, questions: result.questions, notice: result.notice, search: result.search }, assistantTime);
    db.prepare('UPDATE records SET body=?,updated_at=? WHERE id=? AND profile_id=?').run(JSON.stringify({ status: result.mode === 'ai' ? 'success' : 'local_or_fallback', provider: settings.provider, model: settings.model, calls, usage, searchCalls }), finishedAt, reservation.runId, id);
    db.prepare("UPDATE external_requests SET status='complete',body=?,updated_at=? WHERE profile_id=? AND key=?").run(JSON.stringify(result), finishedAt, id, key);
    db.prepare("DELETE FROM records WHERE kind='agentRun' AND created_at<?").run(new Date(Date.parse(finishedAt) - 30 * 86400000).toISOString());
    return result;
  })();
}
