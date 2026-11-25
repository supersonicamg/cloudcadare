import { expect, test, type Page } from '@playwright/test'
import { signIn } from './helpers'

const OWNER = process.env.E2E_OWNER_EMAIL ?? 'founder@example.com'
const stamp = Date.now().toString().slice(-6)
const openTitle = `Cloud Basics ${stamp}`
const closedTitle = `Closed Cohort ${stamp}`
const closedSlug = `closed-cohort-${stamp}`
let openSlug = ''

// Next keeps previously visited routes mounted but hidden, so match only what the user can see.
const completed = (page: Page) => page.getByText('Completed', { exact: true }).filter({ visible: true })
const saved = (page: Page) => page.getByText('Saved.').filter({ visible: true })

async function createCourse(page: Page, title: string) {
  await page.goto('/admin/courses')
  await page.getByLabel('Title').fill(title)
  await page.getByRole('button', { name: 'Create draft' }).click()
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
}

async function addLesson(page: Page, title: string, type: 'Video' | 'Reading') {
  await page.getByLabel('Lesson title').fill(title)
  await page.getByLabel('Type').selectOption({ label: type })
  await page.getByRole('button', { name: 'Add lesson' }).click()
  await expect(page.getByRole('link', { name: title })).toBeVisible()
}

test.describe.serial('free enrolment and learning', () => {
  test('owner builds an open course and a closed one', async ({ page }) => {
    await signIn(page, OWNER, '/admin')

    // Closed: published, but nobody can enrol.
    await createCourse(page, closedTitle)
    const closedEdit = page.url()
    await page.getByRole('button', { name: 'Publish' }).click()
    await expect(page.getByText('Published', { exact: true })).toBeVisible()
    expect(closedEdit).toContain('/admin/courses/')

    // Open: two readings and a video.
    await createCourse(page, openTitle)
    const editUrl = page.url()
    await page.getByLabel('Anyone with an account can enrol for free').check()
    await page.waitForLoadState('networkidle') // let the form hydrate, or the click submits it as a plain GET
    await page.getByRole('button', { name: 'Save details' }).click()
    await expect(saved(page)).toBeVisible()

    await page.getByLabel('Label').fill('Week 1')
    await page.getByLabel('New section').fill('Getting oriented')
    await page.getByRole('button', { name: 'Add section' }).click()
    await expect(page.getByRole('heading', { name: /Getting oriented/ })).toBeVisible()

    await addLesson(page, 'Welcome to the course', 'Reading')
    await addLesson(page, 'Shared responsibility', 'Reading')
    await addLesson(page, 'Console tour', 'Video')

    await page.getByRole('link', { name: 'Welcome to the course' }).click()
    await page.waitForURL(/\/lessons\//)
    await page.getByLabel('Reading', { exact: true }).fill('## Why this matters\n\nYou will learn the **shared responsibility model**.\n\n<script>window.pwned = 1</script>')
    await page.getByRole('button', { name: 'Save lesson' }).click()
    await expect(saved(page)).toBeVisible()

    await page.goto(editUrl)
    await page.getByRole('link', { name: 'Shared responsibility' }).click()
    await page.waitForURL(/\/lessons\//)
    await page.getByLabel('Reading', { exact: true }).fill('The provider secures the cloud; you secure what you put in it.')
    await page.getByRole('button', { name: 'Save lesson' }).click()
    await expect(saved(page)).toBeVisible()

    await page.goto(editUrl)
    await page.getByRole('link', { name: 'Console tour' }).click()
    await page.waitForURL(/\/lessons\//)
    await page.getByLabel('Source').selectOption('url')
    await page.getByLabel('Link or ID').fill('http://insecure.example.com/tour.mp4')
    await page.getByRole('button', { name: 'Save lesson' }).click()
    await expect(page.getByText('That video address is not valid')).toBeVisible()
    await page.getByLabel('Link or ID').fill('https://cdn.example.com/tour.mp4')
    await page.getByRole('button', { name: 'Save lesson' }).click()
    await expect(saved(page)).toBeVisible()
    await expect(page.getByText('Current video:')).toBeVisible()

    await page.goto(editUrl)
    await page.getByRole('button', { name: 'Publish' }).click()
    await expect(page.getByText('Published', { exact: true })).toBeVisible()
    openSlug = (await page.getByRole('link', { name: 'View public page' }).getAttribute('href'))!.replace('/courses/', '')
  })

  test('a visitor cannot enrol in a closed course', async ({ page }) => {
    await page.goto(`/courses/${closedSlug}`)
    await expect(page.getByRole('button', { name: 'Enrolment opens soon' }).first()).toBeDisabled()
    await page.goto(`/courses/${openSlug}`)
    await expect(page.getByRole('link', { name: /Sign in to start/ }).first()).toBeVisible()
  })

  test('a learner enrols, reads, and sees progress', async ({ page }) => {
    await signIn(page, `learner-${stamp}@example.com`, `/courses/${openSlug}`)
    await page.getByRole('button', { name: 'Enrol for free' }).first().click()
    await page.waitForURL(`**/learn/${openSlug}`)
    await expect(page.getByRole('heading', { level: 1, name: openTitle })).toBeVisible()
    await expect(page.getByText('0 of 3 lessons', { exact: true })).toBeVisible()

    await page.getByRole('link', { name: 'Start' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Welcome to the course' })).toBeVisible()
    await expect(page.locator('strong', { hasText: 'shared responsibility model' })).toBeVisible()
    // staff-written markdown is rendered, never executed
    expect(await page.evaluate(() => (window as unknown as { pwned?: number }).pwned)).toBeUndefined()
    await expect(completed(page)).toBeVisible()

    await page.getByRole('navigation', { name: 'Lesson navigation' }).getByRole('link', { name: /Shared responsibility/ }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Shared responsibility' })).toBeVisible()
    await expect(completed(page)).toBeVisible()

    await page.getByRole('navigation', { name: 'Lesson navigation' }).getByRole('link', { name: /Console tour/ }).click()
    await expect(page.locator('video')).toBeVisible()
    await expect(completed(page)).toHaveCount(0)
    const videoLessonId = page.url().split('/').pop()!

    await page.goto(`/learn/${openSlug}`)
    await expect(page.getByText('of 3 lessons · 67%')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Continue' })).toBeVisible()

    await page.goto('/learn')
    await expect(page.getByRole('heading', { name: openTitle })).toBeVisible()
    await expect(page.getByText('of 3 lessons · 67%')).toBeVisible()

    // What the player sends: a heartbeat at 50 % does not complete a video, 95 % does (the lesson rule is 90 %).
    const beat = (data: object) => page.request.post('/api/progress', { data: { lessonId: videoLessonId, ...data } })
    expect(await (await beat({ position: 60, delta: 15, pct: 50 })).json()).toMatchObject({ tracked: true, completed: false })
    expect(await (await beat({ position: 114, delta: 54, pct: 95 })).json()).toMatchObject({ completed: true, newly_completed: true, course_progress_pct: 100 })
    await page.goto('/learn')
    await expect(page.getByText('Completed · 100%')).toBeVisible()
    await page.goto(`/learn/${openSlug}`)
    await expect(page.getByText('Course completed · 100%')).toBeVisible()
  })

  test('a learner cannot reach a course they are not enrolled in', async ({ page }) => {
    await signIn(page, `learner-${stamp}@example.com`, '/dashboard')
    expect((await page.goto(`/learn/${closedSlug}`))?.status()).toBe(404)
  })

  test('progress cannot be posted cross-site or signed out', async ({ browser, baseURL }) => {
    const anon = await browser.newContext({ baseURL })
    const body = { lessonId: '00000000-0000-4000-8000-000000000000', delta: 5 }
    const signedOut = await anon.request.post('/api/progress', { data: body })
    expect(signedOut.status()).toBe(401)
    const crossSite = await anon.request.post('/api/progress', { data: body, headers: { origin: 'https://evil.example' } })
    expect(crossSite.status()).toBe(403)
    expect((await anon.request.post('/api/progress', { data: { nope: true } })).status()).toBe(400)
    await anon.close()
  })
})
