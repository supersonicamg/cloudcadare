'use client'

import { useEffect, useState } from 'react'
import { Icon } from '@educore/ui/marks'
import { clock } from '@/lib/clock'
import { buttonOutline } from '@/lib/ui'
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
    <section className="lx-qn" aria-label="Write a note" data-filled={text ? 'true' : undefined}>
      <div className="lx-qn-head">
        <label htmlFor="note-box"><Icon name="pen" />Write a note {where}</label>
        {mode === 'time' && <span className="k">Press <kbd>N</kbd> while watching</span>}
      </div>
      <textarea id="note-box" ref={setBox} rows={1} value={text} maxLength={4000} placeholder={mode === 'time' ? 'Write a note about this moment' : mode === 'page' ? 'Write a note about this page' : 'Write a note about this lesson'}
        onFocus={() => { if (mode === 'time') setStamp(Math.floor(time())) }}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submit() } }} />
      <div className="lx-qn-act">
        <button type="button" onClick={submit} disabled={busy} className={buttonOutline}>Save note</button>
        {mode === 'page' && (
          <button type="button" onClick={() => void save('bookmark', text.trim())} disabled={busy} className="lx-qn-mark">
            <Icon name="bookmark" />Bookmark this page
          </button>
        )}
        {saved && <span className="lx-qn-ok" role="status"><Icon name="check" className="lx-i" />Saved. Find it under My notes.</span>}
      </div>
      {error && <p role="alert" className="lx-qn-err">{error}</p>}
    </section>
  )
}
