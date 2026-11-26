import { expect, test, type Page } from '@playwright/test'
import { PASSWORD, signIn } from './helpers'

// Slice 1 (plan/16 §11): navbar, log out, account area. Runs against a cloud DEV project (plan/14), never a client's.

const email = (tag: string) => `account-${tag}-${Date.now().toString(36)}@example.com`

async function openMenu(page: Page) {
  await page.getByRole('button', { name: /account menu/i }).click()
  await expect(page.locator('#au-acct')).toBeVisible()
}

test('signed-in navbar: account menu, Escape, and one-click Log out that ends the session', async ({ page }) => {
  const mail = email('menu')
  await signIn(page, mail, '/dashboard')

  await openMenu(page)
  const panel = page.locator('#au-acct')
  await expect(panel.getByText(mail)).toBeVisible()
  const links = await panel.getByRole('link').allInnerTexts()
  expect(links.slice(0, 3)).toEqual(['Profile', 'Subscription', 'Payments and receipts'])
  // Log out is the last item.
  const lastButton = panel.getByRole('button').last()
  await expect(lastButton).toHaveText(/Log out/)

  await page.keyboard.press('Escape')
  await expect(panel).toBeHidden()
  await expect(page.getByRole('button', { name: /account menu/i })).toBeFocused()

  await openMenu(page)
  await panel.getByRole('button', { name: 'Log out' }).click()
  await page.waitForURL((u) => u.pathname === '/' && u.searchParams.has('logged-out'))
  await expect(page.getByRole('status').filter({ hasText: 'You are logged out' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Log in' }).first()).toBeVisible()

  // The session is gone: protected pages send the visitor to the login page.
  await page.goto('/account')
  await expect(page).toHaveURL(/\/login\?next=%2Faccount/)
})

test('log out works from the phone menu', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await signIn(page, email('phone'), '/dashboard')
  await page.getByRole('button', { name: 'Menu' }).click()
  const menu = page.locator('#au-mnav')
  await expect(menu.getByText('Log out')).toBeVisible()
  await expect(menu.locator('.who')).toBeVisible()
  await menu.getByRole('button', { name: 'Log out' }).click()
  await page.waitForURL((u) => u.pathname === '/' && u.searchParams.has('logged-out'))
})

test('profile saves, validates the number, and reminders stay switched', async ({ page }) => {
  await signIn(page, email('profile'), '/account')
  await expect(page.getByRole('heading', { level: 1, name: 'Profile' })).toBeVisible()

  await page.getByLabel('WhatsApp number').fill('12345')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('Enter a 10-digit mobile number')).toBeVisible()

  await page.getByLabel('Full name').fill('Asha Verma')
  await page.getByLabel('WhatsApp number').fill('98765 43210')
  await page.getByLabel('City').fill('Pune')
  await page.getByLabel('Name on your certificate').fill('Asha R Verma')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Saved.' })).toBeVisible()

  await page.reload()
  await expect(page.getByLabel('Full name')).toHaveValue('Asha Verma')
  await expect(page.getByLabel('WhatsApp number')).toHaveValue('+919876543210')
  await expect(page.getByLabel('City')).toHaveValue('Pune')
  await expect(page.getByLabel('Name on your certificate')).toHaveValue('Asha R Verma')

  const sw = page.getByRole('switch', { name: 'New material by email' })
  await expect(sw).toHaveAttribute('aria-checked', 'false')
  await sw.click()
  await expect(sw).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('switch', { name: 'New material by email' })).toHaveAttribute('aria-checked', 'true')
})

test('subscription and payments answer plainly when nothing was bought; /orders moves to payments', async ({ page }) => {
  await signIn(page, email('empty'), '/account/subscription')
  await expect(page.getByRole('heading', { level: 1, name: 'Subscription' })).toBeVisible()
  await expect(page.getByText('You do not have access to a course yet.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Join the next batch' })).toBeVisible()

  await page.goto('/orders')
  await expect(page).toHaveURL(/\/account\/payments$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Payments and receipts' })).toBeVisible()
  await expect(page.getByText('You have not paid for anything yet.')).toBeVisible()
})

test('password: wrong current password is refused, a new one works and old sessions can be listed', async ({ page, browser }) => {
  const mail = email('pw')
  await signIn(page, mail, '/account/security')
  await expect(page.getByText('This device')).toBeVisible()

  await page.getByLabel('Current password').fill('not-the-password')
  await page.getByLabel('New password', { exact: true }).fill('a-new-password-1')
  await page.getByLabel('Type it again').fill('a-new-password-1')
  await page.getByRole('button', { name: 'Update password' }).click()
  await expect(page.getByText('That is not your current password.')).toBeVisible()

  // A second device signs in, then the first changes the password and ends it.
  const other = await browser.newPage()
  await other.goto('/login')
  await other.getByLabel('Email').fill(mail)
  await other.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await other.getByRole('button', { name: 'Log in', exact: true }).click()
  await other.waitForURL((u) => u.pathname !== '/login')

  await page.reload()
  await expect(page.getByRole('button', { name: /^Log out / }).first()).toBeVisible()

  await page.getByLabel('Current password').fill(PASSWORD)
  await page.getByLabel('New password', { exact: true }).fill('a-new-password-1')
  await page.getByLabel('Type it again').fill('a-new-password-1')
  await page.getByRole('button', { name: 'Update password' }).click()
  await expect(page.getByText('Password updated.')).toBeVisible()

  await page.reload()
  await expect(page.getByRole('button', { name: /^Log out / })).toHaveCount(0)
  await other.close()
})
