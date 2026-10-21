import type { NextConfig } from 'next';
import { PHASE_PRODUCTION_SERVER } from 'next/constants';
const config: NextConfig = {
  serverExternalPackages: ['better-sqlite3'], devIndicators: false,
  output: 'standalone',
  outputFileTracingExcludes: { '*': ['.env*', 'data/**/*', '.local/**/*', 'test-results/**/*'] },
};
export default function configuration(phase: string): NextConfig {
  return { ...config, distDir: phase === PHASE_PRODUCTION_SERVER ? (process.env.LDC_ACTIVE_BUILD_DIR || process.env.LDC_BUILD_DIR || '.next') : (process.env.LDC_BUILD_DIR || '.next') };
}
