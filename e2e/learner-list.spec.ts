import { expect, test } from '@playwright/test'
import { createPublishedCourse, signUpAndConfirm, staffWithMfa } from './helpers'

// Slice 3 (plan/16 §11): sign up -> confirm -> listed email -> "Join my batch now" -> the course opens; an unlisted email
// is not let in; staff see every outcome of an add. Staff here is a throwaway account, never the real owner.
const stamp = Date.now().toString().slice(-6)
const title = `List Course ${stamp}`
const listed = `listed-${stamp}@example.com`
const stranger = `stranger-${stamp}@example.com`

test('a listed email gets the course after confirming; an unlisted one does not', async ({ page, browser }) => {
  test.setTimeout(180_000)
  await staffWithMfa(page)
  await createPublishedCourse(page, title)

  // Staff add: one good address typed messily, one that looks wrong, one repeated.
  await page.goto('/admin/learner-list')
  await expect(page.getByRole('heading', { level: 1, name: 'Learner list' })).toBeVisible()
  await page.getByRole('combobox', { name: 'Course' }).selectOption({ label: title })
  await page.getByRole('textbox', { name: 'Emails' }).fill(`  ${listed.toUpperCase()} , Listed Learner\nrohit@gmailcom\n${listed}`)
  await expect(page.getByRole('status').filter({ hasText: 'Check before adding' })).toContainText('1 will be added')
  await page.getByRole('button', { name: 'Add to list' }).click()
  const done = page.getByRole('status').filter({ hasText: 'added to the list' })
  await expect(done).toContainText('1 added to the list')
  await expect(done).toContainText('Look wrong, not added: 1')
  await expect(done).toContainText('Repeated in your paste: 1')
  await page.reload()
  await expect(page.getByRole('link', { name: /Waiting/ })).toContainText(/[1-9]/)
  await expect(page.getByText('Listed Learner').first()).toBeVisible()

  // The listed learner signs up, confirms, and is offered their batch; pressing the button gives access.
  const learner = await (await browser.newContext()).newPage()
  await signUpAndConfirm(learner, listed, 'Listed Learner')
  await learner.waitForURL((u) => u.pathname === '/dashboard')
  await expect(learner.getByRole('heading', { level: 1, name: /Hi Listed, which batch are you in/ })).toBeVisible()
  await learner.reload() // reading the page changes nothing
  await learner.getByRole('button', { name: /Join my batch now/ }).click()
  await learner.waitForURL((u) => u.pathname === '/dashboard' && u.searchParams.get('joined') === '1')
  await expect(learner.getByRole('heading', { level: 1, name: /Welcome, Listed/ })).toBeVisible()
  await learner.goto('/account/subscription')
  await expect(learner.getByText('Added by CloudCadre. Your email was on our learner list')).toBeVisible()
  await learner.close()

  // Someone else is not on the list: no welcome, no access.
  const other = await (await browser.newContext()).newPage()
  await signUpAndConfirm(other, stranger, 'Stranger')
  await other.waitForURL((u) => u.pathname === '/dashboard')
  await other.goto(`/learn/${title.toLowerCase().replace(/\s+/g, '-')}`)
  await expect(other.getByRole('heading', { name: title })).toHaveCount(0)
  await other.close()

  // Staff now see the row as claimed and cannot remove it.
  await page.goto('/admin/learner-list?status=claimed')
  await expect(page.getByText(listed)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Remove' })).toHaveCount(0)
})
