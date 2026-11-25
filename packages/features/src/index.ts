import { FEATURES, type FeatureDef, type FeatureKey } from './catalog.generated'

export { FEATURES }
export type { FeatureDef, FeatureKey }

/** What the academy bought (public.tenant_entitlements). */
export interface Entitlement {
  featureKey: string
  enabled: boolean
  limitValue: number | null
  config?: Record<string, unknown>
}

/** What the academy admin switched on or off (public.tenant_modules). Absent row = on. */
export interface ModuleSetting {
  featureKey: string
  isEnabled: boolean
}

export interface FeatureState {
  enabled: boolean
  /** Only for kind = 'limit'. null = unlimited. */
  limit: number | null
  config: Record<string, unknown>
}

/** Plain JSON, safe to pass from server to client components. */
export type FeatureSnapshot = Readonly<Record<string, FeatureState>>

const BY_KEY: ReadonlyMap<string, FeatureDef> = new Map(FEATURES.map((f) => [f.key, f]))

export function getFeatureDef(key: string): FeatureDef | undefined {
  return BY_KEY.get(key)
}

/**
 * Two-layer resolution (plan/04):
 *   effective = entitlement.enabled AND module setting (default on) AND every dependency effective.
 * Core features are always on. Limits come from the entitlement only.
 */
export function resolveFeatures(entitlements: Entitlement[], modules: ModuleSetting[] = []): FeatureSnapshot {
  const ent = new Map(entitlements.map((e) => [e.featureKey, e]))
  const mod = new Map(modules.map((m) => [m.featureKey, m.isEnabled]))
  const memo = new Map<string, boolean>()

  const effective = (key: string, trail: string[] = []): boolean => {
    const cached = memo.get(key)
    if (cached !== undefined) return cached
    const def = BY_KEY.get(key)
    if (!def || trail.includes(key)) return false
    let on: boolean
    if (def.isCore) on = true
    else {
      const e = ent.get(key)
      const bought = e ? e.enabled : def.defaultEnabled
      const chosen = mod.get(key) ?? true
      on = bought && chosen && def.dependsOn.every((d) => effective(d, [...trail, key]))
    }
    memo.set(key, on)
    return on
  }

  const out: Record<string, FeatureState> = {}
  for (const def of FEATURES) {
    const e = ent.get(def.key)
    out[def.key] = {
      enabled: effective(def.key),
      limit: e ? e.limitValue : def.defaultLimit,
      config: e?.config ?? {},
    }
  }
  return out
}

export class FeatureDisabledError extends Error {
  readonly code = 'feature_disabled'
  constructor(readonly featureKey: string) {
    super(`Feature "${featureKey}" is not enabled for this academy`)
    this.name = 'FeatureDisabledError'
  }
}

export function isEnabled(snapshot: FeatureSnapshot, key: FeatureKey): boolean {
  return snapshot[key]?.enabled === true
}

export function requireFeature(snapshot: FeatureSnapshot, key: FeatureKey): void {
  if (!isEnabled(snapshot, key)) throw new FeatureDisabledError(key)
}

/** null = unlimited. Returns 0 when the feature is absent or disabled. */
export function getLimit(snapshot: FeatureSnapshot, key: FeatureKey): number | null {
  const s = snapshot[key]
  if (!s || !s.enabled) return 0
  return s.limit
}

export function isWithinLimit(snapshot: FeatureSnapshot, key: FeatureKey, currentCount: number): boolean {
  const limit = getLimit(snapshot, key)
  return limit === null || currentCount < limit
}
