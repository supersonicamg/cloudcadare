import { expect, test } from '@playwright/test'
import { createPaidCourse, signUpAndConfirm, staffWithMfa } from './helpers'

// Slice 4 (plan/16 §5, §11): UPI settings, the live QR checkout, "I have paid", the waiting page and the optional upload.
// Runs with the built-in test gateway OFF (EDUCORE_FAKE_GATEWAY=0), so Razorpay is "coming soon", as it is for CloudCadre today.
const stamp = Date.now().toString().slice(-6)
const title = `Upi Course ${stamp}`
const slug = title.toLowerCase().replace(/\s+/g, '-')
const VPA = `cloudcadre${stamp}@okaxis`

// The smallest valid PNG.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')

test('UPI QR checkout: settings, QR for the exact amount, "I have paid", waiting page, upload', async ({ page, browser }) => {
  test.setTimeout(240_000)

  // ---- staff: course with a price, then UPI settings (a bad UPI ID is refused first)
  await staffWithMfa(page)
  await createPaidCourse(page, title, '1,180')
  await page.goto('/admin/payments')
  await expect(page.getByRole('heading', { level: 1, name: 'Payment settings' })).toBeVisible()
  await page.waitForLoadState('networkidle')
  await page.getByLabel('Accept UPI QR payments').check()
  await page.getByLabel('UPI ID').fill('not a upi id')
  await page.getByLabel('Name shown to learners').fill('CloudCadre')
  await page.getByLabel('WhatsApp number for screenshots').fill('98765 43210')
  await page.getByRole('button', { name: 'Save settings' }).click()
  await expect(page.getByText('A UPI ID looks like name@bank.')).toBeVisible()
  await page.getByLabel('UPI ID').fill(VPA)
  await page.getByLabel('When you check payments').fill('9am to 9pm, Mon to Sat')
  await page.getByLabel('How long it takes').fill('usually within 2 hours')
  await page.getByRole('button', { name: 'Save settings' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Saved.' })).toBeVisible()

  // ---- learner: buys
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const l = await ctx.newPage()
  await signUpAndConfirm(l, `upi-${stamp}@example.com`, 'Upi Learner')
  await l.goto(`/courses/${slug}`)
  await l.waitForLoadState('networkidle')
  await l.getByRole('button', { name: 'Buy for ₹1,180' }).first().click()
  await l.waitForURL(/\/checkout\/[0-9a-f-]{36}$/)
  const orderUrl = l.url()

  await expect(l.getByRole('heading', { level: 1, name: 'Pay ₹1,180' })).toBeVisible()
  // The QR is drawn on the server for exactly this amount; Razorpay is listed but cannot be chosen.
  await expect(l.getByRole('img', { name: `QR code to pay ₹1,180 to ${VPA}` })).toBeVisible()
  await expect(l.getByText(VPA).first()).toBeVisible()
  const note = (await l.getByTestId('order-total').count()) ? await l.locator('p:has-text("Order CC")').first().innerText() : ''
  expect(note).toMatch(/Order CC-/)
  await expect(l.getByText('Coming soon')).toBeVisible()
  await expect(l.getByRole('radio', { name: /Card, net banking/ })).toBeDisabled()
  await expect(l.getByRole('radio', { name: /UPI QR code/ })).toBeChecked()

  // "I have paid" (the one filled button)
  await l.getByRole('button', { name: /I have paid/ }).click()
  await l.waitForURL(/\/pending$/)
  await expect(l.getByRole('heading', { level: 1, name: 'Thank you. We are checking your payment.' })).toBeVisible()
  const wa = await l.getByRole('link', { name: /Send screenshot on WhatsApp/ }).getAttribute('href')
  expect(wa).toContain('https://wa.me/919876543210')
  expect(decodeURIComponent(wa!)).toMatch(/order is CC-/)

  // The checkout page now sends the learner back here: one open proof per order.
  await l.goto(orderUrl)
  await l.waitForURL(/\/pending$/)

  // Upload: a text file renamed .png is refused by what is inside it; a real picture is accepted with a reference.
  await l.getByText('Or upload it here instead').click()
  await l.locator('#proof-file').setInputFiles({ name: 'fake.png', mimeType: 'image/png', buffer: Buffer.from('this is not a picture') })
  await l.getByRole('button', { name: 'Upload', exact: true }).click()
  await expect(l.getByText('That file is not a picture or PDF, or it is over 5 MB.')).toBeVisible()
  await l.locator('#proof-file').setInputFiles({ name: 'paid.png', mimeType: 'image/png', buffer: PNG })
  await l.locator('#proof-utr').fill('4012 3456 7890')
  await l.getByRole('button', { name: 'Upload', exact: true }).click()
  await expect(l.getByText('Received. We will check it.')).toBeVisible()
  await l.reload()
  await expect(l.getByRole('heading', { name: 'We have your screenshot' })).toBeVisible()

  // Nothing is unlocked while it waits.
  await l.goto(`/learn/${slug}`)
  await expect(l.getByRole('heading', { name: title })).toHaveCount(0)
  await l.goto('/account/payments')
  await expect(l.getByText('Waiting for check')).toBeVisible()
  await ctx.close()
})

test('the main action stays on screen on a phone', async ({ page, browser }) => {
  test.setTimeout(180_000)
  await staffWithMfa(page)
  const t = `Phone Course ${stamp}`
  await createPaidCourse(page, t, '1,180')
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })
  const l = await ctx.newPage()
  await signUpAndConfirm(l, `upi-phone-${stamp}@example.com`, 'Phone Learner')
  await l.goto(`/courses/${t.toLowerCase().replace(/\s+/g, '-')}`)
  await l.waitForLoadState('networkidle')
  await l.getByRole('button', { name: 'Buy for ₹1,180' }).first().click()
  await l.waitForURL(/\/checkout\/[0-9a-f-]{36}$/)
  const paid = l.getByRole('button', { name: /I have paid/ })
  await expect(paid).toBeVisible()
  await expect(paid).toBeInViewport({ ratio: 1 })
  expect((await paid.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  // no sideways scroll
  expect(await l.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0)
  await ctx.close()
})
