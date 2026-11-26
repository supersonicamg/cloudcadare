'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Ic } from '../../../_components/v11'
import { finishProofUpload, prepareProofUpload } from './actions'

/** The secondary way to send the screenshot: straight to private storage, then recorded on this payment. Folded away by default. */
export function ProofUpload({ orderId, hasFile, utr, open }: { orderId: string; hasFile: boolean; utr: string | null; open?: boolean }) {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [ref, setRef] = useState(utr ?? '')
  const [picked, setPicked] = useState('')
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
      setPicked('')
      router.refresh()
    } catch {
      setState({ error: 'The upload did not go through. Try again.' })
    }
  }

  return (
    <details open={open || undefined}>
      <summary className="link link-s">Or upload it here instead</summary>
      <div className="drop">
        <Ic n="up" />
        <p className="t-card">{picked || 'Choose the screenshot'}</p>
        <p className="t-label">JPG, PNG or PDF, up to 5 MB</p>
        <input id="proof-file" ref={input} type="file" accept="image/jpeg,image/png,application/pdf,.jpg,.jpeg,.png,.pdf"
          onChange={(e) => setPicked(e.target.files?.[0]?.name ?? '')} />
        <label htmlFor="proof-file" className="btn btn-line btn-sm">Choose file</label>
      </div>
      <div className="fld">
        <label htmlFor="proof-utr">UPI reference number <small>(optional, 12 digits)</small></label>
        <input id="proof-utr" className="in" value={ref} onChange={(e) => setRef(e.target.value)} inputMode="numeric" autoComplete="off" maxLength={14}
          aria-describedby="utr-hint" placeholder="e.g. 432198765012" style={{ maxWidth: 320 }} />
        <p id="utr-hint" className="hint">12 numbers, in the payment details of your UPI app.</p>
      </div>
      <div className="form-act">
        <button type="button" className="btn btn-line btn-sm" disabled={state.busy} onClick={send}>{state.busy ? 'Sending…' : 'Upload'}</button>
        {(state.done || hasFile) && <p role="status" className="ok-line"><Ic n="check" s />{state.done ? 'Received. We will check it.' : 'We have your upload.'}</p>}
      </div>
      {state.error && <p role="alert" className="ferr"><Ic n="info" s />{state.error}</p>}
    </details>
  )
}
