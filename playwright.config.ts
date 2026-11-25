import { defineConfig } from '@playwright/test'

// End-to-end tests run against an already-running local stack:
//   supabase start (packages/db) · node packages/db/scripts/smtp-sink.mjs · pnpm dev:academy
// Chrome resolves *.localhost to 127.0.0.1 by itself.
export default defineConfig({
  testDir: './e2e',
  workers: 1,
  retries: 0,
  use: { baseURL: process.env.E2E_BASE_URL ?? 'http://cloudcadre.localhost:3000', trace: 'retain-on-failure' },
})
