# DeepSeek / ChatGPT 模型选择与检索

本文中的“ChatGPT”是模型服务的展示名称，实际使用 API 接口，需单独配置 API Key 和 API 额度，不能使用 ChatGPT 网页版订阅代替。原有 `OPENAI_*` 配置项、`openai` 服务标识及官方接口地址保持不变，无需迁移已有配置。

> 安全版本优先使用本机凭据工具：免安装版“配置模型”，源码版 `pnpm credentials:setup`。旧 .env.local Key 使用 `node scripts/credentials.mjs --import-env` 迁移。下面的环境变量示例仅供开发者兼容，不代表安全保存方式；自定义接口默认拒绝，完整规则见 [安全说明](security.md)。

当前代码已支持两家模型、账户模型清单、手动模型 ID、独立检索开关、来源引用、调用统计、格式/引用校验和本地兜底。2026-10-20 经用户授权，DeepSeek 当前模型完成一次真实接入验收；搜索接口连通，但返回结果偏题，质量待改进。ChatGPT/Tavily 尚未真实验收，详见 live-service-acceptance.md。自动测试仍使用 fixture，与真实验收分开。

## 1. 在本机填写密钥

打开项目根目录 `.env.local`。配置文件不会自动启用外部服务；已有 Key 请保留。只填写你要使用的服务：

```dotenv
MOCK_AI=0

DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_API_KEY=在此处填写你的DeepSeek密钥
DEEPSEEK_MODEL=deepseek-flash

OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=在此处填写你的ChatGPT密钥
OPENAI_MODEL=

SEARCH_PROVIDER=deepseek
TAVILY_API_KEY=
```

上面是说明示例，不能把“在此处填写……”当作真实 Key。只用 DeepSeek 时 ChatGPT Key 留空；反之亦然。Key 不通过网页输入，不会返回浏览器，不进导出、日志或 Git。`.env.local` 已被 Git 忽略。

两家的 Key 独立，不能互相替代。兼容旧 `LLM_*` 环境变量时，只将它们用于 `LLM_PROVIDER` 指定的一家，未指定时用于 DeepSeek。推荐使用新的服务商专属字段，避免混淆。

DeepSeek 官方文档当前列出 `deepseek-flash` 和 `deepseek-v4-pro`。ChatGPT 模型从账户清单选择或手动填写，不预先假定你有某型号权限。也可通过 `OPENAI_MODEL`、`OPENAI_MODELS`（逗号分隔）配置候选。

## 2. 更新数据库并重启

在项目根目录运行：

```powershell
pnpm db:migrate
pnpm dev
```

开发服务已运行时先在对应终端 Ctrl+C，再启动。生产模式需 `pnpm build` 后重启 `pnpm start`。如果此前由 Windows 登录任务在后台运行，请使用原有管理脚本停止、重建并启动对应任务；不要只刷新浏览器。脚本及 Node PATH 说明见 README 与 windows-autostart.md。

迁移版本 2 只新增服务设置、异步请求和公共搜索缓存表，保留现有个人资料；不会在 API 请求中建表。维护脚本现在与 Next 一样加载根目录 `.env.local`，也尊重已设置的进程环境。

## 3. 在界面选择服务商和具体模型

1. 进入“设置与隐私”中的“模型与检索设置”。
2. 选择 DeepSeek 或 ChatGPT。界面只显示 Key 是否已配置，不显示 Key 内容。
3. 选择具体模型。可以点击“读取账户模型列表”，或手动填写控制台中的完整模型 ID。
4. 核对“发送范围与费用”，勾选启用模型及确认框，保存设置。
5. 打开“学习顾问”，选择专题、输入问题并发送。

账户模型清单可能包含非文本模型；当前 DeepSeek 使用 Chat Completions JSON Output，ChatGPT 使用 Responses + JSON Schema。所选模型需要支持对应接口及结构化输出。接口或模型不支持时显示本地兜底，不冒充成功。

选择、保存设置和读取模型清单不会自动生成回答。读取清单仅向所选服务发送认证信息。每条回答显示实际服务商、模型和模式，历史不随模型切换改写。

## 4. 按需联网检索

检索服务与模型选择独立。例如可以用 ChatGPT 解释，同时用 DeepSeek 搜索。

在设置中允许检索，再在顾问页选择具体专题并勾选“本次联网核对公开专题资料”。默认检索 Bilibili、小红书、百度贴吧和抖音的公开内容，也可切换官方与参考来源核对。每次只生成一条由公开技术词和所选来源站点构成的查询，不发送用户提问或完整画像。最多五个匹配结果，八秒超时，匹配内容缓存七天；页面显示平台、公开检索词、过滤数量与缓存状态。具体规则与索引限制见 [检索说明](retrieval.md)。

DeepSeek 搜索使用 DeepSeek Key。Tavily 使用独立 `TAVILY_API_KEY`，没有就留空。不提供自由网页抓取/工具循环；外部摘要不能直接修改知识库。

## 5. 发送哪些内容

模型可收到：当前提问、最近最多二十条顾问对话、所选专题、该目标相关的已确认等级/证据类型、活动标签和规则计算摘要。不发送完整问卷原文、课程/项目证据原文或数据库。

模型只返回解释、允许的来源/证据 ID 与最多三个追问。不能修改掌握、依赖、预算、活动路线或 ready/blocked。格式或引用失败至多重试一次；网络错误直接本地兜底；单次二十秒、包含检索总预算四十五秒。

关闭服务、切换设置、修改画像或删除资料发生在请求期间时，旧上下文回答丢弃，不自动写回。已发出的请求无法从服务商回收。每画像每小时最多二十次顾问请求，浏览/保存/导出/删除不受该额度阻塞。

## 6. 如何判断接入成功

成功回答应显示所选服务商与模型，设置统计出现实际模型请求；有 usage 才累加已返回 token，未知用量保留未知，不推算费用。失败会标明本地兜底，保留提问。

仅凭“Key 已配置”、出现模型名称或测试全绿，不证明真实服务已成功调用。首次实际调用可用不含个人经历的简单方向问题。费用和模型权限以账户控制台为准。

## 接口依据

2026-10-20 实际读取的官方文档：

- DeepSeek 接口地址与模型入口：https://api-docs.deepseek.com/
- DeepSeek JSON Output：https://api-docs.deepseek.com/guides/json_mode
- DeepSeek 非思考模式参数：https://api-docs.deepseek.com/guides/thinking_mode
- DeepSeek 搜索接口与鉴权：https://api-docs.deepseek.com/guides/search
- ChatGPT Responses 与结构化输出：https://developers.openai.com/api/docs/guides/structured-outputs
- Tavily 搜索鉴权与请求：https://docs.tavily.com/documentation/api-reference/endpoint/search

本地 HTTP fixture 验证 SDK 及 UI 整条链路，与真实服务实测分开报告。

## 无费用配置检查

执行 `pnpm services:check`，只检查本地 Key 是否存在、接口/模型 ID 格式及演示开关；不显示密钥、不联网、不验证账户额度或权限。显示 readyForManualTest 后，仍需明确授权或本人在界面发起真实验收。

余额和用量可在设置页查看：点击刷新 DeepSeek 余额或 Tavily 额度，ChatGPT 使用官方控制台入口；本应用七天统计单独展示。查询不发送学习资料，也不调用模型或搜索。范围与限制见 [账户说明](account-usage.md)。

顾问支持快速检索和四平台实时对照，后者每站各查询一次、最多一次统一总结。使用前核对本次方式和每日剩余额度；没有有效网页时不调用模型总结。详见 [双模式规则](search-modes.md)。
