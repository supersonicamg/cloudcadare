'use server'

import { z } from 'zod'
import { createLicense, LicenseError } from '@educore/core/licensing'
import { getControlSql } from '@educore/db/control'
import { requireStaff } from '@/lib/session'

export type CreateKeyState = { key?: string; hint?: string; error?: string }

const schema = z.object({
  plan: z.string().regex(/^[a-z0-9_-]{1,40}$/),
  termDays: z.coerce.number().int().min(1).max(3650).optional(),
  restrictedEmail: z.email().optional(),
  notes: z.string().max(500).optional(),
})

export async function createKey(_p: CreateKeyState, form: FormData): Promise<CreateKeyState> {
  const staff = await requireStaff('/licenses')
  if (!['owner', 'admin', 'sales'].includes(staff.role)) return { error: 'Your role cannot create license keys.' }

  const emptyToUndef = (v: FormDataEntryValue | null) => (typeof v === 'string' && v.trim() ? v.trim() : undefined)
  const parsed = schema.safeParse({
    plan: emptyToUndef(form.get('plan')),
    termDays: emptyToUndef(form.get('termDays')),
    restrictedEmail: emptyToUndef(form.get('restrictedEmail')),
    notes: emptyToUndef(form.get('notes')),
  })
  if (!parsed.success) return { error: 'Check the form: pick a plan and use valid values.' }

  try {
    const { key } = await createLicense(getControlSql(), {
      distributorId: staff.distributorId,
      createdBy: staff.userId,
      planCode: parsed.data.plan,
      termDays: parsed.data.termDays ?? null,
      restrictedEmail: parsed.data.restrictedEmail ?? null,
      notes: parsed.data.notes ?? null,
    })
    return { key }
  } catch (e) {
    if (e instanceof LicenseError && e.code === 'plan_not_found') return { error: 'That plan does not exist.' }
    throw e
  }
}
