'use client'

import { useState } from 'react'
import { useKeepForm } from '@/lib/use-keep-form'
import { button, hint, input, label } from '@/lib/ui'
import { saveQuestion, updateQuiz } from '../actions'

const LETTERS = ['a', 'b', 'c', 'd', 'e', 'f'] as const

export function QuizSettingsForm({ courseId, lessonId, testId, v }: {
  courseId: string; lessonId: string; testId: string
  v: { title: string; instructions: string; passPct: number | null; minutes: number | null; maxAttempts: number | null; shuffleQuestions: boolean; shuffleOptions: boolean }
}) {
  const [s, onSubmit, pending] = useKeepForm(updateQuiz.bind(null, courseId, lessonId, testId))
  return (
    <form onSubmit={onSubmit} className="grid max-w-2xl gap-5">
      <div><label htmlFor="title" className={label}>Title</label><input id="title" name="title" defaultValue={v.title} required className={input} /></div>
      <div><label htmlFor="instructions" className={label}>Instructions</label><textarea id="instructions" name="instructions" rows={3} defaultValue={v.instructions} className={input} />
        <p className={hint}>Shown before the learner starts. Optional.</p></div>
      <div className="grid gap-5 sm:grid-cols-3">
        <div><label htmlFor="pass_pct" className={label}>Pass mark (%)</label><input id="pass_pct" name="pass_pct" inputMode="numeric" defaultValue={v.passPct ?? ''} className={input} /><p className={hint}>Blank: finishing it is enough.</p></div>
        <div><label htmlFor="minutes" className={label}>Time limit (minutes)</label><input id="minutes" name="minutes" inputMode="numeric" defaultValue={v.minutes ?? ''} className={input} /><p className={hint}>Blank: no limit.</p></div>
        <div><label htmlFor="max_attempts" className={label}>Attempts allowed</label><input id="max_attempts" name="max_attempts" inputMode="numeric" defaultValue={v.maxAttempts ?? ''} className={input} /><p className={hint}>Blank: unlimited.</p></div>
      </div>
      <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" name="shuffle_questions" defaultChecked={v.shuffleQuestions} /> Shuffle the questions</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="shuffle_options" defaultChecked={v.shuffleOptions} /> Shuffle the options</label>
      </div>
      {s.error && <p role="alert" className="text-sm text-danger">{s.error}</p>}
      {s.saved && <p className="text-sm text-success">Saved.</p>}
      <div><button className={button} disabled={pending}>{pending ? 'Saving…' : 'Save settings'}</button></div>
    </form>
  )
}

export interface QuestionValues { id: string; type: string; text: string; marks: number; explanation: string; options: Record<string, string>; correct: string[] }

export function QuestionForm({ courseId, lessonId, testId, v }: { courseId: string; lessonId: string; testId: string; v: QuestionValues | null }) {
  const [s, onSubmit, pending] = useKeepForm(saveQuestion.bind(null, courseId, lessonId, testId, v?.id ?? null))
  const [type, setType] = useState(v?.type ?? 'mcq_single')
  const multi = type === 'mcq_multi'
  return (
    <form onSubmit={onSubmit} className="grid max-w-2xl gap-5">
      <div className="grid gap-5 sm:grid-cols-[1fr_8rem]">
        <div><label htmlFor="type" className={label}>Question type</label>
          <select id="type" name="type" value={type} onChange={(e) => setType(e.target.value)} className={input}>
            <option value="mcq_single">One correct answer</option><option value="mcq_multi">Several correct answers</option><option value="true_false">True or false</option>
          </select></div>
        <div><label htmlFor="marks" className={label}>Marks</label><input id="marks" name="marks" inputMode="decimal" defaultValue={v?.marks ?? 1} className={input} /></div>
      </div>
      <div><label htmlFor="text" className={label}>Question</label><textarea id="text" name="text" rows={3} defaultValue={v?.text ?? ''} required className={input} /></div>

      {type === 'true_false' ? (
        <fieldset className="flex gap-6 text-sm"><legend className="mb-1 text-sm font-medium">The statement is</legend>
          <label className="flex items-center gap-2"><input type="radio" name="tf" value="true" defaultChecked={v?.correct[0] === 'true'} /> True</label>
          <label className="flex items-center gap-2"><input type="radio" name="tf" value="false" defaultChecked={v?.correct[0] === 'false'} /> False</label>
        </fieldset>
      ) : (
        <fieldset className="grid gap-3">
          <legend className="mb-1 text-sm font-medium">Options <span className="font-normal text-fg/60">· tick {multi ? 'every correct one' : 'the correct one'}</span></legend>
          {LETTERS.map((id, i) => (
            <div key={id} className="flex items-center gap-3">
              <input type={multi ? 'checkbox' : 'radio'} name="correct" value={id} defaultChecked={v?.correct.includes(id)} aria-label={`Option ${i + 1} is correct`} />
              <input name={`option_${id}`} defaultValue={v?.options[id] ?? ''} aria-label={`Option ${i + 1}`} placeholder={i < 2 ? 'Required' : 'Optional'} className={input} autoComplete="off" />
            </div>
          ))}
        </fieldset>
      )}

      <div><label htmlFor="explanation" className={label}>Explanation</label><textarea id="explanation" name="explanation" rows={2} defaultValue={v?.explanation ?? ''} className={input} />
        <p className={hint}>Shown to the learner with the right answer after they submit. Optional.</p></div>
      {s.error && <p role="alert" className="text-sm text-danger">{s.error}</p>}
      {s.saved && <p className="text-sm text-success">Saved.</p>}
      <div><button className={button} disabled={pending}>{pending ? 'Saving…' : v ? 'Save question' : 'Add question'}</button></div>
    </form>
  )
}
