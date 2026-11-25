'use client'

import { useActionState, useState } from 'react'
import { contrastRatio, readableForeground } from '@educore/ui/tokens'
import { button, hint, input, label } from '@/lib/ui'
import { saveBranding, type BrandingState } from './actions'

export function BrandingForm(props: { displayName: string; tagline: string; primary: string; accent: string }) {
  const [s, action, pending] = useActionState<BrandingState, FormData>(saveBranding, {})
  const [primary, setPrimary] = useState(props.primary)
  const fg = /^#[0-9a-fA-F]{6}$/.test(primary) ? readableForeground(primary) : '#FFFFFF'
  const ratio = /^#[0-9a-fA-F]{6}$/.test(primary) ? contrastRatio(primary, fg) : 0

  return (
    <form action={action} className="grid max-w-xl gap-5">
      <div><label htmlFor="display_name" className={label}>Academy name</label>
        <input id="display_name" name="display_name" defaultValue={props.displayName} required className={input} /></div>
      <div><label htmlFor="tagline" className={label}>Tagline</label>
        <input id="tagline" name="tagline" defaultValue={props.tagline} className={input} />
        <p className={hint}>Shown under the name on your home page.</p></div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div><label htmlFor="primary" className={label}>Main colour</label>
          <div className="flex items-center gap-3">
            <input id="primary" name="primary" value={primary} onChange={(e) => setPrimary(e.target.value)} className={input} />
            <span aria-hidden className="h-10 w-10 shrink-0 rounded-[var(--radius)] border border-border" style={{ background: /^#[0-9a-fA-F]{6}$/.test(primary) ? primary : 'transparent' }} />
          </div></div>
        <div><label htmlFor="accent" className={label}>Highlight colour</label>
          <input id="accent" name="accent" defaultValue={props.accent} className={input} /></div>
      </div>
      <div className="flex items-center gap-4">
        <span className="rounded-[var(--radius)] px-4 py-2 text-sm font-medium" style={{ background: /^#[0-9a-fA-F]{6}$/.test(primary) ? primary : '#999', color: fg }}>Button preview</span>
        <span className={hint}>{ratio >= 4.5 ? 'Text is easy to read on this colour.' : 'Low contrast: the text colour is adjusted automatically, but this colour may look weak.'}</span>
      </div>
      {s.error && <p role="alert" className="text-sm text-danger">{s.error}</p>}
      {s.saved && <p className="text-sm text-success">Saved. Your site updates within a moment.</p>}
      <div><button className={button} disabled={pending}>{pending ? 'Saving…' : 'Save branding'}</button></div>
    </form>
  )
}
