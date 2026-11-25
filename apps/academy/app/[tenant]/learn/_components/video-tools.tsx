'use client'

import { useState } from 'react'
import { Icon } from '@educore/ui/marks'
import { clock } from '@/lib/clock'
import { useStage } from './stage'

const SPEEDS = [0.75, 1, 1.25, 1.5, 2]

/**
 * The strip under a video: the three things people reach for most (back 10 seconds, forward 10 seconds, speed) as big,
 * labelled buttons, and, when the lesson was left half-watched, where it picked up from with a way to start over.
 */
export function VideoTools({ resumeAt }: { resumeAt: number }) {
  const s = useStage()
  const [rate, setRate] = useState(1)
  const [resumed, setResumed] = useState(resumeAt > 5)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  return (
    <div className="lx-vtools">
      <div className="lx-vtools-row" role="group" aria-label="Video controls">
        <button type="button" onClick={() => s.skip(-10)}><Icon name="back10" />Back 10 sec</button>
        <button type="button" onClick={() => s.skip(10)}><Icon name="fwd10" />Forward 10 sec</button>
        <label className="lx-speed">
          <span>Speed</span>
          <select value={rate} aria-label="Playback speed" onChange={(e) => { const r = Number(e.target.value); setRate(r); s.setRate(r) }}>
            {SPEEDS.map((r) => <option key={r} value={r}>{r === 1 ? 'Normal' : `${r}×`}</option>)}
          </select>
        </label>
        {s.enabled && (
          <button type="button" className="mark" disabled={busy} onClick={async () => {
            setBusy(true)
            const at = Math.floor(s.time())
            const err = await s.add('bookmark', '', { seconds: at, page: null })
            setBusy(false)
            setMsg(err ?? `Marked ${clock(at)}. You will find it under My notes.`)
            setTimeout(() => setMsg(null), 3500)
          }}><Icon name="bookmark" />Mark this moment</button>
        )}
      </div>
      {msg && <p className="lx-resumed" role="status"><Icon name="check" className="lx-i" /><span>{msg}</span></p>}
      {resumed && (
        <p className="lx-resumed" role="status">
          <Icon name="clock" className="lx-i" />
          <span>Continuing from <b>{clock(resumeAt)}</b></span>
          <button type="button" onClick={() => { s.seekTo(0); setResumed(false) }}>Start from the beginning</button>
        </p>
      )}
    </div>
  )
}
