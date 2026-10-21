import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const id = '2026-10-20.4';
const data = JSON.parse(readFileSync('knowledge/releases/2026-10-20.3.json', 'utf8'));
const designs = {
 'ml-foundations': ['本地小型匿名表格，二分类标签；保存划分规则，不上传个人数据。', '示例：100 条合成样本，标签 70:30；多数类为对照，固定随机种子划分训练与测试。', '报告测试集多数类准确率，再用同一划分比较简单模型；列出误判样本，不要求模型一定更好。', ['检查训练/测试是否混用、标签是否进入特征', '分开说明整体指标和少数类错误', '重跑固定种子，记录划分及结果'], '只能说明这份样本和划分下的结果，不能推出真实业务效果或总体泛化能力。'],
 'ai-apps': ['选择可在本地运行的现成模型与其公开样例，记录模型版本和输入格式。', '示例：固定 5 条正常样例、2 条空输入或格式错误；运行前写下预期类别或错误类型。', '保存输入、输出、预期与偏差对照表；相同样例重复运行并记录差异。', ['核对输入维度和预处理与模型约定一致', '区分模型错误、格式错误和不支持输入', '写明复用示例与本人独立完成部分'], '不能证明模型可解释性、全场景可靠性或已掌握模型训练；本任务不要求购买 API。'],
 'linux-basics': ['本地 Linux、WSL 或虚拟机的个人临时目录；只读观察本人启动的进程。', '示例：在临时目录创建一份三行文本，观察一个由本人启动的进程及其退出。', '保存工作目录、文件路径、进程标识和退出前后记录，解释文件与进程的区别。', ['区分相对路径、当前目录与文件内容', '找不到文件时核对路径和权限', '仅结束本人创建的实验进程，记录清理动作'], '不证明内核、运维或多用户系统管理能力；实验不要求管理员权限。'],
 'systems-performance': ['个人电脑上的可重复本地任务；记录系统、工具、输入规模和采样间隔。', '示例：同一文件处理任务运行三次，分别记录耗时、CPU 和内存观察值，再只改变输入规模。', '提交假设、三次原始测量、单变量对照和结论；证据不足时明确无法定位瓶颈。', ['区分一次峰值与可重复现象', '核对后台负载和缓存等混杂因素', '保留与假设不一致的结果，不凭单一指标判定瓶颈'], '只反映该环境与任务的观察，不证明因果关系、容量上限或线上性能。'],
 'distributed-basics': ['纸面或本地三副本模型，显式列出消息延迟、故障和写入确认规则。', '示例：A 接收写入后到 B 的消息延迟，C 暂时离线；分别列出各副本可见值与客户端观察。', '画出消息时间线与状态表，区分已收到、已确认、未知；恢复通信后再逐步推演。', ['不能把离线直接判作永久故障', '注明不同确认规则会产生不同结果', '说明这是情景推演，未实现一致性协议'], '不证明分布式系统实现正确性、真实网络表现或生产级容灾能力。'],
 'cloud-ops': ['已有本地容器或学习集群；无可用环境时先做状态推演，不购买云资源。', '示例：在本地示例应用记录启动、健康、停止、更新前后状态；保留原版本和回退步骤。', '产出环境清单、状态记录与一次可复核的恢复过程；推演与实际执行分开标注。', ['区分应用运行、可访问与健康检查成功', '更新失败时记录日志、版本和回退条件', '核对端口、资源占用与清理结果'], '本地模拟不能证明云上扩缩效果、真实可用性或生产运维能力。'],
 'embedded-basics': ['本人开发板、数据线和匹配的官方工具链，记录芯片型号及串口；无板卡时停在环境核对。', '示例：使用官方最小示例，保存构建日志和一次启动输出；不接外部执行器。', '清楚区分编译成功、烧录成功与设备实际运行，保存各阶段证据。', ['核对板卡型号、目标芯片与端口', '连接失败先检查供电和数据线，不任意调整电压', '标出日志中本人能解释的阶段与未知项'], '无板卡记录不算硬件实践；不证明电路设计、实时性或设备安全。'],
 'iot-basics': ['本人设备与本地接收端或明确标注的模拟链路；使用不含个人数据的测试消息。', '示例：发送带序号的三条测试消息，记录设备发送和接收端收到的时间，再模拟接收端停止。', '提交发送/接收日志、链路图和故障对照；不能收到时指出尚未定位的环节。', ['按序号匹配同一条消息，不把发送日志当成功送达', '核对连接、传输和接收端的职责', '断线后的恢复与重复消息单独记录'], '不证明公网部署、传感器精度或安全可靠性；模拟记录不算硬件证据。'],
 'modern-crypto': ['公开教材中的安全目标，使用符号或玩具例子描述消息和攻击者能力，不处理真实秘密。', '示例：分别讨论仅加密与带认证的消息，写出攻击者可观察或篡改什么，以及实验要区分的事件。', '产出机密性与完整性目标对照、假设和反例说明；不能论证之处明确保留。', ['区分安全定义、实验和证明', '反例需对应具体假设与目标', '玩具例子不能作为新密码方案或安全证明'], '不证明完整密码理论掌握、形式化证明能力或自设计方案安全。'],
 'crypto-engineering': ['本地成熟认证加密库的官方示例；随机生成测试密钥，按库要求处理 nonce，不使用真实资料。', '示例：同一测试明文先正常解密，再分别篡改密文、认证数据或使用错误密钥；每次独立记录。', '正常案例恢复原文；篡改或不匹配输入应被拒绝，记录实际异常与处理，不输出密钥。', ['逐次记录算法、库版本和输入条件', '异常时不把未认证内容作为可信明文', '按所选算法核对 nonce 要求，不复用示例到生产'], '不证明密钥管理、协议设计或系统整体安全；不自行实现密码算法。'],
};
data.id = id;
data.createdAt = '2026-10-20T14:30:00.000Z';
for (const n of data.nodes) {
 n.releaseId = id;
 if (n.type !== 'project') continue;
 const design = designs[n.id.replace(/^project-/, '')];
 if (design) {
  const [input, example, expected, failures, limits] = design;
  n.content = { ...n.content, input, example, expected, failureChecks: failures, rubric: ['保存环境、输入与原始产出', ...failures, '注明独立完成范围与仍未验证的内容'], limits, designStatus: 'application-designed-not-independently-evaluated' };
 }
 // Stages describe deliverables, never an automatic mastery change or completion deadline.
 n.content.stages = [
  { name: '核对条件', output: String(n.content.input), check: '条件未知先记录；缺少必需设备时暂停实作，可先做明确标注的推演。' },
  { name: '记录与对照', output: String(n.content.output), check: String(n.content.expected ?? n.content.rubric[0]) },
  { name: '解释与复核', output: '整理一次失败或反例、实际耗时、独立完成范围及尚未验证项。', check: String(n.content.limits) },
 ];
}
for (const e of data.edges) e.releaseId = id;
const path = `knowledge/releases/${id}.json`, body = JSON.stringify(data, null, 2) + '\n';
if (existsSync(path) && readFileSync(path, 'utf8') !== body) throw new Error('禁止改写已生成版本');
writeFileSync(path, body);
const profiles = JSON.parse(readFileSync('knowledge/retrieval/2026-10-20.1.json', 'utf8'));
profiles.version = '2026-10-20.2'; profiles.knowledgeRelease = id;
const target = 'knowledge/retrieval/2026-10-20.2.json', retrieval = JSON.stringify(profiles, null, 2) + '\n';
if (existsSync(target) && readFileSync(target, 'utf8') !== retrieval) throw new Error('禁止改写检索配置');
writeFileSync(target, retrieval);
console.log(`${id}: 10 个专题具体样例，26 个项目阶段产出；未更改等级、前置与旧发布。`);
