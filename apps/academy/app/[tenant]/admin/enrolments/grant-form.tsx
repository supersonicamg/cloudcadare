'use client'

import { useKeepForm } from '@/lib/use-keep-form'
import { buttonSm, inputSm } from '@/lib/ui'
import { Field } from '../_components/ui'
import { grantAccess } from './actions'

export function GrantForm({ courses }: { courses: { id: string; title: string }[] }) {
  const [s, onSubmit, pending] = useKeepForm(grantAccess)
  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Field id="email" label="Student’s email"><input id="email" name="email" type="email" required className={inputSm} /></Field>
        <Field id="course_id" label="Course">
          <select id="course_id" name="course_id" required className={inputSm}>{courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select>
        </Field>
        <button className={buttonSm} disabled={pending}>{pending ? 'Giving access…' : 'Give access'}</button>
      </div>
      <p className="t-small">Emails are not checked automatically. Confirm who they are first, for example on WhatsApp.</p>
      {s.error && <p role="alert" className="rounded-xl bg-danger-bg px-4 py-3 t-label !text-danger-ink">{s.error}</p>}
      {s.saved && <p role="status" className="rounded-xl bg-ok-bg px-4 py-3 t-label !text-ok-ink">{s.message}</p>}
    </form>
  )
}
