import type { Metadata } from 'next';
import { AppProvider } from '@/components/provider';
import { Shell } from '@/components/shell';
import './globals.css';
export const metadata: Metadata = { title: '方向卡 · 计算机学习探索指南', description: '认识计算机专业与技术领域，复用已有知识，用小项目验证下一步。' };
export const dynamic = 'force-dynamic';
export default function RootLayout({ children }: {
    children: React.ReactNode;
}) { return <html lang="zh-CN"><body><AppProvider><Shell>{children}</Shell></AppProvider></body></html>; }
