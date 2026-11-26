import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { z } from 'zod'
import { getPublicPreview } from '@educore/core/catalog'
import { describeFile, isFileLessonType, resolvePlayback } from '@educore/core/media'
import { isEnabled } from '@educore/features'
import { getShell } from '@/lib/shell'
import { button, buttonQuiet } from '@/lib/ui'
import { Prose } from '../../../../learn/_components/prose'
import { VideoPlayer } from '../../../../learn/_components/video-player'

export const metadata: Metadata = { title: 'Free preview' }

/** A free-preview lesson, open to anyone. Nothing here is tracked: progress starts when someone enrols. */
export default async function PreviewLesson({ params }: PageProps<'/[tenant]/courses/[slug]/preview/[lessonId]'>) {
  const { slug, lessonId } = await params
  if (!z.uuid().safeParse(lessonId).success) notFound()
  const { bundle, theme, brand, nav, account, site } = await getShell()
  if (!isEnabled(bundle.features, 'catalog.courses')) notFound()
  const p = await getPublicPreview(bundle.tenant.id, slug, lessonId)
  if (!p) notFound()
  const { lesson, course } = p

  const fileType = isFileLessonType(lesson.type)
  const videoOn = isEnabled(bundle.features, 'content.video')
  const fileOn = isEnabled(bundle.features, lesson.type === 'pdf' ? 'content.documents' : 'content.downloads')
  const playback = lesson.type === 'video' && videoOn && lesson.mediaAssetId ? await resolvePlayback(bundle.tenant.id, lesson.mediaAssetId) : null
  const file = fileType && fileOn && lesson.mediaAssetId ? await describeFile(bundle.tenant.id, lesson.mediaAssetId) : null

  return (
    <theme.SiteLayout brand={brand} nav={nav} account={account} site={site}>
      <article className="mx-auto max-w-3xl px-5 py-12 md:py-16">
        <Link href={`/courses/${slug}`} className="text-sm text-fg/65 hover:text-fg">&larr; {course.title}</Link>
        <p className="mt-6 rounded-[var(--radius)] bg-muted px-4 py-3 text-sm" data-testid="preview-banner">
          This lesson is a free preview of <span className="font-medium">{course.title}</span>. <Link href={`/courses/${slug}`} className="font-medium text-primary underline">See the full course</Link> to enrol.
        </p>
        <h1 className="mt-8 font-heading text-3xl font-semibold leading-tight tracking-tight md:text-4xl">{lesson.title}</h1>
        {lesson.summary && <p className="mt-3 max-w-2xl text-lg text-fg/75">{lesson.summary}</p>}

        <div className="mt-8">
          {lesson.type === 'article' && (lesson.body?.text ? <Prose text={lesson.body.text} /> : <Notice>This lesson has no content yet.</Notice>)}
          {lesson.type === 'video' && (
            !videoOn ? <Notice>Video lessons are not enabled for this academy.</Notice>
            : playback && playback.kind !== 'unavailable'
              ? <VideoPlayer playback={playback} lessonId={lesson.id} startAt={0} completed={false} title={lesson.title} tracked={false} />
              : <Notice>The video for this lesson is not ready yet.</Notice>
          )}
          {lesson.type === 'external_link' && (lesson.externalUrl
            ? <a href={lesson.externalUrl} target="_blank" rel="noopener noreferrer" className={`${buttonQuiet} inline-block`}>Open the resource &nearr;</a>
            : <Notice>This lesson has no link yet.</Notice>)}
          {fileType && (
            !fileOn || !file ? <Notice>The file for this lesson is not available.</Notice>
            : lesson.type === 'pdf'
              ? <iframe src={`/api/lesson-file/${lesson.id}`} title={lesson.title} className="h-[75vh] w-full rounded-[var(--radius)] border border-border" />
              : <Notice>This file is not available online.</Notice>
          )}
          {!['article', 'video', 'external_link', 'pdf', 'download'].includes(lesson.type) && <Notice>This kind of lesson cannot be previewed.</Notice>}
        </div>

        <div className="mt-12 flex flex-wrap items-center gap-6 border-t border-border pt-6">
          <Link href={`/courses/${slug}`} className={button}>See the full course</Link>
          {p.more.length > 0 && <Link href={`/courses/${slug}/preview/${p.more[0]!.id}`} className="text-sm text-primary hover:underline">Next preview: {p.more[0]!.title} &rarr;</Link>}
        </div>
      </article>
    </theme.SiteLayout>
  )
}

function Notice({ children }: { children: React.ReactNode }) {
  return <p className="rounded-[var(--radius)] border border-border px-4 py-6 text-fg/70">{children}</p>
}
