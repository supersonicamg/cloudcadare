import 'server-only'
import { cache } from 'react'
import type { Access } from '@/lib/dal'

// Learner reads. Everything goes through the USER-SCOPED client: RLS decides what this member may see
// (enrolled courses, lesson content only when enrolled or a free preview). Nothing here is cached
// across users.

export interface MyEnrollment {
  id: string
  status: string
  progressPct: number
  lessonsCompleted: number
  lessonsTotal: number
  lastLessonId: string | null
  completedAt: string | null
  expiresAt: string | null
  course: { id: string; slug: string; title: string; subtitle: string | null }
}

export async function getMyEnrollments(a: Access): Promise<MyEnrollment[]> {
  const { data, error } = await a.db
    .from('enrollments')
    .select('id, status, progress_pct, lessons_completed, lessons_total, last_lesson_id, completed_at, expires_at, last_activity_at, courses(id, slug, title, subtitle, status, deleted_at)')
    .eq('member_id', a.memberId).in('status', ['active', 'completed'])
    .order('last_activity_at', { ascending: false, nullsFirst: false })
  if (error) throw new Error(`enrollments read failed: ${error.message}`)
  const now = Date.now()
  return (data ?? []).flatMap((e) => {
    const c = Array.isArray(e.courses) ? e.courses[0] : e.courses
    if (!c || c.deleted_at || c.status !== 'published') return []
    if (e.expires_at && new Date(e.expires_at).getTime() <= now) return []
    return [{
      id: e.id, status: e.status, progressPct: Number(e.progress_pct), lessonsCompleted: e.lessons_completed,
      lessonsTotal: e.lessons_total, lastLessonId: e.last_lesson_id, completedAt: e.completed_at, expiresAt: e.expires_at,
      course: { id: c.id, slug: c.slug, title: c.title, subtitle: c.subtitle },
    }]
  })
}

/** The course the navbar links point at: the learner's most recently used live enrolment. One cheap read, once per request. */
export const getLeadCourseSlug = cache(async (a: Access): Promise<string | null> => {
  const mine = await getMyEnrollments(a)
  return (mine.find((e) => e.status === 'active') ?? mine[0])?.course.slug ?? null
})

/** Why a lesson cannot be opened yet: an earlier required lesson is unfinished, or its drip date has not come. */
export interface LessonLock { reason: 'sequential' | 'drip'; blockingLessonId: string | null; unlocksAt: string | null }
export interface LearnLesson {
  id: string; title: string; type: string; durationSeconds: number | null; isPreview: boolean; done: boolean; lock: LessonLock | null
}
export interface LearnSection { id: string; label: string | null; title: string; lessons: LearnLesson[]; children: LearnSection[] }
export interface LearnCourse {
  enrollment: MyEnrollment
  sections: LearnSection[]
  /** Lessons in reading order. Used for previous / next and for "continue". */
  order: LearnLesson[]
  resume: LearnLesson | null
}

/** The enrolled learner's view of a course by slug; null when the member is not enrolled in it. */
export async function getLearnCourse(a: Access, slug: string): Promise<LearnCourse | null> {
  const enrollment = (await getMyEnrollments(a)).find((e) => e.course.slug === slug)
  if (!enrollment) return null
  const courseId = enrollment.course.id
  const [secs, lessons, progress, locks] = await Promise.all([
    a.db.from('course_sections').select('id, parent_id, label, title, position').eq('course_id', courseId).eq('is_published', true).is('deleted_at', null).order('position'),
    a.db.from('lessons').select('id, section_id, title, type, duration_seconds, is_preview, position').eq('course_id', courseId).eq('is_published', true).is('deleted_at', null).order('position'),
    a.db.from('lesson_progress').select('lesson_id, status').eq('enrollment_id', enrollment.id),
    a.db.rpc('my_lesson_locks', { p_course_id: courseId }),
  ])
  if (secs.error || lessons.error || progress.error || locks.error) throw new Error('curriculum read failed')
  const lockOf = new Map((locks.data ?? []).map((k) => [k.lesson_id, { reason: k.reason as LessonLock['reason'], blockingLessonId: k.blocking_lesson_id, unlocksAt: k.unlocks_at }]))

  const done = new Set((progress.data ?? []).filter((p) => p.status === 'completed').map((p) => p.lesson_id))
  const byId = new Map<string, LearnSection & { parentId: string | null }>()
  for (const s of secs.data ?? []) byId.set(s.id, { id: s.id, parentId: s.parent_id, label: s.label, title: s.title, lessons: [], children: [] })
  for (const l of lessons.data ?? []) {
    byId.get(l.section_id)?.lessons.push({ id: l.id, title: l.title, type: l.type, durationSeconds: l.duration_seconds, isPreview: l.is_preview, done: done.has(l.id), lock: lockOf.get(l.id) ?? null })
  }
  const roots: LearnSection[] = []
  for (const s of byId.values()) (s.parentId ? byId.get(s.parentId)?.children ?? roots : roots).push(s)

  const order: LearnLesson[] = []
  const walk = (list: LearnSection[]) => { for (const s of list) { order.push(...s.lessons); walk(s.children) } }
  walk(roots)

  const open = order.filter((l) => !l.lock)
  const resume = open.find((l) => l.id === enrollment.lastLessonId && !l.done) ?? open.find((l) => !l.done) ?? open[0] ?? null
  return { enrollment, sections: roots, order, resume }
}

export interface LessonContent {
  id: string
  courseId: string
  title: string
  summary: string | null
  type: string
  body: { format?: string; text?: string } | null
  externalUrl: string | null
  mediaAssetId: string | null
  testId: string | null
  completionRule: string
  durationSeconds: number | null
}

/** Null when RLS hides it: not enrolled and not a free preview, unpublished, or deleted. */
export async function getLessonContent(a: Access, lessonId: string): Promise<LessonContent | null> {
  const { data, error } = await a.db.from('lessons')
    .select('id, course_id, title, summary, type, body, external_url, media_asset_id, test_id, completion_rule, duration_seconds')
    .eq('id', lessonId).eq('is_published', true).is('deleted_at', null).maybeSingle()
  if (error) throw new Error(`lesson read failed: ${error.message}`)
  if (!data) return null
  return {
    id: data.id, courseId: data.course_id, title: data.title, summary: data.summary, type: data.type,
    body: (data.body ?? null) as LessonContent['body'], externalUrl: data.external_url, mediaAssetId: data.media_asset_id, testId: data.test_id,
    completionRule: ((data.completion_rule ?? {}) as { type?: string }).type ?? 'auto', durationSeconds: data.duration_seconds,
  }
}

export async function getLessonProgress(a: Access, enrollmentId: string, lessonId: string) {
  const { data } = await a.db.from('lesson_progress').select('status, last_position_seconds')
    .eq('enrollment_id', enrollmentId).eq('lesson_id', lessonId).maybeSingle()
  return { completed: data?.status === 'completed', positionSeconds: data?.last_position_seconds ?? 0 }
}
