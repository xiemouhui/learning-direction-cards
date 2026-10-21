'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Assessment, assessmentSchema } from '@/core/schema';
import { useAction, useApp } from './provider';
import { PageHeading } from './ui';
const questions = [['你现在处于什么学习阶段？', '可以写年级、专业或跨专业经历。专业只作背景，不决定知识等级。'], ['你的数学基础如何？', '可以写接触过的内容；具体掌握程度稍后单独确认。'], ['有哪些编程、网络、数据或工程实践？', '课程和工具只记录经历，不自动认定掌握。'], ['你喜欢进行哪些活动？', '可在下方选择喜欢或当前不喜欢的活动。未知可以不选。'], ['一次有成就感的经历', '写真实经历；没有或暂时想不到也可以跳过。'], ['一次困难或痛苦的经历', '描述具体活动与阻碍，不把一次困难当作长期不适合。'], ['每周可以投入多少时间？', '0 小时会保存目标，但不安排正时长行动；不会降低兴趣判断。'], ['你希望通过探索达成什么？', '比如理解一个研究问题、完成一次小验证或澄清方向。'], ['你偏好哪类活动？', '偏研究、偏工程或还不确定，都可以继续探索。'], ['还有哪些现实约束？', '例如设备、资源、可用环境；无需填写敏感个人信息。']];
export const tags = ['理论算法', '系统性能', '网络排障', '安全攻防', '数据分析', '智能模型', '软硬结合', '界面产品', '工程协作'];
const initial: Assessment = { schemaVersion: 1, answers: Array(10).fill(''), positive: [], negative: [], preference: 'unknown', hours: null };
export function Assess() {
    const { state, mutate } = useApp(), { busy, message, run } = useAction(), router = useRouter();
    const [draft, setDraft] = useState<Assessment>(initial), [step, setStep] = useState(0), [restored, setRestored] = useState(false);
    useEffect(() => { try {
        const saved = localStorage.getItem('direction-assessment-v1');
        if (saved) {
            const p = assessmentSchema.safeParse(JSON.parse(saved));
            if (p.success)
                setDraft(p.data);
        }
        else if (state?.assessment)
            setDraft(state.assessment);
    }
    catch { /* 草稿损坏不影响重新填写。 */ } setRestored(true); }, [state?.assessment]);
    function update(next: Assessment) { setDraft(next); localStorage.setItem('direction-assessment-v1', JSON.stringify(next)); }
    function toggle(tag: string, key: 'positive' | 'negative') { update({ ...draft, [key]: draft[key].includes(tag) ? draft[key].filter(x => x !== tag) : [...draft[key], tag] }); }
    async function submit() { await run(async () => { const result = await mutate<{
        assessmentId: string;
    }>({ action: 'assessment', assessment: draft }); localStorage.removeItem('direction-assessment-v1'); router.push('/result/' + result.assessmentId); }); }
    return <><PageHeading eyebrow="先了解自己，再选择入口" title="梳理我的学习起点" description="十个问题都可以跳过。自由文本只保存经历，不会直接认定你掌握知识或改变兴趣标签。"/><div className="panel"><div className="section-heading"><span className="muted">第 {step + 1} / 10 题</span><span className="muted">{restored ? '草稿保存在当前浏览器' : '正在读取草稿…'}</span></div><div className="progress-track"><span style={{ width: `${(step + 1) * 10}%` }}/></div><h2>{questions[step][0]}</h2><p>{questions[step][1]}</p><label className="form-field"><span>补充说明（选填）</span><textarea aria-label={questions[step][0]} maxLength={500} value={draft.answers[step]} onChange={e => { const answers = [...draft.answers]; answers[step] = e.target.value; update({ ...draft, answers }); }}/><small>{draft.answers[step].length} / 500 字</small></label>
 {step === 3 && <>{(['positive', 'negative'] as const).map(key => <fieldset key={key}><legend>{key === 'positive' ? '喜欢／愿意尝试' : '当前不喜欢／体验较弱'}</legend><div className="inline-options">{tags.map(tag => <label key={tag}><input type="checkbox" checked={draft[key].includes(tag)} onChange={() => toggle(tag, key)}/>{tag}</label>)}</div></fieldset>)}</>}
 {step === 6 && <label className="form-field"><span>每周预算（小时）</span><input type="number" min={0} max={80} value={draft.hours ?? ''} onChange={e => update({ ...draft, hours: e.target.value === '' ? null : Number(e.target.value) })}/><small>留空表示未知。</small></label>}
 {step === 8 && <label className="form-field"><span>活动偏好</span><select value={draft.preference} onChange={e => update({ ...draft, preference: e.target.value as Assessment['preference'] })}><option value="unknown">还不确定</option><option value="research">偏研究与理论分析</option><option value="engineering">偏工程与实践验证</option></select></label>}
 <div className="actions"><button className="button" disabled={step === 0 || busy} onClick={() => setStep(step - 1)}><ArrowLeft size={16}/>上一题</button>{step < 9 ? <><button className="button primary" onClick={() => setStep(step + 1)}>下一题<ArrowRight size={16}/></button><button className="text-link" onClick={() => setStep(step + 1)}>暂时跳过</button></> : <button className="button primary" disabled={busy} onClick={() => void submit()}>{busy ? '正在保存…' : '保存并查看三维建议'}<ArrowRight size={16}/></button>}<button className="text-link" disabled={busy} onClick={() => void submit()}>用当前信息看结果</button></div><div className="status-message" role="status">{message}</div></div></>;
}
