import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { z } from 'zod'
import { describeFile, isFileLessonType, resolvePlayback } from '@educore/core/media'
import { isEnabled } from '@educore/features'
import { requireMember } from '@/lib/dal'
import { getLearnCourse, getLessonContent, getLessonProgress } from '@/lib/learn'
import { getLessonNotes } from '@/lib/notes'
import { getShell } from '@/lib/shell'
import type { LearnLesson } from '@/lib/learn'
import { LearnerShell } from '../../../_components/learner-shell'
import { Ic, type IconName } from '../../../_components/v11'
import { ImageViewer } from '../../_components/image-viewer'
import { LessonActions } from '../../_components/lesson-actions'
import { KIND, KIND_ICON, dripDate, minutes, placeOf } from '../../_components/lesson-meta'
import { PdfReader } from '../../_components/pdf-reader'
import { Prose } from '../../_components/prose'
import { QuickNote } from '../../_components/quick-note'
import { QuizOverview, type QuizOverviewData } from '../../_components/quiz-overview'
import { SheetButtons, SidePanel } from '../../_components/side-panel'
import { StageProvider, type NoteMode } from '../../_components/stage'
import { ScrubMarks } from '../../_components/stage-parts'
import { VideoPlayer } from '../../_components/video-player'
import { VideoTools } from '../../_components/video-tools'
import '../../_components/study.css'

export const metadata: Metadata = { title: 'Lesson' }

/*
 * The study room. One job: learn this lesson, then move on.
 * Reading order: the lesson itself (video, PDF, picture, text) -> a note box under it -> the title -> the one filled
 * button that goes forward. Beside it (two outline buttons on a phone): the lessons of this month and the learner's notes.
 * Everything that is not studying (the menu, other pages) is out of the way: this screen has its own slim bar.
 * Every kind of lesson sits in the same frame; only the block at the top changes (design guide v11, mockup s-lesson).
 */

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

  const place = placeOf(course?.sections, lesson.id)
  const where = place ? `${place.label} · Lesson ${place.no} of ${place.lessons.length}` : undefined
  const monthName = place ? `${place.label}${place.month.title && place.month.title !== place.label ? `: ${place.month.title}` : ''}` : null
  const e = course?.enrollment
  const mins = minutes(lesson.durationSeconds)

  const backHref = course ? (lesson.type === 'live' ? `/learn/${slug}/live` : `/learn/${slug}/material${place ? `?month=${place.month.id}` : ''}`) : `/courses/${slug}`
  const toLesson = (l?: LearnLesson) => (l ? { href: `/learn/${slug}/${l.id}`, title: l.title } : null)
  // Reading, links, files and quizzes are the lesson; the title comes first and the content under it.
  const titleFirst = Boolean(lock) || ['article', 'external_link', 'download', 'quiz', 'test'].includes(lesson.type) || !['video', 'live', 'pdf', 'image'].includes(lesson.type)

  let viewer: React.ReactNode = null
  if (lock) {
    viewer = (
      <Callout icon="lock" title={lock.reason === 'drip' && lock.unlocksAt ? `This lesson opens on ${dripDate(lock.unlocksAt)}` : 'Finish the earlier lessons first'}>
        {lock.reason === 'drip' ? 'Come back on that day. Everything before it is open now.' : <>This course is taken in order. {blocker ? <>Start with <Link href={`/learn/${slug}/${blocker.id}`}>{blocker.title}</Link>.</> : null}</>}
      </Callout>
    )
  } else if (isVideo) {
    viewer = teamsLink ? (
      <Callout icon="live" title="This recording is in Microsoft Teams" action={<a href={`/api/recording/${lesson.id}`} target="_blank" rel="noopener noreferrer" className="btn btn-line btn-sm">Open in Microsoft Teams<Ic n="ext" s /></a>}>
        It opens in a new tab. Come back here when you have watched it.
      </Callout>
    )
      : lesson.type === 'live' && !lesson.mediaAssetId ? <Callout icon="clock" title="The recording is on its way">It is usually up the same night. Check back tomorrow morning.</Callout>
      : !videoOn ? <Callout icon="info" title="Videos are switched off">Video lessons are not enabled for this academy.</Callout>
      : playback && playback.kind !== 'unavailable'
        ? <>
            <div className="player">
              <VideoPlayer framed playback={playback} lessonId={lesson.id} startAt={deepT ?? (progress.completed ? 0 : progress.positionSeconds)} completed={progress.completed} title={lesson.title} tracked={tracked} />
            </div>
            <ScrubMarks fallbackSeconds={lesson.durationSeconds} />
            <VideoTools resumeAt={deepT ?? (progress.completed ? 0 : progress.positionSeconds)} />
          </>
        : <Callout icon="info" title="The video is not ready yet">{playback?.kind === 'unavailable' && playback.reason === 'not_configured' ? 'Video playback is not set up yet. Tell your instructor.' : 'Check back soon.'}</Callout>
  } else if (lesson.type === 'pdf') {
    viewer = !fileOn ? <Callout icon="info" title="PDFs are switched off">This kind of lesson is not enabled for this academy.</Callout>
      : !file ? <Callout icon="clock" title="The file is not ready yet">Check back soon.</Callout>
      : <PdfReader src={`/api/lesson-file/${lesson.id}`} title={lesson.title} />
  } else if (imageOn) {
    viewer = lesson.mediaAssetId
      ? <ImageViewer src={`/api/lesson-file/${lesson.id}`} alt={lesson.title} />
      : <Callout icon="clock" title="The picture is not ready yet">Check back soon.</Callout>
  }

  // What sits under the title for reading, links, files and quizzes.
  let content: React.ReactNode = lock ? viewer : null
  if (!lock) {
    if (lesson.type === 'article') content = lesson.body?.text ? <Prose v11 text={lesson.body.text} /> : <Callout icon="info" title="Nothing here yet">This lesson has no text yet.</Callout>
    else if (lesson.type === 'lab') {
      content = <>
        {lesson.body?.text && <Prose v11 text={lesson.body.text} />}
        {lesson.externalUrl
          ? <Callout icon="lab" title="Open the lab" action={<a href={lesson.externalUrl} target="_blank" rel="noopener noreferrer" className="btn btn-line btn-sm">Open the lab<Ic n="ext" s /></a>}>This is a hands-on lab. It opens in a new tab. Come back here when you are done.</Callout>
          : !lesson.body?.text && <Callout icon="lab" title="A hands-on lab">Do this one on your own computer, as shown in class or in the lesson text. Stuck? Ask in the next class, or message us on WhatsApp.</Callout>}
      </>
    } else if (lesson.type === 'external_link') {
      const host = (() => { try { return new URL(lesson.externalUrl ?? '').hostname.replace(/^www\./, '') } catch { return null } })()
      content = lesson.externalUrl
        ? <Callout icon="ext" title={host ?? 'Open the resource'} action={<a href={lesson.externalUrl} target="_blank" rel="noopener noreferrer" className="btn btn-line btn-sm">Open the resource<Ic n="ext" s /></a>}>This lesson is on another website. It opens in a new tab.</Callout>
        : <Callout icon="info" title="No link yet">This lesson has no link yet.</Callout>
    } else if (fileType && lesson.type !== 'pdf') {
      // Files are not offered for download. Lessons made as "file to download" before that rule have nothing to show.
      content = <Callout icon="info" title="This file is not available online">Course files are not offered for download. Ask your instructor if you need this one.</Callout>
    } else if (lesson.type === 'quiz') {
      content = !isEnabled(a.bundle.features, 'assess.quizzes') ? <Callout icon="info" title="Quizzes are switched off">Quizzes are not enabled for this academy.</Callout>
        : !course ? <Callout icon="info" title="Join to take this quiz">Enrol in the course to take the quiz.</Callout>
        : overview?.data ? <QuizOverview slug={slug} lessonId={lesson.id} o={overview.data as unknown as QuizOverviewData} notice={typeof quizNotice === 'string' ? quizNotice : undefined} />
        : <Callout icon="info" title="Not available">This quiz is not available right now.</Callout>
    } else if (!['video', 'live', 'image', 'article', 'lab', 'external_link', 'pdf', 'download', 'quiz'].includes(lesson.type)) {
      content = <Callout icon="info" title="Not available yet">This kind of lesson is not available yet.</Callout>
    }
  }

  const head = (
    <header className={`stitle${titleFirst ? ' first' : ''}`}>
      <p className="kick"><Ic n={KIND_ICON[lesson.type] ?? 'doc'} s />{[KIND[lesson.type] ?? lesson.type, mins && lesson.type !== 'quiz' ? mins : null, monthName].filter(Boolean).join(' · ')}</p>
      <h1 className="t-title" id="ls-h">{lesson.title}</h1>
      {progress.completed && <p className="ok-line"><Ic n="check" s />Completed</p>}
      {lesson.summary && <p className="t-lead">{lesson.summary}</p>}
    </header>
  )

  const actions = course && !lock ? (
    <LessonActions lessonId={lesson.id} rule={lesson.completionRule} completed={progress.completed} tracked={tracked}
      autoOnOpen={lesson.type === 'article' || lesson.type === 'lab' || lesson.type === 'external_link' || fileType || imageOn}
      plays={isVideo && !teamsLink && (lesson.completionRule === 'watch_pct' || (lesson.completionRule === 'auto' && lesson.type === 'video'))}
      next={toLesson(next)} prev={toLesson(prev)} backHref={`/learn/${slug}/material`}
      quiet={(lesson.type === 'quiz' || lesson.type === 'test') && !progress.completed} />
  ) : course && lock ? (
    <div className="acts"><Link href={blocker ? `/learn/${slug}/${blocker.id}` : `/learn/${slug}/material`} className="btn">{blocker ? `Go to ${blocker.title}` : 'Back to my course'}</Link></div>
  ) : null

  return (
    <LearnerShell a={a} shell={shell} active="lessons" focus={{
      backHref, backLabel: course ? (lesson.type === 'live' ? 'Live classes' : 'My course') : 'The course',
      where, progress: e ? { pct: e.progressPct, label: `${e.lessonsCompleted} of ${e.lessonsTotal} done` } : undefined,
    }}>
      <StageProvider lessonId={lesson.id} mode={mode} enabled={notesOn} initialNotes={notes} startPage={deepPage ?? 1}>
        <div className={`study${course ? '' : ' solo'}`}>
          <article aria-labelledby="ls-h" style={{ minWidth: 0 }}>
            {!tracked && (
              <p className="note-l lead-note">
                <Ic n="info" s /><span>This is a free preview. <Link href={`/courses/${slug}`}>See the full course</Link> to join.</span>
              </p>
            )}
            {titleFirst ? <>{head}{content && <div className="lcontent">{content}</div>}</> : <>{viewer}</>}
            {notesOn && !lock && <QuickNote />}
            {!titleFirst && head}
            {actions}
            {course && <SheetButtons notesOn={notesOn} />}
          </article>

          {course && <SidePanel slug={slug} sections={course.sections} currentId={lesson.id} notesOn={notesOn} />}
        </div>
      </StageProvider>
    </LearnerShell>
  )
}

/** A short message in the lesson's place (locked, not ready, a link that leaves the site): an icon tile, what it is, what to do. */
function Callout({ icon, title, action, children }: { icon: IconName; title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="callout">
      <span className="ti lg"><Ic n={icon} /></span>
      <div>
        <p className="t-card">{title}</p>
        <p className="t-body">{children}</p>
        {action && <p className="act">{action}</p>}
      </div>
    </div>
  )
}
