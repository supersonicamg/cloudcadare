import { expect, test } from '@playwright/test'
import { PASSWORD } from './helpers'

test('a new learner creates an account, then signs in again with the same password', async ({ page }) => {
  const email = `e2e-${Date.now()}@example.com`

  await page.goto('/signup')
  await page.getByLabel('Full name').fill('E2e Learner')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('WhatsApp number').fill('98765 43210')
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Create account' }).click()

  await page.waitForURL((u) => u.pathname === '/')
  expect((await page.context().cookies()).some((c) => c.name.includes('auth-token'))).toBe(true)

  await page.context().clearCookies()
  await page.goto('/login?next=%2Flearn')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL((u) => u.pathname === '/learn')
})

test('a wrong password is rejected without saying whether the account exists', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill(`e2e-nobody-${Date.now()}@example.com`)
  await page.getByLabel('Password', { exact: true }).fill('not-the-password')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByText('Wrong email or password.')).toBeVisible()
})

test('a bad WhatsApp number is refused and the rest of the form is kept', async ({ page }) => {
  await page.goto('/signup')
  await page.getByLabel('Full name').fill('E2e Learner')
  await page.getByLabel('Email').fill(`e2e-wa-${Date.now()}@example.com`)
  await page.getByLabel('WhatsApp number').fill('12345')
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByText('Enter a 10-digit mobile number')).toBeVisible()
  await expect(page.getByLabel('Full name')).toHaveValue('E2e Learner')
})

test('a protected path redirects to login with the original path preserved', async ({ page }) => {
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/login\?next=%2Fadmin/)
})
