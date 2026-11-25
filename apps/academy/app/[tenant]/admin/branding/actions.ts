'use server'

import { updateTag } from 'next/cache'
import { z } from 'zod'
import { parseTokens } from '@educore/ui/tokens'
import { ActionDenied, requireActionAccess } from '@/lib/dal'

export type BrandingState = { error?: string; saved?: boolean }

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a 6-digit colour like #0F5C56.')
const schema = z.object({
  display_name: z.string().trim().min(2, 'The name needs at least 2 characters.').max(80),
  tagline: z.string().trim().max(160).nullable(),
  primary: hex,
  accent: hex,
})

export async function saveBranding(_s: BrandingState, form: FormData): Promise<BrandingState> {
  const tagline = String(form.get('tagline') ?? '').trim()
  const parsed = schema.safeParse({
    display_name: form.get('display_name'), tagline: tagline || null, primary: form.get('primary'), accent: form.get('accent'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the form.' }
  try {
    const a = await requireActionAccess({ permission: 'tenant.branding.manage', feature: 'core.branding' })
    const { data: cur } = await a.db.from('tenant_branding').select('tokens').eq('tenant_id', a.bundle.tenant.id).single()
    const tokens = parseTokens(cur?.tokens)
    const next = { ...tokens, colors: { ...tokens.colors, primary: parsed.data.primary.toUpperCase(), accent: parsed.data.accent.toUpperCase() } }
    const { error, count } = await a.db.from('tenant_branding')
      .update({ display_name: parsed.data.display_name, tagline: parsed.data.tagline, tokens: next }, { count: 'exact' })
      .eq('tenant_id', a.bundle.tenant.id)
    if (error || !count) return { error: 'Could not save. Try again.' }
    updateTag(`tenant:${a.bundle.tenant.id}:branding`)
    return { saved: true }
  } catch (e) {
    return { error: e instanceof ActionDenied ? 'You do not have permission to do that.' : 'Something went wrong. Try again.' }
  }
}
