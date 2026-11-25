import 'server-only'
import type { Access } from '@/lib/dal'
import { getLearnCourse, type LearnCourse, type LearnLesson, type LearnSection } from '@/lib/learn'
import { countByLesson, getAllNotes, type Note } from '@/lib/notes'

// Everything the learner's course screens share (plan/16 §6.2-6.3): the program month by month, with each lesson's state.
// Read with the USER-SCOPED client, so a locked or hidden lesson never reaches the page.

const NEW_DAYS = 7

export interface MaterialLesson extends LearnLesson {
  monthId: string
  /** 0-100, how far the learner got. */
  pct: number
  opened: boolean
  /** Published in the last 7 days and never opened. */
  isNew: boolean
  noteCount: number
  publishedAt: string | null
}
export interface MaterialMonth { id: string; label: string | null; title: string; lessons: MaterialLesson[]; done: number }
export interface Material { course: LearnCourse; months: MaterialMonth[]; all: MaterialLesson[]; notes: Note[]; noteCounts: Map<string, number> }

const flatten = (s: LearnSection): LearnLesson[] => [...s.lessons, ...s.children.flatMap(flatten)]

/** The kind of lesson as the learner filters it (plan/16 §6.2). Other kinds (reading, quiz, download, link) only appear under "All". */
export type Group = 'video' | 'live' | 'pdf' | 'image'
export const groupOf = (type: string): Group | null =>
  type === 'video' ? 'video' : type === 'live' ? 'live' : type === 'pdf' || type === 'document' ? 'pdf' : type === 'image' ? 'image' : null

export async function getMaterial(a: Access, slug: string, nowMs: number): Promise<Material | null> {
  const course = await getLearnCourse(a, slug)
  if (!course) return null
  const [meta, progress, notes] = await Promise.all([
    a.db.from('lessons').select('id, published_at').eq('course_id', course.enrollment.course.id).eq('is_published', true).is('deleted_at', null),
    a.db.from('lesson_progress').select('lesson_id, progress_pct').eq('enrollment_id', course.enrollment.id),
    getAllNotes(a),
  ])
  const published = new Map((meta.data ?? []).map((l) => [l.id, l.published_at]))
  const pct = new Map((progress.data ?? []).map((p) => [p.lesson_id, Number(p.progress_pct)]))
  const noteCounts = countByLesson(notes)
  const fresh = nowMs - NEW_DAYS * 86_400_000

  const months: MaterialMonth[] = course.sections.map((s) => {
    const lessons = flatten(s).map<MaterialLesson>((l) => {
      const at = published.get(l.id) ?? null
      const opened = pct.has(l.id) || l.done
      return {
        ...l, monthId: s.id, pct: l.done ? 100 : Math.round(pct.get(l.id) ?? 0), opened,
        isNew: Boolean(at) && new Date(at!).getTime() > fresh && !opened, noteCount: noteCounts.get(l.id) ?? 0, publishedAt: at,
      }
    })
    return { id: s.id, label: s.label, title: s.title, lessons, done: lessons.filter((l) => l.done).length }
  })
  return { course, months, all: months.flatMap((m) => m.lessons), notes, noteCounts }
}
