'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@educore/ui/marks'
import { FILE_RULES, checkFile, extOf, humanSize } from '@educore/core/media/files'
import { buttonOutline, buttonSm } from '@/lib/ui'
import { createFileLesson } from '../courses/actions'
import { FILE_PROBLEMS, sendFile } from './send-file'

interface Item { key: number; file: File; percent: number; state: 'waiting' | 'sending' | 'done' | 'failed'; error?: string; lessonId?: string }

const MAX_FILES = 30

/**
 * "Upload PDFs and files" for a month: every file becomes its own lesson, named after the file. A PDF is shown in the
 * page and any other file is offered as a download, so nobody has to choose a type first. Files go one after another.
 */
export function FilesUploader({ courseId, sectionId }: { courseId: string; sectionId: string }) {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const nextKey = useRef(1)
  const queue = useRef<Item[]>([])
  const working = useRef<{ key: number; abort: AbortController } | null>(null)
  const draining = useRef(false)
  const [items, setItems] = useState<Item[]>([])
  const [problem, setProblem] = useState('')
  const [over, setOver] = useState(false)
  const busy = items.some((i) => i.state === 'waiting' || i.state === 'sending')

  const patch = (key: number, change: Partial<Item>) => setItems((all) => all.map((i) => (i.key === key ? { ...i, ...change } : i)))

  useEffect(() => {
    if (!busy) return
    const ask = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', ask)
    return () => window.removeEventListener('beforeunload', ask)
  }, [busy])
  useEffect(() => () => { queue.current = []; working.current?.abort.abort() }, [])

  async function drain() {
    if (draining.current) return
    draining.current = true
    try {
      for (let item = queue.current.shift(); item; item = queue.current.shift()) {
        const abort = new AbortController()
        working.current = { key: item.key, abort }
        patch(item.key, { state: 'sending', percent: 0, error: undefined })
        let lessonId = item.lessonId
        if (!lessonId) {
          const made = await createFileLesson(courseId, sectionId, item.file.name)
          if ('error' in made) { patch(item.key, { state: 'failed', error: made.error }); continue }
          lessonId = made.lessonId
          item.lessonId = lessonId
          patch(item.key, { lessonId })
        }
        const result = await sendFile(courseId, lessonId, extOf(item.file.name) === 'pdf' ? 'pdf' : 'download', item.file, (percent) => patch(item.key, { percent }), abort.signal)
        if (result.cancelled) continue
        if (result.error) patch(item.key, { state: 'failed', error: result.error })
        else { patch(item.key, { state: 'done', percent: 100 }); router.refresh() }
      }
    } finally {
      working.current = null
      draining.current = false
    }
  }

  function choose(list: FileList | null) {
    const files = Array.from(list ?? []).slice(0, MAX_FILES)
    if (input.current) input.current.value = ''
    const found: string[] = []
    const added: Item[] = []
    for (const file of files) {
      const type = extOf(file.name) === 'pdf' ? 'pdf' : 'download'
      const check = checkFile(type, file.name, file.size)
      if (check.ok) added.push({ key: nextKey.current++, file, percent: 0, state: 'waiting' })
      else found.push(check.reason === 'type' ? FILE_PROBLEMS.type('download', file.name) : check.reason === 'size' ? FILE_PROBLEMS.size(file.name, Math.round(FILE_RULES[type].maxBytes / 1024 / 1024)) : FILE_PROBLEMS.empty(file.name))
    }
    setProblem(found.join(' '))
    if (!added.length) return
    setItems((all) => [...all.filter((i) => i.state !== 'done'), ...added])
    queue.current.push(...added)
    void drain()
  }

  function remove(item: Item) {
    queue.current = queue.current.filter((q) => q.key !== item.key)
    if (working.current?.key === item.key) working.current.abort.abort()
    setItems((all) => all.filter((i) => i.key !== item.key))
  }

  function retry(item: Item) {
    patch(item.key, { state: 'waiting', error: undefined, percent: 0 })
    queue.current.push(item)
    void drain()
  }

  return (
    <div className="grid gap-4">
      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); choose(e.dataTransfer.files) }}
        className={`grid justify-items-center gap-3 rounded-2xl border-2 border-dashed px-5 py-8 text-center ${over ? 'border-primary bg-[#E4EFEB]' : 'border-field bg-white'}`}
      >
        <Icon name="doc" className="h-9 w-9 text-primary" />
        <p className="t-card">Drop PDFs and files here</p>
        <button type="button" className={buttonSm} onClick={() => input.current?.click()}>Choose files</button>
        <p className="t-small">PDF, Word, Excel, PowerPoint, images, ZIP, text. Each file becomes a lesson, named after its file.</p>
        <input ref={input} type="file" multiple accept={FILE_RULES.download.exts.map((e) => `.${e}`).join(',')} className="sr-only" tabIndex={-1}
          aria-label="Files to upload" onChange={(e) => choose(e.target.files)} />
      </div>

      {problem && <p role="alert" className="rounded-xl bg-danger-bg px-4 py-3 t-label !text-danger-ink">{problem}</p>}

      {items.length > 0 && (
        <ul className="grid gap-3" aria-live="polite">
          {items.map((i) => (
            <li key={i.key} className="grid gap-2 rounded-2xl border border-border bg-white p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="min-w-0 break-all t-label !text-fg">{i.file.name}</p>
                <p className="t-small tnum">
                  {i.state === 'waiting' ? 'Waiting' : i.state === 'done' ? 'Uploaded' : i.state === 'failed' ? 'Stopped' : i.percent >= 99 ? 'Almost done…' : `${i.percent}% of ${humanSize(i.file.size)}`}
                </p>
              </div>
              <div role="progressbar" aria-label={`Uploading ${i.file.name}`} aria-valuenow={i.percent} aria-valuemin={0} aria-valuemax={100} className="h-2.5 overflow-hidden rounded-full bg-muted">
                <div className={`h-full rounded-full transition-[width] ${i.state === 'failed' ? 'bg-danger' : 'bg-primary'}`} style={{ width: `${i.state === 'failed' ? 100 : i.percent}%` }} />
              </div>
              {i.error && <p role="alert" className="t-label !text-danger-ink">{i.error}</p>}
              {i.state === 'done' && <p className="flex items-center gap-2 t-label !text-ok-ink"><Icon name="check" className="h-5 w-5" /> Added as a lesson.</p>}
              {i.state !== 'done' && (
                <div className="flex gap-3">
                  {i.state === 'failed' && <button type="button" className={buttonOutline} onClick={() => retry(i)}>Try again</button>}
                  <button type="button" className="min-h-11 t-label !text-primary underline underline-offset-4" onClick={() => remove(i)}>Cancel</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {busy && <p className="rounded-xl bg-tint-2 px-4 py-3 t-label !text-fg">Keep this page open until the upload finishes.</p>}
    </div>
  )
}
