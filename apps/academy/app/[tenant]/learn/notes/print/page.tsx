import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { isEnabled } from '@educore/features'
import { requireMember } from '@/lib/dal'
import { clock } from '@/lib/clock'
import { dateLong, nowMs } from '@/lib/format'
import { getNoteGroups } from '@/lib/my-notes'
import { PrintNow } from './print-now'

export const metadata: Metadata = { title: 'My notes (print)' }

// "Download as PDF" (plan/16 B7): a clean printable page that opens the browser's print dialog, where "Save as PDF" is an
// option on every device. Same approach as the certificate. Generated on request; nothing is stored.
export default async function PrintNotes() {
  const a = await requireMember('/learn/notes/print')
  if (!isEnabled(a.bundle.features, 'learning.notes')) notFound()
  const r = await getNoteGroups(a, 'all', '')
  return (
    <main className="mx-auto max-w-[760px] px-6 py-10 text-fg print:px-0 print:py-0">
      <PrintNow />
      <header className="mb-8 border-b-2 border-fg pb-4">
        <h1 className="t-title">My notes</h1>
        <p className="t-label tnum">{a.memberName} · {r.counts.all} notes from {r.lessons} lessons · {dateLong(new Date(nowMs()))}</p>
      </header>
      {r.groups.map((g) => (
        <section key={g.lessonId} className="mb-7 break-inside-avoid">
          <h2 className="t-card mb-2">{g.title}</h2>
          <ul className="grid gap-2">
            {g.notes.map((n) => (
              <li key={n.id} className="grid grid-cols-[72px_minmax(0,1fr)] gap-3 t-body !text-fg">
                <b className="tnum">{n.positionSeconds !== null ? clock(n.positionSeconds) : n.pageNo !== null ? `Page ${n.pageNo}` : n.kind}</b>
                <span className="whitespace-pre-line break-words">{n.body || 'Bookmark'}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  )
}
