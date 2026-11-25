'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { Icon } from '@educore/ui/marks'
import { buttonOutline } from '@/lib/ui'
import { clock } from '@/lib/clock'
import { useStage } from './stage'

const KIND_ICON = { note: 'note', bookmark: 'bookmark', highlight: 'highlight' } as const
const field = 'w-full rounded-[10px] border-2 border-field bg-white px-3.5 py-2.5 text-base outline-none focus:border-primary focus:ring-4 focus:ring-accent/55'

/** Right-hand panel of a lesson: tabs "Notes" and "Class list". The class list is server-rendered and passed in. */
export function SidePanel({ classList, notesOn }: { classList: ReactNode; notesOn: boolean }) {
  const stage = useStage()
  const [tab, setTab] = useState<'notes' | 'list'>(notesOn ? 'notes' : 'list')
  const tabs = [...(notesOn ? [['notes', `Notes (${stage.notes.length})`] as const] : []), ['list', 'Class list'] as const]
  return (
    <div className="grid gap-4">
      <div role="tablist" aria-label="Lesson side panel" className="flex gap-6 border-b border-border">
        {tabs.map(([k, label]) => (
          <button key={k} type="button" role="tab" id={`tab-${k}`} aria-selected={tab === k} aria-controls={`panel-${k}`} onClick={() => setTab(k)}
            className={`-mb-px inline-flex min-h-11 items-center border-b-[3px] t-label ${tab === k ? 'border-fg !text-fg font-bold' : 'border-transparent hover:!text-fg'}`}>
            {label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id="panel-notes" aria-labelledby="tab-notes" hidden={tab !== 'notes'}>{notesOn ? <NotesTab /> : null}</div>
      <div role="tabpanel" id="panel-list" aria-labelledby="tab-list" hidden={tab !== 'list'}>{classList}</div>
    </div>
  )
}

function NotesTab() {
  const { mode, time, setBox, page, setPage, notes, undo, undoRemove, jump, remove, add, lessonId } = useStage()
  const [text, setText] = useState('')
  const [kind, setKind] = useState<'note' | 'highlight'>('note')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(0)
  // The moment the note box was opened: a note is stamped with it even if the video keeps playing while the learner types.
  const [stamp, setStamp] = useState<number | null>(null)
  const draftKey = `notes-draft:${lessonId}`

  // A draft survives a reload or a closed tab: it is saved in this browser while typing.
  useEffect(() => { const d = localStorage.getItem(draftKey); const t = setTimeout(() => { if (d) setText(d) }, 0); return () => clearTimeout(t) }, [draftKey])
  useEffect(() => { if (text) localStorage.setItem(draftKey, text); else localStorage.removeItem(draftKey) }, [text, draftKey])
  // The time shown above the box follows the player until the box is used.
  useEffect(() => {
    if (mode !== 'time') return
    const id = setInterval(() => setNow(Math.floor(time())), 500)
    return () => clearInterval(id)
  }, [mode, time])

  const here = () => (mode === 'time' ? { seconds: Math.floor(stamp ?? time()), page: null } : mode === 'page' ? { seconds: null, page: page } : { seconds: null, page: null })
  const save = async (k: 'note' | 'bookmark' | 'highlight', body: string) => {
    setBusy(true); setError(null)
    const err = await add(k, body, here())
    setBusy(false)
    if (err) { setError(err); return false }
    return true
  }
  const submit = async () => {
    if (!text.trim()) { setError('Write something first.'); return }
    if (await save(mode === 'page' ? kind : 'note', text.trim())) { setText(''); setStamp(null) }
  }
  const mark = async () => { if (await save('bookmark', text.trim())) { setText(''); setStamp(null) } }

  const label = mode === 'time' ? `Note at ${clock(stamp ?? now)}` : mode === 'page' ? `Note on page ${page}` : 'Note on this lesson'
  return (
    <div className="grid gap-4">
      <div className="grid gap-2.5">
        <label htmlFor="note-box" className="t-label !text-fg">{label}</label>
        {mode === 'page' && (
          <div className="flex flex-wrap items-center gap-3">
            <label className="t-small flex items-center gap-2">Page
              <input type="number" min={1} max={5000} value={page} onChange={(e) => setPage(Number(e.target.value))} className={`${field} !w-20 !py-1.5`} />
            </label>
            <div role="group" aria-label="Kind" className="flex gap-1 rounded-[10px] bg-muted p-1">
              {(['note', 'highlight'] as const).map((k) => (
                <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}
                  className={`min-h-9 rounded-lg px-3 t-label ${kind === k ? 'bg-white !text-fg font-bold shadow-sm' : ''}`}>{k === 'note' ? 'Note' : 'Highlight'}</button>
              ))}
            </div>
          </div>
        )}
        <textarea id="note-box" ref={setBox} rows={3} value={text} maxLength={4000} className={field}
          placeholder={mode === 'page' && kind === 'highlight' ? 'Paste the text you highlighted' : 'What do you want to remember?'}
          onFocus={() => { if (mode === 'time') setStamp(Math.floor(time())) }}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void submit() } }} />
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={submit} disabled={busy} className={buttonOutline}>Save note</button>
          {mode === 'time' && <button type="button" onClick={mark} disabled={busy} className={buttonOutline}><Icon name="bookmark" className="h-4 w-4" />Mark this moment</button>}
        </div>
        <p className="t-small">{mode === 'time' ? 'Press N to pause and write. ' : ''}Ctrl+Enter saves. Only you can see your notes.</p>
        {error && <p role="alert" className="t-label rounded-xl bg-muted p-3 !text-fg shadow-[inset_3px_0_0_var(--color-fg)]">{error}</p>}
      </div>

      {undo && (
        <p role="status" className="t-label flex items-center justify-between gap-3 rounded-xl bg-fg px-3.5 py-2.5 !text-white">
          Note deleted
          <button type="button" onClick={undoRemove} className="min-h-9 font-bold underline underline-offset-4 !text-accent">Undo</button>
        </p>
      )}

      {notes.length ? (
        <ul className="grid border-t-2 border-fg" aria-label="Your notes on this lesson">
          {notes.map((n) => {
            const place = n.positionSeconds !== null ? clock(n.positionSeconds) : n.pageNo !== null ? `Page ${n.pageNo}` : null
            return (
              <li key={n.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 border-b border-border py-3">
                {place ? (
                  <button type="button" onClick={() => jump(n)} aria-label={`Go to ${place}`}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[#E4EFEB] px-2.5 t-label tnum !font-bold !text-deep"><Icon name={KIND_ICON[n.kind]} className="h-4 w-4" />{place}</button>
                ) : <span className="inline-flex min-h-9 items-center px-1"><Icon name={KIND_ICON[n.kind]} className="h-4 w-4 text-primary" /></span>}
                <p className="t-body min-w-0 break-words whitespace-pre-line !text-fg">
                  {n.kind === 'highlight' && n.body ? <mark className="bg-accent/70 px-0.5">{n.body}</mark> : n.body || <span className="text-mute">Bookmark</span>}
                </p>
                <button type="button" onClick={() => remove(n.id)} aria-label={`Delete this ${n.kind}`} className="inline-grid h-9 w-9 place-items-center rounded-lg text-mute hover:bg-muted hover:text-fg">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="t-body border-t-2 border-fg pt-4">No notes on this lesson yet. {mode === 'time' ? 'Press N while it plays.' : 'Add the first one above.'}</p>
      )}
      <Link href="/learn/notes" className="t-label font-semibold !text-primary underline underline-offset-4">All my notes →</Link>
    </div>
  )
}
