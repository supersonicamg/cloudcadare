'use client'

import { useActionState } from 'react'
import { useKeepForm } from '@/lib/use-keep-form'
import { button, buttonQuiet, buttonSm, hint, input, inputSm, label } from '@/lib/ui'
import { addLesson, addSection, createCourse, setCoursePrice, updateCourse, type FormState } from './actions'

const KINDS = [
  ['course', 'Course'], ['material_pack', 'Study material pack'], ['test_series', 'Test series'], ['live_program', 'Live program'],
] as const

function Status({ s }: { s: FormState }) {
  if (s.error) return <p role="alert" className="text-sm text-danger">{s.error}</p>
  if (s.saved) return <p className="text-sm text-success">Saved.</p>
  return null
}

/** Quick add: a title and a type on one row. Creates a draft and opens it for editing. */
export function CreateCourseForm() {
  const [s, action, pending] = useActionState<FormState, FormData>(createCourse, {})
  return (
    <form action={action} className="flex flex-wrap items-end gap-x-4 gap-y-3">
      <div className="min-w-56 flex-[2_1_16rem]">
        <label htmlFor="title" className={label}>Title</label>
        <input id="title" name="title" required className={inputSm} />
      </div>
      <div className="min-w-44 flex-[1_1_11rem]">
        <label htmlFor="kind" className={label}>Type</label>
        <select id="kind" name="kind" className={inputSm}>{KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      </div>
      <button className={buttonSm} disabled={pending}>{pending ? 'Creating…' : 'Create draft'}</button>
      <div className="basis-full empty:hidden"><Status s={s} /></div>
    </form>
  )
}

export interface CourseFormValues {
  title: string; subtitle: string | null; summary: string | null; level: string; deliveryMode: string
  estimatedMinutes: number | null; outcomes: string[]; requirements: string[]; openEnrolment: boolean; sequential: boolean; certificate: boolean | null
}

export function EditCourseForm({ id, v }: { id: string; v: CourseFormValues }) {
  const [s, onSubmit, pending] = useKeepForm(updateCourse.bind(null, id))
  return (
    <form onSubmit={onSubmit} className="grid max-w-2xl gap-5">
      <div><label htmlFor="title" className={label}>Title</label><input id="title" name="title" defaultValue={v.title} required className={input} /></div>
      <div><label htmlFor="subtitle" className={label}>Subtitle</label><input id="subtitle" name="subtitle" defaultValue={v.subtitle ?? ''} className={input} /></div>
      <div><label htmlFor="summary" className={label}>Summary</label><textarea id="summary" name="summary" rows={4} defaultValue={v.summary ?? ''} className={input} /></div>
      <div className="grid gap-5 sm:grid-cols-3">
        <div><label htmlFor="level" className={label}>Level</label>
          <select id="level" name="level" defaultValue={v.level} className={input}>
            {['all', 'beginner', 'intermediate', 'advanced'].map((l) => <option key={l} value={l}>{l[0]!.toUpperCase() + l.slice(1)}</option>)}
          </select></div>
        <div><label htmlFor="delivery_mode" className={label}>Delivery</label>
          <select id="delivery_mode" name="delivery_mode" defaultValue={v.deliveryMode} className={input}>
            {[['self_paced', 'Self-paced'], ['cohort', 'Cohort'], ['live', 'Live'], ['hybrid', 'Hybrid'], ['offline', 'In person']].map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select></div>
        <div><label htmlFor="estimated_minutes" className={label}>Total minutes</label><input id="estimated_minutes" name="estimated_minutes" inputMode="numeric" defaultValue={v.estimatedMinutes ?? ''} className={input} /></div>
      </div>
      <div><label htmlFor="outcomes" className={label}>What learners will be able to do</label>
        <textarea id="outcomes" name="outcomes" rows={4} defaultValue={v.outcomes.join('\n')} className={input} />
        <p className={hint}>One per line.</p></div>
      <div><label htmlFor="requirements" className={label}>Before they start</label>
        <textarea id="requirements" name="requirements" rows={3} defaultValue={v.requirements.join('\n')} className={input} />
        <p className={hint}>One per line.</p></div>
      <div>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" name="open_enrolment" defaultChecked={v.openEnrolment} /> Anyone with an account can enrol for free
        </label>
        <p className={hint}>Leave this off for paid or invitation-only courses. It stops applying once the course is sold as a product.</p>
      </div>
      <div>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" name="sequential" defaultChecked={v.sequential} /> Learners must finish lessons in order
        </label>
        <p className={hint}>A lesson stays locked until every required lesson before it is done.</p>
      </div>
      {v.certificate !== null && (
        <div>
          <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" name="certificate" defaultChecked={v.certificate} /> Give learners a certificate when they complete the course</label>
        </div>
      )}
      <Status s={s} />
      <div><button className={button} disabled={pending}>{pending ? 'Saving…' : 'Save details'}</button></div>
    </form>
  )
}

export function AddSectionForm({ courseId }: { courseId: string }) {
  const [s, action, pending] = useActionState<FormState, FormData>(addSection.bind(null, courseId), {})
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div><label htmlFor="label" className={label}>Label</label><input id="label" name="label" placeholder="Month 1" className={input} /></div>
      <div className="min-w-60 flex-1"><label htmlFor="stitle" className={label}>New section</label><input id="stitle" name="title" required className={input} /></div>
      <button className={buttonQuiet} disabled={pending}>Add section</button>
      <Status s={s} />
    </form>
  )
}

export function AddLessonForm({ courseId, sectionId, quizzes = false }: { courseId: string; sectionId: string; quizzes?: boolean }) {
  const [s, action, pending] = useActionState<FormState, FormData>(addLesson.bind(null, courseId, sectionId), {})
  return (
    <form action={action} className="mt-3 flex flex-wrap items-end gap-3 rounded-[var(--radius)] bg-muted p-3">
      <div className="min-w-48 flex-1"><label className={label}>Lesson title<input name="title" required className={`${input} mt-1 font-normal`} /></label></div>
      <div><label className={label}>Type
        <select name="type" className={`${input} mt-1 font-normal`}>
          {[['video', 'Video'], ['article', 'Reading'], ['external_link', 'Link'], ['pdf', 'PDF'], ['download', 'Download'], ...(quizzes ? [['quiz', 'Quiz']] : [])].map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select></label></div>
      <div className="w-24"><label className={label}>Minutes<input name="minutes" inputMode="numeric" className={`${input} mt-1 font-normal`} /></label></div>
      <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" name="is_preview" /> Free preview</label>
      <button className={buttonQuiet} disabled={pending}>Add lesson</button>
      <Status s={s} />
    </form>
  )
}

export function PriceForm({ courseId, price, compareAt, gst, selling }: { courseId: string; price: number | null; compareAt: number | null; gst: boolean; selling: boolean }) {
  const [s, onSubmit, pending] = useKeepForm(setCoursePrice.bind(null, courseId))
  const rupees = (m: number | null) => (m === null ? '' : String(m / 100))
  return (
    <form onSubmit={onSubmit} className="grid max-w-xl gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label htmlFor="price" className={label}>Price (₹)</label><input id="price" name="price" inputMode="decimal" defaultValue={rupees(price)} required className={input} /></div>
        <div><label htmlFor="compare_at" className={label}>Original price (₹)</label><input id="compare_at" name="compare_at" inputMode="decimal" defaultValue={rupees(compareAt)} className={input} />
          <p className={hint}>Optional. Shown crossed out.</p></div>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="gst_included" defaultChecked={gst} /> The price includes 18% GST</label>
      {s.error && <p role="alert" className="text-sm text-danger">{s.error}</p>}
      {s.saved && <p className="text-sm text-success">Saved.</p>}
      <div><button className={button} disabled={pending}>{pending ? 'Saving…' : selling ? 'Update price' : 'Start selling'}</button></div>
    </form>
  )
}
