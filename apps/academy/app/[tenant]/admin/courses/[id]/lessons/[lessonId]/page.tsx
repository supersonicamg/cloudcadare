import { notFound, redirect } from 'next/navigation'
import { z } from 'zod'
import { humanSize, resolvePlayback, videoServerFromEnv, videoUploadDirFromEnv } from '@educore/core/media'
import { isEnabled } from '@educore/features'
import { can, requireAccess } from '@/lib/dal'
import { Card, Empty, PageHeader } from '../../../../_components/ui'
import { VideoUploader } from '../../../../_components/video-uploader'
import { FileUpload } from './file-upload'
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
  const current = media ? `${media.title ?? 'File'}${media.size_bytes ? ` (${humanSize(media.size_bytes)})` : ''}` : null

  const mayVideo = isEnabled(f, 'content.video') && can(a, 'content.upload')
  const mayUpload = isEnabled(f, 'core.media') && can(a, 'content.upload') && isEnabled(f, isVideo ? 'content.video' : l.type === 'pdf' ? 'content.documents' : 'content.downloads')
  const toServer = Boolean(videoUploadDirFromEnv() && videoServerFromEnv())
  const playback = isVideo && l.media_asset_id ? await resolvePlayback(a.bundle.tenant.id, l.media_asset_id) : null

  return (
    <>
      <PageHeader title={l.title} lead={TYPE[l.type] ?? l.type} back={{ href: `/admin/courses/${id}`, label: 'Back to the course' }} />

      <div className="grid gap-5">
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
              ) : (
                <Empty icon="video" title="No video yet">Students see that the lesson is not ready.</Empty>
              )}
              {current && <p className="break-all t-small">Current video: <span className="font-semibold" data-testid="current-file">{current}</span></p>}
              {!mayUpload ? <p className="t-body">Your role or plan cannot upload videos.</p>
                : toServer ? <VideoUploader courseId={id} to={{ lessonId }} hasVideo={Boolean(l.media_asset_id || l.external_url)} />
                : l.type === 'live' ? <FileUpload courseId={id} lessonId={lessonId} type="recording" />
                : <p className="rounded-xl bg-tint-2 p-4 t-label !text-fg">Uploading videos is not set up for this academy. Use “Add a video from somewhere else” below.</p>}
            </div>
          </Card>
        )}

        {isFile && (
          <Card title={l.type === 'pdf' ? 'PDF' : 'File'} lead={current ? undefined : 'Nothing uploaded yet.'}>
            {current && <p className="mb-4 break-all t-body">Current file: <span className="font-semibold" data-testid="current-file">{current}</span>. Choose another to replace it.</p>}
            {mayUpload ? <FileUpload courseId={id} lessonId={lessonId} type={l.type as 'pdf' | 'download'} /> : <p className="t-body">Your role or plan cannot upload files.</p>}
          </Card>
        )}

        <Card title="Lesson details">
          <LessonForm courseId={id} lessonId={lessonId} v={{
            title: l.title, summary: l.summary, type: l.type, minutes: l.duration_seconds ? Math.round(l.duration_seconds / 60) : null,
            isPreview: l.is_preview, text: ((l.body ?? {}) as { text?: string }).text ?? '', externalUrl: l.external_url ?? '',
            canAddVideo: mayVideo, videoFolder: videoServerFromEnv() ? a.bundle.tenant.slug : null,
            dripAvailable: isEnabled(f, 'learning.drip'),
            dripDays: ((l.unlock_rule ?? {}) as { type?: string; days?: number }).type === 'days_after_enrolment' ? ((l.unlock_rule as { days?: number }).days ?? 0) : null,
          }} />
        </Card>
      </div>
    </>
  )
}
