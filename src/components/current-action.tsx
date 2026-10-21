'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { PathView } from '@/db/store';
import { getRelease } from '@/core/catalog';
import { actionGuide } from '@/core/action-guide';
import { useAction, useApp } from './provider';
import { BulletList } from './ui';

export function CurrentAction({ path }: { path: PathView }) {
  const { mutate } = useApp(), { busy, message, run, setMessage } = useAction();
  const [stepIndex, selectStep] = useState(0);
  const [form, setForm] = useState({ environment: '', expected: '', actual: '', independent: '', limits: '', minutes: 0 });
  const plan = path.versions.find(v => v.version === path.version)?.plan;
  if (!plan) return null;
  if (plan.hours <= 0 || plan.status === 'blocked' || !plan.steps.length || plan.missingResources?.length) return <section className="panel"><h2>当前先核对条件</h2><p>{plan.hours <= 0 ? '每周预算为 0，先保留目标，不安排实践行动。' : '当前路线缺少行动条件，先核对资源和路线中的提示。'}</p><Link className="button" href={`/transfer/${path.id}`}>核对路线条件</Link></section>;
  const step = plan.steps[stepIndex] ?? plan.steps[0];
  const archive = getRelease(plan.knowledgeRelease), node = archive?.nodes.find(n => n.id === step.nodeId);
  const guide = node?.type === 'project' ? actionGuide(node) : null;
  const minutes = step.minutes === null ? null : Math.min(step.minutes, plan.hours * 60);
  const fields = [['environment', '环境与输入条件'], ['expected', '原先预期与完成标准'], ['actual', '实际产出与失败现象'], ['independent', '独立完成范围'], ['limits', '尚未验证与下一步']] as const;
  return <section className="panel" aria-label="当前行动"><h2>今天先做什么</h2><p>默认展示已保存路线的第一步。已有证据时可以手动选择其他行动；选择和回报都不表示知识已达标。</p>
    <label className="form-field"><span>本次行动</span><select aria-label="本次行动" value={stepIndex} onChange={e => { selectStep(Number(e.target.value)); setForm({ environment: '', expected: '', actual: '', independent: '', limits: '', minutes: 0 }); setMessage(''); }}>{plan.steps.map((s, i) => <option key={`${i}-${s.nodeId}`} value={i}>{i + 1}. {s.action}</option>)}</select></label>
    <h3>{step.action}</h3><p>{step.condition}</p><p>{guide?.start ?? `先核对「${node?.name ?? step.nodeId}」的现有记录，保存一项能复查的输入与实际结果；不确定的能力先保留未知。`}</p>
    <p className="muted">本次尝试预算：{minutes === null ? '按每周可用预算自行设定' : `${minutes} 分钟以内`}；每周总预算 {plan.hours} 小时。时间盒用于控制投入，不是完成工期。</p>
    {guide ? <details><summary>开始条件与交付标准</summary><h3>开始条件</h3><BulletList items={guide.prerequisites}/><h3>交付证据</h3><BulletList items={guide.deliverables}/><h3>完成时核对</h3><BulletList items={guide.acceptance}/><h3>卡住后怎么办</h3><BulletList items={guide.recovery}/></details> : <p>记录条件、预期、实际结果及不能证明的部分；若无法开始，先保存具体缺项，不强行执行后续项目。</p>}
    <details><summary>记录本次行动证据</summary><p>只填写文字记录，不上传文件。证据保存后仍需本人核对知识等级与路线。</p><div className="form-grid">{fields.map(([key, label]) => <label className="form-field" key={key}><span>{label}</span><textarea maxLength={500} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })}/></label>)}<label className="form-field"><span>实际投入（分钟）</span><input type="number" min={0} max={10080} value={form.minutes} onChange={e => setForm({ ...form, minutes: Number(e.target.value) })}/></label></div>
    <button className="button primary" disabled={busy || fields.some(([key]) => !form[key].trim()) || !Number.isFinite(form.minutes) || form.minutes < 0 || form.minutes > 10080} onClick={() => void run(async () => { await mutate({ action: 'attempt', pathId: path.id, content: `${step.action}\n${form.actual}`, evidence: { ...form, pathVersion: path.version, stepIndex } }); setForm({ environment: '', expected: '', actual: '', independent: '', limits: '', minutes: 0 }); setMessage('行动证据已保存；知识等级与路线未自动改变。'); })}>保存行动证据</button></details>
    <p role="status">{message}</p><Link className="text-link" href={`/knowledge?topic=${path.topic_id}`}>带着证据核对知识自评 →</Link>
  </section>;
}
