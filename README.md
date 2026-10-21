# 计算机学习方向卡

本地中文学习决策 Web 应用。认识专业、领域和专题，核对已有知识，用验证任务规划与调整下一步。无需 API Key。

**源码公开，保留全部权利，不授予开源许可**，详见 [LICENSE](LICENSE)。第三方依赖保留各自许可证。

Windows x64 用户可从 [GitHub Releases](https://github.com/xiemouhui/learning-direction-cards/releases) 下载免安装测试包，解压后双击「启动.vbs」。无需安装 Node.js 或 pnpm；资料保存在本机用户目录。配置自己的 Key、停止与升级方法见 [免安装包说明](docs/portable-windows.md)。

当前能力和未通过门槛统一见 [状态清单](docs/current-state.md)。工作台新增单步行动与结构化证据，三个试点的试用材料见 [三专题评审](docs/pilot-review.md)；最新四平台真实结果见 [十二次搜索验收](docs/search-acceptance-2026-10-21.md)。

当前是可运行的阶段一 MVP，含阶段二的本地周反馈。**不是 V2 全量范围验收完成**；真实账户验收、领域进阶内容、完整阶段与资源模型及独立用户评估的差距见 [HANDOFF.md](HANDOFF.md)。

安全版本已加入本机 DPAPI 凭据存储、默认官方接口白名单、本地访问认证与实例级调用上限。配置自己的 Key 前请阅读 [安全说明](docs/security.md)。

## Windows 快速开始

已在 Windows、Node **24.19.0**、pnpm **11.25.0** 验证。依赖以 `pnpm-lock.yaml` 为准：Next 16.4.2、React 19.3.1、TypeScript 6.0.3、better-sqlite3 13.0.3。维护脚本使用 Node 24 同步模块钩子和 TypeScript 编译器，避免此环境的 tsx 系统用户查询问题。

在此项目根目录的 PowerShell 执行：

```powershell
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm db:seed
pnpm dev
# 服务启动后，在另一个根目录终端运行 pnpm open，建立本机访问授权。
```

打开终端显示的 [本地入口](http://127.0.0.1:3000)。首次安装需要联网下载依赖；运行核心流程不需要联网。better-sqlite3 13 已携带 Windows x64 N-API 预编译包，本机实测 SQLite 3.53.4；workspace 配置不执行多余的原生重编译。

环境文件可选。应用与数据库脚本均使用默认 `data/app.db`。更改数据库时，请在 PowerShell 会话设置 `$env:DATABASE_URL='data/other.db'`，确保迁移、seed 与服务使用同一值。Next 自动加载 `.env.local`，维护脚本也加载 `.env.local`，已设置的进程环境优先。API Key 示例为空。现已支持 DeepSeek / OpenAI 模型选择与独立检索；需本机配置并在界面明确启用，详见 [AI 接入说明](docs/ai-setup.md)。学习方向检索默认优先 Bilibili、小红书、百度贴吧、抖音的公开内容，可切换官方与参考来源，规则与限制见 [检索说明](docs/retrieval.md)。

生产模式：`pnpm build` 后 `pnpm start`。服务默认只监听 `127.0.0.1`。未迁移时目录可读，个人操作显示初始化提示，不会在请求内静默建表。

## 主要入口

| 入口 | 用途 |
| --- | --- |
| `/`、`/directions/cs` | 五专业卡、搜索、七区详情和领域关系 |
| `/domains`、`/topics/crypto-engineering` | 十二领域入口范围、二十六个当前专题 |
| `/assess`、`/knowledge` | 十题浏览器草稿与目标相关知识核对 |
| `/result/current` | 三项独立判断；历史评估从工作台打开 |
| `/transfer`、`/dashboard` | 缺口、条件路线、回报、确认、历史与周反馈 |
| `/compare`、`/advisor` | 同层比较、本地边界顾问模板 |
| `/settings`、`/about` | 导出删除、模式、来源与方法 |

未填写是未知，0 是明确未了解。结构化自评先预览后确认；课程与任务回报不会自动修改等级。路线支持最多三条候选对比与合法支路切换；保存当前选择为非活动状态，明确启用后最多一条活动计划。确认知识与采用新路线分开进行。

## 可复现密码学演示

```powershell
pnpm demo:reset
pnpm demo:run
```

只写隔离的 `data/demo.db`，生成 `.local/cryptography-demo.json`。全部是虚构 fixture：网工背景、网络 3、C 3、部分离散数学 1 → 密码工程 → 回报 → 明确确认认证加密等级 → 路线差异 → 应用版本 2，并输出未知与零基础对照。任务目标是观察成熟库行为，不能自行设计生产密码算法。

界面操作：问卷填写背景 → 知识画像确认 C、网络、离散数学 → 密码工程迁移分析 → 保存、设为活动计划 → 工作台回报 → 知识画像确认认证加密自评 → 工作台比较差异 → 确认应用。旧路线保留。自动浏览器验收覆盖此过程及导出、删除。

## 维护与验证

```powershell
pnpm knowledge:validate
pnpm services:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

E2E 使用已安装的 Microsoft Edge、独立 `data/e2e.db`、端口 3001；先 build。在没有 Edge 的设备上调整 Playwright `channel` 并安装对应浏览器。测试服务器仅在该隔离端口提供测试退出处理，不进入正式服务。

`pnpm db:generate` 为维护者生成 Drizzle 迁移草案；当前 Drizzle 定义已覆盖全部现有表，并有列与复合外键契约校验。生成草案仍需审查，不能直接替换已有手写迁移。迁移文件已随工程交付，新目录无需先 generate。

知识维护：修改生成器或新建 JSON，**更换 release ID**，全量校验后 seed。相同 ID 内容不同将拒绝发布；seed 幂等且不清个人资料。`2026-10-20.1` 保留初始草稿，`.2` 保留模型接入时的内容，当前为 `2026-10-21.5`，新增三个试点专题行动契约；`.1` 至 `.4` 原文保留。新增入口由 `node scripts/expand-catalog.mjs` 生成，任务细化由 `node scripts/deepen-projects.mjs` 生成。覆盖声明同时检查双模式要求、来源与验证项目；范围见 [内容覆盖说明](docs/content-coverage.md)。图结构检查不等于教育有效性证明。

## 架构与隐私

`src/server` 为受限多服务商模型、检索、上下文及异步请求；`src/core` 包含纯函数；`src/db` 为 SQLite 事务与归属；`src/app/api/app` 校验请求、长度、来源、幂等和版本；`src/components` 为响应式中文界面。公共图来源为 `knowledge/releases` JSON，SQLite 存不可变发布与规范化节点/边；个人记录存确认事件、投影、快照与路线版本。原始经历按文本渲染，不接受 HTML。

身份使用 256 位随机 HttpOnly / SameSite=Lax Cookie。所有个人查询以身份限定；外来路线 ID 不授权访问。Cookie 丢失后不恢复原登录，但支持将 JSON 备份恢复到新的空白身份；清 Cookie 不等同删除资料。

设置页可白名单导出 JSON、单路线级联删除、二次确认删除全部个人资料。删除全部包括知识、快照、路线、回报、对话、调用元数据、幂等和浏览器草稿；公共库保留。下载和备份无法回收。数据库、Key、日志及测试截图不提交 Git。

## 状态与故障

- 无 Key：完整本地核心可用。设置页明确显示模板模式。
- 资料加载失败：按 migrate / seed 顺序初始化；避免用演示库覆盖个人库。
- 输入或版本冲突：页面保留表单，刷新当前状态后核对；不强行覆盖旧版本。
- 原生驱动：本机通过预编译二进制验证；其他平台需核对架构支持，不承诺所有环境已测。
- ESLint 9.39.5 被上游标为停止维护，但目前 Next 官方插件的 peer 范围不兼容 ESLint 10。当前锁定可实际运行且 peer 无冲突的组合，升级插件后再切换，不隐瞒该维护风险。

详细证据：[测试报告](docs/test-report.md)、[方法](docs/methodology.md)、[需求映射](docs/requirements.md)、[人工评估方案](docs/user-evaluation.md)。

## 多服务商升级

已接入 DeepSeek Chat Completions、OpenAI Responses 和 DeepSeek/Tavily 检索。两家 Key 独立，设置中选择具体模型；默认须本人启用。当前自动测试与浏览器验收记录见 docs/test-report.md。DeepSeek 最小模型与余额查询已实测；最新十二次独立搜索保留九条线索，其中小红书仍为零，三个专题均为部分召回，详见 [真实搜索验收](docs/search-acceptance-2026-10-21.md)。OpenAI/Tavily 未真实验收。设置支持快速/四平台对照检索、每日调用上限、账户信息，配置教程见 docs/ai-setup.md。

后续验收顺序与具体完成条件见 [剩余工作](docs/completion-plan.md)。

备份与撤销：[个人恢复和数据库备份](docs/backup-recovery.md)。`pnpm backup:database` 创建本机一致性备份；设置页导出 JSON 可先预览、再恢复到空白身份，外部开关默认关闭。

学习顾问新增 [快速检索与四平台实时对照](docs/search-modes.md)：勾选联网后选择本次方式。对照每站独立请求一次、不读缓存、逐平台报告状态，最后最多一次模型总结；没有网页时跳过总结。新模式已执行十二次真实搜索，三个专题均部分召回；全平台质量和总结忠实性仍待验收。最新 158 项自动测试与 20 项浏览器验收通过。
