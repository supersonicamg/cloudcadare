import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: { agentFeedback: true },
  cacheComponents: true,
  partialPrefetching: true,
  // Workspace packages ship TypeScript source ("just-in-time" packages).
  transpilePackages: [
    '@educore/auth', '@educore/core', '@educore/db', '@educore/features', '@educore/integrations', '@educore/permissions',
    '@educore/tenancy', '@educore/theme-aurora', '@educore/theme-default', '@educore/ui',
  ],
  poweredByHeader: false,
}

export default nextConfig
