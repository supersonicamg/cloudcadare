'use client'

import { useEffect, useRef } from 'react'
import type { Playback } from '@educore/core/media'
import { useOptionalStage } from './stage'
import { useProgressTracker } from './use-progress'

type Playable = Exclude<Playback, { kind: 'unavailable' }>

// Minimal slice of the YouTube IFrame API that we use.
interface YTPlayer { getCurrentTime(): number; getDuration(): number; destroy(): void; seekTo(s: number, allowSeekAhead: boolean): void; playVideo(): void; pauseVideo(): void; setPlaybackRate(r: number): void }
interface YTApi {
  Player: new (el: HTMLElement, o: {
    videoId: string
    playerVars: Record<string, string | number>
    events: { onStateChange(e: { data: number }): void; onReady(): void }
  }) => YTPlayer
}
declare global { interface Window { YT?: YTApi; onYouTubeIframeAPIReady?: () => void } }

let ytReady: Promise<YTApi> | null = null
function loadYouTube(): Promise<YTApi> {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  ytReady ??= new Promise((resolve) => {
    window.onYouTubeIframeAPIReady = () => resolve(window.YT!)
    const s = document.createElement('script')
    s.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(s)
  })
  return ytReady
}

export function VideoPlayer({ playback, lessonId, startAt, completed, title, tracked = true, framed = false }: {
  playback: Playable; lessonId: string; startAt: number; completed: boolean; title: string
  /** False on public free previews: nothing is reported until the person enrols. */
  tracked?: boolean
  /** Inside the lesson page's `.player` frame (v11): the frame sets the size and the look. Off for the public preview page. */
  framed?: boolean
}) {
  const tracker = useProgressTracker(lessonId, completed, tracked)
  const videoRef = useRef<HTMLVideoElement>(null)
  const ytRef = useRef<HTMLDivElement>(null)
  // Whichever player is mounted fills this in, so the tab-switch handler below can pause it.
  const pauseRef = useRef<(() => void) | null>(null)
  // On a lesson page the notes panel reads the time from here and can jump to a moment (plan/16 §6.4).
  const stage = useOptionalStage()
  const register = stage?.register
  const setDuration = stage?.setDuration

  useEffect(() => {
    const v = videoRef.current
    if (!v || playback.kind === 'youtube' || !register) return
    register({ time: () => v.currentTime, duration: () => (Number.isFinite(v.duration) ? v.duration : 0), seek: (s) => { v.currentTime = s; void v.play().catch(() => {}) }, pause: () => v.pause(),
      skip: (d) => { v.currentTime = Math.max(0, Math.min(Number.isFinite(v.duration) ? v.duration : Infinity, v.currentTime + d)) },
      setRate: (r) => { v.playbackRate = r },
    })
    const meta = () => { if (Number.isFinite(v.duration)) setDuration?.(v.duration) }
    v.addEventListener('loadedmetadata', meta)
    meta()
    return () => { v.removeEventListener('loadedmetadata', meta); register(null) }
  }, [playback, register, setDuration])

  // Switching to another browser tab (or minimising the window) pauses the video. Picture-in-picture is left alone
  // because the learner chose to keep watching it.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden' && !document.pictureInPictureElement) pauseRef.current?.()
    }
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
  }, [])

  // HTML5 video: a direct file or an HLS stream (Safari plays HLS natively; everything else uses hls.js).
  useEffect(() => {
    const v = videoRef.current
    if (!v || playback.kind === 'youtube') return
    let hls: { destroy(): void } | undefined
    pauseRef.current = () => v.pause()
    const seek = () => { if (startAt > 5) v.currentTime = startAt }
    v.addEventListener('loadedmetadata', seek, { once: true })
    if (playback.kind === 'hls' && !v.canPlayType('application/vnd.apple.mpegurl')) {
      void import('hls.js').then(({ default: Hls }) => {
        if (!Hls.isSupported()) return
        const h = new Hls()
        h.loadSource(playback.src)
        h.attachMedia(v)
        hls = h
      })
    } else {
      v.src = playback.src
    }
    const t = tracker
    const on = () => t.setPlaying(true)
    const off = () => { t.update(v.currentTime, v.duration); t.setPlaying(false) }
    const time = () => t.update(v.currentTime, v.duration)
    v.addEventListener('play', on); v.addEventListener('pause', off); v.addEventListener('ended', off); v.addEventListener('timeupdate', time)
    return () => {
      v.removeEventListener('play', on); v.removeEventListener('pause', off); v.removeEventListener('ended', off); v.removeEventListener('timeupdate', time)
      hls?.destroy()
      pauseRef.current = null
    }
  }, [playback, startAt, tracker])

  // YouTube: the IFrame API reports state and position, which is how we get watch percentage.
  useEffect(() => {
    if (playback.kind !== 'youtube' || !ytRef.current) return
    let player: YTPlayer | undefined
    let poll: ReturnType<typeof setInterval> | undefined
    let cancelled = false
    const mount = document.createElement('div')
    ytRef.current.appendChild(mount)
    void loadYouTube().then((YT) => {
      if (cancelled) return
      player = new YT.Player(mount, {
        videoId: playback.videoId,
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1, ...(startAt > 5 ? { start: Math.floor(startAt) } : {}) },
        events: {
          onReady: () => {
            if (!player) return
            const p = player
            pauseRef.current = () => p.pauseVideo()
            register?.({ time: () => p.getCurrentTime(), duration: () => p.getDuration() || 0, seek: (s) => { p.seekTo(s, true); p.playVideo() }, pause: () => p.pauseVideo(),
              skip: (d) => p.seekTo(Math.max(0, p.getCurrentTime() + d), true),
              setRate: (r) => p.setPlaybackRate(r),
            })
            const d = p.getDuration()
            if (d > 0) setDuration?.(d)
          },
          onStateChange: ({ data }) => {
            const t = tracker
            clearInterval(poll)
            if (data === 1) { // playing
              t.setPlaying(true)
              poll = setInterval(() => player && t.update(player.getCurrentTime(), player.getDuration()), 1000)
            } else {
              if (player) t.update(player.getCurrentTime(), player.getDuration())
              t.setPlaying(false)
            }
          },
        },
      })
    })
    return () => { cancelled = true; clearInterval(poll); pauseRef.current = null; register?.(null); player?.destroy() }
  }, [playback, startAt, tracker, register, setDuration])

  if (playback.kind === 'youtube') {
    return <div ref={ytRef} className={framed ? undefined : 'aspect-video w-full overflow-hidden rounded-[18px] bg-deep [&_iframe]:size-full'} aria-label={title} />
  }
  return (
    <video ref={videoRef} controls playsInline preload="metadata" aria-label={title}
      className={framed ? undefined : 'aspect-video w-full rounded-[18px] bg-deep'} />
  )
}
