import { MethodPicker } from './method-picker'

const soon = { soon: true, soonLabel: 'Off for now', panel: null }
// A fixed made-up pattern that only looks like a code from a distance. It is not a QR and encodes nothing.
const CELLS = Array.from({ length: 121 }, (_, i) => (Math.imul(i + 7, 2654435761) >>> 27) % 2 === 0)

/** Online payment is off: the methods are listed greyed, over a blurred stand-in. Nothing here is real or clickable. */
export function LockedPayments() {
  return (
    <div className="grid gap-3">
      <MethodPicker initial="" methods={[
        { id: 'upi', title: 'UPI QR code', sub: 'GPay, PhonePe, Paytm or any UPI app', ...soon },
        { id: 'razorpay', title: 'Card, net banking, wallets', sub: 'Pay online', ...soon },
      ]} />
      <div aria-hidden="true" className="pointer-events-none flex select-none items-center gap-6 overflow-hidden rounded-[clamp(22px,2.6vw,32px)] bg-muted p-6 opacity-60 blur-[6px]">
        <div className="grid w-[148px] shrink-0 grid-cols-11 rounded-2xl bg-white p-3">
          {CELLS.map((on, i) => <span key={i} className={`aspect-square ${on ? 'bg-fg' : ''}`} />)}
        </div>
        <div className="grid flex-1 gap-3">
          {['w-4/5', 'w-3/5', 'w-2/3'].map((w) => <span key={w} className={`h-4 rounded-full bg-field ${w}`} />)}
        </div>
      </div>
    </div>
  )
}
