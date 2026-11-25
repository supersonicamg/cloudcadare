import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { z } from 'zod'
import { humanSize } from '@educore/core/media'
import { isEnabled } from '@educore/features'
import { can, requireAccess } from '@/lib/dal'
import { LessonForm } from './lesson-form'

export const metadata = { title: 'Edit lesson' }

const PROVIDER: Record<string, string> = { youtube: 'YouTube', mux: 'Mux', external_url: 'Direct link' }

export default async function EditLesson({ params }: PageProps<'/[tenant]/admin/courses/[id]/lessons/[lessonId]'>) {
  const { id, lessonId } = await params
  if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(lessonId).success) notFound()
  const a = await requireAccess({ permission: 'course.manage', feature: 'catalog.courses' }, `/admin/courses/${id}/lessons/${lessonId}`)

  const { data: l } = await a.db.from('lessons').select('*').eq('id', lessonId).eq('course_id', id).is('deleted_at', null).maybeSingle()
  if (!l) notFound()
  if (l.type === 'quiz') redirect(`/admin/courses/${id}/quiz/${lessonId}`)

  let currentVideo: string | null = null
  let currentFile: string | null = null
  if (l.media_asset_id && (l.type === 'pdf' || l.type === 'download')) {
    const { data: m } = await a.db.from('media_assets').select('title, size_bytes').eq('id', l.media_asset_id).maybeSingle()
    if (m) currentFile = `${m.title ?? 'File'}${m.size_bytes ? ` (${humanSize(m.size_bytes)})` : ''}`
  } else if (l.media_asset_id) {
    const { data: m } = await a.db.from('media_assets').select('provider, playback_id, metadata').eq('id', l.media_asset_id).maybeSingle()
    if (m) currentVideo = `${PROVIDER[m.provider] ?? m.provider} ${m.playback_id ?? ((m.metadata ?? {}) as { url?: string }).url ?? ''}`.trim()
  }

  return (
    <>
      <Link href={`/admin/courses/${id}`} className="text-sm text-fg/65 hover:text-fg">&larr; Back to the course</Link>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">{l.title}</h1>
      <p className="mt-1 text-fg/65">{{ video: 'Video', article: 'Reading', external_link: 'Link', pdf: 'PDF', download: 'Download', quiz: 'Quiz' }[l.type] ?? l.type} lesson</p>
      <div className="mt-8">
        <LessonForm courseId={id} lessonId={lessonId} v={{
          title: l.title, summary: l.summary, type: l.type, minutes: l.duration_seconds ? Math.round(l.duration_seconds / 60) : null,
          isPreview: l.is_preview, text: ((l.body ?? {}) as { text?: string }).text ?? '', externalUrl: l.external_url ?? '',
          currentVideo, canAddVideo: isEnabled(a.bundle.features, 'content.video') && can(a, 'content.upload'),
          currentFile, canUpload: isEnabled(a.bundle.features, 'core.media') && isEnabled(a.bundle.features, l.type === 'pdf' ? 'content.documents' : 'content.downloads') && can(a, 'content.upload'),
          dripAvailable: isEnabled(a.bundle.features, 'learning.drip'),
          dripDays: ((l.unlock_rule ?? {}) as { type?: string; days?: number }).type === 'days_after_enrolment' ? ((l.unlock_rule as { days?: number }).days ?? 0) : null,
        }} />
      </div>
    </>
  )
}
