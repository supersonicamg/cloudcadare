'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@educore/ui/marks'
import { UPLOAD_PROBLEMS, checkServerUpload } from '@educore/core/media/upload'
import { buttonOutline, buttonSm } from '@/lib/ui'
import { cancelVideoUpload, createVideoLesson, finishVideoUpload, startVideoUpload } from '../courses/upload-actions'
import { Stopped, sendPieces, videoSeconds } from './upload-video'

/** One lesson (replace or add its video), or a month: every chosen file becomes its own lesson there. */
export type UploadTo = { lessonId: string } | { sectionId: string }

interface Item {
  key: number; file: File; sent: number
  state: 'waiting' | 'uploading' | 'saving' | 'done' | 'failed'
  error?: string; lessonId?: string; uploadId?: string; type: 'live' | 'video'
}

const size = (b: number) => (b >= 1024 ** 3 ? `${(b / 1024 ** 3).toFixed(1)} GB` : `${Math.max(1, Math.round(b / 1024 ** 2))} MB`)

export function VideoUploader({ courseId, to, hasVideo = false }: { courseId: string; to: UploadTo; hasVideo?: boolean }) {
  const router = useRouter()
  const single = 'lessonId' in to
  const input = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<Item[]>([])
  const [type, setType] = useState<'live' | 'video'>('live')
  const [over, setOver] = useState(false)
  const [problem, setProblem] = useState('')
  const running = useRef<{ key: number; abort: AbortController } | null>(null)
  const nextKey = useRef(1)

  const patch = (key: number, change: Partial<Item>) => setItems((all) => all.map((i) => (i.key === key ? { ...i, ...change } : i)))
  const busy = items.some((i) => i.state === 'waiting' || i.state === 'uploading' || i.state === 'saving')

  // Leaving the page stops the upload, so the browser asks first.
  useEffect(() => {
    if (!busy) return
    const ask = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', ask)
    return () => window.removeEventListener('beforeunload', ask)
  }, [busy])
  useEffect(() => () => running.current?.abort.abort(), [])

  // One file at a time, in the order chosen.
  useEffect(() => {
    if (running.current) return
    const item = items.find((i) => i.state === 'waiting')
    if (!item) return
    const abort = new AbortController()
    running.current = { key: item.key, abort }
    void (async () => {
      try {
        patch(item.key, { state: 'uploading', error: undefined })
        let lessonId = 'lessonId' in to ? to.lessonId : item.lessonId
        if (!lessonId && 'sectionId' in to) {
          const made = await createVideoLesson(courseId, to.sectionId, item.type, item.file.name)
          if ('error' in made) throw new Stopped(made.error)
          lessonId = made.lessonId
          patch(item.key, { lessonId })
        }
        const started = await startVideoUpload(courseId, lessonId!, { name: item.file.name, size: item.file.size, modified: item.file.lastModified })
        if ('error' in started) throw new Stopped(started.error)
        patch(item.key, { uploadId: started.uploadId })
        const seconds = await videoSeconds(item.file)
        await sendPieces(item.file, started.uploadId, started.received, abort.signal, (sent) => patch(item.key, { sent }))
        patch(item.key, { state: 'saving' })
        const finished = await finishVideoUpload(courseId, lessonId!, started.uploadId, seconds)
        if (finished.error) throw new Stopped(finished.error)
        patch(item.key, { state: 'done', sent: item.file.size })
        router.refresh()
      } catch (e) {
        patch(item.key, { state: 'failed', error: (e instanceof Stopped && e.message) || 'The upload stopped. Press Try again: it continues where it stopped.' })
      } finally {
        running.current = null
        // Wake the queue for the next file.
        setItems((all) => [...all])
      }
    })()
  }, [items, courseId, to, router])

  function choose(list: FileList | null) {
    const files = Array.from(list ?? []).slice(0, single ? 1 : 30)
    const bad = files.map((f) => ({ f, check: checkServerUpload(f.name, f.size) })).filter((x) => !x.check.ok)
    setProblem(bad.map(({ f, check }) => (check.ok ? '' : `${f.name}: ${UPLOAD_PROBLEMS[check.reason]}`)).join(' '))
    const good = files.filter((f) => checkServerUpload(f.name, f.size).ok)
      .map((file): Item => ({ key: nextKey.current++, file, sent: 0, state: 'waiting', type }))
    if (good.length) setItems((all) => (single ? good : [...all.filter((i) => i.state !== 'done'), ...good]))
    if (input.current) input.current.value = ''
  }

  function remove(item: Item) {
    if (running.current?.key === item.key) running.current.abort.abort()
    if (item.uploadId) void cancelVideoUpload(item.uploadId)
    setItems((all) => all.filter((i) => i.key !== item.key))
  }

  return (
    <div className="grid gap-4">
      {!single && (
        <fieldset className="flex flex-wrap gap-3">
          <legend className="t-label mb-2 !text-fg">What are you uploading?</legend>
          {([['live', 'Live class recordings'], ['video', 'Course videos']] as const).map(([value, text]) => (
            <label key={value} className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border-2 border-border bg-white px-4 t-label !text-fg has-checked:border-primary has-checked:bg-[#E4EFEB]">
              <input type="radio" name={`kind-${'sectionId' in to ? to.sectionId : ''}`} checked={type === value} onChange={() => setType(value)} className="h-5 w-5 accent-[var(--color-primary)]" />
              {text}
            </label>
          ))}
        </fieldset>
      )}

      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); choose(e.dataTransfer.files) }}
        className={`grid justify-items-center gap-3 rounded-2xl border-2 border-dashed px-5 py-8 text-center ${over ? 'border-primary bg-[#E4EFEB]' : 'border-field bg-white'}`}
      >
        <Icon name="video" className="h-9 w-9 text-primary" />
        <p className="t-card">{single ? (hasVideo ? 'Replace the video' : 'Add the video') : 'Drop your videos here'}</p>
        <button type="button" className={buttonSm} onClick={() => input.current?.click()} disabled={single && busy}>
          {single ? 'Choose a video' : 'Choose videos'}
        </button>
        <p className="t-small">MP4 or WebM, up to 4 GB each.{single ? '' : ' Each video becomes a lesson, named after its file.'}</p>
        <input ref={input} type="file" multiple={!single} accept="video/mp4,video/webm,.mp4,.webm" className="sr-only" tabIndex={-1}
          aria-label={single ? 'Video file' : 'Video files'} onChange={(e) => choose(e.target.files)} />
      </div>

      {problem && <p role="alert" className="rounded-xl bg-danger-bg px-4 py-3 t-label !text-danger-ink">{problem}</p>}

      {items.length > 0 && (
        <ul className="grid gap-3" aria-live="polite">
          {items.map((i) => {
            const pct = Math.floor((i.sent / i.file.size) * 100)
            return (
              <li key={i.key} className="grid gap-2 rounded-2xl border border-border bg-white p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="min-w-0 break-all t-label !text-fg">{i.file.name}</p>
                  <p className="t-small tnum">
                    {i.state === 'waiting' ? 'Waiting' : i.state === 'saving' ? 'Almost done…' : i.state === 'done' ? 'Uploaded' : i.state === 'failed' ? 'Stopped' : `${pct}% of ${size(i.file.size)}`}
                  </p>
                </div>
                <div role="progressbar" aria-label={`Uploading ${i.file.name}`} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} className="h-2.5 overflow-hidden rounded-full bg-muted">
                  <div className={`h-full rounded-full transition-[width] ${i.state === 'failed' ? 'bg-danger' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
                </div>
                {i.error && <p role="alert" className="t-label !text-danger-ink">{i.error}</p>}
                {i.state === 'done' && <p className="flex items-center gap-2 t-label !text-ok-ink"><Icon name="check" className="h-5 w-5" /> Learners can watch it now.</p>}
                {i.state !== 'done' && i.state !== 'saving' && (
                  <div className="flex gap-3">
                    {i.state === 'failed' && <button type="button" className={buttonOutline} onClick={() => patch(i.key, { state: 'waiting', error: undefined })}>Try again</button>}
                    <button type="button" className="min-h-11 t-label !text-primary underline underline-offset-4" onClick={() => remove(i)}>Cancel</button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {busy && <p className="rounded-xl bg-tint-2 px-4 py-3 t-label !text-fg">Keep this page open until the upload finishes.</p>}
    </div>
  )
}
