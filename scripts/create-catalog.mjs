// 维护源生成器。生成后 JSON 纳入版本控制；不得覆盖已发布数据库版本。
import { mkdirSync, writeFileSync } from 'node:fs';
const id='2026-10-20.2', date='2026-10-20';
const data={id,schemaVersion:1,createdAt:date,nodes:[],edges:[],requirements:[],clauses:[],sources:[],claims:[]};
const sources=[
 ['cs2023','计算机课程体系 CS2023','https://csed.acm.org/','ACM / IEEE-CS / AAAI','课程报告覆盖多个计算机知识领域；不是中国各校统一培养方案。'],
 ['ml','机器学习速成课程准备要求','https://developers.google.com/machine-learning/crash-course/prereqs-and-prework','Google','课程练习使用 Python，建议代数、线性代数、统计基础，微积分用于深入理解。'],
 ['torch','PyTorch 基础','https://docs.pytorch.org/tutorials/beginner/basics/intro.html','PyTorch','教程以基本 Python 和深度学习概念为背景，覆盖数据、模型、优化与保存。'],
 ['shell','计算机教育缺失的一课','https://missing.csail.mit.edu/','MIT','课程涉及命令行、开发工具、调试与性能分析。'],
 ['perf','Linux 性能分析','https://www.brendangregg.com/linuxperf.html','Brendan Gregg','性能分析需要结合系统指标、工具和测量上下文。'],
 ['dist','分布式系统 6.5840','https://pdos.csail.mit.edu/6.824/','MIT','课程讨论容错、复制和一致性，包含编程实验。'],
 ['k8s','Kubernetes 基础','https://kubernetes.io/docs/tutorials/kubernetes-basics/','Kubernetes','基础教程覆盖部署、探索、扩缩容、更新应用。'],
 ['esp','ESP-IDF 开始使用','https://docs.espressif.com/projects/esp-idf/en/stable/esp32/get-started/','Espressif','硬件、工具链、构建、烧录和监视是设备起步流程。'],
 ['crypto','应用密码学教材','https://toc.cryptobook.us/','Dan Boneh / Victor Shoup','教材覆盖对称密码、公钥密码及安全论证；具体数学要求仍需逐章核验。'],
 ['aead','认证加密 API','https://cryptography.io/en/latest/hazmat/primitives/aead/','Python Cryptographic Authority','认证加密同时涉及机密性与完整性，nonce 重复与标签验证失败需正确处理。'],
 ['data-major','数据科学与大数据技术培养方案','https://www.sc.sdu.edu.cn/info/1018/5876.htm','山东大学','专业结合数学统计、计算机与数据采集处理分析能力。'],
 ['bupt','本科专业介绍','https://scs.bupt.edu.cn/info/1015/1605.htm','北京邮电大学','网络工程重视计算机与网络工程实践；软件工程涵盖程序开发、系统、网络通信及工程核心课程。仅为校级示例。'],
 ['jnu','网络空间安全本科培养方案','https://cybsec.jnu.edu.cn/2023/1116/c39603a781291/page.htm','暨南大学','本科核心包含程序设计、密码学、计算机网络、操作系统和数学基础；实践包括应用密码学等实验。'],
 ['crypto-math','密码学课程入口要求','https://www.cse.ust.hk/faculty/cding/COMP3631/','香港科技大学','该课程要求离散数学或相似数学背景。此应用据此设计理论阅读前的知识诊断，不据课程成绩判断长期适合。'],
 ['crypto-advanced','密码学与安全课程数学背景','https://www.cse.ust.hk/faculty/cding/COMP5631/','香港科技大学','这门研究生课程要求离散数学、初等数论与网络基础。仅用于深入数学阅读的准备参考。'],
 ['crypto-book','密码学教材第二章','https://toc.cryptobook.us/book.pdf','Dan Boneh / Victor Shoup','第二章使用概率定义安全性并给出证明。应用选择解释安全目标与检查论证作为验证任务；不把整个研究生教材作为入门门槛。'],
 ['openssl','EVP 认证加密接口','https://docs.openssl.org/3.5/man3/EVP_EncryptInit/','OpenSSL','EVP 提供 C 语言加解密及认证加密接口，需处理附加认证数据、标签和验证结果。']
];
for(const [key,title,url,publisher,text] of sources){data.sources.push({id:key,title,url,publisher,accessedAt:date,tier:'primary',status:'verified'});data.claims.push({id:`claim-${key}`,text,sourceIds:[key],quality:'verified',note:'已阅读来源；课程活动与行为等级的映射是本应用的可审查设计，不是来源给出的通用能力标准。'});}
function node(key,type,name,summary,content={},source='cs2023',verified=true){const n={id:key,type,name,summary,aliases:[],content,sourceClaimIds:[`claim-${source}`],quality:verified?'verified':'draft',verifiedAt:verified?date:null,releaseId:id};data.nodes.push(n);return n;}
function edge(from,to,type='belongs_to',source='cs2023',scope=[],requiredLevel=2,verified=true){const e={id:`${type}:${from}:${to}:${scope.join(',')}`,from,to,type,explanation:type==='prerequisite_of'?'仅适用于列明目标与任务，不代表所有学习活动均需此前置。':'用于导航或提供该活动的局部证据，不自动认定掌握。',scope,requiredLevel,sourceClaimIds:[`claim-${source}`],quality:verified?'verified':'draft',verifiedAt:verified?date:null,releaseId:id,rubric:type==='validated_by'?['解释输入条件','记录产出和可重复检查','说明未能验证的部分']:[]};data.edges.push(e);return e.id;}
const majors=[
 ['cs','计算机科学与技术','从算法到系统，理解计算如何发生。',['算法推理','系统抽象','程序设计'],['数据结构：组织数据','算法：分析问题','操作系统：管理资源','计算机网络：连接系统','数据库：持久化数据'],['较高','较高','较高'],['ai-ml','systems','theory-algorithms','cloud-distributed'],'软件研发、系统与算法相关探索','广度大，需要通过具体问题逐步聚焦'],
 ['net','网络工程','研究系统之间如何连接、传输与可靠协作。',['协议理解','网络排障','网络设计'],['计算机网络：理解协议','路由交换：组织连通','操作系统：理解主机','程序设计：实现工具','网络安全：识别风险'],['中等','较高','较高'],['networks','cloud-distributed','security-crypto','embedded-iot'],'网络系统、基础设施与协议相关探索','需要耐心排查跨层问题'],
 ['sec','网络空间安全','理解可信边界，分析系统与信息的风险。',['威胁分析','安全验证','协议理解'],['密码学：理解安全机制','计算机网络：理解通信','操作系统：理解边界','程序设计：分析实现','离散数学：支撑论证'],['较高','较高','较高'],['security-crypto','systems','networks'],'安全工程、密码与系统安全相关探索','需要授权意识、严谨验证和持续补基础'],
 ['data','数据科学与大数据技术','把数据变成可以检验的问题与结论。',['数据建模','统计分析','数据处理'],['概率统计：表达不确定性','线性代数：表达数据','数据库：组织数据','机器学习：建模预测','程序设计：实现分析'],['较高','较高','较高'],['ai-ml','data-science-systems','cloud-distributed'],'数据分析、数据工程与建模相关探索','数据质量与假设检验往往比调用工具更费精力'],
 ['se','软件工程','让软件在真实约束下可靠地演进。',['需求分析','协作设计','质量保障'],['软件需求：澄清问题','软件设计：组织边界','软件测试：收集质量证据','数据库：管理数据','项目实践：理解协作'],['中等','较高','较高'],['software-systems','cloud-distributed','hci-media','ai-ml'],'软件开发、质量与工程方法相关探索','沟通、维护与权衡贯穿整个过程']
];
for(const [key,name,summary,abilities,courses,intensity,domains,outlets,cost] of majors){node(key,'major',name,summary,{abilities,courses,intensity,domains,outlets,cost,misconceptions:['专业名称不等于固定职业','修过课程不等于能够独立应用','基础薄弱不代表长期不适合'],path:['理解课程和问题范围','选择一个领域的具体入口','通过小项目验证并修正方向']},key==='data'?'data-major':key==='net'||key==='se'?'bupt':key==='sec'?'jnu':'cs2023');}
const domains=[
 ['ai-ml','人工智能与机器学习','complete',['智能模型','数据分析'],'从数据与模型中寻找可检验的规律。'],
 ['systems','计算机系统与底层技术','complete',['系统性能'],'理解程序、操作系统与硬件如何共同工作。'],
 ['cloud-distributed','云计算与分布式系统','complete',['工程协作','网络排障'],'面对多节点、故障与资源管理的工程问题。'],
 ['embedded-iot','嵌入式系统与物联网','complete',['软硬结合'],'把计算连接到设备与现实信号。'],
 ['robotics','机器人与智能系统','planned',['软硬结合'],'尚未扩充'],['graphics-visual','计算机图形学与视觉计算','planned',[],'尚未扩充'],['hci-media','人机交互与数字媒体技术','planned',[],'尚未扩充'],['theory-algorithms','计算理论与算法','planned',[],'尚未扩充'],['networks','计算机网络与通信','planned',[],'尚未扩充'],
 ['security-crypto','网络安全与密码学','partial',['安全攻防','理论算法'],'本版仅覆盖密码学探索与密码工程入口。'],['software-systems','软件工程与软件系统','planned',[],'尚未扩充'],['data-science-systems','数据系统与数据科学','planned',[],'尚未扩充']
];
for(const [key,name,coverage,tags,summary] of domains){node(key,'domain',name,summary,{coverage,tags,preferences:['engineering','research']});for(const major of data.nodes.filter(n=>n.type==='major'&&n.content.domains.includes(key)))edge(key,major.id);}
edge('systems','cloud-distributed','related_to','dist');edge('embedded-iot','security-crypto','related_to','aead');edge('ai-ml','data-science-systems','related_to','ml');
const knowledge=[
 ['programming','程序设计与测试','能够解释控制流程、处理输入输出并记录检查结果。','shell'],['c','C / C++ 基础','能阅读和修改简单程序，区分语言基础与设备经验。','esp'],['python','Python 基础','能解释函数、容器和简单数据操作。','ml'],['linear','线性代数基础','理解向量、矩阵与线性运算。','ml'],['probability','概率与统计基础','理解随机性、条件概率与统计摘要。','ml'],['discrete','离散数学基础','理解集合、逻辑与离散结构；不等同完整数论。','crypto'],['proof','数学证明基础','能够检查论证的假设与推理步骤。','crypto'],['number-theory','数论基础','理解模运算等代数背景。','crypto'],['network','计算机网络基础','解释主机间通信与协议分层。','dist'],['linux','Linux 与命令行','能使用命令行检查文件、进程和环境。','shell'],['measurement','系统测量与实验记录','区分指标、假设、实验与结论。','perf'],['containers','容器与应用部署','理解应用实例、镜像与部署状态。','k8s'],['distributed','复制与故障模型','理解多节点状态与故障假设。','dist'],['electronics','设备与电路基本安全','核对板卡、供电、接口与连接说明。','esp'],['toolchain','嵌入式工具链','区分编译、烧录与监视。','esp'],['aead','认证加密与安全使用','理解机密性、完整性、nonce 与验证失败。','aead'],['model-eval','模型评估基础','区分训练数据与测试证据，记录误差和局限。','torch']
];
for(const [key,name,summary,source] of knowledge)node(key,key==='measurement'||key==='toolchain'?'skill':'knowledge',name,summary,{diagnostic:`用一个小例子解释「${name}」，记录能独立完成与仍需帮助的部分。`},source);
const topics=[
 ['ml-foundations','机器学习基础探索','ai-ml','比较简单模型与基线，检查数据和误差。','ml',['python','linear','probability'],['model-eval'],'小型数据集基线比较','一份数据划分、基线和误差解释报告','电脑'],
 ['ai-apps','AI 应用与模型使用探索','ai-ml','理解现成模型的输入、输出和使用边界。','torch',['python'],['model-eval'],'现成模型误差观察','固定样例的输出、失败情形和使用边界说明','电脑'],
 ['linux-basics','操作系统与 Linux 基础探索','systems','解释进程、文件与命令行环境。','shell',['programming'],['linux'],'命令行环境观察','命令记录、进程与文件关系说明','电脑'],
 ['systems-performance','系统性能分析','systems','用测量检验一个性能瓶颈假设。','perf',['linux'],['measurement'],'本地进程指标观察','带假设与复测的测量报告','电脑'],
 ['distributed-basics','分布式系统基础','cloud-distributed','辨认复制、故障与一致性的取舍。','dist',['programming','network'],['distributed'],'复制状态与故障情景记录','不同故障假设下的状态变化及解释','电脑'],
 ['cloud-ops','云服务部署与运维基础','cloud-distributed','在本地环境观察应用部署与更新。','k8s',['linux'],['containers'],'本地应用生命周期观察','部署、扩缩和更新的状态记录；无需购买云服务','电脑'],
 ['embedded-basics','嵌入式开发基础','embedded-iot','核对工具链、板卡输入和运行现象。','esp',['c','electronics'],['toolchain'],'开发板构建与监视记录','构建日志、设备输出和条件说明','开发板'],
 ['iot-basics','物联网系统入门','embedded-iot','区分设备、传输和接收端的职责。','esp',['c','electronics'],['network','toolchain'],'设备消息链路观察','设备输出与链路故障检查表','开发板'],
 ['modern-crypto','现代密码学探索','security-crypto','区分加密、认证与攻击者模型。','crypto',['discrete','probability'],['proof'],'安全目标与反例辨识','两种安全目标、假设与反例的解释记录','电脑'],
 ['crypto-engineering','密码工程应用入门','security-crypto','通过成熟库观察认证加密成功与失败。','aead',['programming'],['aead'],'认证加密输入与篡改验证','记录正常输入、被篡改输入和错误处理；不自行设计密码算法','电脑']
];
for(const [key,name,domain,summary,source,entry,stage,project,output,resource] of topics){
 node(key,'subdomain',name,summary,{domain,resource,cost:resource==='开发板'?'需要兼容设备和实际连接条件，可先核对资源再决定。':'需要阅读文档、记录失败与复测；任务规模由首次尝试校准。',methods:['阅读来源并提出可检验的问题','控制输入并记录观察','解释假设、反例与局限'],explore:summary,deep:`在已验证基础上，进一步解释「${name}」的机制与复杂情形。`,limitations:'项目只提供局部证据，不能证明就业或科研准备充分。'},source);
 edge(key,domain); const pid=`project-${key}`;
 node(pid,'project',project,summary,{input:`核对本专题已列明的起步要求和${resource}资源。`,output,rubric:['明确输入、环境与假设','保存可重复检查的产出','解释至少一个失败或反例','说明独立完成范围与未验证部分'],limits:'不能证明全部理论掌握、生产安全、职业胜任或研究创新。',resource},source);
 edge(pid,key);
 for(const mode of ['explore','deep']){
   const scope=`${key}:${mode}`;
   for(const [index,kid] of [...entry,...stage,...(mode==='deep'&&key==='modern-crypto'?['number-theory']:[])].entries()){
     const importance=index<entry.length?'entry_required':'stage_required';
     const verified=true;
     const reqSource=key==='modern-crypto'?(kid==='discrete'?'crypto-math':kid==='number-theory'?'crypto-advanced':'crypto-book'):source;
     data.requirements.push({id:`${scope}:${kid}`,topicId:key,mode,objectiveKey:scope,nodeId:kid,requiredLevel:mode==='deep'?3:2,importance,minimumEvidence:mode==='deep'?'practice':'self',sourceClaimIds:[`claim-${reqSource}`],quality:verified?'verified':'draft'});
     const eid=edge(kid,pid,'prerequisite_of',reqSource,[scope],mode==='deep'?3:2,verified);
     data.clauses.push({id:`clause:${scope}:${kid}`,targetId:pid,scope,options:[eid]});
     if(!data.edges.some(e=>e.from===kid&&e.to===pid&&e.type==='validated_by')){edge(kid,pid,'applied_in',reqSource);edge(kid,pid,'validated_by',reqSource,[],2);}
   }
   const optional=key==='crypto-engineering'?'network':key==='ml-foundations'?'programming':'measurement';
   data.requirements.push({id:`${scope}:optional-${optional}`,topicId:key,mode,objectiveKey:scope,nodeId:optional,requiredLevel:2,importance:'optional',minimumEvidence:'self',sourceClaimIds:[`claim-${source}`],quality:'verified'});
 }
}
// 密码工程项目允许 C/OpenSSL 或 Python/cryptography；不从专业推断语言能力。
for(const mode of ['explore','deep']){
 const scope=`crypto-engineering:${mode}`,project='project-crypto-engineering';
 const old=data.edges.find(e=>e.type==='prerequisite_of'&&e.from==='programming'&&e.to===project&&e.scope.includes(scope));
 data.requirements=data.requirements.filter(q=>!(q.objectiveKey===scope&&q.nodeId==='programming'));
 data.edges=data.edges.filter(e=>e.id!==old.id);data.clauses=data.clauses.filter(c=>!c.options.includes(old.id));
 const c=edge('c',project,'prerequisite_of','openssl',[scope],mode==='deep'?3:2),p=edge('python',project,'prerequisite_of','aead',[scope],mode==='deep'?3:2);
 data.clauses.push({id:`clause:${scope}:language`,targetId:project,scope,options:[c,p]});
 for(const [kid,source] of [['c','openssl'],['python','aead']])if(!data.edges.some(e=>e.type==='validated_by'&&e.from===kid&&e.to===project))edge(kid,project,'validated_by',source,[],2);
}
data.nodes.find(n=>n.id==='data').aliases=['大数据'];
mkdirSync('knowledge/releases',{recursive:true});writeFileSync(`knowledge/releases/${id}.json`,JSON.stringify(data,null,2)+'\n');
console.log(`已生成 ${data.nodes.length} 节点、${data.edges.length} 关系。等级与项目 rubric 是应用行为标准，非外部认证。`);
