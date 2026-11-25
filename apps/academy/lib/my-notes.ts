import 'server-only'
import type { Access } from '@/lib/dal'
import { getMyEnrollments } from '@/lib/learn'
import { getAllNotes, type Note, type NoteKind } from '@/lib/notes'

// "My notes" (plan/16 B7): every note, grouped by lesson, each with a link that opens the lesson at that moment or page.

export interface NoteGroup { lessonId: string; title: string; type: string; href: string | null; notes: Note[]; latest: string }

export const KINDS: Array<{ key: NoteKind | 'all'; label: string }> = [
  { key: 'all', label: 'All' }, { key: 'note', label: 'Notes' }, { key: 'bookmark', label: 'Bookmarks' }, { key: 'highlight', label: 'Highlights' },
]

/** The link that opens a note where it was taken. */
export const noteHref = (base: string, n: Note) =>
  n.positionSeconds !== null ? `${base}?t=${n.positionSeconds}` : n.pageNo !== null ? `${base}?page=${n.pageNo}` : base

export async function getNoteGroups(a: Access, kind: NoteKind | 'all', q: string) {
  const [all, enrollments] = await Promise.all([getAllNotes(a, 2000), getMyEnrollments(a)])
  const counts = { all: all.length, note: 0, bookmark: 0, highlight: 0 }
  for (const n of all) counts[n.kind]++

  const ids = [...new Set(all.map((n) => n.lessonId))]
  // Row-level security hides lessons the learner can no longer open: their notes stay (and are listed), but cannot be linked.
  const { data: lessons } = ids.length ? await a.db.from('lessons').select('id, title, type, course_id').in('id', ids) : { data: [] }
  const info = new Map((lessons ?? []).map((l) => [l.id, l]))
  const slugOf = new Map(enrollments.map((e) => [e.course.id, e.course.slug]))

  const needle = q.trim().toLowerCase()
  const kept = all.filter((n) => (kind === 'all' || n.kind === kind) && (!needle || (n.body ?? '').toLowerCase().includes(needle) || (info.get(n.lessonId)?.title ?? '').toLowerCase().includes(needle)))
  const by = new Map<string, NoteGroup>()
  for (const n of kept) {
    const l = info.get(n.lessonId)
    const slug = l ? slugOf.get(l.course_id) : undefined
    const g = by.get(n.lessonId) ?? { lessonId: n.lessonId, title: l?.title ?? 'A lesson you can no longer open', type: l?.type ?? 'video', href: l && slug ? `/learn/${slug}/${n.lessonId}` : null, notes: [], latest: n.createdAt }
    g.notes.push(n)
    if (n.createdAt > g.latest) g.latest = n.createdAt
    by.set(n.lessonId, g)
  }
  const groups = [...by.values()].sort((x, y) => y.latest.localeCompare(x.latest))
  for (const g of groups) g.notes.sort((x, y) => (x.positionSeconds ?? x.pageNo ?? 0) - (y.positionSeconds ?? y.pageNo ?? 0) || x.createdAt.localeCompare(y.createdAt))
  return { groups, counts, lessons: ids.length, shown: kept.length }
}
