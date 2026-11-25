// Pure rules for the console's features matrix. No database here, so it is unit-tested.

/** Where a feature's current value comes from (control.tenant_entitlements.source). */
export type EntitlementSource = 'core' | 'plan' | 'addon' | 'override' | 'default' | 'dependency'

export interface MatrixInput {
  isCore: boolean
  enabled: boolean
  source: EntitlementSource
  /** Names of the features this one needs that are currently off. */
  missing: string[]
}

export interface MatrixCell {
  /** Short text for the "Comes from" column. */
  label: string
  /** quiet = not available; warn = a manual exception worth noticing. */
  tone: 'plain' | 'warn' | 'quiet'
  /** The switch can be flipped. */
  editable: boolean
  /** Why it cannot be flipped, or what it is waiting on. */
  note: string | null
}

export function describeFeature(f: MatrixInput): MatrixCell {
  if (f.isCore || f.source === 'core') {
    return { label: 'Always on', tone: 'plain', editable: false, note: 'Every academy has this.' }
  }
  if (f.source === 'dependency') {
    const needs = f.missing.length ? f.missing.join(', ') : 'another feature'
    return { label: 'Needs another feature', tone: 'quiet', editable: false, note: `Turn on ${needs} first.` }
  }
  if (f.source === 'override') return { label: 'Override for this academy', tone: 'warn', editable: true, note: null }
  if (f.source === 'addon') return { label: 'Add-on', tone: 'plain', editable: true, note: null }
  if (f.source === 'plan') {
    return f.enabled
      ? { label: 'Plan', tone: 'plain', editable: true, note: null }
      : { label: 'Not in plan', tone: 'quiet', editable: true, note: null }
  }
  // 'default': nothing in the plan mentions it
  return f.enabled
    ? { label: 'Default', tone: 'plain', editable: true, note: null }
    : { label: 'Not in plan', tone: 'quiet', editable: true, note: null }
}

const MODULE_TITLES: Record<string, string> = {
  ai: 'AI', analytics: 'Analytics', app: 'Mobile app', assess: 'Quizzes and tests', catalog: 'Catalogue',
  cohort: 'Batches', commerce: 'Selling', comms: 'Messages', content: 'Lesson content', core: 'Included in every academy',
  crm: 'Enquiries', engage: 'Engagement', integrations: 'Integrations', learning: 'Learning', live: 'Live classes',
  org: 'Organisation', security: 'Security', site: 'Website',
}

/** Human heading for a feature module key such as "commerce" or "assess". */
export function moduleTitle(module: string): string {
  const known = MODULE_TITLES[module]
  if (known) return known
  const spaced = module.replace(/[_-]+/g, ' ').trim()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v)
