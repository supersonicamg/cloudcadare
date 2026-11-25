'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FILE_RULES } from '@educore/core/media/files'
import { button, hint } from '@/lib/ui'
import { finishFileUpload, prepareFileUpload } from '../../../actions'

/** Uploads straight from the browser to storage through a one-time address; the server only checks and records it. */
export function FileUpload({ courseId, lessonId, type }: { courseId: string; lessonId: string; type: 'pdf' | 'download' }) {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<{ busy?: boolean; error?: string; done?: boolean }>({})

  async function send() {
    const file = input.current?.files?.[0]
    if (!file) { setState({ error: 'Choose a file first.' }); return }
    setState({ busy: true })
    try {
      const prep = await prepareFileUpload(courseId, lessonId, { name: file.name, size: file.size })
      if ('error' in prep) { setState({ error: prep.error }); return }
      const body = new FormData()
      body.append('cacheControl', '3600')
      body.append('', file)
      const res = await fetch(prep.target.signedUrl, { method: 'PUT', body })
      if (!res.ok) { setState({ error: 'The upload did not go through. Try again.' }); return }
      const fin = await finishFileUpload(courseId, lessonId, prep.target.path, file.name)
      if (fin.error) { setState({ error: fin.error }); return }
      setState({ done: true })
      if (input.current) input.current.value = ''
      router.refresh()
    } catch {
      setState({ error: 'The upload did not go through. Try again.' })
    }
  }

  const rule = FILE_RULES[type]
  return (
    <div className="grid gap-3">
      <input ref={input} type="file" aria-label="File to upload" accept={rule.exts.map((e) => `.${e}`).join(',')} className="text-sm" />
      <div className="flex items-center gap-4">
        <button type="button" className={button} disabled={state.busy} onClick={send}>{state.busy ? 'Uploading…' : 'Upload file'}</button>
        {state.done && <span className="text-sm text-success">Uploaded.</span>}
      </div>
      {state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      <p className={hint}>Up to {Math.round(rule.maxBytes / 1024 / 1024)} MB. Allowed: {rule.exts.join(', ')}.</p>
    </div>
  )
}
