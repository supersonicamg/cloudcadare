'use client'

import { useKeepForm } from '@/lib/use-keep-form'
import { buttonSm, inputSm } from '@/lib/ui'
import type { UpiSettings } from '@educore/core/commerce/upi'
import { saveUpi } from './upi-actions'

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid content-start gap-2">
      <label htmlFor={id} className="t-label !text-fg">{label}</label>
      {children}
      {hint && <p id={`${id}-hint`} className="t-small">{hint}</p>}
    </div>
  )
}

export function UpiForm({ s }: { s: UpiSettings }) {
  const [state, onSubmit, pending] = useKeepForm(saveUpi)
  return (
    <form onSubmit={onSubmit} className="grid gap-5" autoComplete="off">
      <label className="flex min-h-11 items-center gap-3 t-card cursor-pointer">
        <input type="checkbox" name="enabled" defaultChecked={s.enabled} className="h-6 w-6 accent-[var(--color-primary)]" />
        Accept UPI QR payments
      </label>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="vpa" label="UPI ID" hint="Where the money goes. Check it twice: learners pay to this ID.">
          <input id="vpa" name="vpa" defaultValue={s.vpa} placeholder="cloudcadre@okaxis" aria-describedby="vpa-hint" className={inputSm} />
        </Field>
        <Field id="payee_name" label="Name shown to learners" hint="They see this in their UPI app before paying.">
          <input id="payee_name" name="payee_name" defaultValue={s.payeeName} required maxLength={60} aria-describedby="payee_name-hint" className={inputSm} />
        </Field>
        <Field id="whatsapp_number" label="WhatsApp number for screenshots" hint="Learners send their payment screenshot here.">
          <input id="whatsapp_number" name="whatsapp_number" type="tel" defaultValue={s.whatsappNumber} placeholder="+91 98765 43210" aria-describedby="whatsapp_number-hint" className={inputSm} />
        </Field>
        <Field id="alert_email" label="Email for new payments" hint="Optional. Not sent yet: the payments queue shows the count.">
          <input id="alert_email" name="alert_email" type="email" defaultValue={s.alertEmail} aria-describedby="alert_email-hint" className={inputSm} />
        </Field>
        <Field id="hours_text" label="When you check payments">
          <input id="hours_text" name="hours_text" defaultValue={s.hoursText} placeholder="9am to 9pm, Mon to Sat" maxLength={80} className={inputSm} />
        </Field>
        <Field id="sla_text" label="How long it takes">
          <input id="sla_text" name="sla_text" defaultValue={s.slaText} placeholder="usually within 2 hours" maxLength={80} className={inputSm} />
        </Field>
      </div>
      <label className="flex min-h-11 items-center gap-3 t-label !text-fg cursor-pointer">
        <input type="checkbox" name="razorpay_coming_soon" defaultChecked={s.razorpayComingSoon} className="h-5 w-5 accent-[var(--color-primary)]" />
        Show Razorpay as “Coming soon” at checkout, until its keys are saved below
      </label>
      {state.error && <p role="alert" className="t-label !text-fg">{state.error}</p>}
      {state.saved && <p role="status" className="t-label !text-deep">{state.message}</p>}
      <div><button className={buttonSm} disabled={pending}>{pending ? 'Saving…' : 'Save settings'}</button></div>
    </form>
  )
}
