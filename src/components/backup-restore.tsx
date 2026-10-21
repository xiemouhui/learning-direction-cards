'use client';
import { useState } from 'react';
import { useAction, useApp } from './provider';
import type { Assessment } from '@/core/schema';
type Preview = { hash: string; exportedAt: string; knowledgeCount: number; pathCount: number; recordCount: number; knowledgeRelease: string };
export function BackupRestore() {
  const { state, mutate } = useApp(), { busy, message, setMessage, run } = useAction();
  const [backup, setBackup] = useState<unknown>(null), [preview, setPreview] = useState<Preview | null>(null), [confirmation, setConfirmation] = useState('');
  return <section className="panel"><h2>从备份恢复个人资料</h2>
    <p>选择本应用导出的 JSON，先预览再确认。只恢复到空白身份，现有资料不会被覆盖。清 Cookie 后的新身份可用此功能找回备份中的记录。</p>
    <p className="muted">文件只发给本机服务，不上传第三方。不恢复 Key、API 余额或内部调用日志；模型与搜索默认关闭。若备份含问卷草稿，确认恢复会替换本浏览器的草稿。请保留原始备份。</p>
    <label className="form-field"><span>选择个人资料备份 JSON（最多 4 MB）</span><input aria-label="选择个人资料备份 JSON" type="file" accept=".json,application/json" disabled={busy} onChange={e => {
      const file = e.target.files?.[0]; setPreview(null); setBackup(null); setConfirmation(''); setMessage('');
      if (!file) return;
      void run(async () => {
        if (file.size > 4 * 1024 * 1024) throw new Error('备份超过 4 MB，请保留原文件，暂不支持此规模。');
        let parsed: unknown; try { parsed = JSON.parse(await file.text()); } catch { throw new Error('文件不是有效的 JSON。'); }
        const result = await mutate<Preview>({ action: 'restorePreview', backup: parsed }); setBackup(parsed); setPreview(result);
      });
    }}/></label>
    {preview && <div className="confirmation"><h3>核对恢复内容</h3><p>备份时间：{new Date(preview.exportedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</p><p>知识 {preview.knowledgeCount} 项 · 路线 {preview.pathCount} 条 · 历史记录 {preview.recordCount} 条</p><p>知识版本：{preview.knowledgeRelease}。历史路线保留原版本，后续调整另行确认。</p>
      <label className="form-field"><span>输入“恢复到空白身份”继续</span><input aria-label="恢复确认文字" value={confirmation} onChange={e => setConfirmation(e.target.value)}/></label>
      <button className="button primary" disabled={busy || !state || confirmation !== '恢复到空白身份'} onClick={() => void run(async () => {
        const result = await mutate<{ browserDraft: Assessment | null }>({ action: 'restore', backup, hash: preview.hash, baseVersion: state!.version, confirmation });
        let draftNotice = '';
        if (result.browserDraft) { try { localStorage.setItem('direction-assessment-v1', JSON.stringify(result.browserDraft)); } catch { draftNotice = '浏览器草稿未能保存，请保留原备份。'; } }
        setPreview(null); setBackup(null); setConfirmation(''); setMessage(`备份已恢复。模型与搜索保持关闭，请到知识画像和工作台核对。${draftNotice}`);
      })}>确认恢复备份</button>
    </div>}
    <div role="status" className="status-message">{message}</div>
  </section>;
}
