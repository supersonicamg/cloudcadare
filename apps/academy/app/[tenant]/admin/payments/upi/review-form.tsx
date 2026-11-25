'use client'

import { useActionState, useState } from 'react'
import { Icon } from '@educore/ui/marks'
import { buttonOutline, buttonSm, inputSm } from '@/lib/ui'
import { approveProof, rejectProof, type ReviewState } from './actions'

const REASONS = [
  ['amount_mismatch', 'Amount does not match'],
  ['not_received', 'Payment not received'],
  ['screenshot_unclear', 'Screenshot unclear'],
  ['wrong_account', 'Paid to a different account'],
  ['duplicate', 'Duplicate'],
] as const

const tick = 'flex cursor-pointer items-start gap-3 rounded-xl border-2 border-field bg-white p-3.5 t-label !text-grey has-[:checked]:border-primary'

/** The decision. Verify stays disabled until the "I can see the payment" tick is set; that tick is also checked by the database. */
export function ReviewForm(p: {
  proofId: string
  source: 'whatsapp' | 'upload'
  courseTitle: string
  pending: boolean
  canVerify: boolean
  message: string
  chatHref: string | null
}) {
  const [approve, approveAction, approving] = useActionState<ReviewState, FormData>(approveProof.bind(null, p.proofId), {})
  const [reject, rejectAction, rejecting] = useActionState<ReviewState, FormData>(rejectProof.bind(null, p.proofId), {})
  const [money, setMoney] = useState(false)
  const [seen, setSeen] = useState(false)
  const [copied, setCopied] = useState(false)
  const ready = money && (p.source === 'upload' || seen)
  const result = approve.message ? approve : reject.message ? reject : null
  const error = approve.error ?? reject.error

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(p.message)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard blocked: the text is shown below so it can be selected */ }
  }

  return (
    <div className="grid gap-4">
      {p.pending && p.canVerify && (
        <>
          <form action={approveAction} className="grid gap-3">
            <label className={tick}>
              <input type="checkbox" name="money_seen" checked={money} onChange={(e) => setMoney(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-primary)]" />
              <span><b className="font-bold !text-fg">I can see this payment</b> in our UPI app or bank statement.</span>
            </label>
            {p.source === 'whatsapp' && (
              <label className={tick}>
                <input type="checkbox" name="whatsapp_seen" checked={seen} onChange={(e) => setSeen(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-primary)]" />
                <span><b className="font-bold !text-fg">I saw the screenshot</b> the learner sent on WhatsApp.</span>
              </label>
            )}
            <button disabled={!ready || approving} className={`${buttonSm} !h-14 w-full !text-base`}>
              {approving ? 'Verifying…' : `Verify and unlock ${p.courseTitle}`}
            </button>
          </form>
          <details className="group rounded-xl border-2 border-field bg-white">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-3.5 t-label !font-bold !text-fg">
              Reject with a reason
              <span aria-hidden="true" className="text-xl leading-none group-open:hidden">+</span><span aria-hidden="true" className="hidden text-xl leading-none group-open:inline">–</span>
            </summary>
            <form action={rejectAction} className="grid gap-3 border-t border-border p-3.5">
              <div className="grid gap-1.5">
                <label htmlFor="rj-reason" className="t-label !text-fg">Reason</label>
                <select id="rj-reason" name="reason" required defaultValue="" className={inputSm}>
                  <option value="" disabled>Choose a reason</option>
                  {REASONS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                </select>
              </div>
              <div className="grid gap-1.5">
                <label htmlFor="rj-note" className="t-label !text-fg">Note to the learner <span className="font-normal text-mute">(optional)</span></label>
                <textarea id="rj-note" name="note" rows={3} maxLength={500} placeholder="Your screenshot shows ₹40,000. ₹9,999 is still due."
                  className="w-full rounded-[10px] border-2 border-field bg-white px-3.5 py-2.5 t-label !text-fg outline-none focus:border-primary focus:ring-4 focus:ring-accent/55" />
              </div>
              <button disabled={rejecting} className={`${buttonOutline} w-full`}>{rejecting ? 'Sending…' : 'Send rejection'}</button>
            </form>
          </details>
        </>
      )}

      {error && <p role="alert" className="t-label flex items-start gap-3 rounded-2xl bg-muted p-3.5 !text-fg shadow-[inset_3px_0_0_var(--color-fg)]"><Icon name="info" className="mt-0.5 h-5 w-5 shrink-0" />{error}</p>}
      {result && <p role="status" className="t-label flex items-start gap-3 rounded-2xl bg-[#E4EFEB] p-3.5 !text-deep"><Icon name="check" className="mt-0.5 h-5 w-5 shrink-0" />{result.message}</p>}

      <div className="grid gap-2 border-t border-border pt-4">
        <p className="t-label !text-fg">Message for the learner</p>
        <p className="t-small whitespace-pre-line break-words rounded-xl bg-muted p-3">{p.message}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={copy} className={buttonOutline}>{copied ? 'Copied' : 'Copy WhatsApp message'}</button>
          {p.chatHref && <a href={p.chatHref} target="_blank" rel="noopener noreferrer" className={buttonOutline}>Open chat</a>}
        </div>
        <p className="t-small" aria-live="polite">{copied ? 'Copied to the clipboard.' : 'Email goes out by itself. WhatsApp is sent by hand.'}</p>
      </div>
    </div>
  )
}
