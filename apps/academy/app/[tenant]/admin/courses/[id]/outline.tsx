import Link from 'next/link'
import { Icon, type IconName } from '@educore/ui/marks'
import { isEnabled } from '@educore/features'
import { can, type Access } from '@/lib/dal'
import { AddPanel, type Pane } from '../../_components/add-panel'
import { ConfirmButton } from '../../_components/confirm'
import { FilesUploader } from '../../_components/files-uploader'
import { Menu } from '../../_components/menu'
import { VideoUploader } from '../../_components/video-uploader'
import { deleteLesson, deleteSection, moveLesson, moveSection } from '../actions'
import { AddLessonForm, AddSectionForm, RenameSectionForm } from '../forms'
import { Card, Empty } from '../../_components/ui'

export interface SectionRow { id: string; label: string | null; title: string; position: number }
export interface LessonRow {
  id: string; section_id: string; title: string; type: string; duration_seconds: number | null; is_preview: boolean
  media_asset_id: string | null; external_url: string | null; written: string | null
}

const TYPE: Record<string, { name: string; icon: IconName; none: string }> = {
  video: { name: 'Video', icon: 'video', none: 'No video yet' }, live: { name: 'Class recording', icon: 'live', none: 'No video yet' },
  article: { name: 'Reading page', icon: 'doc', none: 'Nothing written yet' }, pdf: { name: 'PDF', icon: 'doc', none: 'No PDF yet' },
  download: { name: 'File to download', icon: 'down', none: 'No file yet' }, external_link: { name: 'Web link', icon: 'link', none: 'No link yet' },
  quiz: { name: 'Quiz', icon: 'quiz', none: '' },
}

/** A lesson whose content is not in yet: students would see an empty lesson. */
export function lacksContent(l: LessonRow): boolean {
  switch (l.type) {
    case 'video': case 'live': return !l.media_asset_id && !l.external_url
    case 'pdf': case 'download': return !l.media_asset_id
    case 'article': return !l.written
    case 'external_link': return !l.external_url
    default: return false
  }
}

export function minutesText(seconds: number): string {
  const m = Math.round(seconds / 60)
  if (m < 60) return `${m} min`
  return `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`
}

const item = 'flex min-h-11 w-full items-center gap-3 rounded-[10px] px-3 text-left t-label !text-fg hover:bg-muted disabled:pointer-events-none disabled:opacity-40'

function Act({ action, label, name, icon, rotate, disabled }: { action: (f: FormData) => Promise<void>; label: string; name: string; icon: IconName; rotate: string; disabled: boolean }) {
  return (
    <form action={action}>
      <button className={item} aria-label={name} disabled={disabled}><Icon name={icon} className={`h-5 w-5 text-mute ${rotate}`} /> {label}</button>
    </form>
  )
}

interface Props {
  courseId: string; a: Access; sections: SectionRow[]; lessons: LessonRow[]; manage: boolean; canUpload: boolean; onlyEmpty: boolean; base: string
}

export function Outline({ courseId, a, sections, lessons, manage, canUpload, onlyEmpty, base }: Props) {
  const canFiles = manage && isEnabled(a.bundle.features, 'core.media') && can(a, 'content.upload')
    && (isEnabled(a.bundle.features, 'content.documents') || isEnabled(a.bundle.features, 'content.downloads'))
  const quizzes = isEnabled(a.bundle.features, 'assess.quizzes') && can(a, 'test.manage')
  const shown = onlyEmpty ? lessons.filter(lacksContent) : lessons

  if (onlyEmpty) {
    return (
      <div className="grid gap-5">
        <p className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-2xl bg-tint-2 px-4 py-3 t-label !text-fg">
          {shown.length ? `Showing the ${shown.length} ${shown.length === 1 ? 'lesson' : 'lessons'} that still need content.` : 'Every lesson has its content.'}
          <Link href={base} className="inline-flex min-h-11 items-center t-label !text-primary underline underline-offset-4">Show all lessons</Link>
        </p>
        {sections.filter((s) => shown.some((l) => l.section_id === s.id)).map((s) => (
          <Card key={s.id} title={s.title}>
            <ul className="divide-y divide-border border-y border-border">
              {shown.filter((l) => l.section_id === s.id).map((l) => (
                <Row key={l.id} courseId={courseId} l={l} manage={manage} first last={false} showMenu={false} />
              ))}
            </ul>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid gap-5">
      {!sections.length && <Empty icon="calendar" title="Start by adding a month">Lessons are grouped by month or topic. Add the first one below, then upload its videos and files.</Empty>}
      {sections.map((s, si) => {
        const rows = lessons.filter((l) => l.section_id === s.id)
        const need = rows.filter(lacksContent).length
        const seconds = rows.reduce((n, l) => n + (l.duration_seconds ?? 0), 0)
        const panes: Pane[] = [
          ...(canUpload ? [{ key: 'videos', label: 'Upload videos', icon: 'video' as const, content: <VideoUploader courseId={courseId} to={{ sectionId: s.id }} /> }] : []),
          ...(canFiles ? [{ key: 'files', label: 'Upload PDFs and files', icon: 'doc' as const, content: <FilesUploader courseId={courseId} sectionId={s.id} /> }] : []),
          { key: 'other', label: 'Add a reading page, quiz or link', icon: 'link' as const, content: <AddLessonForm courseId={courseId} sectionId={s.id} quizzes={quizzes} /> },
        ]
        return (
          <section key={s.id} id={`month-${s.id}`} aria-labelledby={`month-title-${s.id}`}
            className="scroll-mt-6 rounded-[20px] bg-white shadow-[0_1px_2px_rgba(20,32,31,.06)] ring-1 ring-border">
            <div className="flex items-center gap-4 p-4 sm:px-6 sm:py-5">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#E4EFEB] text-[20px] font-extrabold tracking-tight text-primary tnum" aria-hidden="true">{si + 1}</span>
              <div className="min-w-0 flex-1">
                {s.label && <p className="t-small !text-primary">{s.label}</p>}
                <h2 id={`month-title-${s.id}`} className="t-card">{s.title}</h2>
                <p className="mt-0.5 t-small tnum">
                  {rows.length === 1 ? '1 lesson' : `${rows.length} lessons`}{seconds ? ` · ${minutesText(seconds)}` : ''}
                  {need > 0 && <span className="font-semibold text-fg"> · {need} still need content</span>}
                </p>
              </div>
              {manage && (
                <Menu label={`Options for ${s.title}`} wide>
                  <div className="grid gap-1">
                    <div className="p-2"><RenameSectionForm courseId={courseId} sectionId={s.id} label={s.label ?? ''} title={s.title} stacked /></div>
                    <div className="grid gap-1 border-t border-border pt-1">
                      <Act action={moveSection.bind(null, courseId, s.id, 'up')} label="Move up" name={`Move ${s.title} up`} icon="back" rotate="rotate-90" disabled={si === 0} />
                      <Act action={moveSection.bind(null, courseId, s.id, 'down')} label="Move down" name={`Move ${s.title} down`} icon="back" rotate="-rotate-90" disabled={si === sections.length - 1} />
                      <ConfirmButton action={deleteSection.bind(null, s.id)} label="Delete this month" name={`Delete ${s.title}`} yes="Yes, delete it and its lessons"
                        question={`Delete “${s.title}” and its ${rows.length} ${rows.length === 1 ? 'lesson' : 'lessons'}?`} />
                    </div>
                  </div>
                </Menu>
              )}
            </div>

            {rows.length ? (
              <ul className="divide-y divide-border border-t border-border">
                {rows.map((l, li) => <Row key={l.id} courseId={courseId} l={l} manage={manage} first={li === 0} last={li === rows.length - 1} showMenu={manage} />)}
              </ul>
            ) : (
              <p className="border-t border-border px-4 py-5 t-body sm:px-6">No lessons yet.{manage && ' Upload files below, or add a lesson by hand.'}</p>
            )}

            {manage && (
              <div className="border-t border-border p-4 sm:px-6">
                <AddPanel id={`add-${s.id}`} empty={!rows.length} panes={panes} />
              </div>
            )}
          </section>
        )
      })}

      {manage && (
        <div className="rounded-[20px] border-2 border-dashed border-field p-4 sm:p-5">
          <AddSectionForm courseId={courseId} />
        </div>
      )}
      {manage && !canUpload && sections.length > 0 && (
        <p className="t-small">Uploading many videos at once is not set up for this academy. Add a lesson, then open it to add its video.</p>
      )}
    </div>
  )
}

function Row({ courseId, l, manage, first, last, showMenu }: { courseId: string; l: LessonRow; manage: boolean; first: boolean; last: boolean; showMenu: boolean }) {
  const t = TYPE[l.type] ?? { name: l.type, icon: 'doc' as IconName, none: 'Empty' }
  const empty = lacksContent(l)
  const href = l.type === 'quiz' ? `/admin/courses/${courseId}/quiz/${l.id}` : `/admin/courses/${courseId}/lessons/${l.id}`
  return (
    <li className="relative flex items-center gap-3 px-4 py-2.5 hover:bg-[#FAFAF8] sm:px-6">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-primary"><Icon name={t.icon} className="h-5 w-5" /></span>
      <div className="min-w-0 flex-1">
        {manage
          ? <Link href={href} className="t-label !text-[16px] !text-fg after:absolute after:inset-0 hover:!text-primary">{l.title}</Link>
          : <p className="t-label !text-[16px] !text-fg">{l.title}</p>}
        <p className="mt-0.5 t-small">{t.name}{l.duration_seconds ? ` · ${minutesText(l.duration_seconds)}` : ''}{l.is_preview ? ' · free preview' : ''}</p>
      </div>
      {empty ? (
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-tint-2 px-2.5 py-1 t-small !font-semibold !text-fg">
          <Icon name="clock" className="h-4 w-4" /> {t.none}
        </span>
      ) : (
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#E4EFEB] text-deep"><Icon name="check" className="h-4 w-4" /><span className="sr-only">Ready</span></span>
      )}
      {showMenu && (
        <div className="relative z-10 shrink-0">
          <Menu label={`Options for ${l.title}`}>
            <div className="grid gap-1">
              <Link href={href} className={item}><Icon name="note" className="h-5 w-5 text-mute" /> Edit this lesson</Link>
              <Act action={moveLesson.bind(null, courseId, l.id, 'up')} label="Move up" name={`Move ${l.title} up`} icon="back" rotate="rotate-90" disabled={first} />
              <Act action={moveLesson.bind(null, courseId, l.id, 'down')} label="Move down" name={`Move ${l.title} down`} icon="back" rotate="-rotate-90" disabled={last} />
              <ConfirmButton action={deleteLesson.bind(null, l.id)} label="Delete this lesson" name={`Delete ${l.title}`} yes="Yes, delete the lesson" question={`Delete “${l.title}”? Students will no longer see it.`} />
            </div>
          </Menu>
        </div>
      )}
    </li>
  )
}
