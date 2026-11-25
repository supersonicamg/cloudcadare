// Pure host parsing: no I/O, safe for proxy.ts and tests.

/** Subdomains of the base domain that belong to platform apps, not academies. */
export const PLATFORM_SUBDOMAINS = ['console', 'start', 'auth', 'api', 'www', 'app', 'admin'] as const
export type PlatformSubdomain = (typeof PLATFORM_SUBDOMAINS)[number]

export type ParsedHost =
  | { kind: 'marketing'; hostname: string }
  | { kind: 'platform_app'; app: PlatformSubdomain; hostname: string }
  | { kind: 'tenant_subdomain'; slug: string; hostname: string }
  | { kind: 'custom'; hostname: string }
  | { kind: 'invalid'; hostname: string }

const HOST_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$/

export function normalizeHost(raw: string | null | undefined): string {
  if (!raw) return ''
  return raw.trim().toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '')
}

export function isValidSlug(slug: string): boolean {
  return SLUG_RE.test(slug)
}

export function parseHost(raw: string | null | undefined, baseDomain: string): ParsedHost {
  const hostname = normalizeHost(raw)
  const base = normalizeHost(baseDomain)
  if (!hostname || !HOST_RE.test(hostname)) return { kind: 'invalid', hostname }
  if (hostname === base) return { kind: 'marketing', hostname }
  if (hostname.endsWith(`.${base}`)) {
    const sub = hostname.slice(0, -(base.length + 1))
    if ((PLATFORM_SUBDOMAINS as readonly string[]).includes(sub)) {
      return { kind: 'platform_app', app: sub as PlatformSubdomain, hostname }
    }
    if (isValidSlug(sub)) return { kind: 'tenant_subdomain', slug: sub, hostname }
    return { kind: 'invalid', hostname }
  }
  return { kind: 'custom', hostname }
}
