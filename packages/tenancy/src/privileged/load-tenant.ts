import 'server-only'
import { resolveFeatures, type Entitlement, type ModuleSetting } from '@educore/features'
import { getPlane } from '@educore/auth'
import { createPrivilegedDb } from '@educore/auth/privileged'
import { fixtureBundle } from '../fixtures'
import { PLACEHOLDER_SLUG, type Branding, type TenantBundle, type TenantStatus } from '../types'

// Reads the tenant mirror + public branding from the data plane. Uses the privileged client because
// `anon` has no grants (plan/07): this is a server-only "public read" path with explicit filters.
// Callers cache the result with 'use cache' + cacheTag(`tenant:${id}:branding`).

function fixturesAllowed(): boolean {
  return process.env.EDUCORE_FIXTURES === '1' ||
    (process.env.NODE_ENV !== 'production' && !process.env.SUPABASE_URL)
}

export async function loadTenantBundle(slug: string): Promise<TenantBundle | null> {
  if (slug === PLACEHOLDER_SLUG) return fixtureBundle(PLACEHOLDER_SLUG)
  if (fixturesAllowed()) return slug === 'demo' ? fixtureBundle('demo') : null

  const plane = getPlane(null)
  const db = createPrivilegedDb(plane)

  const { data: t, error } = await db
    .from('tenants')
    .select('id, slug, name, status, vertical_key, frontend_template_key, timezone, default_locale, currency, country')
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw new Error(`tenant lookup failed: ${error.message}`)
  if (!t) return null

  const [brandingRes, entRes, modRes] = await Promise.all([
    db.from('tenant_branding').select('*').eq('tenant_id', t.id).maybeSingle(),
    db.from('tenant_entitlements').select('feature_key, enabled, limit_value, config').eq('tenant_id', t.id),
    db.from('tenant_modules').select('feature_key, is_enabled').eq('tenant_id', t.id),
  ])
  for (const r of [brandingRes, entRes, modRes]) if (r.error) throw new Error(`tenant load failed: ${r.error.message}`)

  const b = brandingRes.data
  const branding: Branding = {
    displayName: b?.display_name ?? t.name,
    tagline: b?.tagline ?? null,
    logoPath: b?.logo_path ?? null,
    logoDarkPath: b?.logo_dark_path ?? null,
    faviconPath: b?.favicon_path ?? null,
    themeKey: b?.theme_key ?? 'default',
    tokens: b?.tokens ?? {},
    themeSettings: b?.theme_settings ?? {},
    contact: (b?.contact as Branding['contact']) ?? {},
    showPoweredBy: b?.show_powered_by ?? true,
  }
  const entitlements: Entitlement[] = (entRes.data ?? []).map((e) => ({
    featureKey: e.feature_key, enabled: e.enabled, limitValue: e.limit_value, config: e.config as Record<string, unknown>,
  }))
  const modules: ModuleSetting[] = (modRes.data ?? []).map((m) => ({ featureKey: m.feature_key, isEnabled: m.is_enabled }))

  return {
    tenant: {
      id: t.id,
      slug: t.slug,
      name: t.name,
      status: t.status as TenantStatus,
      planeId: plane.id,
      frontend: t.frontend_template_key,
      verticalKey: t.vertical_key,
      timezone: t.timezone,
      defaultLocale: t.default_locale,
      currency: t.currency,
      country: t.country,
    },
    branding,
    features: resolveFeatures(entitlements, modules),
  }
}
