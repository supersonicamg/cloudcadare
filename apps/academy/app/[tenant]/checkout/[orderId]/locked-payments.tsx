import { Ic } from '../../_components/v11'

/** Online payment is off: the ways to pay are listed as locked rows, so nothing looks broken. Nothing here is real or clickable. */
export function LockedPayments() {
  return (
    <div className="lockd">
      <p className="t-label">Other ways to pay</p>
      <div className="method off" aria-disabled="true">
        <Ic n="lock" /><span className="tx"><b className="t-card">UPI QR code</b><span className="t-label">Not available yet</span></span><span />
      </div>
      <div className="method off" aria-disabled="true">
        <Ic n="lock" /><span className="tx"><b className="t-card">Card, net banking, wallets</b><span className="t-label">Coming soon</span></span><span />
      </div>
    </div>
  )
}
