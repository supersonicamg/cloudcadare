'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Note, NoteKind } from '@/lib/notes'
import { deleteNote, saveNote } from '../notes-actions'

/**
 * What a lesson page shares between its parts: the player (which knows the time), the notes panel (which stamps notes
 * with it), the markers under the video and the PDF frame (which jumps to a page). One provider wraps the page so these
 * client parts talk to each other while the page itself stays a server component.
 */

export interface PlayerHandle { time(): number; duration(): number; seek(seconds: number): void; pause(): void }
export type NoteMode = 'time' | 'page' | 'none'

interface Stage {
  mode: NoteMode
  /** False for free previews and when the academy has notes switched off. */
  enabled: boolean
  lessonId: string
  notes: Note[]
  duration: number
  setDuration(n: number): void
  register(h: PlayerHandle | null): void
  /** Where the player is now, in seconds (0 when there is no player). Call it from handlers, not while rendering. */
  time(): number
  page: number
  /** Changing `jump` makes the PDF frame reload at that page, even when the page number did not change. */
  jumpTick: number
  setPage(n: number): void
  /** The note box registers itself so that the N key can focus it. */
  setBox(el: HTMLTextAreaElement | null): void
  add(kind: NoteKind, body: string, at: { seconds: number | null; page: number | null }): Promise<string | null>
  /** Removes now and offers Undo for 6 seconds; the delete is sent only after that. */
  remove(id: string): void
  undo: Note | null
  undoRemove(): void
  jump(n: Note): void
}

const Ctx = createContext<Stage | null>(null)
export const useStage = () => {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStage outside StageProvider')
  return s
}

/** For parts that also appear outside a lesson page (the public preview player): null there. */
export const useOptionalStage = () => useContext(Ctx)

const UNDO_MS = 6000
const byPlace = (a: Note, b: Note) => (a.positionSeconds ?? a.pageNo ?? 1e9) - (b.positionSeconds ?? b.pageNo ?? 1e9) || a.createdAt.localeCompare(b.createdAt)

export function StageProvider({ lessonId, mode, enabled, initialNotes, startPage = 1, children }: {
  lessonId: string; mode: NoteMode; enabled: boolean; initialNotes: Note[]; startPage?: number; children: ReactNode
}) {
  const [notes, setNotes] = useState<Note[]>(initialNotes)
  const [duration, setDuration] = useState(0)
  const [page, setPageState] = useState(startPage)
  const [jumpTick, setJumpTick] = useState(0)
  const [undo, setUndo] = useState<Note | null>(null)
  const player = useRef<PlayerHandle | null>(null)
  const boxRef = useRef<HTMLTextAreaElement | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pending = useRef<Note | null>(null)

  const register = useCallback((h: PlayerHandle | null) => { player.current = h }, [])
  const time = useCallback(() => player.current?.time() ?? 0, [])
  const setBox = useCallback((el: HTMLTextAreaElement | null) => { boxRef.current = el }, [])
  const setPage = useCallback((n: number) => setPageState(Math.max(1, Math.min(5000, Math.floor(n) || 1))), [])

  const add = useCallback<Stage['add']>(async (kind, body, at) => {
    const r = await saveNote({ lessonId, kind, body, positionSeconds: at.seconds, pageNo: at.page })
    if ('error' in r) return r.error
    setNotes((l) => [...l, r.note].sort(byPlace))
    return null
  }, [lessonId])

  const finish = useCallback(() => {
    const n = pending.current
    pending.current = null
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    setUndo(null)
    if (n) void deleteNote(n.id)
  }, [])

  const remove = useCallback((id: string) => {
    // A second delete while one is waiting makes the first final.
    if (pending.current) finish()
    const n = notes.find((x) => x.id === id)
    if (!n) return
    pending.current = n
    setNotes((l) => l.filter((x) => x.id !== id))
    setUndo(n)
    timer.current = setTimeout(finish, UNDO_MS)
  }, [notes, finish])

  const undoRemove = useCallback(() => {
    const n = pending.current
    if (!n) return
    pending.current = null
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    setNotes((l) => [...l, n].sort(byPlace))
    setUndo(null)
  }, [])

  const jump = useCallback((n: Note) => {
    if (n.positionSeconds !== null) { player.current?.seek(n.positionSeconds); return }
    if (n.pageNo !== null) { setPage(n.pageNo); setJumpTick((t) => t + 1) }
  }, [setPage])

  // Leaving the page makes a waiting delete final instead of losing the click.
  useEffect(() => () => { if (pending.current) void deleteNote(pending.current.id) }, [])

  // N: pause and start a note. Not while typing in a field.
  useEffect(() => {
    if (!enabled || mode === 'none') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'n' || e.ctrlKey || e.metaKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return
      e.preventDefault()
      player.current?.pause()
      boxRef.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled, mode])

  const value = useMemo<Stage>(() => ({
    mode, enabled, lessonId, notes, duration, setDuration, register, time, page, jumpTick, setPage, setBox, add, remove, undo, undoRemove, jump,
  }), [mode, enabled, lessonId, notes, duration, register, time, page, jumpTick, setPage, setBox, add, remove, undo, undoRemove, jump])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
