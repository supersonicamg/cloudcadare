// Shared ESLint config: Next.js rules + the import boundaries from plan/02 §2.
import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

const SERVICE_ROLE = {
  group: ['@educore/auth/privileged', '@educore/auth/privileged/*'],
  message: 'The privileged (service-role) client may only be imported from a /privileged/ folder or apps/workers.',
}

export const base = [
  ...nextVitals,
  ...nextTs,
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    // Boundary 1: nobody outside a privileged folder may use the service-role client.
    files: ['**/*.{ts,tsx,mjs}'],
    ignores: ['**/privileged/**', '**/apps/workers/**'],
    rules: { 'no-restricted-imports': ['error', { patterns: [SERVICE_ROLE] }] },
  },
  {
    // Boundary 2: themes are presentation only. They never reach the domain or the database.
    files: ['**/packages/themes/**/*.{ts,tsx}', '**/themes/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          SERVICE_ROLE,
          { group: ['@educore/core', '@educore/core/*', '@educore/auth', '@educore/auth/*', '@supabase/*', 'postgres'],
            message: 'Themes are presentation only: they receive DTOs and server actions as props.' },
        ],
      }],
    },
  },
]

export default defineConfig(base)
