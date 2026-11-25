import type { NextConfig } from 'next'

// Internal admin tool: every page is per-user and dynamic, so Cache Components stays off here.
const nextConfig: NextConfig = {
  transpilePackages: ['@educore/auth', '@educore/core', '@educore/db', '@educore/tenancy', '@educore/ui'],
  poweredByHeader: false,
}

export default nextConfig
