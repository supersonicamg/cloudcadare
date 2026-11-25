import path from 'node:path'
import type { NextConfig } from 'next'

// Internal admin tool: every page is per-user and dynamic, so Cache Components stays off here.
const nextConfig: NextConfig = {
  transpilePackages: ['@educore/auth', '@educore/core', '@educore/db', '@educore/tenancy', '@educore/ui'],
  poweredByHeader: false,
  // Self-hosting (Dockerfile): a self-contained server, tracing files from the monorepo root.
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
}

export default nextConfig
