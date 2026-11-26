import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { isEnabled } from '@educore/features'
import { requireMember } from '@/lib/dal'
import { clock } from '@/lib/clock'
import { dateLong, nowMs } from '@/lib/format'
import { getNoteGroups } from '@/lib/my-notes'
import { PrintNow } from './print-now'
import './print.css'

export const metadata: Metadata = { title: 'Notes (print)' }

// "Download as PDF" (plan/16 B7): a clean printable page that opens the browser's print dialog, where "Save as PDF" is an
// option on every device. Same approach as the certificate. Generated on request; nothing is stored.
export default async function PrintNotes() {
  const a = await requireMember('/learn/notes/print')
  if (!isEnabled(a.bundle.features, 'learning.notes')) notFound()
  const r = await getNoteGroups(a, 'all', '')
  return (
    <main className="np">
      <PrintNow />
      <header className="np-head">
        <h1>My notes</h1>
        <p>{a.memberName} · {r.counts.all} {r.counts.all === 1 ? 'note' : 'notes'} from {r.lessons} {r.lessons === 1 ? 'lesson' : 'lessons'} · {dateLong(new Date(nowMs()))}</p>
      </header>
      {r.groups.map((g) => (
        <section key={g.lessonId} className="np-grp">
          <h2>{g.title}</h2>
          <ul>
            {g.notes.map((n) => (
              <li key={n.id}>
                <b>{n.positionSeconds !== null ? clock(n.positionSeconds) : n.pageNo !== null ? `Page ${n.pageNo}` : n.kind}</b>
                <span>{n.body || 'Bookmark'}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  )
}
