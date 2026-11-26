'use client'

import { useEffect, useState } from 'react'
import { clock } from '@/lib/clock'
import { Ic } from '../../_components/v11'
import { useStage } from './stage'

/**
 * Where a learner writes a note: right under what they are looking at, so they never have to leave it.
 * A note is stamped with the minute of the video or the page of the PDF the moment the box gets the cursor.
 * Reading and deleting notes happens in the side panel ("My notes").
 */
export function QuickNote() {
  const { mode, time, setBox, page, add, lessonId, enabled } = useStage()
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [now, setNow] = useState(0)
  // The moment the box was opened: the note keeps it even if the video keeps playing while the learner types.
  const [stamp, setStamp] = useState<number | null>(null)
  const draftKey = `notes-draft:${lessonId}`

  // A draft survives a reload or a closed tab: it is kept in this browser while typing.
  useEffect(() => { const d = localStorage.getItem(draftKey); const t = setTimeout(() => { if (d) setText(d) }, 0); return () => clearTimeout(t) }, [draftKey])
  useEffect(() => { if (text) localStorage.setItem(draftKey, text); else localStorage.removeItem(draftKey) }, [text, draftKey])
  useEffect(() => {
    if (mode !== 'time') return
    const id = setInterval(() => setNow(Math.floor(time())), 500)
    return () => clearInterval(id)
  }, [mode, time])
  useEffect(() => { if (!saved) return; const t = setTimeout(() => setSaved(false), 2500); return () => clearTimeout(t) }, [saved])

  if (!enabled) return null

  const here = () => (mode === 'time' ? { seconds: Math.floor(stamp ?? time()), page: null } : mode === 'page' ? { seconds: null, page } : { seconds: null, page: null })
  const save = async (kind: 'note' | 'bookmark', body: string) => {
    setBusy(true); setError(null)
    const err = await add(kind, body, here())
    setBusy(false)
    if (err) { setError(err); return }
    setText(''); setStamp(null); setSaved(true)
  }
  const submit = () => { if (!text.trim()) { setError('Write something first.'); return } void save('note', text.trim()) }

  const where = mode === 'time' ? `at ${clock(stamp ?? now)}` : mode === 'page' ? `on page ${page}` : 'on this lesson'
  return (
    <section className="qn">
      <div className="qn-h">
        <label htmlFor="note-box"><Ic n="pen" s />Write a note {where}</label>
        {mode === 'time' && <span className="t-label kbd-hint">Press <kbd>N</kbd> while watching</span>}
      </div>
      <textarea id="note-box" ref={setBox} className="in" rows={2} value={text} maxLength={4000}
        placeholder={mode === 'time' ? 'What do you want to remember from this minute?' : mode === 'page' ? 'What do you want to remember from this page?' : 'What do you want to remember from this lesson?'}
        onFocus={() => { if (mode === 'time') setStamp(Math.floor(time())) }}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submit() } }} />
      <div className="qn-act">
        <button type="button" onClick={submit} disabled={busy} className="btn btn-line btn-sm">Save note</button>
        {mode === 'page' && (
          <button type="button" onClick={() => void save('bookmark', text.trim())} disabled={busy} className="link link-s"><Ic n="bookmark" s />Bookmark this page</button>
        )}
        {saved
          ? <span className="ok-line" role="status"><Ic n="check" s />Saved. Find it under My notes.</span>
          : <span className="t-label"><span className="kbd-hint"><kbd>Ctrl</kbd> + <kbd>Enter</kbd> saves too. </span>Only you can see your notes.</span>}
      </div>
      {error && <p role="alert" className="note-l"><Ic n="info" s />{error}</p>}
    </section>
  )
}
