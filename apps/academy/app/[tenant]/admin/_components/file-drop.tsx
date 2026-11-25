'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@educore/ui/marks'
import { checkFile, humanSize, uploadRule, type UploadType } from '@educore/core/media/files'
import { buttonOutline, buttonSm } from '@/lib/ui'
import { FILE_PROBLEMS, sendFile } from './send-file'

const WORDS: Record<UploadType, { noun: string; drop: string; choose: string; accepts: string }> = {
  pdf: { noun: 'PDF', drop: 'Drop your PDF here', choose: 'Choose a PDF', accepts: 'PDF' },
  download: { noun: 'file', drop: 'Drop your file here', choose: 'Choose a file', accepts: 'PDF, Word, Excel, PowerPoint, images, ZIP, text' },
  recording: { noun: 'video', drop: 'Drop the recording here', choose: 'Choose a video', accepts: 'MP4 or WebM' },
}

type Attempt = { file: File; percent: number; state: 'sending' | 'failed'; error?: string }

/**
 * The file of one lesson. Choosing or dropping a file sends it at once (no second "Upload" press), with a progress bar;
 * a file that is already there shows as a card with Replace and Open.
 */
export function FileDrop({ courseId, lessonId, type, current }: {
  courseId: string; lessonId: string; type: UploadType; current: { name: string; size: number | null } | null
}) {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const abort = useRef<AbortController | null>(null)
  const [at, setAt] = useState<Attempt | null>(null)
  const [over, setOver] = useState(false)
  const [problem, setProblem] = useState('')
  const [done, setDone] = useState(false)
  const rule = uploadRule(type)
  const w = WORDS[type]
  const sending = at?.state === 'sending'

  // Leaving the page would stop the upload, so the browser asks first.
  useEffect(() => {
    if (!sending) return
    const ask = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', ask)
    return () => window.removeEventListener('beforeunload', ask)
  }, [sending])
  useEffect(() => () => abort.current?.abort(), [])

  async function start(file: File) {
    const controller = new AbortController()
    abort.current = controller
    setDone(false)
    setAt({ file, percent: 0, state: 'sending' })
    const result = await sendFile(courseId, lessonId, type, file, (percent) => setAt((a) => (a ? { ...a, percent } : a)), controller.signal)
    if (result.cancelled) { setAt(null); return }
    if (result.error) { setAt({ file, percent: 0, state: 'failed', error: result.error }); return }
    setAt(null)
    setDone(true)
    router.refresh()
  }

  function choose(list: FileList | null) {
    const file = list?.[0]
    if (input.current) input.current.value = ''
    if (!file || sending) return
    const check = checkFile(type, file.name, file.size)
    if (!check.ok) {
      setProblem(check.reason === 'type' ? FILE_PROBLEMS.type(type, file.name) : check.reason === 'size' ? FILE_PROBLEMS.size(file.name, Math.round(rule.maxBytes / 1024 / 1024)) : FILE_PROBLEMS.empty(file.name))
      return
    }
    setProblem('')
    void start(file)
  }

  const picker = (
    <input ref={input} type="file" accept={rule.exts.map((e) => `.${e}`).join(',')} className="sr-only" tabIndex={-1}
      aria-label={`${w.noun} to upload`} onChange={(e) => choose(e.target.files)} />
  )
  const limits = `${w.accepts}, up to ${Math.round(rule.maxBytes / 1024 / 1024)} MB.`

  return (
    <div className="grid gap-3"
      onDragOver={(e) => { e.preventDefault(); if (!sending) setOver(true) }} onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); choose(e.dataTransfer.files) }}>
      {at ? (
        <div className="grid gap-3 rounded-2xl border-2 border-border bg-white p-5">
          <div className="flex items-center gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-[#E4EFEB] text-primary"><Icon name="doc" className="h-6 w-6" /></span>
            <div className="min-w-0 flex-1">
              <p className="break-all t-label !text-[16px] !text-fg">{at.file.name}</p>
              <p className="t-small tnum">{at.state === 'failed' ? 'Stopped' : at.percent >= 99 ? 'Almost done…' : `${at.percent}% of ${humanSize(at.file.size)}`}</p>
            </div>
          </div>
          <div role="progressbar" aria-label={`Uploading ${at.file.name}`} aria-valuenow={at.percent} aria-valuemin={0} aria-valuemax={100} className="h-2.5 overflow-hidden rounded-full bg-muted">
            <div className={`h-full rounded-full transition-[width] ${at.state === 'failed' ? 'bg-danger' : 'bg-primary'}`} style={{ width: `${at.state === 'failed' ? 100 : at.percent}%` }} />
          </div>
          {at.error && <p role="alert" className="t-label !text-danger-ink">{at.error}</p>}
          <div className="flex flex-wrap gap-3">
            {at.state === 'failed' && <button type="button" className={buttonSm} onClick={() => void start(at.file)}>Try again</button>}
            <button type="button" className="min-h-11 t-label !text-primary underline underline-offset-4"
              onClick={() => { abort.current?.abort(); setAt(null) }}>{at.state === 'failed' ? 'Cancel' : 'Stop the upload'}</button>
          </div>
        </div>
      ) : current ? (
        <div className={`flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border-2 p-4 sm:p-5 ${over ? 'border-primary bg-[#E4EFEB]' : 'border-border bg-white'}`}>
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-[#E4EFEB] text-primary"><Icon name="doc" className="h-6 w-6" /></span>
          <div className="min-w-0 flex-1 basis-48">
            <p className="break-all t-label !text-[16px] !text-fg" data-testid="current-file">{current.name}</p>
            <p className="t-small">{current.size ? `${humanSize(current.size)} · ` : ''}Students can open it now.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {type !== 'recording' && (
              <a href={`/api/lesson-file/${lessonId}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center px-3 t-label !text-primary underline underline-offset-4">Open</a>
            )}
            <button type="button" className={buttonOutline} onClick={() => input.current?.click()}>Replace</button>
          </div>
        </div>
      ) : (
        <div className={`grid justify-items-center gap-3 rounded-2xl border-2 border-dashed px-5 py-10 text-center ${over ? 'border-primary bg-[#E4EFEB]' : 'border-field bg-white'}`}>
          <span className="grid size-14 place-items-center rounded-2xl bg-[#E4EFEB] text-primary"><Icon name={type === 'recording' ? 'video' : 'doc'} className="h-7 w-7" /></span>
          <p className="t-card">{w.drop}</p>
          <button type="button" className={buttonSm} onClick={() => input.current?.click()}>{w.choose}</button>
          <p className="t-small">{limits}</p>
        </div>
      )}
      {picker}
      {problem && <p role="alert" className="rounded-xl bg-danger-bg px-4 py-3 t-label !text-danger-ink">{problem}</p>}
      {done && !at && <p role="status" className="flex items-center gap-2 t-label !text-ok-ink"><Icon name="check" className="h-5 w-5" /> Uploaded. Students can open it now.</p>}
      {current && !at && <p className="t-small">To replace it, drop another file here or press Replace. {limits}</p>}
    </div>
  )
}
