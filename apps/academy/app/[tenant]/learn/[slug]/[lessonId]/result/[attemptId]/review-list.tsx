'use client'

import { useState } from 'react'
import { Ic } from '../../../../../_components/v11'

export interface ReviewItem {
  id: string; n: number; text: string
  /** true right, false wrong, null left blank. */
  right: boolean | null
  yours: string | null; answer: string; marks: string; explanation: string | null
}

/** Every question with your answer; the ones to review come first when the quiz is long, and one button shows the rest. */
export function ReviewList({ items }: { items: ReviewItem[] }) {
  const toReview = items.filter((x) => x.right !== true)
  const right = items.length - toReview.length
  const long = items.length > 6 && toReview.length > 0
  const [all, setAll] = useState(!long)
  const shown = all ? items : toReview
  return (
    <section className="blk" aria-labelledby="rv-h">
      <div className="blk-h"><h2 className="t-h3" id="rv-h">Your answers</h2><p className="t-small"><b>{right}</b> right · <b>{toReview.length}</b> to review</p></div>
      <ol className="rv rows">
        {shown.map((q) => (
          <li key={q.id} data-testid="review-item">
            <span className={`mk${q.right === true ? '' : ' x'}`} role="img" aria-label={q.right === true ? 'Right' : q.right === false ? 'Wrong' : 'Not answered'}><Ic n={q.right === true ? 'check' : 'x'} s /></span>
            <span>
              <b className="t-card">{q.text}</b><br />
              <span className="t-label" data-testid="review-verdict">{q.right === true ? 'Correct' : q.right === null ? 'Not answered' : 'Not correct'} · {q.marks}</span><br />
              <span className="t-label">
                {q.yours ? <>Your answer: {q.yours}. </> : null}
                {q.right === true ? null : <b>Right answer: {q.answer}.</b>}
              </span>
              {q.explanation && <><br /><span className="t-label">Explanation: {q.explanation}</span></>}
            </span>
            <span className="t-label">Q{q.n}</span>
          </li>
        ))}
      </ol>
      {long && (
        <p style={{ marginTop: 12 }}>
          <button type="button" className="link link-s" onClick={() => setAll(!all)} aria-expanded={all}>{all ? 'Show only the ones to review' : `Show all ${items.length} answers`}</button>
        </p>
      )}
    </section>
  )
}
