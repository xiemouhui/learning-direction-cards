# 公开源码与 Windows 测试包

版本：0.1.0-preview.2。用户选择公开源码、保留全部权利，项目不授予开源许可。

## 发布内容

- GitHub 仓库仅放应用源码、公共知识库、迁移、测试、配置空白示例和说明。
- 以干净初始提交发布，原本机 Git 历史保留；不上传私人作者信息、API Key、个人数据库、开发日志及未授权的本机开机任务脚本。
- Release 提供 Windows x64 ZIP 与 SHA-256 文件；Node 24.19.0 从官方站下载并核对官方 SHASUMS256.txt。
- 包内含本项目权利声明、Node 许可证及依赖第三方声明。

## 本机复现

源码开发需 Node 24、pnpm 11，先按 README 安装和构建。打包还需在 `.local/vendor` 放置 Node 官方 `node-v24.19.0-win-x64` 目录（包含 node.exe 和 LICENSE）；使用官方 ZIP 解压，并先核对官方 SHA-256。

```powershell
pnpm build:portable
pnpm package:windows
pnpm test:portable
node scripts/audit-release.mjs --bundle
```

打包输出位于忽略的 dist；输出目录已存在时拒绝覆盖，防止覆盖已验收版本。默认首次启动不自动调用模型或搜索，不附带任何作者账户额度。

自动测试使用实际 ZIP、捆绑 Node、隔离的临时个人目录和可用端口；不使用真实 Key，不请求付费外部服务。检查包括首次建库、重复启动、保存路线、停止服务、换目录升级、备份和端口冲突。

## 实际边界

2026-10-21 本机检查：171 项自动测试、24 项浏览器验收、lint、typecheck、生产 build 均通过。实际 ZIP 的独立 Node（空 PATH）、首次建库、重复启动、保存路线、停止 HTTP 服务、换目录升级、备份、端口冲突均通过；源码与包内扫描未发现本机配置 Key、数据库、日志或构建者绝对路径。最终 ZIP 内文件按清单逐项核对 SHA-256。

当前提供本机 Windows x64 验证，不宣称在全新 Windows 系统、ARM64 或所有企业安全策略中通过。VBScript 被禁用时使用文档中的捆绑 Node 命令。当前包未签名、无自动升级和崩溃遥测；这是预览版。四平台质量和教育评估边界沿用现有状态清单。

安全专项规则与边界见 [security.md](security.md)。源代码可使用 pnpm open 取得本机授权；测试包先启动，再配置凭据，默认仅当前会话。当前发布依旧未签名，不承诺同账户恶意程序防护。
