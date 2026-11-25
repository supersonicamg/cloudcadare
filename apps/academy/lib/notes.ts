import 'server-only'
import type { Access } from '@/lib/dal'

// The learner's own notes (plan/16 §6.4). Read through the USER-SCOPED client: row-level security lets a learner read only
// their own rows, and staff have no policy at all, so nothing here can leak another person's notes.

export type NoteKind = 'note' | 'bookmark' | 'highlight'

export interface Note {
  id: string
  lessonId: string
  kind: NoteKind
  /** Video and recordings: seconds from the start. */
  positionSeconds: number | null
  /** PDFs: page number. */
  pageNo: number | null
  body: string | null
  createdAt: string
}

const COLUMNS = 'id, lesson_id, kind, position_seconds, page_no, body, created_at'
type Row = { id: string; lesson_id: string; kind: string; position_seconds: number | null; page_no: number | null; body: string | null; created_at: string }
export const toNote = (r: Row): Note => ({
  id: r.id, lessonId: r.lesson_id, kind: (r.kind as NoteKind), positionSeconds: r.position_seconds, pageNo: r.page_no, body: r.body, createdAt: r.created_at,
})

/** Notes on one lesson, in the order they happen in it (time or page), then by when they were written. */
export async function getLessonNotes(a: Access, lessonId: string): Promise<Note[]> {
  const { data, error } = await a.db.from('lesson_notes').select(COLUMNS).eq('member_id', a.memberId).eq('lesson_id', lessonId)
    .order('position_seconds', { ascending: true, nullsFirst: false }).order('page_no', { ascending: true, nullsFirst: false }).order('created_at').limit(500)
  if (error) throw new Error(`notes read failed: ${error.message}`)
  return (data ?? []).map(toNote)
}

/** Every note of this learner (newest first), for the lesson counts and "My notes". Capped; a learner with more has used this very hard. */
export async function getAllNotes(a: Access, limit = 1000): Promise<Note[]> {
  const { data, error } = await a.db.from('lesson_notes').select(COLUMNS).eq('member_id', a.memberId).order('created_at', { ascending: false }).limit(limit)
  if (error) throw new Error(`notes read failed: ${error.message}`)
  return (data ?? []).map(toNote)
}

/** lessonId -> how many notes. */
export const countByLesson = (notes: Note[]) => {
  const m = new Map<string, number>()
  for (const n of notes) m.set(n.lessonId, (m.get(n.lessonId) ?? 0) + 1)
  return m
}

export { clock } from '@/lib/clock'
