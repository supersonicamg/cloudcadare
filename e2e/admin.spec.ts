import { expect, test } from '@playwright/test'
import { signIn } from './helpers'

const OWNER = process.env.E2E_OWNER_EMAIL ?? 'founder@example.com'
const title = `AWS Solutions Architect ${Date.now().toString().slice(-5)}`

test.describe.serial('academy owner publishes a course', () => {
  test('a draft is invisible to visitors, then public after publishing', async ({ page, browser }) => {
    await signIn(page, OWNER, '/admin')
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible()

    await page.goto('/admin/courses')
    await page.getByLabel('Title').fill(title)
    await page.getByRole('button', { name: 'Create draft' }).click()
    await expect(page.getByRole('heading', { name: title })).toBeVisible()
    const editUrl = page.url()

    await page.getByLabel('Summary').fill('A hands-on path to the SAA-C03 exam.')
    await page.getByLabel('What learners will be able to do').fill('Design a multi-AZ VPC\nPick the right storage class')
    await page.waitForLoadState('networkidle') // let the form hydrate, or the click submits it as a plain GET
    await page.getByRole('button', { name: 'Save details' }).click()
    await expect(page.getByText('Saved.')).toBeVisible()

    await page.getByLabel('Label').fill('Month 1')
    await page.getByLabel('New section').fill('Identity and networking')
    await page.getByRole('button', { name: 'Add section' }).click()
    await expect(page.getByRole('heading', { name: /Identity and networking/ })).toBeVisible()
    await page.getByLabel('Lesson title').fill('IAM users, roles and policies')
    await page.getByLabel('Minutes', { exact: true }).fill('42')
    await page.getByLabel('Free preview').check()
    await page.getByRole('button', { name: 'Add lesson' }).click()
    await expect(page.getByText('IAM users, roles and policies')).toBeVisible()

    // anonymous visitor: the draft is not listed
    const anon = await browser.newContext({ baseURL: page.url().split('/admin')[0] })
    const visitor = await anon.newPage()
    await visitor.goto('/courses')
    await expect(visitor.getByText(title)).toHaveCount(0)

    await page.goto(editUrl)
    await page.getByRole('button', { name: 'Publish' }).click()
    await expect(page.getByText('Published', { exact: true })).toBeVisible()

    await visitor.goto('/courses')
    await expect(visitor.getByRole('heading', { name: title })).toBeVisible()
    await visitor.getByRole('link', { name: new RegExp(title) }).click()
    await expect(visitor.getByRole('heading', { level: 1, name: title })).toBeVisible()
    await expect(visitor.getByText('Design a multi-AZ VPC')).toBeVisible()
    await expect(visitor.getByText('IAM users, roles and policies')).toBeVisible()
    await expect(visitor.getByText('Free preview', { exact: true })).toBeVisible()
    await anon.close()
  })

  test('branding changes reach the public site', async ({ page, browser }) => {
    await signIn(page, OWNER, '/admin/branding')
    await page.getByLabel('Tagline').fill('Cloud careers, taught by people who run clouds.')
    await page.getByLabel('Main colour').fill('#1F4E8C')
    await page.getByRole('button', { name: 'Save branding' }).click()
    await expect(page.getByText(/^Saved\./)).toBeVisible()

    const anon = await browser.newContext({ baseURL: page.url().split('/admin')[0] })
    const visitor = await anon.newPage()
    await expect(async () => {
      await visitor.goto('/')
      await expect(visitor.getByText('Cloud careers, taught by people who run clouds.')).toBeVisible()
    }).toPass({ timeout: 15_000 })
    expect(await visitor.content()).toContain('--color-primary:#1F4E8C')
    await anon.close()
  })
})

test('a learner cannot see the admin area', async ({ page }) => {
  await signIn(page, `learner-${Date.now()}@example.com`, '/')
  const res = await page.goto('/admin')
  expect(res?.status()).toBe(404)
})
