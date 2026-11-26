import { requireMember } from '@/lib/dal'
import { deviceLabel, isPhone } from '@/lib/device'
import { dateShort, timeShort } from '@/lib/format'
import { getShell } from '@/lib/shell'
import { Ic } from '../../_components/v11'
import { waHref } from '../../_components/v11-bars'
import { EndOthersButton, EndSessionButton, PasswordForm } from '../forms'
import { St } from '../ui'

export const metadata = { title: 'Password and devices' }

/*
 * Password and devices ("keep my account safe"). One filled button: Update password. Every password field has a Show
 * button. Devices are ruled rows with a picture; this device is marked with a tick and a word, the others get an
 * outline "Log out". Changing the email is not built yet: the row says who can do it.
 */
export default async function SecurityPage() {
  const a = await requireMember('/account/security')
  const [{ brand }, sessions, claims] = await Promise.all([getShell(), a.db.rpc('my_sessions'), a.db.auth.getClaims()])
  const email = claims.data?.claims?.email ?? ''
  const wa = waHref(brand, 'Hi, I need to change my sign-in email.')
  const list = [...(sessions.data ?? [])].sort((x, y) => Number(y.is_current) - Number(x.is_current))
  const others = list.filter((s) => !s.is_current).length

  return (
    <>
      <div className="pg-h"><div><h1 className="t-title">Password and devices</h1><p className="t-lead">Change your password. Other devices are logged out when you do.</p></div></div>

      <PasswordForm />

      <section className="blk" aria-labelledby="dv-h">
        <div className="blk-h"><h2 className="t-h3" id="dv-h">Where you are logged in</h2><p className="t-small">Don’t know one? Log it out and change your password.</p></div>
        {sessions.error ? (
          <p className="t-body">We could not load your devices. Reload the page in a minute.</p>
        ) : (
          <ul className="rows">
            {list.map((s) => (
              <li key={s.id} className="dev">
                <span className="ti"><Ic n={isPhone(s.user_agent) ? 'phone' : 'laptop'} /></span>
                <span className="tx">
                  <b className="t-card">{deviceLabel(s.user_agent)}</b>
                  <span className="t-label tnum">{s.is_current ? 'Active now' : `Last used ${dateShort(s.last_seen)}, ${timeShort(s.last_seen)}`}</span>
                </span>
                {s.is_current ? <St tone="ok">This device</St> : <EndSessionButton id={s.id} label={`Log out ${deviceLabel(s.user_agent)}`} />}
              </li>
            ))}
          </ul>
        )}
        {others > 0 && <EndOthersButton />}
      </section>

      <section className="blk" aria-labelledby="em-h">
        <div className="blk-h"><h2 className="t-h3" id="em-h">Sign-in email</h2></div>
        <dl className="facts">
          <div>
            <dt>Email</dt><dd>{email}</dd>
            {wa ? <a className="link link-s" href={wa} target="_blank" rel="noopener noreferrer" style={{ minHeight: 0 }}>Ask us to change it</a> : <span />}
          </div>
        </dl>
      </section>
    </>
  )
}
