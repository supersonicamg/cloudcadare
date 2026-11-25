'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'

export interface ProgressPayload {
  lessonId: string
  position?: number
  delta?: number
  pct?: number
  complete?: boolean
}

interface ProgressResult { tracked?: boolean; completed?: boolean; newly_completed?: boolean }

const URL_PATH = '/api/progress'

/** Fire and forget on page close. sendBeacon survives navigation; fetch with keepalive is the fallback. */
function beacon(p: ProgressPayload) {
  const body = JSON.stringify(p)
  if (navigator.sendBeacon?.(URL_PATH, new Blob([body], { type: 'application/json' }))) return
  void fetch(URL_PATH, { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => {})
}

export async function postProgress(p: ProgressPayload): Promise<ProgressResult | null> {
  try {
    const res = await fetch(URL_PATH, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(p) })
    return res.ok ? ((await res.json()) as ProgressResult) : null
  } catch {
    return null
  }
}

/**
 * Heartbeat for media lessons: counts seconds while `setPlaying(true)`, reports every 15 s, when the tab
 * is hidden and on page close. The database caps each delta and applies the lesson's completion rule.
 */
export function useProgressTracker(lessonId: string, alreadyCompleted: boolean, enabled = true) {
  const router = useRouter()
  const state = useRef({ delta: 0, position: 0, pct: 0, playing: false, completed: alreadyCompleted, ticks: 0 })

  const flush = useCallback(async (onClose = false) => {
    const s = state.current
    if (!enabled) return
    if (s.delta === 0 && !onClose) return
    const payload: ProgressPayload = { lessonId, position: Math.floor(s.position), delta: s.delta, pct: Math.round(s.pct * 100) / 100 }
    s.delta = 0
    if (onClose) return beacon(payload)
    const r = await postProgress(payload)
    if (r?.completed && !s.completed) {
      s.completed = true
      router.refresh() // curriculum ticks and the course percentage update
    }
  }, [lessonId, router, enabled])

  useEffect(() => {
    const id = setInterval(() => {
      const s = state.current
      if (!s.playing) return
      s.delta += 1
      if (++s.ticks % 15 === 0) void flush()
    }, 1000)
    const hide = () => { if (document.visibilityState === 'hidden') void flush(true) }
    const close = () => void flush(true)
    document.addEventListener('visibilitychange', hide)
    window.addEventListener('pagehide', close)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', hide)
      window.removeEventListener('pagehide', close)
      void flush(true)
    }
  }, [flush])

  // Stable identity so players can use it in effect dependencies without re-subscribing.
  return useMemo(() => ({
    setPlaying: (v: boolean) => { state.current.playing = v; if (!v) void flush() },
    update: (position: number, duration: number) => {
      const s = state.current
      s.position = position
      if (duration > 0) s.pct = Math.min(100, (position / duration) * 100)
    },
    flush,
  }), [flush])
}
