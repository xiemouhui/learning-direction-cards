# 本地安全方案与边界

安全预览版：0.1.0-preview.3。此项目仍为本地单用户工具，不是可直接公开部署的多用户服务。公开源码和下载包不收集用户 Key；网页不提供上传 Key 的接口。

## 凭据

免安装版先启动，再双击“配置模型”。原生窗口掩码显示输入，默认不勾选保存：Key 仅留在当前后台进程，停止后不再可用；勾选安全保存时使用 Windows CurrentUser DPAPI，密文放在个人目录的 security/credentials.dpapi。凭据目录移除继承权限，仅授予当前 Windows 用户访问。

会话配置会移除该服务之前保存的凭据；空白提交可移除选中服务的 Key。网页只显示配置状态，不回传 Key。请勿将 Key 粘贴到顾问或其他资料字段；服务器会阻止常见凭据格式及已配置 Key 被误存，模型发送前还会再次检查。

旧免安装版 .env 中已保存的 Key 在新版本启动时加密、解密核对后从原文件移除；失败则中止，不静默退回明文。不要事先复制或上传整个个人目录。

源码版：`pnpm credentials:setup`。选择安全保存后重启服务；不保存时会启动使用临时凭据的前台生产服务，3000 端口须空闲。迁移旧 .env.local：`node scripts/credentials.mjs --import-env`，成功核对密文后原文件的 Key 项移除，不生成含 Key 的备份。

开发者直接使用环境变量仍受支持，但这不等于加密存储。DPAPI 无法抵御已控制同一 Windows 账户、管理员权限或运行中进程的恶意程序。JavaScript 的字符串内存也不承诺物理清零；用户应保护设备与系统账户。

## 请求边界

默认模型目的地仅允许官方 HTTPS 源及已知基础路径。认证请求统一禁止自动重定向。自定义代理须在本机高级设置同时设 `LDC_ALLOW_CUSTOM_API=1` 和精确 `LDC_TRUSTED_API_ORIGINS`；这代表用户主动信任代理接收 Key，不会因 HTTPS 自动获得信任。允许显式指定的本机 HTTP 代理；不要信任不明代理。

应用只接受 APP_BASE_URL 指定的本机入口，严格核对 Host、Origin 和浏览器请求上下文。启动器或源码版 pnpm open 在当前 Windows 用户的私有目录签发 60 秒有效、只能使用一次的授权；仅 URL 片段携带，网页读取后立即清除，不进入 HTTP 地址或 referrer。兑换后获得每浏览器独立、12 小时有效的签名 HttpOnly / SameSite=Strict Cookie。单独访问 localhost 不会授权，过期或清 Cookie 后须重新使用本机启动入口。未授权 API 请求拒绝。安装签名密钥仅在本机私有目录，不进入前端包。

页面使用动态 nonce CSP，脚本不开放 unsafe-inline，禁止被其他网站嵌入，关闭摄像头、麦克风和定位权限，并限制 referrer。开发模式因热更新允许 unsafe-eval；正式构建不允许。

## 调用与费用

每身份原有限额外，增加数据库持久化实例预算。默认北京时间每日模型最多 80 次、检索 40 次、同时最多 2 个外部顾问请求；每轮请求先预占，完成后按实际次数结算。异常中断按预占保守保留到当日结束；清 Cookie、换身份、删除个人资料或重启不重置。

通过本机非敏感配置调整 LDC_DAILY_MODEL_LIMIT、LDC_DAILY_SEARCH_LIMIT、LDC_MAX_EXTERNAL_CONCURRENCY；非法值或 0 禁止对应请求。聚合预算不含身份、问题或 Key，独立保留约一个月以防删除身份绕过；不收入个人导出。首页和本地规划不扣外部额度。

本地次数上限不是金额硬上限，其他程序也能使用同一个 Key。建议每个工具使用独立、最小权限 Key，服务商支持时设置费用限额和告警。怀疑泄露应先到服务商撤销 Key、检查用量，再换新 Key；删除文件或 Git 记录不能撤回已泄露凭据。

## 验证与发布

单元测试覆盖签名、Host/Origin、白名单、重定向实际网络跳转、误粘贴拦截和跨身份预算；浏览器测试覆盖 CSP 水合、未授权 API、跨站请求和误粘贴不保存。Windows 测试验证 DPAPI 往返、Unicode、删除和损坏拒绝；实际 ZIP 验证会话不落盘、安全保存后重启及移除。

发布前扫描源码与实际 ZIP，检查已配置 Key、测试 canary、数据库、日志、凭据密文文件和构建者路径；生成 SHA-256。当前没有付费代码签名，也没有第三方渗透测试；校验和不能替代可信发布者签名。依赖更新与安全扫描需持续进行。

参考：[OWASP Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)、[OWASP SSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)、[微软 DPAPI](https://learn.microsoft.com/en-us/dotnet/standard/security/how-to-use-data-protection)。
