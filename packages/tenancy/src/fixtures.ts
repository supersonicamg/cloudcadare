import { resolveFeatures } from '@educore/features'
import type { TenantBundle } from './types'

// Development-only stand-in so the app renders before a database exists.
// The loader uses it ONLY when fixtures are explicitly allowed (see load-tenant.ts).

export function fixtureBundle(slug: string): TenantBundle {
  const name = slug === 'demo' ? 'Demo Academy' : slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  return {
    tenant: {
      id: '00000000-0000-7000-8000-000000000001',
      slug,
      name,
      status: 'active',
      planeId: 'fixture',
      frontend: 'default',
      verticalKey: null,
      timezone: 'Asia/Kolkata',
      defaultLocale: 'en-IN',
      currency: 'INR',
      country: 'IN',
    },
    branding: {
      displayName: name,
      tagline: 'Learn at your own pace, with a mentor beside you.',
      logoPath: null,
      logoDarkPath: null,
      faviconPath: null,
      themeKey: 'default',
      tokens: {},
      themeSettings: {},
      contact: {},
      showPoweredBy: true,
    },
    features: resolveFeatures([]),
  }
}
