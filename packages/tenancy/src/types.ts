import type { FeatureSnapshot } from '@educore/features'

export type TenantStatus =
  | 'provisioning' | 'trial' | 'active' | 'past_due' | 'suspended' | 'cancelled' | 'archived'

/** Resolved once per request. Never built from client input. */
export interface TenantContext {
  id: string
  slug: string
  name: string
  status: TenantStatus
  /** Which data plane (Supabase project) holds this academy. */
  planeId: string
  /** 'default' or 'custom:<name>' (L4 zone). */
  frontend: string
  verticalKey: string | null
  timezone: string
  defaultLocale: string
  currency: string
  country: string
}

/** Public-facing identity: safe on anonymous pages. Mirrors public.tenant_branding. */
export interface Branding {
  displayName: string
  tagline: string | null
  logoPath: string | null
  logoDarkPath: string | null
  faviconPath: string | null
  themeKey: string
  tokens: unknown
  themeSettings: unknown
  contact: { email?: string; phone?: string; whatsapp?: string; address?: string }
  showPoweredBy: boolean
}

export interface TenantBundle {
  tenant: TenantContext
  branding: Branding
  features: FeatureSnapshot
}

/** What the edge knows about a hostname: enough to route, nothing more. */
export interface DomainRecord {
  tenantId: string
  slug: string
  planeId: string
  frontend: string
  status: TenantStatus
}

/** Slug used only so `next build` can prerender the [tenant] shell. It is also a reserved slug. */
export const PLACEHOLDER_SLUG = 'root'
