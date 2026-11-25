'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { syncDomainMap } from '@educore/core/domains'
import {
  clearFeatureOverride, isUuid, resumeTenant, setFeatureOverride, suspendTenant, TenantAdminError,
} from '@educore/core/tenants'
import { getControlSql } from '@educore/db/control'
import { writableDomainMapFromEnv } from '@educore/tenancy'
import { canManageAcademies } from '@/lib/roles'
import { requireStaff } from '@/lib/session'

export type ActionState = { error?: string; ok?: string }

const NO_RIGHT = 'Your role can look at this academy but not change it.'
const MESSAGES: Record<TenantAdminError['code'], string> = {
  not_found: 'That academy no longer exists, or it is not yours to manage.',
  bad_feature: 'That feature cannot be switched for one academy.',
  not_suspendable: 'This academy is not in a state that can be suspended.',
  not_suspended: 'This academy is not suspended.',
}

const idOf = (form: FormData) => {
  const v = form.get('tenantId')
  return isUuid(v) ? v : null
}

async function guard(form: FormData) {
  const tenantId = idOf(form)
  if (!tenantId) return { error: MESSAGES.not_found } as const
  const staff = await requireStaff(`/tenants/${tenantId}`)
  if (!canManageAcademies(staff.role)) return { error: NO_RIGHT } as const
  return { tenantId, staff, actor: { userId: staff.userId, distributorId: staff.distributorId } } as const
}

const featureSchema = z.object({ featureKey: z.string().regex(/^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/), enabled: z.enum(['true', 'false']) })

/** The switch on a feature row. Forces the feature on or off for this academy only. */
export async function setFeature(_p: ActionState, form: FormData): Promise<ActionState> {
  const g = await guard(form)
  if ('error' in g) return g
  const parsed = featureSchema.safeParse({ featureKey: form.get('featureKey'), enabled: form.get('enabled') })
  if (!parsed.success) return { error: MESSAGES.bad_feature }
  try {
    await setFeatureOverride(getControlSql(), g.actor, {
      tenantId: g.tenantId, featureKey: parsed.data.featureKey, enabled: parsed.data.enabled === 'true',
    })
  } catch (e) {
    if (e instanceof TenantAdminError) return { error: MESSAGES[e.code] }
    throw e
  }
  revalidatePath(`/tenants/${g.tenantId}`)
  return {}
}

/** "Back to plan": drop this academy's override. */
export async function clearOverride(_p: ActionState, form: FormData): Promise<ActionState> {
  const g = await guard(form)
  if ('error' in g) return g
  const key = featureSchema.shape.featureKey.safeParse(form.get('featureKey'))
  if (!key.success) return { error: MESSAGES.bad_feature }
  try {
    await clearFeatureOverride(getControlSql(), g.actor, { tenantId: g.tenantId, featureKey: key.data })
  } catch (e) {
    if (e instanceof TenantAdminError) return { error: MESSAGES[e.code] }
    throw e
  }
  revalidatePath(`/tenants/${g.tenantId}`)
  return {}
}

/** The edge keeps its own copy of "which host is which academy"; it must hear about every status change. */
async function publishToEdge(tenantId: string): Promise<string | null> {
  const map = writableDomainMapFromEnv()
  if (!map) return null // no Redis configured (local dev): the academy reads the status from its own database
  try {
    await syncDomainMap(getControlSql(), map, tenantId)
    return null
  } catch (e) {
    console.error('domain map sync failed', tenantId, e)
    return 'The change is saved, but the address list at the edge could not be updated, so the academy may still be reachable (or still blocked). Open the Domains tab and press "Update address list".'
  }
}

/** Domains tab: push this academy's hostnames and status to the edge again. Safe to repeat. */
export async function republish(_p: ActionState, form: FormData): Promise<ActionState> {
  const g = await guard(form)
  if ('error' in g) return g
  if (!writableDomainMapFromEnv()) return { error: 'No edge address list is configured here (UPSTASH_REDIS_REST_URL), so there is nothing to update.' }
  const warn = await publishToEdge(g.tenantId)
  return warn ? { error: warn } : { ok: 'Address list updated.' }
}

const suspendSchema = z.object({ note: z.string().trim().min(3, 'Add a short note for the team.').max(300) })

export async function suspend(_p: ActionState, form: FormData): Promise<ActionState> {
  const g = await guard(form)
  if ('error' in g) return g
  const parsed = suspendSchema.safeParse({ note: form.get('note') })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Add a short note for the team.' }
  try {
    await suspendTenant(getControlSql(), g.actor, { tenantId: g.tenantId, note: parsed.data.note })
  } catch (e) {
    if (e instanceof TenantAdminError) return { error: MESSAGES[e.code] }
    throw e
  }
  const warn = await publishToEdge(g.tenantId)
  revalidatePath(`/tenants/${g.tenantId}`)
  if (warn) return { error: warn }
  redirect(`/tenants/${g.tenantId}?tab=features`)
}

export async function resume(_p: ActionState, form: FormData): Promise<ActionState> {
  const g = await guard(form)
  if ('error' in g) return g
  try {
    await resumeTenant(getControlSql(), g.actor, { tenantId: g.tenantId })
  } catch (e) {
    if (e instanceof TenantAdminError && e.code === 'not_suspended') {
      // Already resumed (a second tab, a retry after an edge failure): just make sure the edge agrees.
      const warn = await publishToEdge(g.tenantId)
      revalidatePath(`/tenants/${g.tenantId}`)
      return warn ? { error: warn } : {}
    }
    if (e instanceof TenantAdminError) return { error: MESSAGES[e.code] }
    throw e
  }
  const warn = await publishToEdge(g.tenantId)
  revalidatePath(`/tenants/${g.tenantId}`)
  return warn ? { error: warn } : {}
}
