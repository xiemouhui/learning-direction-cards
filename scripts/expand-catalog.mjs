// 扩充入口切片；旧发布文件保持不可变。来源于 2026-10-20 阅读核对。
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const data = JSON.parse(readFileSync('knowledge/releases/2026-10-20.2.json', 'utf8'));
const id = '2026-10-20.3', date = '2026-10-20';
data.id = id;
for (const item of [...data.nodes, ...data.edges]) item.releaseId = id;
const sources = [
 ['ros', 'ROS 2 Jazzy CLI 入门', 'https://docs.ros.org/en/jazzy/Tutorials/Beginner-CLI-Tools.html', 'Open Robotics', 'CLI 入门包含 turtlesim、节点、话题、服务、参数、日志及录制回放；本版选取电脑模拟通信入口，不等于机器人控制课程。'],
 ['webgl', 'WebGL 上下文入门', 'https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial/Getting_started_with_WebGL', 'MDN', '入门示例通过 canvas 获取 WebGL 上下文，检查不支持情形并清除颜色缓冲；不覆盖完整三维渲染。'],
 ['opencv', '图像基本操作（官方文档源文件）', 'https://github.com/opencv/opencv/blob/4.x/doc/py_tutorials/py_core/py_basic_ops/py_basic_ops.markdown', 'OpenCV', '教程使用 Python 和 NumPy 访问像素、图像属性、区域和通道，提醒关注数据类型与索引。文档站访问受限，已阅读官方仓库正文。'],
 ['access', '网页可访问性初步检查', 'https://www.w3.org/WAI/test-evaluate/preliminary/', 'W3C WAI', '初步检查包括标题、替代文本、键盘操作等；通过这些检查仍不能断言全面符合可访问性要求。'],
 ['usability', '主持式可用性测试', 'https://www.gov.uk/service-manual/user-research/using-moderated-usability-testing', 'GOV.UK Service Manual', '可用性测试围绕任务、参与者观察和记录展开；可使用虚构数据，但其情境洞察有限。'],
 ['algorithms', '6.006 算法课程大纲', 'https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/pages/syllabus/', 'MIT OCW', '该课程使用 Python 和离散数学，讨论数据结构、排序、图搜索、动态规划及性能分析；本应用只选择小规模搜索比较任务。'],
 ['computability', '6.045J 自动机、可计算性与复杂性大纲', 'https://ocw.mit.edu/courses/6-045j-automata-computability-and-complexity-spring-2011/pages/syllabus/', 'MIT OCW', '课程以离散数学和读写证明的背景讨论有限自动机、图灵机、可计算性及复杂性；本版仅选择有限自动机入口。'],
 ['http', 'HTTP 概览', 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Overview', 'MDN', 'HTTP 采用请求与响应语义；方法、路径、头、状态码和正文帮助解释一次浏览器交互，不同协议版本的传输格式不同。'],
 ['wireshark', 'Wireshark 用户指南：介绍', 'https://www.wireshark.org/docs/wsug_html_chunked/ChapterIntroduction.html', 'Wireshark', 'Wireshark 用于观察协议数据、故障排查与学习；不是入侵检测系统，观察结果需要结合环境解释。'],
 ['pytest', 'pytest 入门', 'https://docs.pytest.org/en/stable/getting-started.html', 'pytest', '入门演示测试发现、断言失败及异常检查；单个测试通过不能证明软件没有缺陷。'],
 ['git', '版本控制简介', 'https://git-scm.com/book/en/v2/Getting-Started-About-Version-Control', 'Pro Git / Git', '版本控制记录文件随时间的变化，以便比较与恢复历史；分布式版本控制在客户端保留仓库历史。'],
 ['sql', 'PostgreSQL 18 教程', 'https://www.postgresql.org/docs/18/tutorial.html', 'PostgreSQL', '教程介绍关系数据库与 SQL，包含建表、查询、连接、聚合及事务；不要求先具备编程或 Unix 经验。'],
 ['pandas', 'pandas 表格读写入门', 'https://pandas.pydata.org/docs/getting_started/intro_tutorials/02_read_write.html', 'pandas', '表格读写教程通过 head、dtypes 和 info 检查行列、数据类型与缺失值；不能仅凭表格摘要推出因果关系。'],
 ['websecurity', '授权设计速查表', 'https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html', 'OWASP', '授权需要默认拒绝、检查权限及处理失败；建议用单元和集成测试检查授权逻辑，但不能替代完整安全测试。'],
 ['threat', '威胁建模速查表', 'https://cheatsheetseries.owasp.org/cheatsheets/Threat_Modeling_Cheat_Sheet.html', 'OWASP', '威胁建模围绕系统模型、威胁识别、风险响应与复核展开；缓解措施应能转为可验证的安全要求。']
];
for (const [key, title, url, publisher, text] of sources) {
 data.sources.push({ id: key, title, url, publisher, accessedAt: date, tier: 'primary', status: 'verified' });
 data.claims.push({ id: `claim-${key}`, text, sourceIds: [key], quality: 'verified', note: '已阅读官方正文；选题、行为等级、练习与验收标准由本应用设计，不是来源认证或通用入学门槛。' });
}
function node(key, type, name, summary, content, source) {
 const n = { id: key, type, name, summary, content, aliases: [], sourceClaimIds: [`claim-${source}`], quality: 'verified', verifiedAt: date, releaseId: id };
 data.nodes.push(n); return n;
}
function edge(from, to, type, source, scope = [], requiredLevel = 2, rubric = []) {
 const e = { id: `${type}:${from}:${to}:${scope.join(',')}`, from, to, type, explanation: '仅支持本版列出的活动与局部证据；导航关系不表示专业独占，练习通过不自动更新掌握等级。', scope, requiredLevel, sourceClaimIds: [`claim-${source}`], quality: 'verified', verifiedAt: date, releaseId: id, rubric };
 data.edges.push(e); return e.id;
}
for (const [key, name, summary, source] of [
 ['ros-interfaces', 'ROS 节点与通信接口', '区分节点、话题和服务，并记录连接关系。', 'ros'],
 ['web-basics', 'HTML 与 JavaScript 基础', '能找到页面元素、执行简单脚本并检查运行错误。', 'webgl'],
 ['image-arrays', '图像数组与索引', '解释行列、通道、数据类型与区域索引。', 'opencv'],
 ['accessibility', '可访问性初步检查', '能够记录键盘、标题和替代文本的检查证据及边界。', 'access'],
 ['user-observation', '用户任务与观察记录', '区分观察事实、个人解释与尚待验证的假设。', 'usability'],
 ['algorithm-analysis', '算法正确性与复杂度', '用反例、输入规模与操作计数检查算法说明。', 'algorithms'],
 ['automata', '有限自动机模型', '用状态、字母表和转移规则描述有限状态过程。', 'computability'],
 ['http-semantics', 'HTTP 请求与响应', '解释方法、路径、状态码与请求响应的对应关系。', 'http'],
 ['packet-observation', '协议观察与证据记录', '识别抓包范围、过滤条件与无法从样本判断的内容。', 'wireshark'],
 ['test-design', '断言与边界测试', '从预期行为构造正常、边界和异常用例。', 'pytest'],
 ['version-control', '版本记录与恢复', '解释历史差异，并在隔离目录恢复指定文件。', 'git'],
 ['relational-data', '关系数据与 SQL', '解释表、行、键、连接和聚合结果。', 'sql'],
 ['table-quality', '表格类型与缺失值检查', '记录字段含义、类型、缺失情况与处理假设。', 'pandas'],
 ['authorization', '身份与授权边界', '区分身份确认和资源权限，检查默认拒绝和失败处理。', 'websecurity'],
 ['threat-model', '资产、信任边界与威胁模型', '把数据流、边界、威胁和可检验的缓解措施对应起来。', 'threat']
]) node(key, ['user-observation', 'packet-observation', 'test-design', 'version-control', 'accessibility'].includes(key) ? 'skill' : 'knowledge', name, summary, { diagnostic: `用一个小例子解释「${name}」，保留输入、检查结果和仍需帮助的部分。` }, source);

// 每行提供两个不同深度目标、专属输入/产出与验收标准，全部可在电脑上开始。
const topics = [
 ['ros-topics', 'ROS 节点与话题探索', 'robotics', 'ros', ['linux'], ['ros-interfaces'], '在 turtlesim 示例中辨认节点和话题，观察消息方向。', '比较节点启动顺序与消息观察结果，解释未接收消息的条件。', '本地 ROS 2 Jazzy 与 turtlesim 示例；先核对系统和安装条件。', '节点—话题关系图、命令日志和消息样本。', ['标明消息发布者与订阅者', '保存一次有消息和无消息的对照', '解释软件模拟不能验证真实传感器或运动安全']],
 ['ros-services', 'ROS 服务与参数探索', 'robotics', 'ros', ['linux'], ['ros-interfaces'], '区分连续话题消息、服务请求响应与参数配置。', '在相同初始条件下比较服务与参数改变前后的模拟行为。', '本地 ROS 2 turtlesim；使用示例已有服务与参数。', '请求响应记录、参数快照和一次可重复的状态对照。', ['标明服务名、输入和返回结果', '记录参数改变前后的状态及恢复方式', '说明该实验未验证导航、控制或实时性']],
 ['webgl-start', '浏览器图形上下文探索', 'graphics-visual', 'webgl', ['web-basics'], [], '初始化 WebGL 上下文并观察颜色缓冲输出。', '封装初始化和失败回退，比较不同尺寸与颜色设置下的输出。', '支持 WebGL 的浏览器、本地 HTML 和官方入门示例。', '可运行页面、输出截图及上下文获取失败的处理记录。', ['说明 canvas 与上下文的关系', '记录支持与不支持分支的处理', '区分颜色缓冲初始化与完整三维渲染']],
 ['image-operations', '图像数组与区域操作', 'graphics-visual', 'opencv', ['python'], ['image-arrays'], '读取自有样例图像，检查尺寸、通道并裁剪指定区域。', '比较不同通道与数据类型处理，加入读取失败和越界输入检查。', '自有或允许使用的样例图像，Python、NumPy 和 OpenCV。', '原图与区域输出、数组属性及错误输入检查报告。', ['说明行列、通道与坐标对应', '验证输出尺寸和指定像素变化', '记录读取失败处理；不把区域操作当作目标识别能力']],
 ['accessible-interface', '界面可访问性初步检查', 'hci-media', 'access', [], ['accessibility'], '依据 WAI 初步检查记录一个本地页面的键盘操作与标题问题。', '修正一个问题并复测，区分初步改善与完整符合性评估。', '一个自有本地页面及键盘；使用 WAI 初步检查清单。', '检查表、复现步骤和修正前后证据。', ['保存键盘焦点和标题检查的实际结果', '标明未检查或无法判断的项目', '明确通过初步检查不等于全面符合 WCAG']],
 ['usability-study', '任务式可用性观察', 'hci-media', 'usability', [], ['user-observation'], '为原型定义一项任务，区分完成情况与主观意见。', '在自愿参与者同意下开展小样本观察，修改原型并比较复测结果。', '纸面或电脑原型、虚构任务数据；无参与者时只做试运行。', '任务说明、匿名观察笔记、问题与修改依据。', ['把观察事实与解释分栏记录', '无参与者时标注为试运行而非用户验证', '说明小样本和虚构情境不能代表所有用户']],
 ['algorithm-basics', '搜索算法与复杂度探索', 'theory-algorithms', 'algorithms', ['python', 'discrete'], ['algorithm-analysis'], '用小规模样例比较顺序搜索与有序搜索的条件和操作次数。', '给出正确性说明，分析输入规模并用边界反例检查结论。', '自建有序与无序数据、Python 程序和操作计数器。', '实现、样例测试、操作计数表及正确性说明。', ['显式标出有序性等前提', '覆盖空输入、重复值与未找到情形', '区分运行耗时观察与渐近复杂度证明']],
 ['automata-basics', '有限自动机与语言探索', 'theory-algorithms', 'computability', ['discrete'], ['automata', 'proof'], '为一个简单字符串规则画出有限自动机并手工跟踪样例。', '说明状态含义与不变量，用论证和反例检查识别语言是否一致。', '一个明确的有限字母表和字符串接受规则；可用纸笔记录。', '状态转移表、正反样例轨迹与正确性解释。', ['给出初态、接受态和完整转移', '覆盖空串与边界反例', '说明样例通过不能替代语言等价证明']],
 ['http-basics', 'HTTP 请求响应探索', 'networks', 'http', [], ['http-semantics'], '在自有本地网页中辨认一次请求与响应的对应字段。', '比较正常、资源不存在和输入错误时的响应并解释边界。', '本地测试页面或服务、浏览器网络面板及虚构数据。', '脱敏请求响应记录、字段说明和状态对照表。', ['对应方法、路径、状态码与正文', '记录正常与失败响应的实际区别', '区分 HTTP 语义与底层传输、加密细节']],
 ['packet-basics', '本地协议数据观察', 'networks', 'wireshark', ['network'], ['packet-observation'], '阅读自己生成或允许分析的示例抓包，定位一次通信。', '比较过滤前后证据，说明观察支持和不能支持的排障假设。', '自有回环通信或公开教学抓包；Wireshark，可先离线读取。', '过滤条件、包字段记录及带证据边界的排障笔记。', ['写明抓包来源、接口与时间范围', '说明筛选条件及一次通信的对应关系', '不把加密载荷或缺失样本推断为已知内容']],
 ['testing-basics', '软件测试与回归探索', 'software-systems', 'pytest', ['python'], ['test-design'], '为简单函数写正常、边界与异常断言并观察失败报告。', '复现一个缺陷、修复并保留回归测试，解释仍未覆盖的行为。', '本地小函数、明确输入输出要求与 pytest。', '测试用例、失败复现、修正后的运行记录与覆盖边界。', ['预期结果来自需求说明而非抄实现', '包含实际失败再修复的对照', '明确测试通过不表示不存在缺陷']],
 ['version-history', '版本管理与变更追踪', 'software-systems', 'git', [], ['version-control'], '在独立练习仓库记录两次变化并比较文件历史。', '模拟误改，在隔离副本恢复指定版本并检查恢复结果。', '独立练习目录、Git 与虚构文本文件。', '提交记录、差异说明与隔离恢复结果。', ['能对应一次需求变化与文件差异', '在隔离目录验证恢复内容', '说明版本历史与团队协作质量、备份策略的区别']],
 ['sql-basics', '关系数据与 SQL 探索', 'data-science-systems', 'sql', [], ['relational-data'], '用小型虚构表格比较筛选、连接与聚合结果。', '加入空值与重复关联，解释查询语义及事务对结果的影响。', '本地 PostgreSQL、两张虚构小表和预期查询结果。', '建表与查询脚本、手工核对表和异常样例结果。', ['说明连接键与行数变化', '对照聚合前后及空值、重复值结果', '不把查询练习视为生产数据库运维验证']],
 ['table-inspection', '表格数据质量探索', 'data-science-systems', 'pandas', ['python'], ['table-quality'], '读取虚构 CSV，核对字段类型、缺失值与样例行。', '给出显式处理规则，保存处理前后差异并说明规则的适用范围。', '虚构 CSV、字段说明与 pandas；保留原始文件副本。', '字段检查表、转换脚本、前后差异与未解决问题。', ['记录实际类型及非空数量', '说明每条转换规则及丢失的信息', '区分描述性检查与统计推断、因果结论']],
 ['web-authorization', 'Web 授权与边界验证', 'security-crypto', 'websecurity', ['programming'], ['authorization'], '为本地示例定义用户、资源和允许或拒绝的权限矩阵。', '为自有示例补充跨用户与匿名访问测试，验证拒绝及错误处理。', '仅使用自有本地示例与虚构账号、数据；先列明权限规则。', '权限矩阵、正常和拒绝用例及修正后的回归结果。', ['区分身份确认与资源权限', '验证默认拒绝和跨用户访问边界', '说明局部授权测试不能证明系统整体安全']],
 ['threat-modeling', '系统威胁建模入门', 'security-crypto', 'threat', [], ['threat-model'], '为自有小应用画出资产、数据流和信任边界。', '将选定威胁转为可测试要求，复核缓解措施及残余风险。', '一个自有或教学系统说明、数据流与虚构资产清单。', '边界图、威胁—措施—检查项对应表和待核实清单。', ['威胁明确对应资产或信任边界', '缓解措施具有可复核的检查办法', '保留残余风险与未知，不把模型当作全面审计']]
];
for (const [key, name, domain, source, entry, stage, explore, deep, input, output, rubric] of topics) {
 node(key, 'subdomain', name, explore, { domain, resource: '电脑', cost: key.startsWith('ros-') ? '需要核对 ROS 2 安装条件；本版可先做软件模拟，无需购买机器人。' : '需要阅读、保留原始输入、记录失败和复测；首次尝试后校准投入。', methods: ['阅读列出的官方来源', ...rubric], explore, deep, limitations: '只验证列出的局部任务，不能证明整个领域、生产系统或职业能力。' }, source);
 edge(key, domain, 'belongs_to', source);
 const project = `project-${key}`;
 node(project, 'project', `${name}验证任务`, explore, { input, output, rubric, resource: '电脑', limits: '只提供本专题局部证据；不证明完整理论、真实硬件控制、生产安全或就业科研能力。' }, source);
 edge(project, key, 'belongs_to', source);
 for (const mode of ['explore', 'deep']) {
  const scope = `${key}:${mode}`, level = mode === 'deep' ? 3 : 2;
  for (const [index, kid] of [...entry, ...stage].entries()) {
   data.requirements.push({ id: `${scope}:${kid}`, topicId: key, mode, objectiveKey: scope, nodeId: kid, requiredLevel: level, importance: index < entry.length ? 'entry_required' : 'stage_required', minimumEvidence: mode === 'deep' ? 'practice' : 'self', sourceClaimIds: [`claim-${source}`], quality: 'verified' });
   const eid = edge(kid, project, 'prerequisite_of', source, [scope], level);
   data.clauses.push({ id: `clause:${scope}:${kid}`, targetId: project, scope, options: [eid] });
  }
 }
 for (const kid of [...entry, ...stage]) {
  edge(kid, project, 'applied_in', source);
  edge(kid, project, 'validated_by', source, [], 2, rubric);
 }
}
const scopes = {
 'ai-ml': ['数据与模型基础、现成模型使用', ['模型训练系统、强化学习和完整研究方法']],
 systems: ['Linux 起步与本地性能测量', ['体系结构、编译器和内核开发']],
 'cloud-distributed': ['复制故障模型与本地部署', ['大规模生产运维和完整一致性协议实现']],
 'embedded-iot': ['开发板工具链与设备消息链路', ['实时控制、电路设计和量产可靠性']],
 robotics: ['ROS 2 软件模拟中的节点、话题、服务与参数', ['运动学、闭环控制、SLAM 和真实机器人部署']],
 'graphics-visual': ['WebGL 上下文与图像数组操作', ['三维渲染、几何建模、视觉识别与重建']],
 'hci-media': ['初步可访问性检查与任务式可用性观察', ['完整 WCAG 评估、交互研究和音视频处理']],
 'theory-algorithms': ['搜索算法比较与有限自动机', ['高级算法、可计算性证明和复杂性理论']],
 networks: ['HTTP 语义与本地协议观察', ['路由交换、无线通信与大规模网络设计']],
 'security-crypto': ['密码理论切片、成熟库、Web 授权与威胁建模', ['二进制安全、应急响应及完整系统安全审计']],
 'software-systems': ['函数测试、回归与版本历史', ['需求工程、软件架构与团队交付管理']],
 'data-science-systems': ['关系数据查询与表格类型、缺失值检查', ['统计推断、数据仓库、流处理和数据治理']]
};
const tags = { robotics: ['软硬结合', '工程协作'], 'graphics-visual': ['界面产品', '数据分析'], 'hci-media': ['界面产品'], 'theory-algorithms': ['理论算法'], networks: ['网络排障'], 'software-systems': ['工程协作'], 'data-science-systems': ['数据分析'] };
for (const domain of data.nodes.filter(n => n.type === 'domain')) {
 const [scope, remaining] = scopes[domain.id];
 const children = data.nodes.filter(n => n.type === 'subdomain' && n.content.domain === domain.id);
 domain.content = { ...domain.content, coverage: 'complete', coverageScope: scope, remainingAreas: remaining, coverageTopicIds: children.map(n => n.id), coverageCriteria: '本版声明的每个入口均有来源、探索/深入目标、知识要求与验证项目；不表示整个学科已覆盖。', ...(tags[domain.id] ? { tags: tags[domain.id] } : {}) };
 domain.summary = `本版入口：${scope}。`;
 domain.sourceClaimIds = [...new Set(children.flatMap(n => n.sourceClaimIds))];
}
// 这些是可选导航入口，不是专业限制或自动前置。
for (const [domain, major, source] of [['robotics', 'cs', 'ros'], ['graphics-visual', 'cs', 'webgl'], ['hci-media', 'cs', 'access'], ['software-systems', 'cs', 'pytest'], ['theory-algorithms', 'data', 'algorithms']]) edge(domain, major, 'belongs_to', source);
for (const [a, b, source] of [['robotics', 'embedded-iot', 'ros'], ['graphics-visual', 'ai-ml', 'opencv'], ['hci-media', 'software-systems', 'access'], ['networks', 'security-crypto', 'websecurity'], ['data-science-systems', 'cloud-distributed', 'sql']]) edge(a, b, 'related_to', source);
const path = `knowledge/releases/${id}.json`, body = JSON.stringify(data, null, 2) + '\n';
if (existsSync(path) && readFileSync(path, 'utf8') !== body) throw new Error('发布内容已存在且不同，请升级 release ID');
writeFileSync(path, body);
console.log(`${id}: ${data.nodes.length} 节点，${data.edges.length} 关系，${data.nodes.filter(n => n.type === 'subdomain').length} 专题。`);
