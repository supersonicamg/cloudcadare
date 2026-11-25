import { createHmac } from 'node:crypto'
import { expect, test, type Page } from '@playwright/test'
import { createPaidCourse, ownerWithMfa, signIn, waitForMail } from './helpers'

/** The coupon field sits behind a "Have a coupon?" link; open it if it is closed. */
async function openCoupon(page: import('@playwright/test').Page) {
  const d = page.locator('details', { hasText: 'Have a coupon?' })
  if (!(await d.evaluate((e) => (e as HTMLDetailsElement).open))) await d.locator('summary').click()
}

// Coupons, a 100%-off order, a failed payment attempt, a learner's receipt and refunds. Fake gateway (see commerce.spec.ts).
const OWNER = process.env.E2E_OWNER_EMAIL ?? 'founder@example.com'
const stamp = Date.now().toString().slice(-6)
const title = `Promo Course ${stamp}`
const slug = `promo-course-${stamp}`
const CODE10 = `SAVE10${stamp}`
const CODEFREE = `FREE${stamp}`
const buyer = `promo-buyer-${stamp}@example.com`
let tenantId = ''
const hmac = (secret: string, data: string) => createHmac('sha256', secret).update(data).digest('hex')

async function openCheckout(page: Page, email: string) {
  await signIn(page, email, `/courses/${slug}`)
  await page.getByRole('button', { name: 'Buy for ₹1,180' }).first().click()
  await page.waitForURL(/\/checkout\//)
  await expect(page.getByTestId('order-total')).toHaveText('₹1,180')
}

test.describe.serial('coupons, receipts and refunds', () => {
  test.setTimeout(120_000)

  test('owner sells a course and creates coupons', async ({ page }) => {
    await ownerWithMfa(page, OWNER)
    await createPaidCourse(page, title, '1,180')
    await page.goto('/admin/payments')
    tenantId = (await page.getByTestId('webhook-url').innerText()).trim().split('/').pop()!

    await page.goto('/admin/coupons')
    await page.getByLabel('Code', { exact: true }).fill(CODE10)
    await page.getByLabel('Discount').fill('10')
    await page.getByRole('button', { name: 'Create coupon' }).click()
    await expect(page.getByText('Coupon created.')).toBeVisible()
    await page.getByLabel('Code', { exact: true }).fill(CODE10)
    await page.getByLabel('Discount').fill('10')
    await page.getByRole('button', { name: 'Create coupon' }).click()
    await expect(page.getByText('You already have a coupon with that code.')).toBeVisible()
    await page.getByLabel('Code', { exact: true }).fill(CODEFREE)
    await page.getByLabel('Discount').fill('100')
    await page.getByRole('button', { name: 'Create coupon' }).click()
    await expect(page.getByTestId('coupon-code').filter({ hasText: CODEFREE })).toBeVisible()
    await page.getByLabel('Discount').fill('150')
    await page.getByLabel('Code', { exact: true }).fill(`BAD${stamp}`)
    await page.getByRole('button', { name: 'Create coupon' }).click()
    await expect(page.getByText('A percentage cannot be more than 100.')).toBeVisible()
  })

  test('a coupon lowers the total; a wrong code is refused; the receipt shows the discount', async ({ page }) => {
    await openCheckout(page, buyer)
    await openCoupon(page)
    await page.getByLabel('Have a coupon code?').fill('NOTACODE')
    await page.getByRole('button', { name: 'Apply' }).click()
    await expect(page.getByText('That code does not work for this order.')).toBeVisible()
    await openCoupon(page)
    await page.getByLabel('Have a coupon code?').fill(CODE10.toLowerCase())
    await page.getByRole('button', { name: 'Apply' }).click()
    await expect(page.getByTestId('order-discount')).toHaveText('−₹118')
    await expect(page.getByTestId('order-total')).toHaveText('₹1,062')
    await expect(page.getByText('Includes ₹162 tax')).toBeVisible()
    await page.getByRole('button', { name: 'Remove' }).click()
    await expect(page.getByTestId('order-total')).toHaveText('₹1,180')
    await openCoupon(page)
    await page.getByLabel('Have a coupon code?').fill(CODE10)
    await page.getByRole('button', { name: 'Apply' }).click()
    await expect(page.getByTestId('order-total')).toHaveText('₹1,062')

    await page.waitForLoadState('networkidle') // the page is re-rendered right after the coupon action; wait for that to settle
    await page.getByRole('button', { name: 'Pay ₹1,062' }).click()
    await page.waitForURL(/\/learn(\?|$)/)
    await expect(page.getByRole('heading', { name: title })).toBeVisible()

    await page.getByRole('navigation', { name: 'My account' }).getByRole('link', { name: 'My orders' }).click()
    await expect(page.getByRole('heading', { name: 'My orders' })).toBeVisible()
    await page.getByRole('link', { name: 'Receipt' }).first().click()
    const receipt = page.getByRole('article', { name: 'Receipt' })
    await expect(receipt).toContainText(title)
    await expect(receipt).toContainText(`Coupon ${CODE10}`)
    await expect(receipt).toContainText('Total paid')
    await expect(receipt).toContainText('₹1,062')
    await expect(receipt).toContainText('not a GST tax invoice')

    // and the receipt arrives by email
    const mail = await waitForMail(buyer, `Your receipt from`)
    expect(mail).toContain('1,062')
    expect(mail).toContain(title)
    expect(mail).toContain('/orders/')
  })

  test('a 100% coupon enrols without payment', async ({ page }) => {
    await openCheckout(page, `promo-free-${stamp}@example.com`)
    await openCoupon(page)
    await page.getByLabel('Have a coupon code?').fill(CODEFREE)
    await page.getByRole('button', { name: 'Apply' }).click()
    await expect(page.getByTestId('order-total')).toHaveText('₹0')
    await expect(page.getByRole('button', { name: /^Pay/ })).toHaveCount(0)
    await page.getByRole('button', { name: 'Enrol for free' }).first().click()
    await page.waitForURL(/\/learn(\?|$)/)
    await expect(page.getByRole('heading', { name: title })).toBeVisible()
  })

  test('a failed attempt is explained and a later success still counts', async ({ page, browser, baseURL }) => {
    await openCheckout(page, `promo-retry-${stamp}@example.com`)
    const gwOrder = (await page.locator('[data-gateway-order]').getAttribute('data-gateway-order'))!
    const hook = `/api/webhooks/razorpay/${tenantId}`
    const failed = JSON.stringify({ event: 'payment.failed', payload: { payment: { entity: { id: `pay_f${stamp}`, order_id: gwOrder, amount: 118000, currency: 'INR', error_description: 'Card declined' } } } })
    const anon = await browser.newContext({ baseURL })
    const r = await anon.request.post(hook, { data: failed, headers: { 'content-type': 'application/json', 'x-razorpay-signature': hmac('fake_webhook_secret', failed), 'x-razorpay-event-id': `evt_f${stamp}` } })
    expect((await r.json()).note).toBe('failure recorded')
    await anon.close()

    await page.reload()
    await expect(page.getByText('Your last payment attempt did not go through: Card declined')).toBeVisible()
    await page.getByRole('button', { name: 'Pay ₹1,180' }).click()
    await page.waitForURL(/\/learn(\?|$)/)
    await expect(page.getByRole('heading', { name: title })).toBeVisible()
  })

  test('the owner refunds part of an order, then the rest, and access ends', async ({ page, browser, baseURL }) => {
    await ownerWithMfa(page, OWNER, '/admin/orders')
    await page.getByRole('listitem').filter({ hasText: buyer }).getByRole('link', { name: /^ORD-/ }).click()
    await expect(page.getByTestId('order-total')).toHaveText('₹1,062')
    await expect(page.getByTestId('order-status')).toHaveText('Paid')

    await page.getByLabel('Amount (₹)').fill('5000')
    await page.getByRole('button', { name: 'Refund', exact: true }).click()
    await expect(page.getByText('You can refund at most 1,062 rupees')).toBeVisible()

    await page.getByLabel('Amount (₹)').fill('62')
    await page.getByLabel('Reason').fill('Goodwill')
    await page.getByLabel('Take away the learner').uncheck()
    await page.getByRole('button', { name: 'Refund', exact: true }).click()
    await expect(page.getByText('Refund sent.')).toBeVisible()
    await expect(page.getByTestId('order-status')).toHaveText('Partly refunded')

    // the learner still has the course after a partial refund
    const learner = await browser.newContext({ baseURL })
    const lp = await learner.newPage()
    await signIn(lp, buyer, '/learn')
    await expect(lp.getByRole('heading', { name: title })).toBeVisible()

    await page.getByLabel('Amount (₹)').fill('')
    await page.getByLabel('Reason').fill('Course withdrawn')
    await page.getByRole('button', { name: 'Refund', exact: true }).click()
    await expect(page.getByTestId('order-status')).toHaveText('Refunded')
    await expect(page.getByTestId('refund-row')).toHaveCount(2)
    await expect(page.getByRole('button', { name: 'Refund', exact: true })).toHaveCount(0)

    await lp.goto('/learn')
    await expect(lp.getByRole('heading', { name: title })).toHaveCount(0)
    await lp.goto('/orders')
    await expect(lp.getByText('Refunded')).toBeVisible()
    await learner.close()
    await waitForMail(buyer, 'Your refund from')
  })
})
