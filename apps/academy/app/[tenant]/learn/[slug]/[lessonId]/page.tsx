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
import { buttonLg, buttonLine, buttonOutline } from '@/lib/ui'
import { LearnerShell } from '../../../_components/learner-shell'
import { dripDate } from '../../_components/curriculum'
import { LessonList, sectionHas } from '../../_components/lesson-list'
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
  const [shell, lesson, course] = await Promise.all([getShell(), getLessonContent(a, lessonId), getLearnCourse(a, slug)])
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

  const monthOf = course?.sections.findIndex((sec) => sectionHas(sec, lesson.id)) ?? -1
  const month = course && monthOf >= 0 ? course.sections[monthOf] : null

  return (
    <LearnerShell a={a} shell={shell} active="lessons" wide>
      <StageProvider lessonId={lesson.id} mode={mode} enabled={notesOn} initialNotes={notes} startPage={deepPage ?? 1}>
        <div className="lx-crumb">
          <Link href={course ? `/learn/${slug}/${lesson.type === 'live' ? 'live' : 'material'}${lesson.type !== 'live' && month ? `?month=${month.id}` : ''}` : `/courses/${slug}`} className="lx-back">
            <Icon name="back" className="lx-i" />{lesson.type === 'live' ? 'Live classes' : 'Lessons'}
          </Link>
          {e && (
            <p className="lx-crumb-prog">
              <span className="lx-bar" role="progressbar" aria-valuenow={Math.round(e.progressPct)} aria-valuemin={0} aria-valuemax={100} aria-label="Course progress"><i style={{ width: `${Math.max(0, Math.min(100, e.progressPct))}%` }} /></span>
              <span>{e.lessonsCompleted} of {e.lessonsTotal} done</span>
            </p>
          )}
        </div>

        <div className={`lx-lgrid${course ? ' has-side' : ''}`}>
          <article className="lx-lmain" aria-labelledby="lesson-h">
            {!tracked && (
              <p className="lx-note">
                <Icon name="info" /><span>This is a free preview. <Link href={`/courses/${slug}`}>See the full course</Link> to enrol.</span>
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
                      ? 'Video playback is not set up yet. Tell your instructor.'
                      : 'The video for this lesson is not ready yet. Check back soon.'}</Notice>
              )}
              </>}
              {isVideo && !lock && !teamsLink && <ScrubMarks fallbackSeconds={lesson.durationSeconds} />}
            </div>


            <header className="lx-ltitle">
              <div className="min-w-0">
                <p className="lx-k">{section ? `${section} · ` : ''}{kind}</p>
                <h1 id="lesson-h" className="lx-h1">{lesson.title}</h1>
              </div>
              {progress.completed && <span className="lx-done"><Icon name="check" className="lx-i" />Completed</span>}
            </header>
            {lesson.summary && <p className="lx-lede">{lesson.summary}</p>}

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
              <nav className="lx-lactions" aria-label="Lesson navigation">
                {/* One filled action per view: on a quiz that is not passed yet, "Start the quiz" is the filled one. */}
                {lock ? (
                  <Link href={blocker ? `/learn/${slug}/${blocker.id}` : `/learn/${slug}/material`} className={`${buttonLg} max-sm:w-full`}>
                    {blocker ? `Go to ${blocker.title}` : 'Back to the lessons'}<Icon name="chev" className="lx-i" />
                  </Link>
                ) : next ? (
                  <Link href={`/learn/${slug}/${next.id}`} className={`${lesson.type === 'quiz' && !progress.completed ? buttonOutline : buttonLg} max-sm:w-full`}>Next: {next.title}<Icon name="chev" className="lx-i" /></Link>
                ) : (
                  <Link href={`/learn/${slug}/material`} className={`${lesson.type === 'quiz' && !progress.completed ? buttonOutline : buttonLg} max-sm:w-full`}>Back to the lessons<Icon name="chev" className="lx-i" /></Link>
                )}
                <div className="lx-lside-acts">
                  {prev && <Link href={`/learn/${slug}/${prev.id}`} className="lx-link"><Icon name="back" className="lx-i" />Previous: {prev.title}</Link>}
                  {lock ? null : lesson.type === 'article' || lesson.type === 'external_link' || fileType || imageOn
                    ? <LessonCompletion lessonId={lesson.id} rule={lesson.completionRule} completed={progress.completed} tracked={tracked} next={next ? `/learn/${slug}/${next.id}` : null} />
                    : null}
                </div>
              </nav>
            )}
          </article>

          {course && (
            <aside className="lx-lside" aria-label="Notes and lesson list">
              <SidePanel
                notesOn={notesOn}
                classList={<LessonList slug={slug} sections={course.sections} currentId={lesson.id} />}
              />
            </aside>
          )}
        </div>
      </StageProvider>
    </LearnerShell>
  )
}

function Notice({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl border border-border bg-white px-4 py-6 text-grey">{children}</p>
}
