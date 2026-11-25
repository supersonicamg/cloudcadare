import 'server-only'
import type { Sql } from '@educore/db/control'
import { generateLicenseKey, hashLicenseKey, licenseKeyHint, normalizeLicenseKey } from './keys'

export { generateLicenseKey, hashLicenseKey, licenseKeyHint, normalizeLicenseKey }

export interface CreateLicenseInput {
  distributorId: string
  planCode: string
  createdBy: string
  verticalKey?: string | null
  frontendTemplateKey?: string | null
  addonCodes?: string[]
  termDays?: number | null
  maxActivations?: number
  restrictedEmail?: string | null
  notes?: string | null
}

/** Creates a key and returns the PLAINTEXT once. It is not recoverable afterwards. */
export async function createLicense(sql: Sql, input: CreateLicenseInput): Promise<{ id: string; key: string }> {
  const key = generateLicenseKey()
  const [plan] = await sql<{ id: string }[]>`
    select p.id from control.plans p
    where p.code = ${input.planCode}
      and p.distributor_id in (${input.distributorId}, (select id from control.distributors where kind = 'platform'))
    order by (p.distributor_id = ${input.distributorId}) desc limit 1`
  if (!plan) throw new LicenseError('plan_not_found')
  const [row] = await sql<{ id: string }[]>`
    insert into control.license_keys
      (distributor_id, plan_id, key_hash, key_hint, vertical_key, frontend_template_key, addon_codes,
       term_days, max_activations, restricted_email, notes, created_by)
    values (${input.distributorId}, ${plan.id}, ${hashLicenseKey(key)}, ${licenseKeyHint(key)},
            ${input.verticalKey ?? null}, ${input.frontendTemplateKey ?? null}, ${input.addonCodes ?? []},
            ${input.termDays ?? null}, ${input.maxActivations ?? 1}, ${input.restrictedEmail ?? null},
            ${input.notes ?? null}, ${input.createdBy})
    returning id`
  return { id: row!.id, key }
}

export interface RedeemInput {
  key: string
  userId: string
  slug: string
  academyName: string
  ownerName: string
  contactPhone?: string | null
  ip?: string | null
  userAgent?: string | null
}

export class LicenseError extends Error {
  constructor(readonly code: string) {
    super(code)
    this.name = 'LicenseError'
  }
}

const USER_FACING = new Set([
  'license_invalid', 'license_revoked', 'license_exhausted', 'license_expired',
  'license_bound_to_other_email', 'slug_reserved', 'distributor_inactive', 'distributor_tenant_limit', 'no_capacity',
])

/** Redeems a key (control.redeem_license) then provisions the academy on the pooled plane. */
export async function redeemLicense(sql: Sql, input: RedeemInput): Promise<{ tenantId: string; slug: string }> {
  const slug = input.slug.trim().toLowerCase()
  try {
    return await sql.begin(async (tx) => {
      const [r] = await tx<{ id: string }[]>`
        select control.redeem_license(
          ${normalizeLicenseKey(input.key)}, ${input.userId}::uuid, ${slug}, ${input.academyName},
          ${input.contactPhone ?? null}, ${input.ip ?? null}::inet, ${input.userAgent ?? null}) as id`
      const tenantId = r!.id
      await tx`select control.provision_local(${tenantId}::uuid, ${input.ownerName})`
      return { tenantId, slug }
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : ''
    if (USER_FACING.has(msg)) throw new LicenseError(msg)
    if (/tenants_slug_key|unique/i.test(msg) || (e as { code?: string }).code === '23505') throw new LicenseError('slug_taken')
    if ((e as { code?: string }).code === '23514') throw new LicenseError('slug_invalid')
    throw e
  }
}
