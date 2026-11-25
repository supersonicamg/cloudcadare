import { createHmac } from 'node:crypto'
import { expect, test, type Page } from '@playwright/test'
import { enableMfa, resetMfa, signIn } from './helpers'

// Runs against the built-in fake gateway (EDUCORE_FAKE_GATEWAY=1 in apps/academy/.env.local). It uses the same
// signature checks as Razorpay, with fixed public keys.
const OWNER = process.env.E2E_OWNER_EMAIL ?? 'founder@example.com'
const stamp = Date.now().toString().slice(-6)
const title = `Paid Course ${stamp}`
const slug = `paid-course-${stamp}`
const FAKE_WEBHOOK_SECRET = 'fake_webhook_secret'
const hmac = (secret: string, data: string) => createHmac('sha256', secret).update(data).digest('hex')
let tenantId = ''

function paidEvent(id: string, gatewayOrderId: string, amount: number) {
  const body = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: `pay_${id}`, order_id: gatewayOrderId, amount, currency: 'INR', method: 'upi' } } } })
  return { body, headers: { 'content-type': 'application/json', 'x-razorpay-signature': hmac(FAKE_WEBHOOK_SECRET, body), 'x-razorpay-event-id': `evt_${id}` } }
}

async function startBuying(page: Page, email: string) {
  await signIn(page, email, `/courses/${slug}`)
  await page.getByRole('button', { name: 'Buy for ₹1,180' }).first().click()
  await page.waitForURL(/\/checkout\//)
  await expect(page.getByTestId('order-total')).toHaveText('₹1,180')
}

test.describe.serial('selling a course', () => {
  test.setTimeout(90_000)

  test('owner sets a price and saves payment keys (secrets are never shown again)', async ({ page }) => {
    await resetMfa(OWNER)
    await signIn(page, OWNER, '/admin')
    await enableMfa(page)

    await page.goto('/admin/courses')
    await page.getByLabel('Title').fill(title)
    await page.getByRole('button', { name: 'Create draft' }).click()
    await page.waitForLoadState('networkidle') // let the forms hydrate
    await page.getByLabel('New section').fill('Start here')
    await page.getByRole('button', { name: 'Add section' }).click()
    await expect(page.getByRole('heading', { name: /Start here/ })).toBeVisible()
    await page.getByLabel('Lesson title').fill('First reading')
    await page.getByLabel('Type').selectOption({ label: 'Reading' })
    await page.getByRole('button', { name: 'Add lesson' }).click()
    await expect(page.getByRole('link', { name: 'First reading' })).toBeVisible()
    await page.getByRole('button', { name: 'Publish' }).click()
    await expect(page.getByText('Published', { exact: true })).toBeVisible()

    await page.getByLabel('Price (₹)', { exact: true }).fill('0.50')
    await page.getByRole('button', { name: 'Start selling' }).click()
    await expect(page.getByText('Enter a price between')).toBeVisible()
    await page.getByLabel('Price (₹)', { exact: true }).fill('1,180')
    await page.getByRole('button', { name: 'Start selling' }).click()
    await expect(page.getByText('This course is for sale.')).toBeVisible()

    await page.goto('/admin/payments')
    tenantId = (await page.getByTestId('webhook-url').innerText()).trim().split('/').pop()!
    expect(tenantId).toMatch(/^[0-9a-f-]{36}$/)
    await page.getByLabel('Mode').selectOption('live')
    await page.getByLabel('Key ID').fill('rzp_test_abcdef123456')
    await page.getByLabel('Key Secret').fill('supersecretvalue')
    await page.getByRole('button', { name: 'Save payment account' }).click()
    await expect(page.getByText('A live account uses a Key ID')).toBeVisible()
    await page.getByLabel('Mode').selectOption('test')
    await page.getByLabel('Webhook secret').fill('hooksecret12345')
    await page.getByRole('button', { name: 'Save payment account' }).click()
    await expect(page.getByText('stored encrypted')).toBeVisible()

    await page.reload()
    await expect(page.getByLabel('Key ID')).toHaveValue('rzp_test_abcdef123456')
    await expect(page.getByLabel('Key Secret')).toHaveAttribute('placeholder', /Saved/)
    const html = await page.content()
    expect(html).not.toContain('supersecretvalue')
    expect(html).not.toContain('hooksecret12345')
  })

  test('a visitor sees the price and must sign in to buy', async ({ page }) => {
    await page.goto(`/courses/${slug}`)
    await expect(page.getByText('₹1,180', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Includes GST 18%').first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'Sign in to buy' }).first()).toBeVisible()
    // paying is for signed-in members only
    expect((await page.request.post('/api/checkout/verify', { data: { orderId: '00000000-0000-4000-8000-000000000000', razorpay_order_id: 'order_x1', razorpay_payment_id: 'pay_x1', razorpay_signature: 'sig_xxxxxxxxxx' } })).status()).toBe(401)
  })

  test('a learner pays at checkout and gets the course', async ({ page }) => {
    await startBuying(page, `buyer-${stamp}@example.com`)
    await expect(page.getByText('Includes ₹180 tax')).toBeVisible()
    await page.getByRole('button', { name: 'Pay ₹1,180' }).click()
    await page.waitForURL(/\/learn(\?|$)/)
    await expect(page.getByRole('heading', { name: title })).toBeVisible()

    // the course page now says continue, and the order cannot be paid twice
    await page.goto(`/courses/${slug}`)
    await expect(page.getByRole('link', { name: 'Continue learning' }).first()).toBeVisible()
    await page.goBack()
  })

  test('a forged checkout result is refused', async ({ page }) => {
    await startBuying(page, `forger-${stamp}@example.com`)
    const orderId = page.url().split('/').pop()!
    const gwOrder = (await page.locator('[data-gateway-order]').getAttribute('data-gateway-order'))!
    const res = await page.request.post('/api/checkout/verify', { data: { orderId, razorpay_order_id: gwOrder, razorpay_payment_id: 'pay_forged1', razorpay_signature: hmac('not-the-secret', `${gwOrder}|pay_forged1`) } })
    expect(res.status()).toBe(400)
    await page.goto('/learn')
    await expect(page.getByRole('heading', { name: title })).toHaveCount(0)
  })

  test('the webhook pays an order even if the learner never returned, once only', async ({ page, browser, baseURL }) => {
    await startBuying(page, `closer-${stamp}@example.com`)
    const gwOrder = (await page.locator('[data-gateway-order]').getAttribute('data-gateway-order'))!
    const hook = `/api/webhooks/razorpay/${tenantId}`
    const ev = paidEvent(`a${stamp}`, gwOrder, 118000)

    const anon = await browser.newContext({ baseURL })
    expect((await anon.request.post(hook, { data: ev.body, headers: { ...ev.headers, 'x-razorpay-signature': hmac('wrong', ev.body) } })).status()).toBe(401)
    expect((await anon.request.post(hook.replace(tenantId, '00000000-0000-4000-8000-000000000000'), { data: ev.body, headers: ev.headers })).status()).toBe(404)
    const first = await anon.request.post(hook, { data: ev.body, headers: ev.headers })
    expect(first.status()).toBe(200)
    expect((await first.json()).note).toBe('paid')
    const again = await anon.request.post(hook, { data: ev.body, headers: ev.headers })
    expect((await again.json()).note).toBe('duplicate')
    await anon.close()

    await page.goto('/learn')
    await expect(page.getByRole('heading', { name: title })).toBeVisible()
  })

  test('a webhook for the wrong amount does not grant the course', async ({ page, browser, baseURL }) => {
    await startBuying(page, `short-${stamp}@example.com`)
    const gwOrder = (await page.locator('[data-gateway-order]').getAttribute('data-gateway-order'))!
    const ev = paidEvent(`b${stamp}`, gwOrder, 100)
    const anon = await browser.newContext({ baseURL })
    const r = await anon.request.post(`/api/webhooks/razorpay/${tenantId}`, { data: ev.body, headers: ev.headers })
    expect((await r.json()).note).toContain('amount mismatch')
    await anon.close()
    await page.goto('/learn')
    await expect(page.getByRole('heading', { name: title })).toHaveCount(0)
  })

  test('the owner sees the paid orders', async ({ page }) => {
    // a fresh sign-in: orders need no two-step check
    await signIn(page, OWNER, '/admin/orders')
    await expect(page.getByRole('heading', { name: 'Orders' })).toBeVisible()
    const paid = page.getByRole('listitem').filter({ hasText: `buyer-${stamp}@example.com` })
    await expect(paid).toContainText('Paid')
    await expect(paid).toContainText('₹1,180')
    await expect(page.getByRole('listitem').filter({ hasText: `short-${stamp}@example.com` })).toContainText('Awaiting payment')
  })
})
