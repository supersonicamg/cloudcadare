import 'server-only'
import type { Access } from '@/lib/dal'
import { timeShort } from '@/lib/format'

// Scheduled classes (plan/16 §6.3). Read with the USER-SCOPED client; the meeting link is never selected here, so it
// cannot end up in a page. "Join" goes through /api/live/[id]/join, which opens it only during the class window.

export const OPEN_BEFORE_MS = 10 * 60_000

export interface ClassSession {
  id: string
  title: string
  startsAt: string
  endsAt: string
  status: string
  teams: boolean
  lessonId: string | null
}

/** The learner's classes: their batch's, plus course-wide ones. Cancelled classes are left out. Soonest first. */
export async function getClassSessions(a: Access, courseId: string, batchId: string | null): Promise<ClassSession[]> {
  const { data, error } = await a.db.from('live_sessions')
    .select('id, title, starts_at, ends_at, status, provider, lesson_id, batch_id')
    .or(`course_id.eq.${courseId},course_id.is.null`).neq('status', 'cancelled').order('starts_at', { ascending: true }).limit(300)
  if (error) throw new Error(`live sessions read failed: ${error.message}`)
  return (data ?? [])
    .filter((s) => !batchId || !s.batch_id || s.batch_id === batchId)
    .map((s) => ({ id: s.id, title: s.title, startsAt: s.starts_at, endsAt: s.ends_at, status: s.status, teams: s.provider === 'ms_teams', lessonId: s.lesson_id }))
}

export const upcomingClasses = (all: ClassSession[], now: number) => all.filter((s) => s.status !== 'completed' && new Date(s.endsAt).getTime() > now)
export const heldClasses = (all: ClassSession[], now: number) => all.filter((s) => s.status === 'completed' || new Date(s.endsAt).getTime() <= now)
export const isOpenNow = (s: ClassSession, now: number) => now >= new Date(s.startsAt).getTime() - OPEN_BEFORE_MS && now <= new Date(s.endsAt).getTime()
export const joinOpensAt = (s: ClassSession) => timeShort(new Date(new Date(s.startsAt).getTime() - OPEN_BEFORE_MS))

const fmt = (o: Intl.DateTimeFormatOptions) => {
  const f = new Intl.DateTimeFormat('en-IN', { ...o, timeZone: 'Asia/Kolkata' })
  return (iso: string | Date) => f.format(new Date(iso))
}
export const weekday = fmt({ weekday: 'short' })
export const dayNum = fmt({ day: 'numeric' })
export const monthName = fmt({ month: 'short' })
export const weekdayLong = fmt({ weekday: 'long' })
export const monthYear = fmt({ month: 'long', year: 'numeric' })

const istDay = (t: number | string | Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(t))
/** "today" or "tomorrow" when the class falls on those days in India, otherwise null. */
export function dayWord(iso: string, now: number): 'today' | 'tomorrow' | null {
  const d = istDay(iso)
  return d === istDay(now) ? 'today' : d === istDay(now + 86_400_000) ? 'tomorrow' : null
}

export const calendarLink = (s: ClassSession) => {
  const f = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(s.title)}&dates=${f(s.startsAt)}/${f(s.endsAt)}`
}
