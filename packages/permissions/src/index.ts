import { isEnabled, type FeatureKey, type FeatureSnapshot } from '@educore/features'
import { PERMISSIONS, type PermissionKey } from './catalog.generated'

export { PERMISSIONS }
export type { PermissionKey }

/** The caller's resolved grants inside one tenant (from private.perm_* / member_roles). */
export interface Principal {
  permissions: ReadonlySet<string>
  features: FeatureSnapshot
  /** Staff who hold a sensitive permission must be at aal2 (MFA). */
  aal?: 'aal1' | 'aal2'
}

const BY_KEY = new Map<string, (typeof PERMISSIONS)[number]>(PERMISSIONS.map((p) => [p.key, p]))

export class PermissionDeniedError extends Error {
  readonly code = 'permission_denied'
  constructor(readonly permission: string, readonly reason: 'not_granted' | 'feature_off' | 'mfa_required') {
    super(`Permission "${permission}" denied (${reason})`)
    this.name = 'PermissionDeniedError'
  }
}

export function check(p: Principal, key: PermissionKey): 'ok' | 'not_granted' | 'feature_off' | 'mfa_required' {
  const def = BY_KEY.get(key)
  if (!def) return 'not_granted'
  if (!isEnabled(p.features, def.featureKey as FeatureKey)) return 'feature_off'
  if (!p.permissions.has(key) && !p.permissions.has('*')) return 'not_granted'
  if (def.sensitive && p.aal !== 'aal2') return 'mfa_required'
  return 'ok'
}

export function can(p: Principal, key: PermissionKey): boolean {
  return check(p, key) === 'ok'
}

export function requirePermission(p: Principal, key: PermissionKey): void {
  const r = check(p, key)
  if (r !== 'ok') throw new PermissionDeniedError(key, r)
}
