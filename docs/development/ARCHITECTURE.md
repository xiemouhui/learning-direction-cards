# 架构

2026-10-21：.5 三专题行动契约由 action-guide schema 校验，旧发布继续可读。CurrentAction 从保存的路线版本及归档读取步骤和资源条件，不自动推进进度；saveAttempt 在服务器验证归属/版本/行动并推导知识关联。回报 context 使用共享 task-evidence schema，旧文本记录兼容；恢复校验关联到原路线版本。EvidenceAssist 仅填入证据草稿，不触发知识写入。comparison-acceptance 有独立一次性账本与十二次上限；recovery-drill 只在忽略目录创建虚构旧库及恢复副本。

Next.js App Router、React、严格 TypeScript。首页和目录从版本化 JSON 读取；SQLite/better-sqlite3 存本地个人数据，Drizzle 定义结构，显式迁移和事务。Cookie 随机身份，所有个人请求按服务端身份限定归属。

纯函数模块负责知识图校验、缺口、规划、三维判断及反馈。UI 不决定掌握状态；结构化自评提交为确认，任务回报本身不提高等级。路线以不可变版本保存，更新预览与应用分开。模型只提供受校验的可选解释，默认本地。

知识 JSON 是维护源；来源、主张、硬边、目标要求均有质量状态。无法核验时降级，不能以实现测试替代知识真实性。发布版本不可变；快照保存可读内容和版本。

多模型：server/config 隔离 DeepSeek/ChatGPT Key；llm 分别用 Chat Completions JSON 与 Responses JSON Schema。preferences 记录明确同意与 revision，advisor-context 只选必要字段，advisor 通过异步请求预占实现幂等。网络 I/O 在 SQLite 事务之外，写回前复核身份/设置/画像版本。检索只用公开专题，独立开关，缓存与来源按日期展示。任何模型文字不具数据库写能力。

数据契约：全部现有 SQL 表由 Drizzle 定义对应列、复合外键和级联规则；迁移仍以显式 SQL 为准，未自动生成或执行破坏性表变更。个人 JSON 恢复由 server/backup 白名单验证、引用检查、事件重放一致性、文件哈希和空白身份约束保护，事务中生成新标识并重映射内部关联。备份不恢复外部启用状态。knowledge-history 通过追加事件撤销最新确认，重放验证当前投影。

费用约束：advisor 预占当前身份北京时间当天的模型/检索额度，LLM 适配器接受剩余请求上限，确保格式修正不突破次数。搜索范围可限制为单平台，缓存指纹包含实际站点。知识 .4 只扩充任务样例和阶段，旧路线按原发布读取。

双检索模式：顾问请求新增可选 searchMode（缺省 quick）；compare 通过独立调度器两路并发、四站各实时一次、不读缓存，逐平台状态和最多八条来源写入原对话结构。共享 searchStatusSchema 同时验证备份恢复，旧字段兼容。预占四次搜索与一次模型额度，部分失败可总结，无有效网页不调用模型，未引用本轮网页的总结拒绝；设置撤销、画像变化或删除时不启动下一组。具体协议、费用边界与本地验证范围见 docs/search-modes.md，本轮未追加真实 API 调用。
