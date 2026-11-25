import { test } from '@playwright/test'
import { createPublishedCourse, signUpAndConfirm, staffWithMfa } from './helpers'

// Screenshots of staff and learner screens for design review (1280 and 390 wide). Skipped unless SHOTS_DIR is set:
//   SHOTS_DIR=/tmp/shots E2E_BASE_URL=http://cloudcadre.localhost:3100 pnpm exec playwright test e2e/screens.spec.ts
// The page colours are previewed with CloudCadre's plan/15 §4 tokens (bg #FFFFFF, muted #F2F2EF) in the browser only.
const dir = process.env.SHOTS_DIR
const tokens = ':root{--color-bg:#FFFFFF;--color-muted:#F2F2EF;--color-fg:#14201F;--color-border:#E2E3DF}'
const stamp = Date.now().toString().slice(-6)

test.skip(!dir, 'set SHOTS_DIR to take screenshots')

test('staff and learner screens', async ({ page, browser }) => {
  test.setTimeout(240_000)
  const snap = async (p: typeof page, name: string, mobile = false) => {
    await p.addStyleTag({ content: tokens })
    await p.waitForTimeout(500)
    await p.screenshot({ path: `${dir}/${name}${mobile ? '.m' : ''}.png`, fullPage: true })
  }

  // ---- staff: D2
  await staffWithMfa(page)
  const title = `Screens Course ${stamp}`
  await createPublishedCourse(page, title)
  await page.goto('/admin/learner-list')
  await page.getByRole('combobox', { name: 'Course' }).selectOption({ label: title })
  await page.getByRole('textbox', { name: 'Emails' }).fill(`anita.desai-${stamp}@example.com, Anita Desai\nvikram.s-${stamp}@example.com\nrohit@gmailcom\nshots-${stamp}@example.com, Shots Learner`)
  await page.getByRole('button', { name: 'Add to list' }).click()
  await page.getByText('added to the list').waitFor()
  await snap(page, 'd2-list')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/admin/learner-list')
  await snap(page, 'd2-list', true)

  // ---- learner on the list: A4
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const l = await ctx.newPage()
  await signUpAndConfirm(l, `shots-${stamp}@example.com`, 'Shots Learner')
  await l.waitForURL((u) => u.pathname === '/welcome-back')
  await snap(l, 'a4-welcome')
  await l.setViewportSize({ width: 390, height: 844 })
  await snap(l, 'a4-welcome', true)
  await l.goto('/account/subscription')
  await snap(l, 'c3-subscription-listed')
  await ctx.close()
})
