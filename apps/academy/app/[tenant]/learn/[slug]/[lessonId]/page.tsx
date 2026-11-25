import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { z } from 'zod'
import { describeFile, humanSize, isFileLessonType, resolvePlayback } from '@educore/core/media'
import { isEnabled } from '@educore/features'
import { Icon, type IconName } from '@educore/ui/marks'
import { requireMember } from '@/lib/dal'
import { getLearnCourse, getLessonContent, getLessonProgress } from '@/lib/learn'
import { getLessonNotes } from '@/lib/notes'
import { getShell } from '@/lib/shell'
import type { LearnLesson, LearnSection } from '@/lib/learn'
import { buttonLg, buttonLine } from '@/lib/ui'
import { LearnerShell } from '../../../_components/learner-shell'
import { dripDate, minutes } from '../../_components/curriculum'
import { ImageViewer } from '../../_components/image-viewer'
import { LessonActions } from '../../_components/lesson-actions'
import { LessonList, sectionHas } from '../../_components/lesson-list'
import { PdfReader } from '../../_components/pdf-reader'
import { Prose } from '../../_components/prose'
import { QuickNote } from '../../_components/quick-note'
import { QuizOverview, type QuizOverviewData } from '../../_components/quiz-overview'
import { SidePanel } from '../../_components/side-panel'
import { StageProvider, type NoteMode } from '../../_components/stage'
import { ScrubMarks } from '../../_components/stage-parts'
import { VideoPlayer } from '../../_components/video-player'
import { VideoTools } from '../../_components/video-tools'
import '../../_components/study.css'

export const metadata: Metadata = { title: 'Lesson' }

/*
 * The study room. One job: learn this lesson, then move on.
 * Reading order: the lesson itself (video, PDF, picture, text) -> a note box under it -> the title -> the one big button
 * that goes forward. Beside it (a sheet on a phone): the course's lesson list and the learner's notes on this lesson.
 * Everything that is not studying (the sidebar, other pages) is out of the way: this screen has its own slim bar.
 */
const KIND: Record<string, string> = { video: 'Video', article: 'Reading', external_link: 'Link', pdf: 'PDF', document: 'Document', download: 'Download', quiz: 'Quiz', test: 'Test', live: 'Class recording', image: 'Picture', lab: 'Lab' }
const ICON: Record<string, IconName> = { video: 'video', live: 'live', pdf: 'doc', document: 'doc', image: 'image', article: 'book', quiz: 'quiz', test: 'quiz', download: 'down', external_link: 'link', lab: 'lab' }
const flatten = (s: LearnSection): LearnLesson[] => [...s.lessons, ...s.children.flatMap(flatten)]

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

  const monthOf = course?.sections.findIndex((sec) => sectionHas(sec, lesson.id)) ?? -1
  const month = course && monthOf >= 0 ? course.sections[monthOf] : null
  const inMonth = month ? flatten(month) : []
  const place = month ? `Month ${monthOf + 1} · Lesson ${inMonth.findIndex((l) => l.id === lesson.id) + 1} of ${inMonth.length}` : undefined
  const e = course?.enrollment
  const mins = minutes(lesson.durationSeconds)
  const fileLabel = file?.sizeBytes ? humanSize(file.sizeBytes) : undefined

  const backHref = course ? (lesson.type === 'live' ? `/learn/${slug}/live` : `/learn/${slug}/material${month ? `?month=${month.id}` : ''}`) : `/courses/${slug}`
  const toLesson = (l?: LearnLesson) => (l ? { href: `/learn/${slug}/${l.id}`, title: l.title } : null)
  // Reading, links, files and quizzes are the lesson; the title comes first and the content under it.
  const titleFirst = Boolean(lock) || ['article', 'external_link', 'download', 'quiz', 'test'].includes(lesson.type) || !['video', 'live', 'pdf', 'image'].includes(lesson.type)

  let viewer: React.ReactNode = null
  if (lock) {
    viewer = (
      <div className="lx-callout">
        <span className="lx-ico"><Icon name="lock" /></span>
        <div>
          <b>{lock.reason === 'drip' && lock.unlocksAt ? `This lesson opens on ${dripDate(lock.unlocksAt)}` : 'Finish the earlier lessons first'}</b>
          <p>{lock.reason === 'drip' ? 'Come back on that day. Everything before it is open now.' : <>This course is taken in order. {blocker ? <>Start with <Link href={`/learn/${slug}/${blocker.id}`}>{blocker.title}</Link>.</> : null}</>}</p>
        </div>
      </div>
    )
  } else if (isVideo) {
    viewer = teamsLink ? (
      <div className="lx-callout">
        <span className="lx-ico"><Icon name="live" /></span>
        <div>
          <b>This recording is in Microsoft Teams</b>
          <p>It opens in a new tab. Come back here when you have watched it.</p>
          <a href={`/api/recording/${lesson.id}`} target="_blank" rel="noopener noreferrer" className={`${buttonLine} mt-3`}>Open in Microsoft Teams<Icon name="arrow" /></a>
        </div>
      </div>
    )
      : lesson.type === 'live' && !lesson.mediaAssetId ? <Notice icon="clock" title="The recording is on its way">It is usually up the same night. Check back tomorrow morning.</Notice>
      : !videoOn ? <Notice icon="info" title="Videos are switched off">Video lessons are not enabled for this academy.</Notice>
      : playback && playback.kind !== 'unavailable'
        ? <>
            <VideoPlayer playback={playback} lessonId={lesson.id} startAt={deepT ?? (progress.completed ? 0 : progress.positionSeconds)} completed={progress.completed} title={lesson.title} tracked={tracked} />
            <VideoTools resumeAt={deepT ?? (progress.completed ? 0 : progress.positionSeconds)} />
            <ScrubMarks fallbackSeconds={lesson.durationSeconds} />
          </>
        : <Notice icon="info" title="The video is not ready yet">{playback?.kind === 'unavailable' && playback.reason === 'not_configured' ? 'Video playback is not set up yet. Tell your instructor.' : 'Check back soon.'}</Notice>
  } else if (lesson.type === 'pdf') {
    viewer = !fileOn ? <Notice icon="info" title="PDFs are switched off">This kind of lesson is not enabled for this academy.</Notice>
      : !file ? <Notice icon="clock" title="The file is not ready yet">Check back soon.</Notice>
      : <PdfReader src={`/api/lesson-file/${lesson.id}`} title={lesson.title} downloadHref={`/api/lesson-file/${lesson.id}?download=1`} sizeLabel={fileLabel} />
  } else if (imageOn) {
    viewer = lesson.mediaAssetId
      ? <ImageViewer src={`/api/lesson-file/${lesson.id}`} alt={lesson.title} downloadHref={`/api/lesson-file/${lesson.id}?download=1`} />
      : <Notice icon="clock" title="The picture is not ready yet">Check back soon.</Notice>
  }

  // What sits under the title for reading, links, files and quizzes.
  let content: React.ReactNode = lock ? viewer : null
  if (!lock) {
    if (lesson.type === 'article') content = lesson.body?.text ? <Prose text={lesson.body.text} /> : <Notice icon="info" title="Nothing here yet">This lesson has no text yet.</Notice>
    else if (lesson.type === 'lab') {
      content = <>
        {lesson.body?.text && <Prose text={lesson.body.text} />}
        {lesson.externalUrl
          ? <div className="lx-callout"><span className="lx-ico"><Icon name="lab" /></span><div><b>Open the lab</b><p>This is a hands-on lab. It opens in a new tab. Come back here when you are done.</p><a href={lesson.externalUrl} target="_blank" rel="noopener noreferrer" className={`${buttonLine} mt-3`}>Open the lab<Icon name="arrow" /></a></div></div>
          : !lesson.body?.text && <Notice icon="lab" title="A hands-on lab">Do this one on your own computer, as shown in class or in the lesson text. Stuck? Ask in the next class, or message us on WhatsApp.</Notice>}
      </>
    } else if (lesson.type === 'external_link') {
      const host = (() => { try { return new URL(lesson.externalUrl ?? '').hostname.replace(/^www\./, '') } catch { return null } })()
      content = lesson.externalUrl
        ? <div className="lx-callout"><span className="lx-ico"><Icon name="link" /></span><div><b>{host ?? 'Open the resource'}</b><p>This lesson is on another website. It opens in a new tab.</p><a href={lesson.externalUrl} target="_blank" rel="noopener noreferrer" className={`${buttonLine} mt-3`}>Open the resource<Icon name="arrow" /></a></div></div>
        : <Notice icon="info" title="No link yet">This lesson has no link yet.</Notice>
    } else if (fileType && lesson.type !== 'pdf') {
      content = !fileOn ? <Notice icon="info" title="Not switched on">This kind of lesson is not enabled for this academy.</Notice>
        : !file ? <Notice icon="clock" title="The file is not ready yet">Check back soon.</Notice>
        : <div className="lx-callout"><span className="lx-ico"><Icon name="down" /></span><div><b>{file.title}</b><p>{fileLabel ? `${fileLabel}. ` : ''}It saves to your device.</p><a href={`/api/lesson-file/${lesson.id}?download=1`} className={`${buttonLine} mt-3`} data-testid="download-link"><Icon name="down" />Download {file.title}{fileLabel ? ` (${fileLabel})` : ''}</a></div></div>
    } else if (lesson.type === 'quiz') {
      content = !isEnabled(a.bundle.features, 'assess.quizzes') ? <Notice icon="info" title="Quizzes are switched off">Quizzes are not enabled for this academy.</Notice>
        : !course ? <Notice icon="info" title="Join to take this quiz">Enrol in the course to take the quiz.</Notice>
        : overview?.data ? <QuizOverview slug={slug} lessonId={lesson.id} o={overview.data as unknown as QuizOverviewData} notice={typeof quizNotice === 'string' ? quizNotice : undefined} />
        : <Notice icon="info" title="Not available">This quiz is not available right now.</Notice>
    } else if (!['video', 'live', 'image', 'article', 'lab', 'external_link', 'pdf', 'download', 'quiz'].includes(lesson.type)) {
      content = <Notice icon="info" title="Not available yet">This kind of lesson is not available yet.</Notice>
    }
  }

  const head = (
    <header className="lx-stitle">
      <p className="lx-kick"><Icon name={ICON[lesson.type] ?? 'doc'} className="lx-i" />{[KIND[lesson.type] ?? lesson.type, mins && lesson.type !== 'quiz' ? mins : null].filter(Boolean).join(' · ')}{month ? ` · ${month.title}` : ''}</p>
      <h1 id="lesson-h" className="lx-sh1">{lesson.title}</h1>
      {progress.completed && <p className="lx-done"><Icon name="check" className="lx-i" />You have completed this lesson</p>}
      {lesson.summary && <p className="lx-ssum">{lesson.summary}</p>}
    </header>
  )

  const actions = course && !lock ? (
    <LessonActions lessonId={lesson.id} rule={lesson.completionRule} completed={progress.completed} tracked={tracked}
      autoOnOpen={lesson.type === 'article' || lesson.type === 'lab' || lesson.type === 'external_link' || fileType || imageOn}
      plays={isVideo && !teamsLink && (lesson.completionRule === 'watch_pct' || (lesson.completionRule === 'auto' && lesson.type === 'video'))}
      next={toLesson(next)} prev={toLesson(prev)} backHref={`/learn/${slug}/material`}
      quiet={(lesson.type === 'quiz' || lesson.type === 'test') && !progress.completed} notes={notesOn} />
  ) : course && lock ? (
    <div className="lx-acts"><div className="lx-acts-main"><Link href={blocker ? `/learn/${slug}/${blocker.id}` : `/learn/${slug}/material`} className={`${buttonLg} max-sm:flex-1`}>{blocker ? `Go to ${blocker.title}` : 'Back to my course'}<Icon name="arrow" /></Link></div></div>
  ) : null

  return (
    <LearnerShell a={a} shell={shell} active="lessons" focus={{
      backHref, backLabel: course ? (lesson.type === 'live' ? 'Live classes' : 'My course') : 'The course',
      where: place, progress: e ? { pct: e.progressPct, label: `${e.lessonsCompleted} of ${e.lessonsTotal} done` } : undefined,
    }}>
      <StageProvider lessonId={lesson.id} mode={mode} enabled={notesOn} initialNotes={notes} startPage={deepPage ?? 1}>
        <div className={`lx-study${course ? ' has-side' : ''}`}>
          <article className="lx-smain" aria-labelledby="lesson-h">
            {!tracked && (
              <p className="lx-note">
                <Icon name="info" /><span>This is a free preview. <Link href={`/courses/${slug}`}>See the full course</Link> to join.</span>
              </p>
            )}
            {titleFirst ? <>{head}{content && <div className="lx-scontent">{content}</div>}</> : <>{viewer && <div className="lx-viewer">{viewer}</div>}</>}
            {notesOn && !lock && <QuickNote />}
            {!titleFirst && head}
            {actions}
          </article>

          {course && <SidePanel notesOn={notesOn} lessons={<LessonList slug={slug} sections={course.sections} currentId={lesson.id} />} />}
        </div>
      </StageProvider>
    </LearnerShell>
  )
}

function Notice({ icon = 'info', title, children }: { icon?: IconName; title: string; children: React.ReactNode }) {
  return (
    <div className="lx-callout">
      <span className="lx-ico"><Icon name={icon} /></span>
      <div><b>{title}</b><p>{children}</p></div>
    </div>
  )
}
