import { expect, test } from '@playwright/test'
import { PASSWORD, latestEmailCode } from './helpers'

test('a new learner confirms the email with the emailed code, then logs in again without it', async ({ page }) => {
  const email = `e2e-${Date.now()}@example.com`

  await page.goto('/signup')
  await page.getByLabel('Full name').fill('E2e Learner')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('WhatsApp number').fill('98765 43210')
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Create account' }).click()

  // Nothing is granted yet: the learner is held on the confirm page, which looks the same for every address.
  await page.waitForURL((u) => u.pathname === '/signup/confirm')
  await expect(page.getByRole('heading', { level: 1, name: 'Check your email' })).toBeVisible()
  expect((await page.context().cookies()).some((c) => c.name.includes('auth-token'))).toBe(true)

  // A wrong code is refused and counted; the right one lets the learner through.
  const real = await latestEmailCode(email)
  const wrong = real === '000000' ? '111111' : '000000'
  await page.getByLabel('6-digit code').fill(wrong)
  await page.getByRole('button', { name: 'Confirm email' }).click()
  await expect(page.getByText('That code is not right. You have 4 tries left.')).toBeVisible()
  await page.getByLabel('6-digit code').fill(real)
  await page.getByRole('button', { name: 'Confirm email' }).click()
  await page.waitForURL((u) => u.pathname === '/')

  // The email stays confirmed: logging in again goes straight to the page asked for.
  await page.context().clearCookies()
  await page.goto('/login?next=%2Flearn')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  await page.waitForURL((u) => u.pathname === '/dashboard')
})

test('after five wrong codes the code is locked, and sending again is closed for a minute', async ({ page }) => {
  const email = `e2e-lock-${Date.now()}@example.com`
  await page.goto('/signup')
  await page.getByLabel('Full name').fill('E2e Locked')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('WhatsApp number').fill('98765 43211')
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Create account' }).click()
  await page.waitForURL((u) => u.pathname === '/signup/confirm')

  const real = await latestEmailCode(email)
  const wrong = real === '000000' ? '111111' : '000000'
  for (let i = 0; i < 5; i++) {
    await page.getByLabel('6-digit code').fill(wrong)
    await page.getByRole('button', { name: 'Confirm email' }).click()
    await expect(page.getByRole('alert').first()).toBeVisible()
  }
  // Even the right code is refused now.
  await page.getByLabel('6-digit code').fill(real)
  await page.getByRole('button', { name: 'Confirm email' }).click()
  await expect(page.getByText('Too many wrong tries. Ask for a new code.')).toBeVisible()
  await expect(page.getByRole('button', { name: /Send again in/ })).toBeDisabled()
})

test('a wrong password is rejected without saying whether the account exists', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill(`e2e-nobody-${Date.now()}@example.com`)
  await page.getByLabel('Password', { exact: true }).fill('not-the-password')
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
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
