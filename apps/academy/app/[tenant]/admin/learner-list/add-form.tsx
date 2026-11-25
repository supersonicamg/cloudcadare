'use client'

import { useActionState, useMemo, useRef, useState } from 'react'
import { Icon } from '@educore/ui/marks'
import { parseLearnerList } from '@educore/core/accounts'
import { buttonOutline, buttonSm, inputSm } from '@/lib/ui'
import { addToList, type AddResult } from './actions'

interface Option { id: string; label: string }

const group = (title: string, list: string[]) =>
  list.length ? (
    <li className="grid gap-0.5">
      <p className="t-label !text-fg">{title}: <span className="tnum">{list.length}</span></p>
      <p className="t-small break-words">{list.slice(0, 8).join(', ')}{list.length > 8 ? ` and ${list.length - 8} more` : ''}</p>
    </li>
  ) : null

export function AddForm({ courses, batches }: { courses: Option[]; batches: Option[] }) {
  const [state, action, pending] = useActionState<AddResult, FormData>(addToList, {})
  const [text, setText] = useState('')
  const file = useRef<HTMLInputElement>(null)
  // The same rules the server uses, so the preview never disagrees with the result.
  const preview = useMemo(() => parseLearnerList(text), [text])
  const flagged = preview.invalid.length + preview.repeats.length

  return (
    <form action={action} className="grid gap-4">
      <div className="grid gap-2">
        <label htmlFor="emails" className="t-label !text-fg">Emails</label>
        <textarea id="emails" name="emails" rows={6} value={text} onChange={(e) => setText(e.target.value)} required spellCheck={false}
          aria-describedby="emails-hint" placeholder={'anita@example.com\nvikram@example.com, Vikram S'}
          className="w-full rounded-[10px] border-2 border-field bg-white px-3.5 py-2.5 t-label !text-fg outline-none focus:border-primary focus:ring-4 focus:ring-accent/55" />
        <p id="emails-hint" className="t-small">One per line, or comma separated. You can paste a column from a spreadsheet, with a name after the email.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <div className="grid gap-2">
          <label htmlFor="course_id" className="t-label !text-fg">Course</label>
          <select id="course_id" name="course_id" required className={inputSm}>{courses.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
        </div>
        <div className="grid gap-2">
          <label htmlFor="batch_id" className="t-label !text-fg">Batch <span className="font-normal text-mute">(optional)</span></label>
          <select id="batch_id" name="batch_id" className={inputSm}><option value="">No batch</option>{batches.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</select>
        </div>
      </div>
      <div className="grid gap-2">
        <label htmlFor="until" className="t-label !text-fg">Access until <span className="font-normal text-mute">(optional)</span></label>
        <input id="until" name="until" type="date" className={inputSm} aria-describedby="until-hint" />
        <p id="until-hint" className="t-small">Blank: the batch end plus 6 months. With no batch, access has no end date.</p>
      </div>

      {preview.valid.length + flagged > 0 && (
        <p role="status" className="t-label flex items-start gap-3 rounded-2xl bg-tint-2 p-3.5 !text-fg">
          <Icon name="info" className="mt-0.5 h-5 w-5 shrink-0" />
          <span>
            <b className="font-bold">Check before adding:</b> <span className="tnum">{preview.valid.length}</span> will be added
            {preview.invalid.length > 0 && <>, <span className="tnum">{preview.invalid.length}</span> look wrong ({preview.invalid.slice(0, 3).join(', ')})</>}
            {preview.repeats.length > 0 && <>, <span className="tnum">{preview.repeats.length}</span> repeated</>}.
          </span>
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button className={buttonSm} disabled={pending || preview.valid.length === 0}>{pending ? 'Adding…' : 'Add to list'}</button>
        <button type="button" className={buttonOutline} onClick={() => file.current?.click()}>Load a CSV file</button>
        <input ref={file} type="file" accept=".csv,text/csv,text/plain" className="sr-only" tabIndex={-1} aria-label="CSV file with emails"
          onChange={async (e) => { const f = e.target.files?.[0]; if (f && f.size < 200_000) setText(await f.text()); e.target.value = '' }} />
      </div>

      {state.error && <p role="alert" className="t-label flex items-start gap-2 !text-fg"><Icon name="info" className="mt-px h-5 w-5 shrink-0 text-primary" />{state.error}</p>}
      {state.done && (
        <div role="status" className="grid gap-3 border-t-2 border-fg pt-3">
          <p className="t-card flex items-center gap-2"><Icon name="check" className="h-5 w-5 text-primary" />{state.done.added.length ? `${state.done.added.length} added to the list` : 'Nothing new was added'}</p>
          <ul className="grid gap-2.5">
            {group('Already on the list', state.done.existing)}
            {group('Already have access', state.done.hasAccess)}
            {group('Look wrong, not added', state.done.invalid)}
            {group('Repeated in your paste', state.done.repeats)}
          </ul>
        </div>
      )}
    </form>
  )
}
