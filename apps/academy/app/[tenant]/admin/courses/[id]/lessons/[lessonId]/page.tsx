import { notFound, redirect } from 'next/navigation'
import { z } from 'zod'
import { humanSize, resolvePlayback, videoServerFromEnv, videoUploadDirFromEnv } from '@educore/core/media'
import { isEnabled } from '@educore/features'
import { can, requireAccess } from '@/lib/dal'
import { chipClass } from '@/lib/ui'
import { Card, Empty, PageHeader } from '../../../../_components/ui'
import { FileDrop } from '../../../../_components/file-drop'
import { VideoUploader } from '../../../../_components/video-uploader'
import { LessonForm } from './lesson-form'

export const metadata = { title: 'Lesson' }

const TYPE: Record<string, string> = { video: 'Video lesson', live: 'Class recording', article: 'Reading page', external_link: 'Web link', pdf: 'PDF', download: 'File to download' }

export default async function EditLesson({ params }: PageProps<'/[tenant]/admin/courses/[id]/lessons/[lessonId]'>) {
  const { id, lessonId } = await params
  if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(lessonId).success) notFound()
  const a = await requireAccess({ permission: 'course.manage', feature: 'catalog.courses' }, `/admin/courses/${id}/lessons/${lessonId}`)

  const { data: l } = await a.db.from('lessons').select('*').eq('id', lessonId).eq('course_id', id).is('deleted_at', null).maybeSingle()
  if (!l) notFound()
  if (l.type === 'quiz') redirect(`/admin/courses/${id}/quiz/${lessonId}`)

  const f = a.bundle.features
  const isVideo = l.type === 'video' || l.type === 'live'
  const isFile = l.type === 'pdf' || l.type === 'download'
  const { data: media } = l.media_asset_id
    ? await a.db.from('media_assets').select('title, size_bytes').eq('id', l.media_asset_id).maybeSingle()
    : { data: null }

  const mayVideo = isEnabled(f, 'content.video') && can(a, 'content.upload')
  const mayUpload = isEnabled(f, 'core.media') && can(a, 'content.upload') && isEnabled(f, isVideo ? 'content.video' : l.type === 'pdf' ? 'content.documents' : 'content.downloads')
  const toServer = Boolean(videoUploadDirFromEnv() && videoServerFromEnv())
  const playback = isVideo && l.media_asset_id ? await resolvePlayback(a.bundle.tenant.id, l.media_asset_id) : null

  const text = ((l.body ?? {}) as { text?: string }).text ?? ''
  const hasContent = isVideo ? Boolean(l.media_asset_id || l.external_url) : isFile ? Boolean(l.media_asset_id) : l.type === 'article' ? text.trim().length > 0 : Boolean(l.external_url)
  const hasVideo = Boolean(l.media_asset_id || l.external_url)
  const base = `/admin/courses/${id}`

  return (
    <>
      <PageHeader title={l.title} back={{ href: base, label: 'Back to the course' }}
        lead={<span className="flex flex-wrap items-center gap-3"><span className={chipClass(hasContent ? 'ok' : 'warn')}>{hasContent ? 'Ready' : 'Needs content'}</span><span>{TYPE[l.type] ?? l.type}</span></span>} />

      <LessonForm courseId={id} lessonId={lessonId} v={{
        title: l.title, summary: l.summary, type: l.type, minutes: l.duration_seconds ? Math.round(l.duration_seconds / 60) : null,
        isPreview: l.is_preview, text, externalUrl: l.external_url ?? '',
        canAddVideo: mayVideo, videoFolder: videoServerFromEnv() ? a.bundle.tenant.slug : null,
        dripAvailable: isEnabled(f, 'learning.drip'),
        dripDays: ((l.unlock_rule ?? {}) as { type?: string; days?: number }).type === 'days_after_enrolment' ? ((l.unlock_rule as { days?: number }).days ?? 0) : null,
        uploadsItself: isVideo || isFile,
      }}>
        {isVideo && (
          <Card title="Video">
            <div className="grid gap-5">
              {playback?.kind === 'file' ? (
                <video key={playback.src} src={playback.src} controls preload="metadata" className="aspect-video w-full rounded-2xl bg-black" />
              ) : playback && playback.kind !== 'unavailable' ? (
                <Empty icon="check" title="A video is added">It comes from {playback.kind === 'youtube' ? 'YouTube' : 'a streaming service'}. Open the lesson on your website to watch it.</Empty>
              ) : playback ? (
                <Empty icon="info" title="The video cannot be played yet">Check the video settings for this academy.</Empty>
              ) : l.external_url ? (
                <Empty icon="link" title="This recording opens in Microsoft Teams">Students watch it there. Upload the video to play it on your website instead.</Empty>
              ) : null}
              {media && <p className="break-all t-small">Current video: <span className="font-semibold" data-testid="current-file">{media.title ?? 'Video'}{media.size_bytes ? ` (${humanSize(media.size_bytes)})` : ''}</span></p>}
              {!mayUpload ? <p className="t-body">Your role or plan cannot upload videos.</p>
                : toServer ? (
                  hasVideo ? (
                    <details>
                      <summary className="inline-flex h-11 cursor-pointer list-none items-center rounded-[10px] border-2 border-fg px-[18px] text-[15px] font-semibold hover:bg-muted">Replace the video</summary>
                      <div className="mt-4"><VideoUploader courseId={id} to={{ lessonId }} hasVideo /></div>
                    </details>
                  ) : <VideoUploader courseId={id} to={{ lessonId }} />
                ) : l.type === 'live' ? <FileDrop courseId={id} lessonId={lessonId} type="recording" current={media ? { name: media.title ?? 'Video', size: media.size_bytes } : null} />
                : <p className="rounded-xl bg-tint-2 p-4 t-label !text-fg">Uploading videos is not set up for this academy. Use the link option below.</p>}
            </div>
          </Card>
        )}

        {isFile && (
          <Card title={l.type === 'pdf' ? 'The PDF' : 'The file'} lead={l.type === 'pdf' ? 'Students read it on the lesson page.' : 'Students download it from the lesson page.'}>
            {mayUpload
              ? <FileDrop courseId={id} lessonId={lessonId} type={l.type as 'pdf' | 'download'} current={media ? { name: media.title ?? 'File', size: media.size_bytes } : null} />
              : <p className="t-body">Your role or plan cannot upload files.</p>}
          </Card>
        )}
      </LessonForm>
    </>
  )
}
