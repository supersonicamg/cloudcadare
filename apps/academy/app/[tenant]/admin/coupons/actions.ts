'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { ActionDenied, MfaRequired, requireActionAccess } from '@/lib/dal'

export type CouponFormState = { error?: string; saved?: boolean }

const need = { permission: 'coupon.manage', feature: 'commerce.coupons' } as const

const rupeesToMinor = (v: FormDataEntryValue | null) => {
  const s = String(v ?? '').replace(/[,\s₹]/g, '')
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? Math.round(n * 100) : NaN
}
const wholeNumber = (v: FormDataEntryValue | null) => {
  const s = String(v ?? '').trim()
  return s ? Number(s) : null
}

const schema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,24}$/, 'The code needs 3 to 24 letters, numbers, - or _.'),
  type: z.enum(['percent', 'fixed']),
  value: z.number().positive('Enter the discount.'),
  maxDiscount: z.number().int().positive().nullable(),
  minOrder: z.number().int().positive().nullable(),
  maxRedemptions: z.number().int().positive().nullable(),
  perMember: z.number().int().min(1).max(100),
  endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
})

export async function createCoupon(_s: CouponFormState, form: FormData): Promise<CouponFormState> {
  const type = form.get('type')
  const raw = {
    code: form.get('code'), type,
    value: Number(String(form.get('value') ?? '').replace(/[,\s₹%]/g, '')),
    maxDiscount: rupeesToMinor(form.get('max_discount')), minOrder: rupeesToMinor(form.get('min_order')),
    maxRedemptions: wholeNumber(form.get('max_redemptions')), perMember: wholeNumber(form.get('per_member')) ?? 1,
    endsOn: String(form.get('ends_on') ?? '') || null,
  }
  const parsed = schema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the form.' }
  const v = parsed.data
  if (v.type === 'percent' && v.value > 100) return { error: 'A percentage cannot be more than 100.' }
  if (v.type === 'fixed' && v.value < 1) return { error: 'A fixed discount must be at least ₹1.' }
  try {
    const a = await requireActionAccess(need)
    const { error } = await a.db.from('coupons').insert({
      tenant_id: a.bundle.tenant.id, code: v.code, discount_type: v.type, discount_value: v.value,
      max_discount_minor: v.type === 'percent' ? v.maxDiscount : null, min_order_minor: v.minOrder, max_redemptions: v.maxRedemptions,
      per_member_limit: v.perMember, ends_at: v.endsOn ? `${v.endsOn}T23:59:59+05:30` : null,
    })
    if (error) return { error: error.code === '23505' ? 'You already have a coupon with that code.' : 'Something went wrong. Try again.' }
    revalidatePath('/admin/coupons')
    return { saved: true }
  } catch (e) {
    if (e instanceof MfaRequired) return { error: 'This needs the two-step check first. Open Security, verify your code, then try again.' }
    if (e instanceof ActionDenied) return { error: 'You do not have permission to do that.' }
    throw e
  }
}

export async function setCouponActive(id: string, active: boolean, _form: FormData): Promise<void> {
  if (!z.uuid().safeParse(id).success) return
  const a = await requireActionAccess(need)
  const { error } = await a.db.from('coupons').update({ is_active: active }).eq('id', id)
  if (error) throw new Error('could not update the coupon')
  revalidatePath('/admin/coupons')
}
