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
export function AppProvider({ children }: {
    children: ReactNode;
}) {
    const [state, setState] = useState<AppState | null>(null), [error, setError] = useState(''), [loading, setLoading] = useState(true);
    const refresh = useCallback(async () => { try {
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
    useEffect(() => { void refresh(); }, [refresh]);
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
