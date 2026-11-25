'use client'

import { useActionState } from 'react'
import { useKeepForm } from '@/lib/use-keep-form'
import { buttonOutline, buttonSm, input, inputSm } from '@/lib/ui'
import { Check, Field } from '../_components/ui'
import { addLesson, addSection, createCourse, renameSection, setCoursePrice, updateCourse, type FormState } from './actions'

const KINDS = [
  ['course', 'Course'], ['live_program', 'Live program'], ['material_pack', 'Study material pack'], ['test_series', 'Test series'],
] as const

function Status({ s, done = 'Saved.' }: { s: FormState; done?: string }) {
  if (s.error) return <p role="alert" className="rounded-xl bg-danger-bg px-4 py-3 t-label !text-danger-ink">{s.error}</p>
  if (s.saved) return <p role="status" className="rounded-xl bg-ok-bg px-4 py-3 t-label !text-ok-ink">{done}</p>
  return null
}

/** A name and a type. Creates a draft and opens it. */
export function CreateCourseForm() {
  const [s, action, pending] = useActionState<FormState, FormData>(createCourse, {})
  return (
    <form action={action} className="grid max-w-xl gap-4">
      <Field id="title" label="Course name"><input id="title" name="title" required className={inputSm} /></Field>
      <Field id="kind" label="Type"><select id="kind" name="kind" className={inputSm}>{KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
      <Status s={s} />
      <div><button className={buttonSm} disabled={pending}>{pending ? 'Creating…' : 'Create course'}</button></div>
    </form>
  )
}

export interface CourseFormValues {
  title: string; subtitle: string | null; summary: string | null; level: string; deliveryMode: string
  estimatedMinutes: number | null; outcomes: string[]; requirements: string[]; openEnrolment: boolean; sequential: boolean; certificate: boolean | null
}

function Group({ title, lead, children }: { title: string; lead?: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid gap-5 border-t border-border pt-6 first:border-t-0 first:pt-0">
      <legend className="float-left mb-1 w-full"><span className="t-card">{title}</span>{lead && <span className="mt-0.5 block t-small">{lead}</span>}</legend>
      {children}
    </fieldset>
  )
}

export function EditCourseForm({ id, v }: { id: string; v: CourseFormValues }) {
  const [s, onSubmit, pending] = useKeepForm(updateCourse.bind(null, id))
  return (
    <form onSubmit={onSubmit} className="grid max-w-2xl gap-6">
      <Group title="What people see" lead="This is the course page before someone joins.">
        <Field id="title" label="Course name"><input id="title" name="title" defaultValue={v.title} required className={input} /></Field>
        <Field id="subtitle" label="One-line description" optional><input id="subtitle" name="subtitle" defaultValue={v.subtitle ?? ''} className={input} /></Field>
        <Field id="summary" label="About the course" optional><textarea id="summary" name="summary" rows={4} defaultValue={v.summary ?? ''} className={input} /></Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="outcomes" label="Students will be able to" hint="One per line." optional><textarea id="outcomes" name="outcomes" rows={5} defaultValue={v.outcomes.join('\n')} className={input} /></Field>
          <Field id="requirements" label="Students need before starting" hint="One per line." optional><textarea id="requirements" name="requirements" rows={5} defaultValue={v.requirements.join('\n')} className={input} /></Field>
        </div>
      </Group>

      <Group title="How it is taught">
        <div className="grid gap-5 sm:grid-cols-3">
          <Field id="level" label="Level">
            <select id="level" name="level" defaultValue={v.level} className={input}>
              {[['all', 'For everyone'], ['beginner', 'Beginner'], ['intermediate', 'Intermediate'], ['advanced', 'Advanced']].map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </Field>
          <Field id="delivery_mode" label="Format">
            <select id="delivery_mode" name="delivery_mode" defaultValue={v.deliveryMode} className={input}>
              {[['live', 'Live classes'], ['self_paced', 'Recorded, at your own pace'], ['cohort', 'In batches'], ['hybrid', 'Online and in person'], ['offline', 'In person']].map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </Field>
          <Field id="estimated_minutes" label="Total minutes" optional><input id="estimated_minutes" name="estimated_minutes" inputMode="numeric" defaultValue={v.estimatedMinutes ?? ''} className={input} /></Field>
        </div>
      </Group>

      <Group title="Who can join, and the rules">
        <div className="grid gap-3">
          <Check name="open_enrolment" defaultChecked={v.openEnrolment} title="Anyone can join for free" hint="Leave off for paid or invite-only courses. It stops applying once you set a price." />
          <Check name="sequential" defaultChecked={v.sequential} title="Students must finish lessons in order" />
          {v.certificate !== null && <Check name="certificate" defaultChecked={v.certificate} title="Give a certificate when a student finishes" />}
        </div>
      </Group>

      <Status s={s} />
      <div><button className={buttonSm} disabled={pending}>{pending ? 'Saving…' : 'Save details'}</button></div>
    </form>
  )
}

export function AddSectionForm({ courseId }: { courseId: string }) {
  const [s, action, pending] = useActionState<FormState, FormData>(addSection.bind(null, courseId), {})
  return (
    <form action={action} className="grid gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1"><Field id="stitle" label="Add a month or topic"><input id="stitle" name="title" required placeholder="Month 2: Azure networking" className={inputSm} /></Field></div>
        <button className={buttonOutline} disabled={pending}>{pending ? 'Adding…' : 'Add month'}</button>
      </div>
      <Status s={s} done="Added." />
    </form>
  )
}

export function RenameSectionForm({ courseId, sectionId, label, title, stacked = false }: { courseId: string; sectionId: string; label: string; title: string; stacked?: boolean }) {
  const [s, onSubmit, pending] = useKeepForm(renameSection.bind(null, courseId, sectionId))
  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      <div className={`grid gap-3 ${stacked ? '' : 'sm:grid-cols-[10rem_1fr_auto] sm:items-end'}`}>
        <Field id={`label-${sectionId}`} label="Small heading" optional><input id={`label-${sectionId}`} name="label" defaultValue={label} placeholder="Month 1" className={inputSm} /></Field>
        <Field id={`title-${sectionId}`} label="Name"><input id={`title-${sectionId}`} name="title" defaultValue={title} required className={inputSm} /></Field>
        <button className={buttonOutline} disabled={pending}>{pending ? 'Saving…' : 'Save name'}</button>
      </div>
      <Status s={s} />
    </form>
  )
}

export function AddLessonForm({ courseId, sectionId, quizzes = false }: { courseId: string; sectionId: string; quizzes?: boolean }) {
  const [s, action, pending] = useActionState<FormState, FormData>(addLesson.bind(null, courseId, sectionId), {})
  return (
    <form action={action} className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_14rem_auto] sm:items-end">
        <Field id={`new-${sectionId}`} label="Lesson name"><input id={`new-${sectionId}`} name="title" required className={inputSm} /></Field>
        <Field id={`type-${sectionId}`} label="What is it?">
          <select id={`type-${sectionId}`} name="type" className={inputSm}>
            {[['article', 'Reading page'], ['external_link', 'Web link'], ...(quizzes ? [['quiz', 'Quiz']] : []), ['video', 'Video from a link (YouTube, Teams…)'], ['live', 'Class recording']].map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </Field>
        <button className={buttonOutline} disabled={pending}>{pending ? 'Adding…' : 'Add lesson'}</button>
      </div>
      <Status s={s} done="Added. Open it in the list above to put its content in." />
    </form>
  )
}

export function PriceForm({ courseId, price, compareAt, gst, selling }: { courseId: string; price: number | null; compareAt: number | null; gst: boolean; selling: boolean }) {
  const [s, onSubmit, pending] = useKeepForm(setCoursePrice.bind(null, courseId))
  const rupees = (m: number | null) => (m === null ? '' : String(m / 100))
  return (
    <form onSubmit={onSubmit} className="grid max-w-xl gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="price" label="Price (₹)"><input id="price" name="price" inputMode="decimal" defaultValue={rupees(price)} required className={input} /></Field>
        <Field id="compare_at" label="Old price (₹)" hint="Shown crossed out." optional><input id="compare_at" name="compare_at" inputMode="decimal" defaultValue={rupees(compareAt)} className={input} /></Field>
      </div>
      <Check name="gst_included" defaultChecked={gst} title="The price includes 18% GST" />
      <Status s={s} />
      <div><button className={buttonSm} disabled={pending}>{pending ? 'Saving…' : selling ? 'Update price' : 'Start selling'}</button></div>
    </form>
  )
}
