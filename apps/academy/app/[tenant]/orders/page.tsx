import { redirect } from 'next/navigation'

// The orders list moved into the account area (plan/16 §2). Receipts stay at /orders/[id]: that page IS the receipt.
export default function MyOrders() {
  redirect('/account/payments')
}
