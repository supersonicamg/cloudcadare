import { expect, test, type Page } from '@playwright/test'
import { signIn, waitForMail } from './helpers'

// Phase 1 slice 7: progress page, leaderboard, certificate (print page, public check, revoke), and the emails.
const OWNER = process.env.E2E_OWNER_EMAIL ?? 'founder@example.com'
const stamp = Date.now().toString().slice(-6)
const title = `Certified Course ${stamp}`
const learner = `certified-${stamp}@example.com`
let slug = ''
let code = ''
const saved = (page: Page) => page.getByText('Saved.').filter({ visible: true })

test.describe.serial('progress, certificates and email', () => {
  test.setTimeout(120_000)

  test('owner publishes a short open course', async ({ page }) => {
    await signIn(page, OWNER, '/admin')
    await page.goto('/admin/courses')
    await page.getByLabel('Title').fill(title)
    await page.getByRole('button', { name: 'Create draft' }).click()
    await expect(page.getByRole('heading', { name: title })).toBeVisible()
    await page.getByLabel('Anyone with an account can enrol for free').check()
    await expect(page.getByLabel('Give learners a certificate when they complete the course')).toBeChecked()
    await page.waitForLoadState('networkidle') // let the form hydrate, or the click submits it as a plain GET
    await page.getByRole('button', { name: 'Save details' }).click()
    await expect(saved(page)).toBeVisible()
    await page.getByLabel('New section').fill('Basics')
    await page.getByRole('button', { name: 'Add section' }).click()
    await expect(page.getByRole('heading', { name: /Basics/ })).toBeVisible()
    for (const name of ['Part one', 'Part two']) {
      await page.getByLabel('Lesson title').fill(name)
      await page.getByLabel('Type').selectOption({ label: 'Reading' })
      await page.getByRole('button', { name: 'Add lesson' }).click()
      await expect(page.getByRole('link', { name })).toBeVisible()
    }
    await page.getByRole('button', { name: 'Publish' }).click()
    await expect(page.getByText('Published', { exact: true })).toBeVisible()
    slug = (await page.getByRole('link', { name: 'View public page' }).getAttribute('href'))!.replace('/courses/', '')
  })

  test('finishing the course earns XP, a place on the leaderboard and a certificate', async ({ page }) => {
    await signIn(page, learner, `/courses/${slug}`)
    await page.getByRole('button', { name: 'Enrol for free' }).first().click()
    await page.waitForURL(/\/(dashboard|learn)/)
    await page.goto(`/learn/${slug}`)
    for (const name of ['Part one', 'Part two']) {
      await page.goto(`/learn/${slug}`)
      await page.getByRole('link', { name: new RegExp(name) }).first().click()
      await expect(page.getByText('Completed', { exact: true }).filter({ visible: true })).toBeVisible()
    }
    await page.goto(`/learn/${slug}`)
    await expect(page.getByText('Course completed')).toBeVisible()

    await page.goto('/learn')
    await page.getByRole('link', { name: 'Progress' }).click()
    await expect(page.getByRole('heading', { name: 'My progress' })).toBeVisible()
    await expect(page.getByTestId('xp-total')).toHaveText('100')
    await expect(page.getByTestId('level-name')).toHaveText('Cloud Explorer')
    await expect(page.getByTestId('streak')).toHaveText('1')
    await expect(page.getByText('700 XP to Practitioner')).toBeVisible()
    await expect(page.locator('[data-earned="no"]').first()).toBeVisible() // badges not earned yet are listed, not hidden

    await page.getByRole('link', { name: 'All time' }).click()
    // on a busy board the learner may be below the top ten: then the page says where they are instead
    const inTop = page.getByTestId('leaderboard').getByRole('listitem').filter({ hasText: '(you)' })
    // a board is recomputed when it is more than a minute old, so right after another run it can lag: reload until it catches up
    await expect(async () => {
      await page.reload()
      await expect(inTop.or(page.getByText(/You are #\d+ with 100 XP/))).toBeVisible({ timeout: 2_000 })
    }).toPass({ timeout: 80_000, intervals: [3_000] })

    await page.getByRole('link', { name: 'Certificates' }).click()
    await page.getByRole('link', { name: 'View' }).first().click()
    await expect(page.getByTestId('cert-title')).toHaveText(title)
    await expect(page.getByTestId('cert-name')).not.toBeEmpty()
    const verifyLine = await page.getByText(/^Verify at /).innerText()
    code = verifyLine.match(/\/verify\/([A-Z0-9]{12})/)![1]!
  })

  test('anyone can check the certificate, and a wrong code says so', async ({ page, browser, baseURL }) => {
    const anon = await browser.newContext({ baseURL })
    const p = await anon.newPage()
    await p.goto(`/verify/${code}`)
    await expect(p.getByTestId('verify-result')).toHaveText('This certificate is genuine.')
    await expect(p.getByText(title)).toBeVisible()
    await p.goto(`/verify/${code.toLowerCase()}`)
    await expect(p.getByTestId('verify-result')).toHaveText('This certificate is genuine.')
    await p.goto('/verify/AAAAAAAAAAAA')
    await expect(p.getByTestId('verify-result')).toContainText('No certificate found for this code')
    expect((await p.goto('/verify/short'))?.status()).toBe(404)
    // the page shows what a verifier needs, not the learner's email
    await p.goto(`/verify/${code}`)
    expect(await p.content()).not.toContain(learner)
    await anon.close()
    void page
  })

  test('the learner is emailed the certificate', async () => {
    const mail = await waitForMail(learner, `Your certificate for ${title}`)
    expect(mail).toContain(`/certificates/`)
    expect(mail).toContain(`/verify/${code}`)
  })

  test('the owner revokes it and the public check says so', async ({ page, browser, baseURL }) => {
    await signIn(page, OWNER, '/admin/certificates')
    const row = page.getByRole('listitem').filter({ hasText: code })
    await row.getByLabel(/Reason to revoke/).fill('Issued by mistake')
    await row.getByRole('button', { name: 'Revoke' }).click()
    await expect(page.getByRole('listitem').filter({ hasText: code })).toContainText('revoked: Issued by mistake')
    const anon = await browser.newContext({ baseURL })
    const p = await anon.newPage()
    await p.goto(`/verify/${code}`)
    await expect(p.getByTestId('verify-result')).toHaveText('This certificate has been revoked.')
    await anon.close()
  })
})
