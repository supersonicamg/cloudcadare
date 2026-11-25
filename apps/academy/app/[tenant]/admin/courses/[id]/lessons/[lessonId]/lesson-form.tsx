'use client'

import type { ReactNode } from 'react'
import { useKeepForm } from '@/lib/use-keep-form'
import { buttonSm, hint, input } from '@/lib/ui'
import { Card, Check, Field } from '../../../../_components/ui'
import { updateLesson } from '../../../actions'

export interface LessonFormValues {
  title: string; summary: string | null; type: string; minutes: number | null; isPreview: boolean
  text: string; externalUrl: string; canAddVideo: boolean
  /** The academy's folder on our video server, or null when no video server is set up. */
  videoFolder: string | null
  dripAvailable: boolean; dripDays: number | null
  /** The content has its own upload (video or file) that saves by itself; Save is then only for the settings. */
  uploadsItself: boolean
}

/**
 * The lesson editor. Left: the lesson's content (`children` is the video or file with its own uploader, then whatever
 * is typed here: the reading, the link). Right: the lesson's settings and the one Save button.
 */
export function LessonForm({ courseId, lessonId, v, children }: { courseId: string; lessonId: string; v: LessonFormValues; children?: ReactNode }) {
  const [s, onSubmit, pending] = useKeepForm(updateLesson.bind(null, courseId, lessonId))
  const isVideo = v.type === 'video' || v.type === 'live'
  return (
    <form onSubmit={onSubmit} className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="grid min-w-0 gap-5 lg:col-start-1 lg:row-start-1">
        {children}

        {v.type === 'article' && (
          <Card title="The reading">
            <Field id="text" label="Write it here" hint="Start a heading with ##. Wrap words in ** to make them bold. Pictures are not supported yet.">
              <textarea id="text" name="text" rows={18} defaultValue={v.text} className={input} />
            </Field>
          </Card>
        )}
        {v.type === 'external_link' && (
          <Card title="The link" lead="Students open it in a new tab.">
            <Field id="external_url" label="Web address" hint="Starts with https://"><input id="external_url" name="external_url" type="url" defaultValue={v.externalUrl} placeholder="https://" className={input} /></Field>
          </Card>
        )}

        {isVideo && v.canAddVideo && (
          <details className="rounded-[20px] bg-white ring-1 ring-border">
            <summary className="min-h-12 cursor-pointer content-center px-5 t-label !text-fg">
              {v.type === 'video' ? 'Use a YouTube, Mux or other video link instead' : 'Use a Microsoft Teams link or a file on the video server instead'}
            </summary>
            <div className="grid gap-4 border-t border-border p-5">
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
                  <p className={hint}>A direct link must be https and end in .mp4, .webm or .m3u8.{v.videoFolder ? ` A server file must already be in the “${v.videoFolder}” folder.` : ''} Press Save lesson to use it.</p>
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
            </div>
          </details>
        )}
      </div>

      <aside className="grid gap-4 lg:sticky lg:top-6 lg:col-start-2 lg:row-start-1">
        <section aria-label="Lesson settings" className="grid gap-5 rounded-[20px] bg-white p-5 shadow-[0_1px_2px_rgba(20,32,31,.06)] ring-1 ring-border">
          <Field id="title" label="Lesson name"><input id="title" name="title" defaultValue={v.title} required className={input} /></Field>
          <Field id="summary" label="Short description" hint="Shown under the name." optional><textarea id="summary" name="summary" rows={3} defaultValue={v.summary ?? ''} className={input} /></Field>
          <Check name="is_preview" defaultChecked={v.isPreview} title="Free for everyone" hint="Anyone can open this lesson from the course page, without joining." />
          <Field id="minutes" label="Length in minutes" hint={isVideo ? 'Filled in automatically when you upload a video.' : undefined} optional>
            <input key={v.minutes ?? ''} id="minutes" name="minutes" inputMode="numeric" defaultValue={v.minutes ?? ''} className={`${input} max-w-40`} />
          </Field>
          {v.dripAvailable && (
            <Field id="drip_days" label="Opens this many days after joining" hint="Leave empty to open at once." optional>
              <input id="drip_days" name="drip_days" inputMode="numeric" defaultValue={v.dripDays ?? ''} className={`${input} max-w-40`} />
            </Field>
          )}

          {s.error && <p role="alert" className="rounded-xl bg-danger-bg px-4 py-3 t-label !text-danger-ink">{s.error}</p>}
          {s.saved && <p role="status" className="rounded-xl bg-ok-bg px-4 py-3 t-label !text-ok-ink">Saved.</p>}
          <div className="grid gap-2">
            <button className={`${buttonSm} w-full`} disabled={pending}>{pending ? 'Saving…' : 'Save lesson'}</button>
            {v.uploadsItself && <p className="t-small">The file or video above is saved as soon as it is uploaded. Save lesson is for these settings.</p>}
          </div>
        </section>
      </aside>
    </form>
  )
}
