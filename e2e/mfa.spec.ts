import { expect, test } from '@playwright/test'
import { resetMfa, signIn, totp } from './helpers'

const OWNER = process.env.E2E_OWNER_EMAIL ?? 'founder@example.com'
const stamp = Date.now().toString().slice(-6)
const courseTitle = `Granted Course ${stamp}`
const learnerEmail = `grant-${stamp}@example.com`
let secret = ''

/** A code for the current 30 s step, never one about to expire while the form is submitted. */
async function freshCode(page: import('@playwright/test').Page, s: string) {
  const left = 30_000 - (Date.now() % 30_000)
  if (left < 4_000) await page.waitForTimeout(left + 500)
  return totp(s)
}

test.describe.serial('staff two-step check and access grants', () => {
  test.setTimeout(90_000)
  test.beforeAll(async () => { await resetMfa(OWNER) })

  test('a sensitive page sends staff to set up an authenticator app, then they can give and remove access', async ({ page, browser, baseURL }) => {
    await signIn(page, OWNER, '/admin')

    // a published course to hand out (creating one is not a sensitive action)
    await page.goto('/admin/courses')
    await page.getByLabel('Title').fill(courseTitle)
    await page.getByRole('button', { name: 'Create draft' }).click()
    await page.getByRole('button', { name: 'Publish' }).click()
    await expect(page.getByText('Published', { exact: true })).toBeVisible()

    await page.goto('/admin/enrolments')
    await page.waitForURL(/\/admin\/security\?next=%2Fadmin%2Fenrolments/)
    await expect(page.getByRole('heading', { name: 'Security' })).toBeVisible()
    await page.getByRole('button', { name: 'Set up authenticator app' }).click()
    secret = (await page.getByTestId('totp-secret').innerText()).trim()
    expect(secret).toMatch(/^[A-Z2-7]{16,}$/)

    await page.getByLabel('Code').fill('000000')
    await page.getByRole('button', { name: 'Turn on two-step check' }).click()
    await expect(page.getByText('That code is not right')).toBeVisible()

    await page.getByLabel('Code').fill(await freshCode(page, secret))
    await page.getByRole('button', { name: 'Turn on two-step check' }).click()
    await page.waitForURL('**/admin/enrolments')
    await expect(page.getByRole('heading', { name: 'Enrolments' })).toBeVisible()

    // the learner has to have signed in once
    const lctx = await browser.newContext({ baseURL })
    const lp = await lctx.newPage()
    await signIn(lp, learnerEmail, '/')

    await page.getByLabel('Learner’s email').fill(`nobody-${stamp}@example.com`)
    await page.getByRole('button', { name: 'Give access' }).click()
    await expect(page.getByText('No one with that email has signed in')).toBeVisible()

    await page.getByLabel('Learner’s email').fill(learnerEmail)
    await page.getByLabel('Course').selectOption({ label: courseTitle })
    await page.getByRole('button', { name: 'Give access' }).click()
    await expect(page.getByText(/now has access to/)).toBeVisible()

    const row = page.getByRole('listitem').filter({ hasText: learnerEmail })
    await expect(row).toContainText('Given by staff')

    await lp.goto('/learn')
    await expect(lp.getByRole('heading', { name: courseTitle })).toBeVisible()

    await row.getByRole('button', { name: 'Remove access' }).click()
    await expect(page.getByRole('listitem').filter({ hasText: learnerEmail })).toHaveCount(0)
    await lp.goto('/learn')
    await expect(lp.getByRole('heading', { name: courseTitle })).toHaveCount(0)
    await lctx.close()
  })

  test('a new sign-in must pass the code before it can change access', async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ baseURL })
    const page = await ctx.newPage()
    await signIn(page, OWNER, '/admin')
    await page.goto('/admin/enrolments')
    await page.waitForURL(/\/admin\/mfa\?next=%2Fadmin%2Fenrolments/)
    await page.getByLabel('Code from your authenticator app').fill('123456')
    await page.getByRole('button', { name: 'Verify' }).click()
    await expect(page.getByText('That code is not right')).toBeVisible()

    // the code of the step used one test ago may be refused as already used; the next step is always fresh
    await page.getByLabel('Code from your authenticator app').fill(totp(secret, Date.now() + 30_000))
    await page.getByRole('button', { name: 'Verify' }).click()
    await page.waitForURL('**/admin/enrolments', { timeout: 15_000 }).catch(async () => {
      await page.getByLabel('Code from your authenticator app').fill(totp(secret))
      await page.getByRole('button', { name: 'Verify' }).click()
      await page.waitForURL('**/admin/enrolments')
    })
    await expect(page.getByRole('heading', { name: 'Enrolments' })).toBeVisible()
    await ctx.close()
  })

  test('open redirects through next are ignored', async ({ page }) => {
    await signIn(page, OWNER, '/admin')
    await page.goto('/admin/mfa?next=https%3A%2F%2Fevil.example%2F')
    expect(new URL(page.url()).origin).not.toContain('evil')
  })
})
