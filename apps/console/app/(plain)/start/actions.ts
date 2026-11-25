'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { LicenseError, redeemLicense } from '@educore/core/licensing'
import { syncDomainMap } from '@educore/core/domains'
import { writableDomainMapFromEnv } from '@educore/tenancy'
import { getControlSql } from '@educore/db/control'
import { requireUser } from '@/lib/session'

export type RedeemState = { error?: string }

const schema = z.object({
  key: z.string().trim().min(8).max(40),
  academyName: z.string().trim().min(2).max(80),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$/),
  ownerName: z.string().trim().min(2).max(80),
})

const MESSAGES: Record<string, string> = {
  license_invalid: 'That key was not recognised. Check it and try again.',
  license_revoked: 'That key has been revoked. Contact whoever issued it.',
  license_exhausted: 'That key has already been used.',
  license_expired: 'That key has expired.',
  license_bound_to_other_email: 'That key is reserved for a different email address.',
  slug_reserved: 'That address is reserved. Choose another.',
  slug_taken: 'That address is taken. Choose another.',
  slug_invalid: 'Use 3 to 48 letters, numbers or hyphens.',
  distributor_inactive: 'The issuer of this key is not active. Contact them.',
  distributor_tenant_limit: 'The issuer has reached their academy limit. Contact them.',
  no_capacity: 'We are at capacity right now. Please try again shortly.',
}

export async function redeem(_p: RedeemState, form: FormData): Promise<RedeemState> {
  const user = await requireUser('/start')
  const parsed = schema.safeParse(Object.fromEntries(form))
  if (!parsed.success) return { error: 'Check the form: every field is required, and the address uses letters, numbers and hyphens.' }

  const h = await headers()
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || null
  try {
    const sql = getControlSql()
    const { slug, tenantId } = await redeemLicense(sql, {
      key: parsed.data.key,
      userId: user.id,
      slug: parsed.data.slug,
      academyName: parsed.data.academyName,
      ownerName: parsed.data.ownerName,
      ip: ip && /^[0-9a-f.:]+$/i.test(ip) ? ip : null,
      userAgent: h.get('user-agent')?.slice(0, 300) ?? null,
    })
    // Publish the new hostname to the edge map. The academy already exists, so a failure here must not
    // hide that: log it; the console's "resync" (todo) and the daily reconcile job repair it.
    const map = writableDomainMapFromEnv()
    if (map) await syncDomainMap(sql, map, tenantId).catch((e) => console.error('domain map sync failed', tenantId, e))
    redirect(`/start/done?slug=${encodeURIComponent(slug)}`)
  } catch (e) {
    if (e instanceof LicenseError) return { error: MESSAGES[e.code] ?? 'That key could not be redeemed.' }
    throw e // includes redirect()
  }
}
