import type { LearnLesson, LearnSection } from '@/lib/learn'
import type { IconName } from '../../_components/v11'

/* Small, pure helpers the lesson screens share (safe in server and client code). */

export const KIND: Record<string, string> = { video: 'Video', article: 'Reading', external_link: 'Link', pdf: 'PDF', document: 'Document', download: 'Download', quiz: 'Quiz', test: 'Test', live: 'Class recording', image: 'Picture', lab: 'Lab' }
export const KIND_ICON: Record<string, IconName> = { video: 'video', live: 'live', pdf: 'doc', document: 'doc', image: 'image', article: 'read', quiz: 'quiz', test: 'quiz', download: 'down', external_link: 'ext', lab: 'lab' }

export const flatten = (s: LearnSection): LearnLesson[] => [...s.lessons, ...s.children.flatMap(flatten)]
export const sectionHas = (s: LearnSection, id: string) => flatten(s).some((l) => l.id === id)
export const minutes = (s: number | null) => (s ? `${Math.max(1, Math.round(s / 60))} min` : null)
export const dripDate = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })

/** Where a lesson sits in the course: its month ("Month 2"), the month's own title, and its number among the month's lessons. */
export function placeOf(sections: LearnSection[] | null | undefined, lessonId: string) {
  const at = sections ? sections.findIndex((s) => sectionHas(s, lessonId)) : -1
  const month = sections && at >= 0 ? sections[at]! : null
  if (!month) return null
  const lessons = flatten(month)
  return {
    month,
    label: month.label || `Month ${at + 1}`,
    lessons,
    no: lessons.findIndex((l) => l.id === lessonId) + 1,
  }
}
