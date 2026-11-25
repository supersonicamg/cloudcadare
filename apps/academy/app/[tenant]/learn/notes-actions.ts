'use server'

import { z } from 'zod'
import { isEnabled } from '@educore/features'
import { ActionDenied, requireMemberAction } from '@/lib/dal'
import { toNote, type Note } from '@/lib/notes'

// Notes, bookmarks and highlights (plan/16 §6.4). Row-level security is the real gate: only the owner writes, only on a
// lesson they can open. These actions add the feature switch and tidy input.

export type NoteResult = { note: Note } | { error: string }

const input = z.object({
  lessonId: z.uuid(),
  kind: z.enum(['note', 'bookmark', 'highlight']),
  positionSeconds: z.number().int().min(0).max(86400).nullable(),
  pageNo: z.number().int().min(1).max(5000).nullable(),
  body: z.string().trim().max(4000),
})
export type NoteInput = z.input<typeof input>

export async function saveNote(raw: NoteInput): Promise<NoteResult> {
  const p = input.safeParse(raw)
  if (!p.success) return { error: 'Write something first. A note can be up to 4,000 characters.' }
  const v = p.data
  if (v.kind !== 'bookmark' && !v.body) return { error: 'Write something first.' }
  // A note belongs to a moment or to a page, never both.
  const pos = v.pageNo ? null : v.positionSeconds
  try {
    const a = await requireMemberAction()
    if (!isEnabled(a.bundle.features, 'learning.notes')) return { error: 'Notes are not switched on for this academy.' }
    const { data, error } = await a.db.from('lesson_notes')
      .insert({ tenant_id: a.bundle.tenant.id, member_id: a.memberId, lesson_id: v.lessonId, kind: v.kind, position_seconds: pos, page_no: v.pageNo, body: v.body || null })
      .select('id, lesson_id, kind, position_seconds, page_no, body, created_at').single()
    if (error || !data) {
      if (error?.message.includes('too_many_notes')) return { error: 'This lesson has 500 notes already. Delete some first.' }
      return { error: 'Could not save. You can only add notes to lessons you can open.' }
    }
    return { note: toNote(data) }
  } catch (e) {
    return { error: e instanceof ActionDenied ? 'Sign in again to save notes.' : 'Could not save. Try again.' }
  }
}

export async function deleteNote(id: string): Promise<{ ok: boolean }> {
  if (!z.uuid().safeParse(id).success) return { ok: false }
  try {
    const a = await requireMemberAction()
    const { error } = await a.db.from('lesson_notes').delete().eq('id', id).eq('member_id', a.memberId)
    return { ok: !error }
  } catch {
    return { ok: false }
  }
}
