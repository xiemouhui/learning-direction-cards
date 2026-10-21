import { readFileSync, writeFileSync, existsSync, renameSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { spawnSync } from 'node:child_process';
import net from 'node:net';
import { credentialOperation, keyNames, readCredentialStore, writeCredentialStore } from './security/credentials.mjs';

const store = resolve('.local/security/credentials.dpapi');
try {
  const saved = readCredentialStore(store);
  if (process.argv.includes('--import-env')) {
    const file = resolve('.env.local');
    if (!existsSync(file)) throw new Error('本机配置文件不存在。');
    const original = readFileSync(file, 'utf8'), configured = parseEnv(original);
    const values = Object.fromEntries(keyNames.map(k => [k, configured[k]?.trim() ?? '']).filter(([, v]) => v));
    if (configured.LLM_API_KEY?.trim()) values[(configured.LLM_PROVIDER === 'openai' ? 'OPENAI' : 'DEEPSEEK') + '_API_KEY'] ??= configured.LLM_API_KEY.trim();
    if (Object.values(values).some(v => /[\r\n]/.test(v))) throw new Error('暂不支持迁移多行凭据。');
    if (!Object.keys(values).length) { console.log('没有需要迁移的明文凭据。'); process.exit(0); }
    writeCredentialStore(store, { ...saved, ...values });
    const verified = readCredentialStore(store);
    if (Object.entries(values).some(([k, v]) => verified[k] !== v)) throw new Error('加密凭据核验未通过，原配置保持不变。');
    const cleaned = original.replace(/^(?:export\s+)?(?:DEEPSEEK_API_KEY|OPENAI_API_KEY|TAVILY_API_KEY|LLM_API_KEY)\s*=.*$/gm, '');
    if (Object.values(values).some(v => cleaned.includes(v))) throw new Error('无法安全清除原配置，原文件保持不变。');
    writeFileSync(`${file}.secure.tmp`, cleaned, { mode: 0o600 }); renameSync(`${file}.secure.tmp`, file);
    console.log('本机凭据已加密、解密核验，并从配置移除；重启服务后生效。');
  } else {
    const result = credentialOperation('Prompt');
    if (!result) process.exit(0);
    const input = JSON.parse(result);
    if (!keyNames.includes(input.name) || typeof input.key !== 'string' || /[\r\n]/.test(input.key)) throw new Error('凭据输入无效。');
    if (input.remember) {
      if (input.key) saved[input.name] = input.key; else delete saved[input.name];
      writeCredentialStore(store, saved); console.log('凭据已安全保存；请重启服务。');
    } else {
      await new Promise((res, rej) => { const probe = net.createServer(); probe.once('error', () => rej(new Error('请先停止 3000 端口的源码服务，再使用会话配置。'))); probe.listen(3000, '127.0.0.1', () => probe.close(res)); });
      delete saved[input.name]; writeCredentialStore(store, saved);
      const env = { ...process.env, ...Object.fromEntries(keyNames.map(k => [k, saved[k] ?? ''])), [input.name]: input.key, LDC_SESSION_CREDENTIALS: '1', MOCK_AI: '0' };
      const child = spawnSync(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3000'], { env, stdio: 'inherit', windowsHide: true });
      process.exit(child.status ?? 1);
    }
  }
} catch { console.error('本机凭据配置未完成。请检查服务状态、Windows 账户和配置格式；未降级到明文保存。'); process.exit(1); }
