'use client'

import { Ic, type IconName } from '../../_components/v11'

/** Opens the browser's print dialog: "Print" or "Save as PDF". Hidden when printing by the page that uses it. */
export function PrintButton({ label = 'Print or save as PDF', icon, className = 'btn btn-line' }: { label?: string; icon?: IconName; className?: string }) {
  return <button type="button" className={className} onClick={() => window.print()}>{icon && <Ic n={icon} />}{label}</button>
}
