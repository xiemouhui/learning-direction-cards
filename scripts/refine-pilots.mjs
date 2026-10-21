import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const id = '2026-10-21.5';
const data = JSON.parse(readFileSync('knowledge/releases/2026-10-20.4.json', 'utf8'));
const guides = {
 'ml-foundations': {
  start: '先保存一份合成二分类样本说明和训练/测试行号清单；本次只核对划分，不急着训练模型。',
  prerequisites: ['能在本机读取表格并区分特征与标签；不熟悉时先核对 Python 和数据处理基础', '已有本地运行环境；不需要 GPU、云服务或付费 API'],
  deliverables: ['环境和包版本、数据生成规则、固定种子、样本行号及类别数', '同一测试集的多数类基线与简单模型结果，以及误判样本', '实际耗时、独立完成部分和不能从本实验推出的结论'],
  acceptance: ['训练与测试样本不重叠，预处理只在训练集拟合，标签不进入特征', '多数类预测由训练集确定，再在测试集计分；保存分母和少数类错误', '不以超过基线作为完成条件；若反复调参，另留验证集，不根据测试结果反复选模型'],
  recovery: ['环境未就绪：先提交环境缺项，不下载不明安装包', '指标异常高：优先核对重复样本、标签泄漏和划分，而非宣布模型优秀', '预算用尽：保存划分与当前结果，下次续接，不伪造完整报告'],
  evidenceNodes: ['python', 'model-eval'],
 },
 'http-basics': {
  start: '打开自有本地测试页的网络面板，记录一组 GET 请求与响应；先找到对应关系，再比较失败案例。',
  prerequisites: ['电脑和浏览器网络面板，以及已有自有本地测试服务', '能辨认 URL、请求方法和状态码；缺项先核对网络基础'],
  deliverables: ['不含 Cookie、Authorization 或个人正文的请求方法、路径、状态码与响应字段表', '一组实际成功响应与一组实际失败响应，以及服务是否真正收到请求的记录', '缓存或重定向等观察条件、实际耗时和未验证部分'],
  acceptance: ['同一行的请求和响应来自同一次操作，区分请求头、响应头和正文', '记录服务实际返回的状态；网络失败或没有响应时不编造 HTTP 状态码', '说明观察到的 HTTP 字段，不能据此推出 TCP、TLS 或服务器内部实现'],
  recovery: ['没有本地服务：先记录环境缺项，或将静态样例明确标为推演', '找不到请求：检查过滤条件、缓存与是否发生重定向', '含凭证的记录：先脱敏再回报，不上传 HAR、截图或真实登录信息'],
  evidenceNodes: ['network', 'http-semantics'],
 },
 'crypto-engineering': {
  start: '先核对成熟库的版本和所选算法 nonce 要求，列出正常解密、篡改密文、认证数据不匹配和错误密钥四个独立案例。',
  prerequisites: ['本地成熟认证加密库和官方示例；所选算法在当前环境受支持', '理解明文、密文、认证数据和 nonce 的职责；不熟悉时先验证这些概念'],
  deliverables: ['库和算法版本、公开输入条件、每次案例的预期及实际结果，不包含密钥', '正常解密对照与三个失败案例记录，说明错误处理', '独立完成部分、实际耗时和密钥管理等尚未验证项'],
  acceptance: ['正常解密恢复测试明文，三个不匹配案例分别记录认证拒绝或实际异常', '加密时遵守所选算法的 nonce 约束；解密对照使用对应的原始 nonce', '认证失败时不使用未认证内容；不自行实现算法或将实验作为生产安全证明'],
  recovery: ['算法或依赖不受支持：保存环境错误并停止，不自行替换为自制算法', '篡改未被拒绝：核对是否实际改变传入数据，以及是否忽略异常', '预算不足：先完成案例设计和环境核对，未执行的案例明确留空'],
  evidenceNodes: ['aead'],
 },
};
data.id = id; data.createdAt = '2026-10-21T04:00:00.000Z';
for (const n of data.nodes) {
 n.releaseId = id;
 const guide = guides[n.id.replace(/^project-/, '')];
 if (n.type === 'project' && guide) {
  if (guide.evidenceNodes.some(key => !data.nodes.some(node => node.id === key && ['knowledge', 'skill'].includes(node.type)))) throw new Error('任务关联知识节点不存在');
  n.content.actionGuide = guide;
  n.content.designStatus = 'application-designed-not-independently-evaluated';
  if (n.id === 'project-http-basics') {
   n.content.example = '自有本地服务的一次正常 GET 与一次不存在路径请求；只记录实际收到的响应。';
   n.content.expected = '对应请求方法、路径、响应状态与正文；无响应时记录网络失败，不编造状态。';
   n.content.failureChecks = guide.recovery;
  }
 }
}
for (const e of data.edges) e.releaseId = id;
data.sources.push({ id: 'ml-splits', title: 'Datasets: Dividing the original dataset', url: 'https://developers.google.com/machine-learning/crash-course/overfitting/dividing-datasets', publisher: 'Google', accessedAt: '2026-10-21', tier: 'primary', status: 'verified' });
data.claims.push({ id: 'claim-ml-splits', text: '训练与最终评估使用不同样本；反复使用验证或测试结果会削弱评估可靠性。', sourceIds: ['ml-splits'], quality: 'verified', note: '只支撑数据划分原则，不证明本应用任务、等级或学习效果。' });
data.nodes.find(n => n.id === 'project-ml-foundations').sourceClaimIds.push('claim-ml-splits');
for (const source of data.sources.filter(s => ['http', 'aead'].includes(s.id))) source.accessedAt = '2026-10-21';
function publish(path, value) {
 const body = JSON.stringify(value, null, 2) + '\n';
 if (existsSync(path) && readFileSync(path, 'utf8') !== body) throw new Error('禁止覆盖已有发布');
 writeFileSync(path, body);
}
publish(`knowledge/releases/${id}.json`, data);
const retrieval = JSON.parse(readFileSync('knowledge/retrieval/2026-10-20.2.json', 'utf8'));
retrieval.version = '2026-10-21.3'; retrieval.knowledgeRelease = id;
publish('knowledge/retrieval/2026-10-21.3.json', retrieval);
console.log('三个试点专题行动契约已生成；旧发布不变，尚未经过独立教学评估。');
