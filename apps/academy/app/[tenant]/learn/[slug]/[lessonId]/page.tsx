import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { z } from 'zod'
import { describeFile, humanSize, isFileLessonType, resolvePlayback } from '@educore/core/media'
import { isEnabled } from '@educore/features'
import { Icon } from '@educore/ui/marks'
import { requireMember } from '@/lib/dal'
import { getLearnCourse, getLessonContent, getLessonProgress } from '@/lib/learn'
import { getLessonNotes } from '@/lib/notes'
import { getShell } from '@/lib/shell'
import type { LearnSection } from '@/lib/learn'
import { buttonLg, buttonLine } from '@/lib/ui'
import { Curriculum, ProgressBar, dripDate } from '../../_components/curriculum'
import { QuizOverview, type QuizOverviewData } from '../../_components/quiz-overview'
import { LessonCompletion } from '../../_components/lesson-completion'
import { Prose } from '../../_components/prose'
import { VideoPlayer } from '../../_components/video-player'
import { SidePanel } from '../../_components/notes-panel'
import { StageProvider, type NoteMode } from '../../_components/stage'
import { ImageFrame, PdfFrame, ScrubMarks } from '../../_components/stage-parts'

export const metadata: Metadata = { title: 'Lesson' }

export default async function LessonPage({ params, searchParams }: PageProps<'/[tenant]/learn/[slug]/[lessonId]'>) {
  const { slug, lessonId } = await params
  const { quiz: quizNotice, t: tParam, page: pageParam } = await searchParams
  if (!z.uuid().safeParse(lessonId).success) notFound()
  const a = await requireMember(`/learn/${slug}/${lessonId}`)
  const [{ theme, brand }, lesson, course] = await Promise.all([getShell(), getLessonContent(a, lessonId), getLearnCourse(a, slug)])
  // RLS already hides lessons the member may not see, so a null here also covers "not enrolled and not a free preview".
  if (!lesson) notFound()

  // Enrolled: the lesson must belong to the course in the URL. Not enrolled: only a free preview gets this far
  // (RLS), and the course in the URL must be the lesson's own.
  if (course) {
    if (course.enrollment.course.id !== lesson.courseId) notFound()
  } else {
    const { data: c } = await a.db.from('courses').select('slug').eq('id', lesson.courseId).maybeSingle()
    if (!c || c.slug !== slug) notFound()
  }

  const tracked = Boolean(course)
  // ?t=1634 opens a recording at that second, ?page=3 opens a PDF at that page (links from My notes).
  const num = (v: string | string[] | undefined) => { const n = Number.parseInt(typeof v === 'string' ? v : '', 10); return Number.isFinite(n) && n >= 0 ? n : null }
  const deepT = num(tParam)
  const deepPage = num(pageParam)
  const progress = course ? await getLessonProgress(a, course.enrollment.id, lesson.id) : { completed: false, positionSeconds: 0 }
  const idx = course ? course.order.findIndex((l) => l.id === lesson.id) : -1
  const prev = course && idx > 0 ? course.order[idx - 1] : undefined
  const next = course && idx >= 0 ? course.order[idx + 1] : undefined

  // Sequential courses and drip schedules: the lesson exists but is not open yet.
  const lock = course?.order[idx]?.lock ?? null
  const blocker = lock?.blockingLessonId ? course?.order.find((l) => l.id === lock.blockingLessonId) : undefined

  const quizOn = lesson.type === 'quiz' && isEnabled(a.bundle.features, 'assess.quizzes') && Boolean(course) && !lock
  const overview = quizOn && lesson.testId ? await a.db.rpc('get_test_overview', { p_test_id: lesson.testId }) : null

  const isVideo = lesson.type === 'video' || lesson.type === 'live'
  const imageOn = lesson.type === 'image'
  const notesFeature = isEnabled(a.bundle.features, 'learning.notes')
  const mode: NoteMode = isVideo ? 'time' : lesson.type === 'pdf' ? 'page' : 'none'
  // A class recording left in Microsoft Teams opens there: no player here, so no notes either.
  const teamsLink = lesson.type === 'live' && !lesson.mediaAssetId && Boolean(lesson.externalUrl)
  const notesOn = notesFeature && tracked && !lock && lesson.type !== 'quiz' && !teamsLink
  const notes = notesOn ? await getLessonNotes(a, lesson.id) : []
  const videoOn = isEnabled(a.bundle.features, 'content.video')
  const fileType = isFileLessonType(lesson.type)
  const fileOn = isEnabled(a.bundle.features, lesson.type === 'pdf' ? 'content.documents' : 'content.downloads')
  const file = !lock && fileType && fileOn && lesson.mediaAssetId ? await describeFile(a.bundle.tenant.id, lesson.mediaAssetId) : null
  const playback = !lock && isVideo && videoOn && lesson.mediaAssetId
    ? await resolvePlayback(a.bundle.tenant.id, lesson.mediaAssetId)
    : null

  const sectionOf = (list: LearnSection[], id: string, trail = ''): string | null => {
    for (const [i, sec] of list.entries()) {
      const label = `${sec.label ?? String(i + 1).padStart(2, '0')} · ${sec.title}`
      if (sec.lessons.some((l) => l.id === id)) return label
      const inner = sectionOf(sec.children, id, trail)
      if (inner) return inner
    }
    return null
  }
  const section = course ? sectionOf(course.sections, lesson.id) : null
  const KIND: Record<string, string> = { video: 'Video', article: 'Reading', external_link: 'Link', pdf: 'PDF', download: 'Download', quiz: 'Quiz', live: 'Live class recording', image: 'Image' }
  const kind = [KIND[lesson.type] ?? lesson.type, lesson.durationSeconds ? `${Math.max(1, Math.round(lesson.durationSeconds / 60))} min` : null].filter(Boolean).join(' · ')
  const e = course?.enrollment

  return (
    <theme.FocusLayout brand={brand}>
      <StageProvider lessonId={lesson.id} mode={mode} enabled={notesOn} initialNotes={notes} startPage={deepPage ?? 1}>
      <div className="flex min-h-screen flex-col">
        <div className="flex h-16 items-center gap-4 border-b border-border bg-white px-[clamp(16px,2.4vw,32px)]">
          <Link href={course ? `/learn/${slug}/${lesson.type === 'live' ? 'live' : 'material'}` : `/courses/${slug}`} className="inline-flex items-center gap-2 text-base font-semibold text-primary">
            <Icon name="back" /><span className="max-sm:hidden">{lesson.type === 'live' ? 'Live classes' : 'Course material'}</span>
          </Link>
          <div className="min-w-0 flex-1 truncate text-base font-semibold">
            {section && <small className="block truncate text-[13px] font-medium text-mute">{section}</small>}
            {lesson.title}
          </div>
          {e && (
            <div className="flex items-center gap-3 whitespace-nowrap text-sm text-mute">
              <ProgressBar pct={e.progressPct} label="Course progress" className="!h-2 w-[140px] max-md:hidden" />
              {e.lessonsCompleted} of {e.lessonsTotal}
            </div>
          )}
        </div>
        <div className="grid flex-1 lg:grid-cols-[minmax(0,1fr)_360px]">
          <main className="min-w-0 px-[clamp(20px,3.4vw,56px)] pb-14 pt-[clamp(20px,2.6vw,40px)]">
            {!tracked && (
              <p className="mb-6 rounded-2xl bg-tint-2 px-4 py-3 text-sm">
                This is a free preview. <Link href={`/courses/${slug}`} className="font-semibold text-primary underline">See the full course</Link> to enrol.
              </p>
            )}
            <div>
              {lock ? (
                <Notice>
                  {lock.reason === 'drip' && lock.unlocksAt
                    ? <>This lesson opens on {dripDate(lock.unlocksAt)}.</>
                    : <>Finish {blocker ? <Link href={`/learn/${slug}/${blocker.id}`} className="font-semibold text-primary underline">{blocker.title}</Link> : 'the earlier lessons'} first. This course is taken in order.</>}
                </Notice>
              ) : <>
              {isVideo && (
                teamsLink ? (
                  <div className="grid justify-items-start gap-4 rounded-[20px] bg-muted p-6 sm:p-8">
                    <p className="t-body !text-fg">This recording is in Microsoft Teams. It opens in a new tab.</p>
                    <a href={`/api/recording/${lesson.id}`} target="_blank" rel="noopener noreferrer" className={buttonLine}>Open in Microsoft Teams &nearr;</a>
                  </div>
                )
                : lesson.type === 'live' && !lesson.mediaAssetId ? <Notice>The recording is on its way. It is usually up the same night.</Notice>
                : !videoOn ? <Notice>Video lessons are not enabled for this academy.</Notice>
                : playback && playback.kind !== 'unavailable'
                  ? <VideoPlayer playback={playback} lessonId={lesson.id} startAt={deepT ?? (progress.completed ? 0 : progress.positionSeconds)} completed={progress.completed} title={lesson.title} />
                  : <Notice>{playback?.kind === 'unavailable' && playback.reason === 'not_configured'
                      ? 'This video needs signed playback, which is not configured yet. Tell your instructor.'
                      : 'The video for this lesson is not ready yet. Check back soon.'}</Notice>
              )}
              </>}
              {isVideo && !lock && !teamsLink && <ScrubMarks fallbackSeconds={lesson.durationSeconds} />}
            </div>

            <div className="mt-7 flex flex-wrap items-start justify-between gap-x-7 gap-y-4">
              <div>
                <p className="text-base font-semibold text-primary">{kind}</p>
                <h1 className="mt-1.5 font-heading text-[clamp(26px,2.6vw,36px)] font-bold leading-[1.08] tracking-[-0.038em] text-balance">{lesson.title}</h1>
              </div>
              {progress.completed && <span className="inline-block rounded-lg bg-ok-bg px-[11px] py-1 text-sm font-semibold text-ok-ink">Completed</span>}
            </div>
            {lesson.summary && <p className="mt-3.5 max-w-[38em] text-[17px] leading-relaxed text-grey">{lesson.summary}</p>}

            <div className="mt-6">
              {lock ? null : <>
              {lesson.type === 'article' && (lesson.body?.text ? <Prose text={lesson.body.text} /> : <Notice>This lesson has no content yet.</Notice>)}
              {lesson.type === 'external_link' && (
                lesson.externalUrl
                  ? <a href={lesson.externalUrl} target="_blank" rel="noopener noreferrer" className={buttonLine}>Open the resource &nearr;</a>
                  : <Notice>This lesson has no link yet.</Notice>
              )}
              {fileType && (
                !fileOn ? <Notice>This kind of lesson is not enabled for this academy.</Notice>
                : !file ? <Notice>The file for this lesson is not ready yet. Check back soon.</Notice>
                : lesson.type === 'pdf' ? (
                  <div>
                    <PdfFrame src={`/api/lesson-file/${lesson.id}`} title={lesson.title} />
                    <p className="mt-3 text-sm"><a href={`/api/lesson-file/${lesson.id}?download=1`} className="font-semibold text-primary underline">Download the PDF</a> <span className="text-mute">{file.sizeBytes ? `· ${humanSize(file.sizeBytes)}` : ''}</span></p>
                  </div>
                ) : (
                  <a href={`/api/lesson-file/${lesson.id}?download=1`} className={buttonLine} data-testid="download-link">
                    <Icon name="down" />Download {file.title}{file.sizeBytes ? ` (${humanSize(file.sizeBytes)})` : ''}
                  </a>
                )
              )}
              {imageOn && (lesson.mediaAssetId ? <ImageFrame src={`/api/lesson-file/${lesson.id}`} alt={lesson.title} /> : <Notice>The picture for this lesson is not ready yet. Check back soon.</Notice>)}
              {lesson.type === 'quiz' && (
                !isEnabled(a.bundle.features, 'assess.quizzes') ? <Notice>Quizzes are not enabled for this academy.</Notice>
                : !course ? <Notice>Enrol to take this quiz.</Notice>
                : overview?.data ? <QuizOverview slug={slug} lessonId={lesson.id} o={overview.data as unknown as QuizOverviewData} notice={typeof quizNotice === 'string' ? quizNotice : undefined} />
                : <Notice>This quiz is not available right now.</Notice>
              )}
              {!['video', 'live', 'image', 'article', 'external_link', 'pdf', 'download', 'quiz'].includes(lesson.type) && <Notice>This kind of lesson is not available yet.</Notice>}
              </>}
            </div>

            {course && (
              <nav className="mt-9 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6" aria-label="Lesson navigation">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                  {prev && <Link href={`/learn/${slug}/${prev.id}`} className="text-base font-semibold text-grey hover:text-fg">&larr; {prev.title}</Link>}
                  {lock ? null : lesson.type === 'article' || lesson.type === 'external_link' || fileType || imageOn
                    ? <LessonCompletion lessonId={lesson.id} rule={lesson.completionRule} completed={progress.completed} tracked={tracked}
                        next={next ? `/learn/${slug}/${next.id}` : null} />
                    : null}
                </div>
                {/* One filled action per view: on a quiz that is not passed yet, "Start the quiz" is the filled one. */}
                {lock ? (
                  // Locked: the way forward is the lesson that unlocks this one, not the next locked lesson.
                  <Link href={blocker ? `/learn/${slug}/${blocker.id}` : `/learn/${slug}`} className={`${buttonLg} max-sm:w-full`}>
                    {blocker ? `Go to ${blocker.title}` : 'Back to the course'} <span aria-hidden="true">→</span>
                  </Link>
                ) : next ? <Link href={`/learn/${slug}/${next.id}`} className={`${lesson.type === 'quiz' && !progress.completed ? buttonLine : buttonLg} max-sm:w-full`}>Next: {next.title} <span aria-hidden="true">→</span></Link>
                  : <Link href={`/learn/${slug}`} className={`${lesson.type === 'quiz' && !progress.completed ? buttonLine : buttonLg} max-sm:w-full`}>Back to the course <span aria-hidden="true">→</span></Link>}
              </nav>
            )}
          </main>

          {course && (
            <aside className="border-t border-border bg-white px-5 pb-10 pt-6 lg:border-l lg:border-t-0">
              <SidePanel
                notesOn={notesOn}
                classList={<>
                  <h2 className="mx-1.5 mb-3 text-sm font-semibold text-mute">{course.enrollment.course.title}</h2>
                  <Curriculum slug={slug} sections={course.sections} currentId={lesson.id} compact />
                </>}
              />
            </aside>
          )}
        </div>
      </div>
      </StageProvider>
    </theme.FocusLayout>
  )
}

function Notice({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl border border-border bg-white px-4 py-6 text-grey">{children}</p>
}
