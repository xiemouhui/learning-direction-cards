import { spawnSync } from 'node:child_process';
const result = spawnSync(process.execPath, ['node_modules/next/dist/bin/next', 'build', '--webpack'], { stdio: 'inherit', windowsHide: true, env: { ...process.env, LDC_BUILD_DIR: '.next-portable', NEXT_TELEMETRY_DISABLED: '1' } });
process.exit(result.status ?? 1);
