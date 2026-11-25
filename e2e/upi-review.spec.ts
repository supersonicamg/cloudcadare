import { expect, test, type Page } from '@playwright/test'
import { createPaidCourse, signUpAndConfirm, staffWithMfa } from './helpers'

// Slices 5 and 6 (plan/16 §5.3, §6.4, §11): staff verify a UPI payment and the learner is unlocked; a rejected payment tells
// the learner what to do; the learner takes a note, finds it in "My notes" and can undo a delete.
// Runs with the built-in test gateway OFF (EDUCORE_FAKE_GATEWAY=0), like upi.spec.ts.
const stamp = Date.now().toString().slice(-6)
const title = `Review Course ${stamp}`
const slug = title.toLowerCase().replace(/\s+/g, '-')

async function enableUpi(page: Page) {
  await page.goto('/admin/payments')
  await page.waitForLoadState('networkidle')
  await page.getByLabel('Accept UPI QR payments').check()
  await page.getByLabel('UPI ID').fill(`review${stamp}@okaxis`)
  await page.getByLabel('Name shown to learners').fill('CloudCadre')
  await page.getByLabel('WhatsApp number for screenshots').fill('98765 43210')
  await page.getByRole('button', { name: 'Save settings' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Saved.' })).toBeVisible()
}

async function learnerPaid(page: Page, email: string, name: string) {
  await signUpAndConfirm(page, email, name)
  await page.goto(`/courses/${slug}`)
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: 'Buy for ₹1,180' }).first().click()
  await page.waitForURL(/\/checkout\/[0-9a-f-]{36}$/)
  await page.getByRole('button', { name: /I have paid/ }).click()
  await page.waitForURL(/\/pending$/)
}

test.describe.serial('UPI review and notes', () => {
  test('staff verify a payment, the learner is unlocked, takes a note and finds it', async ({ page, browser }) => {
    test.setTimeout(300_000)
    await staffWithMfa(page)
    await createPaidCourse(page, title, '1,180')
    await enableUpi(page)

    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    const l = await ctx.newPage()
    await learnerPaid(l, `review-${stamp}@example.com`, 'Review Learner')

    // ---- staff: the queue shows the payment; verify stays off until the ticks are set
    await page.goto('/admin/payments/upi')
    await expect(page.getByRole('heading', { level: 1, name: 'UPI payments' })).toBeVisible()
    await page.getByRole('link', { name: /Review Learner/ }).first().click()
    const verify = page.getByRole('button', { name: /^Verify and unlock/ })
    await expect(verify).toBeDisabled()
    await page.getByLabel(/I can see this payment/).check()
    await expect(verify).toBeDisabled() // a WhatsApp proof also needs the WhatsApp tick
    await page.getByLabel(/I saw the screenshot/).check()
    await expect(verify).toBeEnabled()
    await verify.click()
    await expect(page.getByRole('status').filter({ hasText: 'Verified.' })).toBeVisible()

    // ---- learner: unlocked; the order is paid
    await l.goto(`/learn/${slug}/material`)
    await expect(l.getByRole('heading', { level: 1, name: 'Lessons' })).toBeVisible()
    await l.getByRole('link', { name: /First reading/ }).click()
    await l.waitForURL(/\/learn\/[^/]+\/[0-9a-f-]{36}/)

    // ---- notes: write one with Ctrl+Enter, it is listed, it survives a reload, My notes links back
    await l.waitForLoadState('networkidle')
    await l.getByRole('tab', { name: /^Notes/ }).click()
    await l.getByLabel(/^Note/).fill('Tags drive cost allocation')
    await l.getByLabel(/^Note/).press('Control+Enter')
    await expect(l.getByRole('list', { name: 'Your notes on this lesson' }).getByText('Tags drive cost allocation')).toBeVisible()
    await l.reload()
    await l.getByRole('tab', { name: /^Notes/ }).click()
    await expect(l.getByText('Tags drive cost allocation')).toBeVisible()
    await l.goto('/learn/notes')
    await expect(l.getByRole('heading', { level: 1, name: 'Notes' })).toBeVisible()
    await expect(l.getByText('Tags drive cost allocation')).toBeVisible()

    // ---- delete shows Undo, and undoing brings it back
    await l.getByRole('link', { name: /Tags drive cost allocation/ }).click()
    await l.waitForLoadState('networkidle')
    await l.getByRole('tab', { name: /^Notes/ }).click()
    await l.getByRole('button', { name: 'Delete this note' }).click()
    await expect(l.getByRole('status').filter({ hasText: 'Note deleted' })).toBeVisible()
    await l.getByRole('button', { name: 'Undo' }).click()
    await expect(l.getByText('Tags drive cost allocation')).toBeVisible()
    await ctx.close()
  })

  test('staff reject a payment and the learner is told what to do', async ({ page, browser }) => {
    test.setTimeout(240_000)
    await staffWithMfa(page)
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    const l = await ctx.newPage()
    await learnerPaid(l, `reject-${stamp}@example.com`, 'Reject Learner')

    await page.goto('/admin/payments/upi')
    await page.getByRole('link', { name: /Reject Learner/ }).first().click()
    await page.getByText('Reject with a reason').click()
    await page.getByLabel('Reason').selectOption('amount_mismatch')
    await page.getByLabel(/Note to the learner/).fill('We saw 500 rupees.')
    await page.getByRole('button', { name: 'Send rejection' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Sent back.' })).toBeVisible()

    await l.reload()
    await expect(l.getByRole('heading', { level: 1, name: 'We could not match your payment' })).toBeVisible()
    await expect(l.getByText('We saw 500 rupees.')).toBeVisible()
    // nothing unlocked
    await l.goto(`/learn/${slug}/material`)
    await expect(l.getByRole('heading', { level: 1, name: 'Lessons' })).toHaveCount(0)
    await ctx.close()
  })
})
