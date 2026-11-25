'use client'

import { useKeepForm } from '@/lib/use-keep-form'
import { buttonSm, hint, input } from '@/lib/ui'
import { Check, Field } from '../../../../_components/ui'
import { updateLesson } from '../../../actions'

export interface LessonFormValues {
  title: string; summary: string | null; type: string; minutes: number | null; isPreview: boolean
  text: string; externalUrl: string; canAddVideo: boolean
  /** The academy's folder on our video server, or null when no video server is set up. */
  videoFolder: string | null
  dripAvailable: boolean; dripDays: number | null
}

export function LessonForm({ courseId, lessonId, v }: { courseId: string; lessonId: string; v: LessonFormValues }) {
  const [s, onSubmit, pending] = useKeepForm(updateLesson.bind(null, courseId, lessonId))
  const isVideo = v.type === 'video' || v.type === 'live'
  return (
    <form onSubmit={onSubmit} className="grid max-w-2xl gap-5">
      <Field id="title" label="Lesson name"><input id="title" name="title" defaultValue={v.title} required className={input} /></Field>
      <Field id="summary" label="Short description" hint="Shown under the name." optional><textarea id="summary" name="summary" rows={2} defaultValue={v.summary ?? ''} className={input} /></Field>

      {v.type === 'article' && (
        <Field id="text" label="The reading" hint="Start a heading with ##. Wrap words in ** to make them bold. Pictures are not supported yet.">
          <textarea id="text" name="text" rows={16} defaultValue={v.text} className={input} />
        </Field>
      )}
      {v.type === 'external_link' && (
        <Field id="external_url" label="Web address" hint="Starts with https://"><input id="external_url" name="external_url" type="url" defaultValue={v.externalUrl} placeholder="https://" className={input} /></Field>
      )}

      <Check name="is_preview" defaultChecked={v.isPreview} title="Free for everyone" hint="Anyone can open this lesson from the course page, without joining." />

      <details className="rounded-2xl ring-1 ring-border">
        <summary className="min-h-12 cursor-pointer content-center px-4 t-label !text-fg">More options</summary>
        <div className="grid gap-5 border-t border-border p-4">
          <Field id="minutes" label="Length in minutes" hint="Filled in automatically when you upload a video." optional>
            <input key={v.minutes ?? ''} id="minutes" name="minutes" inputMode="numeric" defaultValue={v.minutes ?? ''} className={`${input} max-w-40`} />
          </Field>
          {v.dripAvailable && (
            <Field id="drip_days" label="Opens this many days after joining" hint="Leave empty to open at once." optional>
              <input id="drip_days" name="drip_days" inputMode="numeric" defaultValue={v.dripDays ?? ''} className={`${input} max-w-40`} />
            </Field>
          )}

          {isVideo && v.canAddVideo && (
            <fieldset className="grid gap-4">
              <legend className="mb-3 t-card">Add a video from somewhere else</legend>
              {v.type === 'video' ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-[15rem_1fr]">
                    <Field id="video_kind" label="Where is it?">
                      <select id="video_kind" name="video_kind" className={input} defaultValue="youtube">
                        <option value="youtube">YouTube link</option><option value="url">Direct video link</option><option value="mux">Mux playback ID</option>
                        {v.videoFolder && <option value="server">File on the video server</option>}
                      </select>
                    </Field>
                    <Field id="video_value" label="Link, ID or file name"><input id="video_value" name="video_value" className={input} autoComplete="off" /></Field>
                  </div>
                  <label className="flex min-h-11 items-center gap-3 t-label !text-fg"><input type="checkbox" name="mux_signed" className="h-5 w-5" /> Mux playback uses a signed policy</label>
                  <p className={hint}>A direct link must be https and end in .mp4, .webm or .m3u8.{v.videoFolder ? ` A server file must already be in the “${v.videoFolder}” folder.` : ''}</p>
                </>
              ) : (
                <>
                  {v.videoFolder && (
                    <Field id="server_path" label="File already on the video server" hint={`The file's name in the “${v.videoFolder}” folder.`} optional>
                      <input id="server_path" name="server_path" className={input} autoComplete="off" placeholder="month-1/class-01.mp4" />
                    </Field>
                  )}
                  <Field id="recording_url" label="Microsoft Teams link" hint="Opens in Teams: no notes or progress. Saving a link replaces the video. Check that students can open it." optional>
                    <input key={v.externalUrl} id="recording_url" name="recording_url" type="url" defaultValue={v.externalUrl} placeholder="https://teams.microsoft.com/…" className={input} />
                  </Field>
                </>
              )}
            </fieldset>
          )}
        </div>
      </details>

      {s.error && <p role="alert" className="rounded-xl bg-danger-bg px-4 py-3 t-label !text-danger-ink">{s.error}</p>}
      {s.saved && <p role="status" className="rounded-xl bg-ok-bg px-4 py-3 t-label !text-ok-ink">Saved.</p>}
      <div><button className={buttonSm} disabled={pending}>{pending ? 'Saving…' : 'Save lesson'}</button></div>
    </form>
  )
}
