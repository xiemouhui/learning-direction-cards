# 需求到实现与验证映射

| 需求 | 主要实现 | 验证/状态 |
| --- | --- | --- |
| 双入口、五专业、十二领域与二十六专题 | releases/*.json、catalog-pages、home | 结构与覆盖声明校验、首页/十二领域 E2E；只在已声明专题内规划 |
| 十题、跳过、未知与草稿 | assessmentSchema、assess | 草稿刷新 E2E |
| 六状态与独立学习状态 | stateSchema、knowledge、knowledge_states | core/store 测试 |
| 三维判断、无总分 | recommendation、results | 知识与时间不影响兴趣测试 |
| 快照与确认事件 | profiles、records、knowledge_states | 确认/历史/冲突及最新确认撤销、事件重放测试 |
| 六类缺口与硬图 | graph、planner | 悬空、自环、重复、DAG、AND/OR、缺边测试 |
| 预算 0 / 检查点 | planner、transfer | 预算与日期测试、零预算 E2E |
| 多候选与分支切换 | planner.candidates / selectedOptions、CandidateChooser | 最多三组合、资源与新增缺口比较、手动切支、保存与重算保留；有限搜索不保证全局最优 |
| 密码工程迁移闭环 | store、dashboard、demo | UI 黄金路径与演示 JSON |
| 路线提案、幂等、活动唯一 | paths/path_versions、records、idempotency | 事务、版本、拒绝与隔离测试 |
| 归属、输入、CSRF | api/app | API 与多身份 E2E |
| 导出、删除、浏览器草稿 | exportData、settings | 下载/删除、预览恢复到空白身份 E2E，关联重映射与事务回滚测试 |
| 周反馈 | checkins、dashboard | 时区、同周覆盖、缺周与提醒测试 |
| 真实 AI / 检索 | server/llm、server/search、service-settings | 多服务商与检索已实现；fixture 验证；DeepSeek 模型最小真实验收通过，搜索连通；四平台/参考范围、来源与相关性过滤已本地验证，真实三专题仅有 Bilibili 有限标题相关结果，其他三平台零匹配、直达未验证；其他账户未验收 |
| 旧数据兼容 | legacy、compatibility.test | 虚构旧分数保留、显式映射、不造等级 |
| SQLite / Drizzle 全模型 | migrations、db | SQLite 现有全表 Drizzle 定义与列/复合外键契约通过；公共细内容仍为版本 JSON |
| 响应式与可访问性 | globals.css、shell、表单 | 三宽度主要页面无溢出；AA/完整键盘审计未全验收 |
| 人工有用性 | user-evaluation.md | 材料已交付，尚未招募执行 |

仅对实际执行的检查报告通过；本表不能代替测试报告或内容评估。
