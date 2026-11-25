'use client'

import { useKeepForm } from '@/lib/use-keep-form'
import { button, hint, input, label } from '@/lib/ui'
import { grantAccess } from './actions'

export function GrantForm({ courses }: { courses: { id: string; title: string }[] }) {
  const [s, onSubmit, pending] = useKeepForm(grantAccess)
  return (
    <form onSubmit={onSubmit} className="grid max-w-2xl gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <div><label htmlFor="email" className={label}>Learner&rsquo;s email</label><input id="email" name="email" type="email" required className={input} /></div>
      <div><label htmlFor="course_id" className={label}>Course</label>
        <select id="course_id" name="course_id" required className={input}>{courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select></div>
      <button className={button} disabled={pending}>{pending ? 'Giving access…' : 'Give access'}</button>
      <div className="sm:col-span-3">
        <p className={hint}>They must have signed in to your academy at least once.</p>
        {s.error && <p role="alert" className="mt-2 text-sm text-danger">{s.error}</p>}
        {s.saved && <p className="mt-2 text-sm text-success">{s.message}</p>}
      </div>
    </form>
  )
}
