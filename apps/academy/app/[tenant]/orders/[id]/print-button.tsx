'use client'

import { Icon } from '@educore/ui/marks'
import { buttonLine } from '@/lib/ui'

export function PrintButton() {
  return <button type="button" className={buttonLine} onClick={() => window.print()}><Icon name="print" />Print or save as PDF</button>
}
