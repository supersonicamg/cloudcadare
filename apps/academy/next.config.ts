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
  // Old addresses still work: saved links and sent emails point at them (plan/16 §12). Exact paths only.
  redirects: async () => [
    { source: '/learn', destination: '/dashboard', permanent: true },
    { source: '/welcome-back', destination: '/dashboard', permanent: true },
    { source: '/logged-out', destination: '/', permanent: true },
  ],
}

export default nextConfig
