'use client'

import { useState } from 'react'
import { clock } from '@/lib/clock'
import { Ic } from '../../_components/v11'
import { useStage } from './stage'

const SPEEDS = [0.75, 1, 1.25, 1.5, 2]

/**
 * The strip under a video: back 10 seconds, forward 10 seconds, speed and "Mark this moment", written out in words, and,
 * when the lesson was left half-watched, where it picked up from with a way to start over.
 */
export function VideoTools({ resumeAt }: { resumeAt: number }) {
  const s = useStage()
  const [rate, setRate] = useState(1)
  const [resumed, setResumed] = useState(resumeAt > 5)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  return (
    <div className="vtools" role="group" aria-label="Video controls">
      <button type="button" className="btn btn-line btn-sm" onClick={() => s.skip(-10)}>Back 10 s</button>
      <button type="button" className="btn btn-line btn-sm" onClick={() => s.skip(10)}>Forward 10 s</button>
      <label>
        <span className="sr">Playback speed</span>
        <select value={rate} onChange={(e) => { const r = Number(e.target.value); setRate(r); s.setRate(r) }}>
          {SPEEDS.map((r) => <option key={r} value={r}>Speed {r}×</option>)}
        </select>
      </label>
      {s.enabled && (
        <button type="button" className="btn btn-line btn-sm" disabled={busy} onClick={async () => {
          setBusy(true)
          const at = Math.floor(s.time())
          const err = await s.add('bookmark', '', { seconds: at, page: null })
          setBusy(false)
          setMsg(err ?? `Marked ${clock(at)}. You will find it under My notes.`)
          setTimeout(() => setMsg(null), 3500)
        }}><Ic n="bookmark" />Mark this moment</button>
      )}
      {resumed && (
        <p className="resumed" role="status">
          <Ic n="clock" s />Picked up at {clock(resumeAt)}.
          <button type="button" className="link link-s" onClick={() => { s.seekTo(0); setResumed(false) }}>Start over</button>
        </p>
      )}
      {msg && <p className="resumed vmsg" role="status"><Ic n="check" s />{msg}</p>}
    </div>
  )
}
