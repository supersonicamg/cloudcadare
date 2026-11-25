'use client'

import { useActionState, useState } from 'react'
import { contrastRatio, readableForeground } from '@educore/ui/tokens'
import { button, hint, input, label } from '@/lib/ui'
import { saveBranding, type BrandingState } from './actions'

export function BrandingForm(props: { displayName: string; tagline: string; primary: string; accent: string }) {
  const [s, action, pending] = useActionState<BrandingState, FormData>(saveBranding, {})
  const [primary, setPrimary] = useState(props.primary)
  const [accent, setAccent] = useState(props.accent)
  const fg = /^#[0-9a-fA-F]{6}$/.test(primary) ? readableForeground(primary) : '#FFFFFF'
  const ratio = /^#[0-9a-fA-F]{6}$/.test(primary) ? contrastRatio(primary, fg) : 0

  return (
    <form action={action} className="grid max-w-xl gap-5">
      <div className="grid content-start gap-2"><label htmlFor="display_name" className={label}>Academy name</label>
        <input id="display_name" name="display_name" defaultValue={props.displayName} required className={input} /></div>
      <div className="grid content-start gap-2"><label htmlFor="tagline" className={label}>One-line description</label>
        <input id="tagline" name="tagline" defaultValue={props.tagline} className={input} />
        <p className={hint}>Shown under the name on your home page.</p></div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="grid content-start gap-2"><label htmlFor="primary" className={label}>Main colour</label>
          <div className="flex items-center gap-3">
            <input id="primary" name="primary" value={primary} onChange={(e) => setPrimary(e.target.value)} className={input} />
            <input type="color" aria-label="Pick the main colour" value={/^#[0-9a-fA-F]{6}$/.test(primary) ? primary : '#000000'} onChange={(e) => setPrimary(e.target.value.toUpperCase())} className="h-11 w-14 shrink-0 cursor-pointer rounded-[10px] border-2 border-field bg-white p-1" />
          </div></div>
        <div className="grid content-start gap-2"><label htmlFor="accent" className={label}>Highlight colour</label>
          <div className="flex items-center gap-3">
            <input id="accent" name="accent" value={accent} onChange={(e) => setAccent(e.target.value)} className={input} />
            <input type="color" aria-label="Pick the highlight colour" value={/^#[0-9a-fA-F]{6}$/.test(accent) ? accent : '#000000'} onChange={(e) => setAccent(e.target.value.toUpperCase())} className="h-11 w-14 shrink-0 cursor-pointer rounded-[10px] border-2 border-field bg-white p-1" />
          </div></div>
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
