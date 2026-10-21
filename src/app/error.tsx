'use client';
export default function ErrorPage({ reset }: {
    reset: () => void;
}) { return <div className="empty-state"><h1>这一页暂时没有加载成功</h1><p>已保存的资料仍在本地。可以重试或返回探索入口。</p><button className="button primary" onClick={reset}>重新加载</button></div>; }
