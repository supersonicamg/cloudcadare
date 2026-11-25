'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { Icon } from '@educore/ui/marks'
import { clock } from '@/lib/clock'
import { useStage } from './stage'

const KIND_ICON = { note: 'note', bookmark: 'bookmark', highlight: 'highlight' } as const

/**
 * The panel beside a lesson. Two tabs: Lessons (the course, with the current lesson marked) and My notes (what the learner
 * wrote on this lesson). On a laptop it sits next to the lesson; on a phone it is a sheet that the two buttons in the
 * bottom bar open. The lesson list is drawn by the server and passed in.
 */
export function SidePanel({ lessons, notesOn }: { lessons: ReactNode; notesOn: boolean }) {
  const stage = useStage()
  const [tab, setTab] = useState<'list' | 'notes'>('list')
  // A phone button picks the tab it was pressed for.
  useEffect(() => { if (stage.sheet) { const t = setTimeout(() => setTab(stage.sheet === 'notes' && notesOn ? 'notes' : 'list'), 0); return () => clearTimeout(t) } }, [stage.sheet, notesOn])
  const open = stage.sheet !== null
  const tabs = [['list', 'Lessons'] as const, ...(notesOn ? [['notes', `My notes${stage.notes.length ? ` (${stage.notes.length})` : ''}`] as const] : [])]

  return (
    <>
      {open && <button type="button" className="lx-scrim" aria-label="Close" tabIndex={-1} onClick={() => stage.setSheet(null)} />}
      <aside className="lx-lside" data-open={open ? 'true' : 'false'} aria-label="Lessons and notes">
        <div className="lx-lside-head">
          {tabs.length > 1 ? (
            <div role="tablist" aria-label="Lesson side panel" className="lx-ptabs">
              {tabs.map(([k, label]) => (
                <button key={k} type="button" role="tab" id={`tab-${k}`} aria-selected={tab === k} aria-controls={`panel-${k}`} onClick={() => setTab(k)}>{label}</button>
              ))}
            </div>
          ) : <h2 className="lx-h2 flex-1" id="tab-list">Lessons in this course</h2>}
          <button type="button" className="lx-sheet-x" aria-label="Close" onClick={() => stage.setSheet(null)}><Icon name="close" /></button>
        </div>
        <div role="tabpanel" id="panel-list" aria-labelledby="tab-list" hidden={tab !== 'list'}>{lessons}</div>
        {notesOn && <div role="tabpanel" id="panel-notes" aria-labelledby="tab-notes" hidden={tab !== 'notes'}><NotesList /></div>}
      </aside>
    </>
  )
}

function NotesList() {
  const { mode, notes, undo, undoRemove, jump, remove, focusNote, setSheet } = useStage()
  return (
    <div className="lx-nl">
      {undo && (
        <p role="status" className="lx-undo">
          Note deleted
          <button type="button" onClick={undoRemove}>Undo</button>
        </p>
      )}
      {notes.length ? (
        <ul aria-label="Your notes on this lesson">
          {notes.map((n) => {
            const place = n.positionSeconds !== null ? clock(n.positionSeconds) : n.pageNo !== null ? `Page ${n.pageNo}` : null
            return (
              <li key={n.id}>
                {place ? (
                  <button type="button" className="lx-where" onClick={() => { jump(n); setSheet(null) }} aria-label={`Go to ${place}`}><Icon name={KIND_ICON[n.kind]} />{place}</button>
                ) : <span className="lx-where plain"><Icon name={KIND_ICON[n.kind]} /></span>}
                <p>{n.kind === 'highlight' && n.body ? <mark>{n.body}</mark> : n.body || <span className="quiet">Bookmark</span>}</p>
                <button type="button" className="lx-x" onClick={() => remove(n.id)} aria-label={`Delete this ${n.kind}`}><Icon name="close" /></button>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="lx-nl-empty">
          <Icon name="note" />
          <p><b>No notes on this lesson yet.</b>{mode === 'time' ? ' Press N while it plays, or write one under the video.' : ' Write one under the lesson.'}</p>
          <button type="button" className="lx-link" onClick={focusNote}>Write the first note</button>
        </div>
      )}
      <Link href="/learn/notes" className="lx-link">See all my notes<Icon name="chev" /></Link>
    </div>
  )
}
