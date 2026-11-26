import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { isEnabled } from '@educore/features'
import { requireMember } from '@/lib/dal'
import { clock } from '@/lib/clock'
import { dateShort } from '@/lib/format'
import { getNoteGroups, KINDS, noteHref } from '@/lib/my-notes'
import type { NoteKind } from '@/lib/notes'
import { getShell } from '@/lib/shell'
import { Ic, type IconName } from '../../_components/v11'
import { LearnerShell } from '../../_components/learner-shell'
import { KIND, KIND_ICON } from '../_components/curriculum'
import { KindSelect } from '../_components/kind-select'
import '../my-course.css'

export const metadata: Metadata = { title: 'My notes' }

/*
 * My notes. One job: find a note again. No filled button; "Download as PDF" is an outline button.
 * Reading order: title + count -> search + show only (notes, bookmarks, highlights) -> notes grouped by lesson (newest first).
 * Each note is a link that reopens the lesson at that minute (?t=) or page (?page=); the place leads the row because that is what
 * you click for. Highlights are quoted with an ink bar. Notes are private. The filter is the URL (?kind=bookmark&q=tags).
 */
const ICON: Record<NoteKind, IconName> = { note: 'note', bookmark: 'bookmark', highlight: 'hl' }
const KIND_FILTER_ICON: Record<string, IconName | null> = { all: null, ...ICON }

export default async function Notes({ searchParams }: PageProps<'/[tenant]/learn/notes'>) {
  const sp = await searchParams
  const a = await requireMember('/learn/notes')
  if (!isEnabled(a.bundle.features, 'learning.notes')) notFound()
  const kind = (KINDS.find((k) => k.key === sp.kind)?.key ?? 'all') as NoteKind | 'all'
  const q = (typeof sp.q === 'string' ? sp.q : '').trim().slice(0, 80)
  const [shell, r] = await Promise.all([getShell(), getNoteGroups(a, kind, q)])
  const href = (k: string) => `/learn/notes${k === 'all' && !q ? '' : `?${new URLSearchParams({ ...(k !== 'all' ? { kind: k } : {}), ...(q ? { q } : {}) })}`}`
  const filtering = kind !== 'all' || Boolean(q)

  return (
    <LearnerShell a={a} shell={shell} active="notes">
      <div className="pg">
        <div className="pg-h">
          <div>
            <h1 className="t-title">My notes</h1>
            <p className="t-lead">
              {r.counts.all
                ? <><b>{r.counts.all} {r.counts.all === 1 ? 'note' : 'notes'}</b> from {r.lessons} {r.lessons === 1 ? 'lesson' : 'lessons'}. Only you can see them.</>
                : 'Notes, bookmarks and highlights you make in a lesson are kept here. Only you can see them.'}
            </p>
          </div>
          {r.counts.all > 0 && <Link href="/learn/notes/print" target="_blank" className="btn btn-line btn-sm"><Ic n="down" />Download as PDF</Link>}
        </div>

        {r.counts.all > 0 && (
          <div className="find">
            <form action="/learn/notes" role="search" className="search">
              {kind !== 'all' && <input type="hidden" name="kind" value={kind} />}
              <label>
                <span className="sr">Search your notes</span>
                <Ic n="search" />
                <input name="q" type="search" defaultValue={q} placeholder="Search your notes" enterKeyHint="search" />
              </label>
              <button className="btn btn-line btn-sm" type="submit">Search</button>
            </form>
            <nav aria-label="Show only" className="tabs swap">
              {KINDS.map((k) => {
                const icon = KIND_FILTER_ICON[k.key]
                return <Link key={k.key} href={href(k.key)} aria-current={kind === k.key ? 'true' : undefined}>{icon && <Ic n={icon} />}{k.label} <em>{r.counts[k.key]}</em></Link>
              })}
            </nav>
            <KindSelect id="nkind-m" action="/learn/notes" name="kind" value={kind} label="Show only" hidden={q ? { q } : undefined}
              options={KINDS.map((k) => ({ value: k.key, label: `${k.label} (${r.counts[k.key]})` }))} />
          </div>
        )}

        {r.groups.length === 0 ? (
          r.counts.all === 0 ? (
            <section className="empty-b">
              <h2 className="t-card">No notes yet</h2>
              <p className="t-body">Open a lesson and press <b>N</b> while it plays, or write one under the video. Your notes, bookmarks and highlights show up here, and each one takes you back to the exact minute.</p>
            </section>
          ) : (
            <section className="empty-b" aria-live="polite">
              <h2 className="t-card">No note matches</h2>
              {filtering && <Link href="/learn/notes" className="link link-s">Clear the search</Link>}
            </section>
          )
        ) : (
          <div>
            {r.groups.map((g) => {
              const labelId = `ng-${g.lessonId}`
              return (
                <section key={g.lessonId} className="ngroup" aria-labelledby={labelId}>
                  <div className="ngroup-h">
                    <span className="ti"><Ic n={KIND_ICON[g.type] ?? 'doc'} /></span>
                    <span className="tx">
                      {g.href ? <Link className="t-card" id={labelId} href={g.href}>{g.title}</Link> : <span className="t-card" id={labelId}>{g.title}</span>}
                      <span className="t-label">{[KIND[g.type] ?? g.type, g.month].filter(Boolean).join(' · ')}</span>
                    </span>
                    <span className="t-label c">{g.notes.length} {g.notes.length === 1 ? 'item' : 'items'}</span>
                  </div>
                  <ul>
                    {g.notes.map((n) => {
                      const place = n.positionSeconds !== null ? clock(n.positionSeconds) : n.pageNo !== null ? `Page ${n.pageNo}` : 'Lesson'
                      const inner = (
                        <>
                          <span className="at"><Ic n={ICON[n.kind]} />{place}</span>
                          {n.body ? <p className={n.kind === 'highlight' ? 'hl' : undefined}>{n.body}</p> : <p className="q">Bookmark</p>}
                          <span className="t-label">{dateShort(n.createdAt)}</span>
                        </>
                      )
                      return (
                        <li key={n.id}>
                          {g.href ? <Link href={noteHref(g.href, n)} className="nrow">{inner}</Link> : <div className="nrow">{inner}</div>}
                        </li>
                      )
                    })}
                  </ul>
                </section>
              )
            })}
          </div>
        )}
      </div>
    </LearnerShell>
  )
}
