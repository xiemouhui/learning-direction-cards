export type Checkin = {
    at: string;
    completion: number;
    difficulty: number;
    interest: 'up' | 'same' | 'down';
    content: string;
    hours: number;
    obstacle: string;
};
export function weekKey(at: string) { const local = new Date(new Date(at).getTime() + 8 * 3600000); const day = local.getUTCDay() || 7; local.setUTCDate(local.getUTCDate() - day + 1); return local.toISOString().slice(0, 10); }
export function reminders(records: Checkin[]) {
    const latest = new Map<string, Checkin>();
    for (const c of [...records].sort((a, b) => a.at.localeCompare(b.at)))
        latest.set(weekKey(c.at), c);
    const weeks = [...latest.keys()].sort().reverse(), run: Checkin[] = [];
    for (const key of weeks) {
        if (run.length && Date.parse(weeks[run.length - 1]) - Date.parse(key) !== 7 * 86400000)
            break;
        run.push(latest.get(key)!);
    }
    const result: string[] = [];
    if (run.length >= 2 && run.slice(0, 2).every(c => c.completion <= 2))
        result.push('连续两周完成度较低，建议检查负荷与阻碍。');
    if (run.length >= 2 && run.slice(0, 2).every(c => c.difficulty >= 4))
        result.push('连续两周难度较高，建议核对基础与任务粒度。');
    if (run.length >= 3 && run.slice(0, 3).every(c => c.completion <= 2 && c.interest === 'down'))
        result.push('连续三周兴趣下降且完成度较低，建议复评；不会自动更换方向。');
    return result;
}
