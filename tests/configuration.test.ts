import { expect, it, vi } from 'vitest';
import { configurationReport } from '../src/server/config';

it('配置检查不联网、不打印密钥或端点，不把配置齐备当账户验收', () => {
    const fetch = vi.fn(() => { throw new Error('must not request'); });
    vi.stubGlobal('fetch', fetch);
    try {
        const report = configurationReport({ MOCK_AI: '0', DEEPSEEK_API_KEY: 'fixture-private-key', DEEPSEEK_BASE_URL: 'https://example.invalid/private-endpoint', DEEPSEEK_MODEL: 'fixture-model', LDC_ALLOW_CUSTOM_API: '1', LDC_TRUSTED_API_ORIGINS: 'https://example.invalid' });
        expect(report.providers[0].readyForManualTest).toBe(true);
        expect(report.providers[1].readyForManualTest).toBe(false);
        expect(report.accountVerified).toBe(false);
        expect(report.externalRequestsMade).toBe(false);
        expect(JSON.stringify(report)).not.toMatch(/fixture-private-key|private-endpoint|fixture-model/);
        expect(fetch).not.toHaveBeenCalled();
    } finally { vi.unstubAllGlobals(); }
});

it('演示模式、缺模型或非法端点不能标为可开始真实测试', () => {
    expect(configurationReport({ DEEPSEEK_API_KEY: 'fixture' }).providers[0].readyForManualTest).toBe(false);
    expect(configurationReport({ MOCK_AI: '0', OPENAI_API_KEY: 'fixture' }).providers[1].readyForManualTest).toBe(false);
    expect(configurationReport({ MOCK_AI: '0', DEEPSEEK_API_KEY: 'fixture', DEEPSEEK_BASE_URL: 'http://example.invalid' }).providers[0].readyForManualTest).toBe(false);
    expect(configurationReport({ MOCK_AI: '0', DEEPSEEK_API_KEY: 'fixture', DEEPSEEK_MODEL: 'invalid model id' }).providers[0].readyForManualTest).toBe(false);
});
