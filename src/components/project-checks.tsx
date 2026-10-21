import type { Node } from '@/core/schema';
import { contentList } from '@/core/catalog';
import { BulletList } from './ui';
import { actionGuide } from '@/core/action-guide';
export function ProjectChecks({ project }: { project: Node }) {
  const content = project.content;
  const guide = actionGuide(project);
  const stages = Array.isArray(content.stages) ? content.stages as { name: string; output: string; check: string }[] : [];
  return <>
    {guide && <details><summary>开始条件、交付证据与验收</summary><h3>先做这一件事</h3><p>{guide.start}</p><h3>开始前核对</h3><BulletList items={guide.prerequisites}/><h3>需要交付</h3><BulletList items={guide.deliverables}/><h3>完成时核对</h3><BulletList items={guide.acceptance}/><h3>卡住后怎么办</h3><BulletList items={guide.recovery}/></details>}
    {!!content.example && <><h3>固定输入样例</h3><p>{String(content.example)}</p></>}
    {!!content.expected && <><h3>预期结果与对照</h3><p>{String(content.expected)}</p></>}
    {contentList(content.failureChecks).length > 0 && <><h3>失败时先检查</h3><BulletList items={contentList(content.failureChecks)} /></>}
    {stages.length > 0 && <><h3>分阶段产出</h3>{stages.map((stage, i) => <details key={stage.name}><summary>{i + 1}. {stage.name}</summary><p>产出：{stage.output}</p><p>检查：{stage.check}</p></details>)}<p className="muted">每次只在本周预算内推进一项，记录实际耗时；未完成可续接。阶段完成不自动提高掌握等级。这些任务为应用设计，尚未经独立教育评估。</p></>}
  </>;
}
