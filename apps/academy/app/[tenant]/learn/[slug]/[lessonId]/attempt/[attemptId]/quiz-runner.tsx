'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Ic } from '../../../../../_components/v11'
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
const isAnswered = (v: Selected | undefined) => v != null && !(Array.isArray(v) && v.length === 0)

/** One question per screen, the answers as big rows you can tap anywhere. Every pick is saved as it is made. */
export function QuizRunner({ paper, resultHref }: { paper: Paper; resultHref: string }) {
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
  function go(n: number) { setI(n); setConfirming(false) }

  const answered = qs.filter((x) => isAnswered(answers[x.id])).length
  const last = i === qs.length - 1
  const unanswered = qs.length - answered

  const letters = 'ABCDEFGHIJKL'
  return (
    <div className="qz">
      <h1 className="t-label">
        <b>{paper.test.title}</b> · <span data-testid="quiz-progress">Question {i + 1} of {qs.length} · {answered} answered</span> ·{' '}
        {left !== null ? <><b className="tnum" data-testid="quiz-timer" role="timer">{clock(left)}</b> left</> : 'no time limit'}
      </h1>
      <div className="qsteps" aria-hidden="true" style={{ gridTemplateColumns: `repeat(${qs.length}, minmax(0, 1fr))` }}>
        {qs.map((x, n) => <i key={x.id} className={n === i ? 'c' : isAnswered(answers[x.id]) ? 'd' : undefined} />)}
      </div>

      <fieldset key={q.id}>
        <legend className="t-h3" data-testid="quiz-question" style={{ whiteSpace: 'pre-line' }}>{q.stem.text}</legend>
        <p className="t-label" style={{ marginTop: 8 }}>{multi ? 'Choose all that apply.' : 'Choose one.'} {q.marks} {q.marks === 1 ? 'mark' : 'marks'}</p>
        <div className="opts">
          {q.options.map((o, n) => (
            <label key={o.id} className="opt">
              <input type={multi ? 'checkbox' : 'radio'} name={`q-${q.id}`} checked={picked(o.id)} onChange={() => choose(o.id)} />
              <span className="lt" aria-hidden="true">{letters[n]}</span>
              <span>{o.content?.text}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="acts">
        <div className="lft">
          {i > 0 && <button type="button" className="link link-s" onClick={() => go(i - 1)}>Previous question</button>}
          <span className="t-label">
            <span aria-live="polite">{failed ? 'Could not save. Check your connection.' : saving > 0 ? 'Saving…' : 'Saved'}</span>
            {' '}· Answers save as you go. You can leave and come back.
          </span>
        </div>
        {confirming ? (
          <div className="qconfirm" role="alertdialog" aria-label="Finish the quiz">
            <p className="t-card">{unanswered > 0 ? `${unanswered} unanswered. ` : ''}Submit your answers?</p>
            <div>
              <button type="button" className="btn" onClick={() => void finish()} disabled={submitting}>{submitting ? 'Submitting…' : 'Yes, submit'}</button>
              <button type="button" className="link link-s" onClick={() => setConfirming(false)} disabled={submitting}>Keep going</button>
            </div>
          </div>
        ) : last ? (
          <button type="button" className="btn" onClick={() => setConfirming(true)} disabled={submitting}>Finish the quiz</button>
        ) : (
          <button type="button" className="btn" onClick={() => go(i + 1)}>Next question</button>
        )}
      </div>

      {failed && <p role="alert" className="note-l qfail"><Ic n="info" s /><span>Something did not save. Your last answer may not be recorded; pick it again.</span></p>}

      <div className="qtools">
        <button type="button" className="link link-s" onClick={flag} aria-pressed={Boolean(flagged[q.id])}>{flagged[q.id] ? 'Remove the flag' : 'Flag to review later'}</button>
        {!last && !confirming && <button type="button" className="link link-s" onClick={() => setConfirming(true)} disabled={submitting}>Finish the quiz</button>}
        <details className="qnav">
          <summary className="link link-s">All questions</summary>
          <ol className="qgrid">
            {qs.map((x, n) => (
              <li key={x.id}>
                <button type="button" onClick={() => go(n)} aria-current={n === i ? 'step' : undefined} data-done={isAnswered(answers[x.id]) ? 'true' : undefined} data-flag={flagged[x.id] ? 'true' : undefined}
                  aria-label={`Question ${n + 1}${isAnswered(answers[x.id]) ? ', answered' : ', not answered'}${flagged[x.id] ? ', flagged' : ''}`}>{n + 1}</button>
              </li>
            ))}
          </ol>
          <p className="t-label">Dark: answered. Underlined: flagged to review.</p>
        </details>
      </div>
    </div>
  )
}
