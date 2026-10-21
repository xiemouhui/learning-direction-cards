import type { NextConfig } from 'next';
const config: NextConfig = {
  serverExternalPackages: ['better-sqlite3'], devIndicators: false,
  output: 'standalone',
  outputFileTracingExcludes: { '*': ['.env*', 'data/**/*', '.local/**/*', 'test-results/**/*'] },
};
export default config;
