'use client'

import { useKeepForm } from '@/lib/use-keep-form'
import { button, hint, input, label } from '@/lib/ui'
import { updateLesson } from '../../../actions'
import { FileUpload } from './file-upload'

export interface LessonFormValues {
  title: string; summary: string | null; type: string; minutes: number | null; isPreview: boolean
  text: string; externalUrl: string; currentVideo: string | null; canAddVideo: boolean
  currentFile: string | null; canUpload: boolean; dripAvailable: boolean; dripDays: number | null
}

export function LessonForm({ courseId, lessonId, v }: { courseId: string; lessonId: string; v: LessonFormValues }) {
  const [s, onSubmit, pending] = useKeepForm(updateLesson.bind(null, courseId, lessonId))
  return (
    <form onSubmit={onSubmit} className="grid max-w-2xl gap-5">
      <div><label htmlFor="title" className={label}>Title</label><input id="title" name="title" defaultValue={v.title} required className={input} /></div>
      <div><label htmlFor="summary" className={label}>Short description</label><textarea id="summary" name="summary" rows={2} defaultValue={v.summary ?? ''} className={input} />
        <p className={hint}>Shown under the title. Optional.</p></div>

      {v.type === 'article' && (
        <div><label htmlFor="text" className={label}>Reading</label>
          <textarea id="text" name="text" rows={16} defaultValue={v.text} className={`${input} font-mono text-sm`} />
          <p className={hint}>Markdown: ## headings, **bold**, lists, links and code blocks. Images are not supported yet.</p></div>
      )}

      {v.type === 'external_link' && (
        <div><label htmlFor="external_url" className={label}>Link</label>
          <input id="external_url" name="external_url" type="url" defaultValue={v.externalUrl} placeholder="https://" className={input} /></div>
      )}

      {v.type === 'video' && (
        <fieldset className="grid gap-3 rounded-[var(--radius)] border border-border p-4">
          <legend className="px-1 text-sm font-medium">Video</legend>
          <p className="text-sm">{v.currentVideo ? <>Current video: <span className="font-medium">{v.currentVideo}</span>. Add a new one below to replace it.</> : 'No video attached yet.'}</p>
          {v.canAddVideo ? (
            <>
              <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
                <div><label htmlFor="video_kind" className={label}>Source</label>
                  <select id="video_kind" name="video_kind" className={input} defaultValue="youtube">
                    <option value="youtube">YouTube link</option><option value="mux">Mux playback ID</option><option value="url">Direct https link</option>
                  </select></div>
                <div><label htmlFor="video_value" className={label}>Link or ID</label><input id="video_value" name="video_value" className={input} autoComplete="off" /></div>
              </div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="mux_signed" /> Mux playback uses a signed policy</label>
              <p className={hint}>A direct link must be https and end in .mp4, .webm or .m3u8. Uploading files comes with the media library.</p>
            </>
          ) : <p className={hint}>Your role cannot add videos.</p>}
        </fieldset>
      )}

      {v.type === 'live' && (
        <fieldset className="grid gap-4 rounded-[var(--radius)] border border-border p-4">
          <legend className="px-1 text-sm font-medium">Class recording</legend>
          <p className="text-sm">{v.currentFile ? <>Uploaded video: <span className="font-medium" data-testid="current-file">{v.currentFile}</span></> : v.externalUrl ? 'Using a Teams link.' : 'No recording yet. Learners see “Recording on its way”.'}</p>
          <div className="grid gap-2">
            <p className={label}>Upload the Teams video (recommended)</p>
            <p className={hint}>Plays inside the academy, so learners get notes, bookmarks and progress.</p>
            {v.canUpload ? <FileUpload courseId={courseId} lessonId={lessonId} type="recording" /> : <p className={hint}>Your role or plan cannot upload videos.</p>}
          </div>
          <div className="border-t border-border pt-4"><label htmlFor="recording_url" className={label}>Or paste a Teams link</label>
            <input key={v.externalUrl} id="recording_url" name="recording_url" type="url" defaultValue={v.externalUrl} placeholder="https://teams.microsoft.com/…" className={input} />
            <p className={hint}>Opens in Microsoft Teams. No notes or progress. Saving a link removes the uploaded video. Check that learners outside your organisation can open it.</p></div>
        </fieldset>
      )}

      {(v.type === 'pdf' || v.type === 'download') && (
        <fieldset className="grid gap-3 rounded-[var(--radius)] border border-border p-4">
          <legend className="px-1 text-sm font-medium">{v.type === 'pdf' ? 'PDF' : 'File'}</legend>
          <p className="text-sm">{v.currentFile ? <>Current file: <span className="font-medium" data-testid="current-file">{v.currentFile}</span>. Choose another to replace it.</> : 'No file attached yet.'}</p>
          {v.canUpload ? <FileUpload courseId={courseId} lessonId={lessonId} type={v.type} /> : <p className={hint}>Your role or plan cannot upload files.</p>}
        </fieldset>
      )}

      {v.dripAvailable && (
        <div className="max-w-xs"><label htmlFor="drip_days" className={label}>Opens after (days)</label>
          <input id="drip_days" name="drip_days" inputMode="numeric" defaultValue={v.dripDays ?? ''} className={input} />
          <p className={hint}>Days after the learner enrols. Leave blank to open at once.</p></div>
      )}

      <div className="grid gap-5 sm:grid-cols-[8rem_1fr] sm:items-end">
        <div><label htmlFor="minutes" className={label}>Minutes</label><input id="minutes" name="minutes" inputMode="numeric" defaultValue={v.minutes ?? ''} className={input} /></div>
        <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" name="is_preview" defaultChecked={v.isPreview} /> Free preview (anyone can open it from the course page)</label>
      </div>

      {s.error && <p role="alert" className="text-sm text-danger">{s.error}</p>}
      {s.saved && <p className="text-sm text-success">Saved.</p>}
      <div><button className={button} disabled={pending}>{pending ? 'Saving…' : 'Save lesson'}</button></div>
    </form>
  )
}
