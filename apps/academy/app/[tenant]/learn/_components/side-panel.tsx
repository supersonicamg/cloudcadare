'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { LearnSection } from '@/lib/learn'
import { clock } from '@/lib/clock'
import { Ic } from '../../_components/v11'
import { KIND, dripDate, minutes, placeOf } from './lesson-meta'
import { useStage } from './stage'

const NOTE_ICON = { note: 'note', bookmark: 'bookmark', highlight: 'hl' } as const

/**
 * The panel beside a lesson, in two tabs: Lessons (the month you are in, with the current lesson marked) and My notes (what
 * the learner wrote on this lesson). On a laptop it sits next to the lesson. On a phone it is hidden, and the two outline
 * buttons under the lesson (SheetButtons) open it right there, one tab each.
 */
export function SidePanel({ slug, sections, currentId, notesOn }: { slug: string; sections: LearnSection[]; currentId: string; notesOn: boolean }) {
  const stage = useStage()
  const [tab, setTab] = useState<'list' | 'notes'>('list')
  // A phone button picks the tab it was pressed for.
  useEffect(() => { if (stage.sheet) { const t = setTimeout(() => setTab(stage.sheet === 'notes' && notesOn ? 'notes' : 'list'), 0); return () => clearTimeout(t) } }, [stage.sheet, notesOn])
  const open = stage.sheet !== null
  const both = notesOn

  return (
    <aside className={`side${open ? ' open' : ''}`} id="side-panel" aria-label="Lessons and notes">
      {both && (
        <div className="tabs" role="tablist" aria-label="Side panel">
          <button type="button" role="tab" id="tab-list" aria-selected={tab === 'list'} aria-controls="panel-list" onClick={() => setTab('list')}>Lessons</button>
          <button type="button" role="tab" id="tab-notes" aria-selected={tab === 'notes'} aria-controls="panel-notes" onClick={() => setTab('notes')}>
            My notes{stage.notes.length > 0 && <> <em>{stage.notes.length}</em></>}
          </button>
        </div>
      )}
      <div role="tabpanel" id="panel-list" aria-labelledby={both ? 'tab-list' : undefined} aria-label={both ? undefined : 'Lessons in this month'} hidden={both && tab !== 'list'}>
        <LessonRows slug={slug} sections={sections} currentId={currentId} />
      </div>
      {both && <div role="tabpanel" id="panel-notes" aria-labelledby="tab-notes" hidden={tab !== 'notes'}><NotesList /></div>}
    </aside>
  )
}

/** The phone's two outline buttons under the lesson: each opens the panel on its tab, and pressing it again closes it. */
export function SheetButtons({ notesOn }: { notesOn: boolean }) {
  const { sheet, setSheet, notes } = useStage()
  const press = (k: 'list' | 'notes') => {
    if (sheet === k) { setSheet(null); return }
    setSheet(k)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    setTimeout(() => document.getElementById('side-panel')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }), 0)
  }
  return (
    <div className="sheet-btns" role="group" aria-label="Lesson tools">
      <button type="button" className="btn btn-line btn-sm" style={{ flex: 1 }} aria-expanded={sheet === 'list'} aria-controls="side-panel" onClick={() => press('list')}><Ic n="list" />Lessons</button>
      {notesOn && <button type="button" className="btn btn-line btn-sm" style={{ flex: 1 }} aria-expanded={sheet === 'notes'} aria-controls="side-panel" onClick={() => press('notes')}><Ic n="note" />My notes{notes.length > 0 ? ` (${notes.length})` : ''}</button>}
    </div>
  )
}

function LessonRows({ slug, sections, currentId }: { slug: string; sections: LearnSection[]; currentId: string }) {
  const list = useRef<HTMLOListElement>(null)
  const place = placeOf(sections, currentId)
  // The list opens with the lesson you are on in view.
  useEffect(() => {
    const ol = list.current
    const cur = ol?.querySelector<HTMLElement>('[aria-current]')
    if (!ol || !cur) return
    ol.scrollTop = Math.max(0, cur.getBoundingClientRect().top - ol.getBoundingClientRect().top + ol.scrollTop - ol.clientHeight / 2 + cur.clientHeight / 2)
  }, [])
  if (!place) return <div className="foot"><Link className="link link-s" href={`/learn/${slug}/material`}>See the whole course</Link></div>
  const done = place.lessons.filter((l) => l.done).length
  return (
    <>
      <div className="side-h"><p className="t-label"><b>{place.label}</b>{place.month.title !== place.label ? <> · {place.month.title}</> : null}</p><p className="t-label">{done} of {place.lessons.length} done</p></div>
      <ol className="side-l" ref={list}>
        {place.lessons.map((l, i) => {
          const here = l.id === currentId
          const meta = [KIND[l.type] ?? l.type, l.type === 'quiz' || l.type === 'test' ? null : minutes(l.durationSeconds)].filter(Boolean).join(' · ')
          if (l.lock) {
            return (
              <li key={l.id}>
                <div className="lrow locked">
                  <span className="n lock"><Ic n="lock" s /><span className="sr">Locked</span></span>
                  <span className="tx"><b>{l.title}</b><span>{l.lock.reason === 'drip' && l.lock.unlocksAt ? `Opens ${dripDate(l.lock.unlocksAt)}` : 'Finish the earlier lessons first'}</span></span>
                </div>
              </li>
            )
          }
          return (
            <li key={l.id}>
              <Link className={`lrow${here ? ' cur' : ''}`} href={`/learn/${slug}/${l.id}`} aria-current={here ? 'page' : undefined}>
                <span className={`n${l.done ? ' done' : ''}`}>{l.done ? <><Ic n="check" s /><span className="sr">Done</span></> : i + 1}</span>
                <span className="tx"><b>{l.title}</b><span>{meta}{here ? ' · now' : ''}</span></span>
              </Link>
            </li>
          )
        })}
      </ol>
      <div className="foot"><Link className="link link-s" href={`/learn/${slug}/material`}>See the whole course</Link></div>
    </>
  )
}

function NotesList() {
  const { mode, notes, undo, undoRemove, jump, remove, focusNote, setSheet } = useStage()
  return (
    <>
      {undo && (
        <p role="status" className="note-l side-undo">
          <span>{undo.kind === 'bookmark' ? 'Bookmark' : undo.kind === 'highlight' ? 'Highlight' : 'Note'} deleted.</span>
          <button type="button" className="link link-s" onClick={undoRemove}>Undo</button>
        </p>
      )}
      {notes.length ? (
        <ul className="snotes" aria-label="Your notes on this lesson">
          {notes.map((n) => {
            const place = n.positionSeconds !== null ? clock(n.positionSeconds) : n.pageNo !== null ? `Page ${n.pageNo}` : null
            const icon = <Ic n={NOTE_ICON[n.kind]} s />
            return (
              <li key={n.id}>
                {place
                  ? <button type="button" className="at" onClick={() => { jump(n); setSheet(null) }} aria-label={`Go to ${place}`}>{icon}{place}</button>
                  : <span className="at plain">{icon}</span>}
                {n.body ? <p>{n.kind === 'highlight' ? <mark>{n.body}</mark> : n.body}</p> : <p className="t-label">{n.kind === 'bookmark' ? 'Bookmark' : 'Note'}</p>}
                <button type="button" className="x" onClick={() => remove(n.id)} aria-label={`Delete this ${n.kind}`}><Ic n="x" s /></button>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="snotes-empty">
          <p className="t-small"><b>No notes on this lesson yet.</b>{mode === 'time' ? ' Press N while it plays, or write one under the video.' : ' Write one under the lesson.'}</p>
          <button type="button" className="link link-s" onClick={focusNote}>Write the first note</button>
        </div>
      )}
      <div className="foot"><Link href="/learn/notes" className="link link-s">See all my notes</Link></div>
    </>
  )
}
