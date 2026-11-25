'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Keeps the waiting page honest without a reload (plan/16 §5.2): every 20 seconds, and when the tab comes back into view,
 * it asks whether the payment was checked. When the answer is not what this page shows, the page re-reads itself and
 * moves on to "verified" or "could not match".
 */
export function Watcher({ orderId, shown }: { orderId: string; shown: string }) {
  const router = useRouter()
  useEffect(() => {
    let stopped = false
    const check = async () => {
      if (stopped || document.hidden) return
      try {
        const r = await fetch(`/api/checkout/${orderId}/state`, { cache: 'no-store' })
        if (!r.ok) return
        const s = (await r.json()) as { key: string }
        if (s.key !== shown) router.refresh()
      } catch { /* offline: try again at the next tick */ }
    }
    const t = setInterval(check, 20_000)
    const onVisible = () => { if (!document.hidden) void check() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { stopped = true; clearInterval(t); document.removeEventListener('visibilitychange', onVisible) }
  }, [orderId, shown, router])
  return null
}
