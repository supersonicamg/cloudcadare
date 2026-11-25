'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { buttonLg, buttonQuiet } from '@/lib/ui'
import { saveAnswer, submitAttempt } from '../../../../quiz-actions'

export interface PaperQuestion {
  id: string; type: string; marks: number; stem: { text?: string }; options: { id: string; content?: { text?: string } }[]
}
export interface Paper {
  attempt_id: string; test: { title: string }; server_now: string; deadline_at: string | null
  questions: PaperQuestion[]; answers: Record<string, { response?: { selected?: string | string[] | null }; flagged?: boolean }>
}
type Selected = string | string[] | null

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

export function QuizRunner({ paper, resultHref, exitHref }: { paper: Paper; resultHref: string; exitHref: string }) {
  const router = useRouter()
  const qs = paper.questions
  // coming back to an open attempt lands on the first question that has no answer yet
  const [i, setI] = useState(() => {
    const first = qs.findIndex((x) => paper.answers[x.id]?.response?.selected == null)
    return first < 0 ? 0 : first
  })
  const [answers, setAnswers] = useState<Record<string, Selected>>(() => Object.fromEntries(Object.entries(paper.answers).map(([k, v]) => [k, v.response?.selected ?? null])))
  const [flagged, setFlagged] = useState<Record<string, boolean>>(() => Object.fromEntries(Object.entries(paper.answers).map(([k, v]) => [k, Boolean(v.flagged)])))
  const [saving, setSaving] = useState(0)
  const [failed, setFailed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const pending = useRef<Promise<unknown>[]>([])

  // The server's clock decides when time is up; the browser only shows it. The offset corrects a wrong local clock.
  const [offset] = useState(() => new Date(paper.server_now).getTime() - Date.now())
  const deadline = paper.deadline_at ? new Date(paper.deadline_at).getTime() : null
  const [left, setLeft] = useState<number | null>(() => (deadline === null ? null : Math.max(0, Math.round((deadline - new Date(paper.server_now).getTime()) / 1000))))

  const finish = useCallback(async () => {
    setSubmitting(true)
    await Promise.allSettled(pending.current)
    const r = await submitAttempt(paper.attempt_id)
    if (r.ok) { router.push(resultHref); router.refresh() } else { setSubmitting(false); setFailed(true) }
  }, [paper.attempt_id, resultHref, router])

  useEffect(() => {
    if (deadline === null) return
    const id = setInterval(() => {
      const s = Math.max(0, Math.round((deadline - (Date.now() + offset)) / 1000))
      setLeft(s)
      if (s === 0) { clearInterval(id); void finish() }
    }, 1000)
    return () => clearInterval(id)
  }, [deadline, offset, finish])

  function save(qid: string, selected: Selected, flag: boolean) {
    setSaving((n) => n + 1)
    const p = saveAnswer(paper.attempt_id, qid, { selected }, flag).then((r) => {
      setFailed(!r.ok)
      if (r.closed) void finish()
    }).finally(() => setSaving((n) => n - 1))
    pending.current.push(p)
  }

  const q = qs[i]!
  const multi = q.type === 'mcq_multi'
  const current = answers[q.id] ?? null
  const picked = (id: string) => (Array.isArray(current) ? current.includes(id) : current === id)

  function choose(id: string) {
    let next: Selected
    if (multi) {
      const set = new Set(Array.isArray(current) ? current : [])
      if (set.has(id)) set.delete(id); else set.add(id)
      next = [...set].sort()
      if (next.length === 0) next = null
    } else next = id
    setAnswers((a) => ({ ...a, [q.id]: next }))
    save(q.id, next, Boolean(flagged[q.id]))
  }
  function flag() {
    const f = !flagged[q.id]
    setFlagged((m) => ({ ...m, [q.id]: f }))
    if (answers[q.id] != null) save(q.id, answers[q.id] ?? null, f)
  }

  const answered = qs.filter((x) => answers[x.id] != null && !(Array.isArray(answers[x.id]) && (answers[x.id] as string[]).length === 0)).length

  const letters = 'ABCDEFGHIJKL'
  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex h-16 items-center gap-4 border-b border-border bg-white px-[clamp(16px,2.4vw,32px)]">
        <div className="min-w-0 flex-1 truncate font-semibold">
          <small className="block text-[13px] font-medium text-mute">Quiz · {qs.length} {qs.length === 1 ? 'question' : 'questions'}</small>
          {paper.test.title}
        </div>
        <Link href={exitHref} className="text-base font-semibold text-primary">Save and exit</Link>
      </div>
      <div className="grid flex-1 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="p-[clamp(24px,3.4vw,56px)]">
          <p className="text-[15px] font-semibold text-primary" data-testid="quiz-progress">Question {i + 1} of {qs.length} · {answered} answered</p>
          <div key={q.id}>
            <h1 className="mt-2.5 max-w-[30em] whitespace-pre-line font-heading text-[clamp(24px,2.4vw,32px)] font-bold leading-tight tracking-[-0.03em]" data-testid="quiz-question">{q.stem.text}</h1>
            <p className="mt-2 text-[15px] text-mute">{multi ? 'Choose all that apply.' : 'Choose one.'} {q.marks} {q.marks === 1 ? 'mark' : 'marks'}</p>
            <ul className="mt-7 grid max-w-[640px] gap-3" role={multi ? 'group' : 'radiogroup'} aria-label="Options">
              {q.options.map((o, n) => {
                const on = picked(o.id)
                return (
                  <li key={o.id}>
                    <label className={`relative flex cursor-pointer items-center gap-4 rounded-2xl border-2 px-5 py-[18px] text-lg font-medium leading-snug focus-within:ring-4 focus-within:ring-accent/55 ${on ? 'border-primary bg-tint-1' : 'border-border bg-white hover:border-field'}`}>
                      <input type={multi ? 'checkbox' : 'radio'} name={`q-${q.id}`} checked={on} onChange={() => choose(o.id)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
                      <span aria-hidden="true" className={`grid h-8 w-8 shrink-0 place-items-center border-2 text-sm font-bold ${multi ? 'rounded-lg' : 'rounded-full'} ${on ? 'border-primary bg-primary text-primary-fg' : 'border-field'}`}>{letters[n]}</span>
                      <span>{o.content?.text}</span>
                    </label>
                  </li>
                )
              })}
            </ul>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3.5">
            {i < qs.length - 1 && <button type="button" className={buttonLg} onClick={() => setI(i + 1)}>Next <span aria-hidden="true">→</span></button>}
            {!confirming ? (
              <button type="button" className={i === qs.length - 1 ? buttonLg : buttonQuiet} onClick={() => setConfirming(true)} disabled={submitting}>Finish the quiz</button>
            ) : (
              <div className="flex flex-wrap items-center gap-3" role="alertdialog" aria-label="Finish the quiz">
                <span className="text-base font-medium">{answered < qs.length ? `${qs.length - answered} unanswered. ` : ''}Submit your answers?</span>
                <button type="button" className={buttonLg} onClick={() => void finish()} disabled={submitting}>{submitting ? 'Submitting…' : 'Yes, submit'}</button>
                <button type="button" className={buttonQuiet} onClick={() => setConfirming(false)} disabled={submitting}>Keep going</button>
              </div>
            )}
            <button type="button" onClick={flag} className="text-base font-semibold text-primary" aria-pressed={Boolean(flagged[q.id])}>{flagged[q.id] ? 'Remove the flag' : 'Flag to review later'}</button>
            <button type="button" className="text-base font-semibold text-grey disabled:opacity-40" disabled={i === 0} onClick={() => setI(i - 1)}>Previous</button>
          </div>
          {failed && <p role="alert" className="mt-5 text-[15px] font-semibold text-danger">Something did not save. Your last answer may not be recorded; pick it again.</p>}
        </div>

        <aside className="border-t border-border bg-white px-6 py-7 lg:border-l lg:border-t-0">
          <div className="mb-5 flex items-baseline justify-between border-b-2 border-fg pb-[18px]">
            {left !== null
              ? <b className={`font-heading text-4xl tabular-nums tracking-[-0.04em] ${left <= 60 ? 'text-danger' : ''}`} data-testid="quiz-timer" role="timer">{clock(left)}</b>
              : <b className="font-heading text-2xl tracking-[-0.03em]">No time limit</b>}
            <span className="text-sm text-mute" aria-live="polite">{failed ? 'Could not save. Check your connection.' : saving > 0 ? 'Saving…' : 'Saved'}</span>
          </div>
          <nav aria-label="Questions">
            <h2 className="mb-3.5 text-[15px] font-semibold">Questions</h2>
            <ol className="grid grid-cols-5 gap-2">
              {qs.map((x, n) => {
                const done = answers[x.id] != null
                return (
                  <li key={x.id}>
                    <button type="button" onClick={() => setI(n)} aria-label={`Question ${n + 1}${done ? ', answered' : ''}${flagged[x.id] ? ', flagged' : ''}`} aria-current={n === i ? 'step' : undefined}
                      className={`grid h-11 w-full place-items-center rounded-[10px] border-2 text-[15px] font-semibold ${n === i ? 'border-fg bg-accent' : done ? 'border-tint-1 bg-tint-1' : 'border-border'} ${flagged[x.id] ? 'shadow-[inset_0_-5px_0_var(--color-primary)]' : ''}`}>{n + 1}</button>
                  </li>
                )
              })}
            </ol>
          </nav>
          <div className="mt-[18px] grid gap-2 text-sm text-grey">
            <span className="flex items-center gap-2.5"><i className="h-[18px] w-[18px] rounded-[5px] border-2 border-tint-1 bg-tint-1" />Answered</span>
            <span className="flex items-center gap-2.5"><i className="h-[18px] w-[18px] rounded-[5px] border-2 border-fg bg-accent" />You are here</span>
            <span className="flex items-center gap-2.5"><i className="h-[18px] w-[18px] rounded-[5px] border-2 border-border shadow-[inset_0_-5px_0_var(--color-primary)]" />Flagged to review</span>
            <span className="flex items-center gap-2.5"><i className="h-[18px] w-[18px] rounded-[5px] border-2 border-border" />Not answered</span>
          </div>
        </aside>
      </div>
    </div>
  )
}
