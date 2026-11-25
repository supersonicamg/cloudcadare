'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@educore/ui/marks'
import { buttonOutline, inputSm } from '@/lib/ui'
import { finishProofUpload, prepareProofUpload } from './actions'

/** The secondary way to send the screenshot: straight to private storage, then recorded on this payment. Folded away by default. */
export function ProofUpload({ orderId, hasFile, utr, open }: { orderId: string; hasFile: boolean; utr: string | null; open?: boolean }) {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [ref, setRef] = useState(utr ?? '')
  const [state, setState] = useState<{ busy?: boolean; error?: string; done?: boolean }>({})

  async function send() {
    const file = input.current?.files?.[0]
    setState({ busy: true })
    try {
      let path = ''
      if (file) {
        const prep = await prepareProofUpload(orderId, { name: file.name, size: file.size })
        if ('error' in prep) { setState({ error: prep.error }); return }
        const body = new FormData()
        body.append('cacheControl', '3600')
        body.append('', file)
        const put = await fetch(prep.target.signedUrl, { method: 'PUT', body })
        if (!put.ok) { setState({ error: 'The upload did not go through. Try again.' }); return }
        path = prep.target.path
      }
      const res = await finishProofUpload(orderId, path, ref)
      if (res.error) { setState({ error: res.error }); return }
      setState({ done: true })
      if (input.current) input.current.value = ''
      router.refresh()
    } catch {
      setState({ error: 'The upload did not go through. Try again.' })
    }
  }

  return (
    <details className="group border-t border-border pt-4" open={open || undefined}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2.5 t-btn-sm !font-bold text-fg">
        <Icon name="down" className="h-5 w-5 rotate-180 text-primary" />Or upload it here instead
      </summary>
      <div className="grid gap-4 pt-3">
        <div className="grid gap-2">
          <label htmlFor="proof-file" className="t-label !text-fg">Screenshot or PDF</label>
          <input id="proof-file" ref={input} type="file" accept="image/jpeg,image/png,application/pdf,.jpg,.jpeg,.png,.pdf" className="t-label" />
          <p className="t-small">JPG, PNG or PDF, up to 5 MB.</p>
        </div>
        <div className="grid gap-2">
          <label htmlFor="proof-utr" className="t-label !text-fg">UPI reference <span className="font-normal text-mute">(optional)</span></label>
          <input id="proof-utr" value={ref} onChange={(e) => setRef(e.target.value)} inputMode="numeric" autoComplete="off" maxLength={14} className={`${inputSm} max-w-xs tnum`} aria-describedby="utr-hint" />
          <p id="utr-hint" className="t-small">12 numbers, in the payment details of your UPI app.</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <button type="button" className={buttonOutline} disabled={state.busy} onClick={send}>{state.busy ? 'Sending…' : 'Send it to us'}</button>
          {(state.done || hasFile) && <p role="status" className="t-label flex items-center gap-2 !text-deep"><Icon name="check" className="h-5 w-5" />{state.done ? 'Received. We will check it.' : 'We have your upload.'}</p>}
        </div>
        {state.error && <p role="alert" className="t-label flex items-start gap-2 !text-fg"><Icon name="info" className="mt-px h-5 w-5 shrink-0 text-primary" />{state.error}</p>}
      </div>
    </details>
  )
}
