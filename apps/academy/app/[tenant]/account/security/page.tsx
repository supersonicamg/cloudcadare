import { requireMember } from '@/lib/dal'
import { deviceLabel } from '@/lib/device'
import { dateShort, timeShort } from '@/lib/format'
import { getShell } from '@/lib/shell'
import { h1s, h2s, lead } from '@/lib/ui'
import { Fact, Facts, Panel, StatusChip } from '../../_components/parts'
import { EndOthersButton, EndSessionButton, PasswordForm } from '../forms'

export const metadata = { title: 'Password and devices' }

/*
 * C5 · Password and devices.
 * 1. One job: keep the account safe.
 * 2. One main action: "Update password" (the only filled button). Device buttons are outline and small.
 * 3. Reading order: title -> the password panel (dominant) -> devices as a ruled list, this device first and marked
 *    -> the sign-in email as one quiet row. Changing the email is not built yet; the row says who can do it.
 */

export default async function SecurityPage() {
  const a = await requireMember('/account/security')
  const [{ brand }, sessions, claims] = await Promise.all([getShell(), a.db.rpc('my_sessions'), a.db.auth.getClaims()])
  const email = claims.data?.claims?.email ?? ''
  const wa = brand.contact?.whatsapp?.replace(/\D/g, '')
  const waHref = wa && wa.length >= 8 ? `https://wa.me/${wa}?text=${encodeURIComponent('Hi, I need to change my sign-in email.')}` : null
  const list = [...(sessions.data ?? [])].sort((x, y) => Number(y.is_current) - Number(x.is_current))
  const others = list.filter((s) => !s.is_current).length

  return (
    <div className="grid gap-12">
      <section aria-labelledby="pw-h" className="grid gap-6">
        <div className="grid gap-3">
          <h1 id="pw-h" className={h1s}>Password and devices</h1>
          <p className={lead}>Change your password. Other devices are logged out when you do.</p>
        </div>
        <Panel><PasswordForm /></Panel>
      </section>

      <section aria-labelledby="dv-h" className="grid gap-4">
        <div className="grid gap-1">
          <h2 id="dv-h" className={h2s}>Where you are logged in</h2>
          <p className="t-body">If you do not know one, log it out and change your password.</p>
        </div>
        {sessions.error ? (
          <p className="t-body !text-fg">We could not load your devices. Reload the page in a minute.</p>
        ) : (
          <ul className="border-t-2 border-fg">
            {list.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2 border-b border-border py-3.5">
                <div className="grid min-w-0 gap-0.5">
                  <p className="t-label flex flex-wrap items-center gap-x-3 gap-y-1 !text-fg">{deviceLabel(s.user_agent)}{s.is_current && <StatusChip tone="ok">This device</StatusChip>}</p>
                  <p className="t-small tnum">{s.is_current ? 'Active now' : `Last used ${dateShort(s.last_seen)}, ${timeShort(s.last_seen)}`}</p>
                </div>
                {!s.is_current && <EndSessionButton id={s.id} label={`Log out ${deviceLabel(s.user_agent)}`} />}
              </li>
            ))}
          </ul>
        )}
        {others > 0 && <EndOthersButton />}
      </section>

      <section aria-labelledby="em-h" className="grid gap-4">
        <h2 id="em-h" className={h2s}>Sign-in email</h2>
        <Facts>
          <Fact label="Email" aside={waHref ? <a href={waHref} target="_blank" rel="noopener noreferrer" className="t-label !text-primary hover:underline">Ask us to change it</a> : undefined}>{email}</Fact>
        </Facts>
      </section>
    </div>
  )
}
