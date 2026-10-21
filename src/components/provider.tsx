'use client';
import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import type { AppState } from '@/db/store';
type Context = {
    state: AppState | null;
    error: string;
    loading: boolean;
    refresh: () => Promise<void>;
    mutate: <T = Record<string, unknown>>(body: unknown) => Promise<T>;
};
const AppContext = createContext<Context | null>(null);
let opening: Promise<void> | undefined;
function authorizeLocalSession() {
    const token = new URLSearchParams(window.location.hash.slice(1)).get('local-access');
    if (!token) return opening ?? Promise.resolve();
    const cleanUrl = window.location.pathname + window.location.search;
    window.history.replaceState(null, '', cleanUrl);
    const previous = opening;
    const pending = (async () => {
        if (previous) await previous.catch(() => {});
        let response: Response;
        try { response = await fetch('/api/local-session', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-app-request': '1' }, body: JSON.stringify({ token }), cache: 'no-store' }); }
        catch { throw new Error('无法连接本地服务。请确认服务仍在运行，再重新运行 pnpm open 或双击免安装包的启动入口。'); }
        if (!response.ok) throw new Error('本机授权已过期或已使用。请重新运行 pnpm open 或双击免安装包的启动入口；刷新页面或手动输入普通网址不能重新授权。');
        // Recreate the router cache from a clean URL. Initial route cache entries
        // in Next can otherwise restore the original fragment on later visits.
        window.location.replace(cleanUrl);
    })();
    opening = pending;
    void pending.finally(() => {
        if (opening === pending) {
            opening = undefined;
            // Initial child effects run before Next installs its history bridge.
            // Repeat after the exchange so the router also forgets the capability.
            if (window.location.pathname + window.location.search === cleanUrl && !window.location.hash) window.history.replaceState(null, '', cleanUrl);
        }
    }).catch(() => {});
    return opening;
}
export function AppProvider({ children }: {
    children: ReactNode;
}) {
    const [state, setState] = useState<AppState | null>(null), [error, setError] = useState(''), [loading, setLoading] = useState(true);
    const refresh = useCallback(async () => { try {
        await authorizeLocalSession();
        const r = await fetch('/api/app', { cache: 'no-store' }), data = await r.json();
        if (!r.ok)
            throw new Error(data.error);
        setState(data);
        setError('');
    }
    catch (e) {
        setError(e instanceof Error ? e.message : '加载失败，请重试。');
    }
    finally {
        setLoading(false);
    } }, []);
    useEffect(() => {
        const onHashChange = () => { if (new URLSearchParams(window.location.hash.slice(1)).has('local-access')) void refresh(); };
        window.addEventListener('hashchange', onHashChange);
        void refresh();
        return () => window.removeEventListener('hashchange', onHashChange);
    }, [refresh]);
    async function mutate<T>(body: unknown): Promise<T> { const r = await fetch('/api/app', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-app-request': '1', 'idempotency-key': crypto.randomUUID() }, body: JSON.stringify(body) }); const data = await r.json(); if (!r.ok)
        throw new Error(data.error); await refresh(); return data as T; }
    return <AppContext.Provider value={{ state, error, loading, refresh, mutate }}>{children}</AppContext.Provider>;
}
export function useApp() { const value = useContext(AppContext); if (!value)
    throw new Error('未加载应用上下文。'); return value; }
export function useAction() { const [busy, setBusy] = useState(false), [message, setMessage] = useState(''); async function run(fn: () => Promise<void>) { if (busy)
    return; setBusy(true); setMessage(''); try {
    await fn();
}
catch (e) {
    setMessage(e instanceof Error ? e.message : '操作失败，请重试。');
}
finally {
    setBusy(false);
} } return { busy, message, setMessage, run }; }
