'use client';
import Link from 'next/link';
import { DomainList, CatalogDetail } from './catalog-pages';
import { Assess } from './assess';
import { KnowledgePage } from './knowledge';
import { Results } from './results';
import { Transfer, PathDetail } from './transfer';
import { Dashboard } from './dashboard';
import { Compare } from './compare';
import { Settings } from './settings';
import { Advisor } from './advisor';
import { Empty, PageHeading, SourceList } from './ui';
export function Workspace({ slug }: {
    slug: string[];
}) { const [route, id] = slug; if (route === 'directions' && id)
    return <CatalogDetail type="major" id={id}/>; if (route === 'domains')
    return id ? <CatalogDetail type="domain" id={id}/> : <DomainList />; if (route === 'topics' && id)
    return <CatalogDetail type="subdomain" id={id}/>; if (route === 'assess')
    return <Assess />; if (route === 'knowledge')
    return <KnowledgePage />; if (route === 'result')
    return <Results id={id}/>; if (route === 'transfer')
    return id ? <PathDetail id={id}/> : <Transfer />; if (route === 'dashboard')
    return <Dashboard />; if (route === 'compare')
    return <Compare />; if (route === 'settings')
    return <Settings />; if (route === 'advisor')
    return <Advisor />; if (route === 'about')
    return <><PageHeading eyebrow="方法、来源与局限" title="关于方向卡" description="用证据辅助决定，不替你决定。软件测试证明实现符合规则，不证明知识关系普遍成立或推荐具有统计预测准确率。"/><section className="panel"><h2>如何形成建议</h2><p>活动兴趣决定探索优先级；具体任务要求与已确认知识决定当前准备；兴趣、知识与约束三组信息决定证据覆盖。三项独立，不合成适配分。</p><p>未知先验证，明确不足才补基础。课程只记经历，任务只记回报；掌握等级需要本人确认。知识变化和路线采用分别确认，旧版本保留。</p><h2>当前版本的诚实边界</h2><p>目录已有五专业、十二领域与二十六专题。专业说明已参考高校本科资料，密码学数学背景已参考官方课程与教材。具体行为等级和项目 rubric 仍是应用设计，未经过独立教育评估。十二领域均有入门切片；每个领域列出本版范围与尚未覆盖方向，不表示穷尽学科。</p><p>已支持 DeepSeek / ChatGPT 模型选择和按需检索，默认需本人配置并启用。DeepSeek 最小模型与余额查询已通过，社区搜索仅验证了 Bilibili 的有限标题相关结果；其他平台质量、领域进阶内容与独立用户评估仍待验收。模型与检索失败时使用本地依据。</p><div className="actions"><Link className="button" href="/advisor">打开学习顾问</Link><Link className="button" href="/settings">隐私与资料管理</Link></div></section><SourceList /></>; return <Empty title="没有找到这个页面" description="从方向目录继续探索，或返回学习工作台。" href="/" label="返回探索入口"/>; }
