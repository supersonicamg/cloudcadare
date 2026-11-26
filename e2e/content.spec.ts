import { expect, test, type Page } from '@playwright/test'
import { signIn } from './helpers'

// Phase 1 slice 5: ordering, file lessons with uploads, free previews, sequential and drip unlock.
const OWNER = process.env.E2E_OWNER_EMAIL ?? 'founder@example.com'
const stamp = Date.now().toString().slice(-6)
const title = `Ordered Course ${stamp}`
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF')
const ids: Record<string, string> = {}
let slug = ''
let editUrl = ''

const saved = (page: Page) => page.getByText('Saved.').filter({ visible: true })

async function addLesson(page: Page, name: string, type: 'Reading' | 'PDF' | 'Download', preview = false) {
  await page.getByLabel('Lesson title').fill(name)
  await page.getByLabel('Type').selectOption({ label: type })
  if (preview) await page.getByLabel('Free preview', { exact: true }).check()
  else await page.getByLabel('Free preview', { exact: true }).uncheck()
  await page.getByRole('button', { name: 'Add lesson' }).click()
  await expect(page.getByRole('link', { name })).toBeVisible()
  ids[name] = (await page.getByRole('link', { name }).getAttribute('href'))!.split('/').pop()!
}

async function openLesson(page: Page, name: string) {
  await page.goto(editUrl)
  await page.getByRole('link', { name, exact: true }).click()
  await page.waitForURL(/\/lessons\//)
}

const order = async (page: Page) => (await page.locator('main li a[href*="/lessons/"]').allInnerTexts()).map((t) => t.trim())

test.describe.serial('files, previews, ordering and unlock rules', () => {
  test.setTimeout(150_000)

  test('owner builds a sequential course with files, a drip lesson and previews', async ({ page }) => {
    await signIn(page, OWNER, '/admin')
    await page.goto('/admin/courses')
    await page.getByLabel('Title').fill(title)
    await page.getByRole('button', { name: 'Create draft' }).click()
    await expect(page.getByRole('heading', { name: title })).toBeVisible()
    editUrl = page.url()
    await page.getByLabel('Anyone with an account can enrol for free').check()
    await page.getByLabel('Learners must finish lessons in order').check()
    await page.waitForLoadState('networkidle') // let the form hydrate, or the click submits it as a plain GET
    await page.getByRole('button', { name: 'Save details' }).click()
    await expect(saved(page)).toBeVisible()

    await page.getByLabel('New section').fill('Module')
    await page.getByRole('button', { name: 'Add section' }).click()
    await expect(page.getByRole('heading', { name: /Module/ })).toBeVisible()
    await addLesson(page, 'Alpha', 'Reading', true)
    await addLesson(page, 'Beta', 'Reading')
    await addLesson(page, 'Gamma', 'Reading')
    await addLesson(page, 'Slides', 'PDF', true)
    await addLesson(page, 'Handout', 'Download')
    await addLesson(page, 'Later', 'Reading')
    expect(await order(page)).toEqual(['Alpha', 'Beta', 'Gamma', 'Slides', 'Handout', 'Later'])

    // ordering: Gamma above Beta
    await page.getByRole('button', { name: 'Move Gamma up' }).click()
    await expect.poll(() => order(page)).toEqual(['Alpha', 'Gamma', 'Beta', 'Slides', 'Handout', 'Later'])
    await page.reload()
    expect(await order(page)).toEqual(['Alpha', 'Gamma', 'Beta', 'Slides', 'Handout', 'Later'])

    await openLesson(page, 'Alpha')
    await page.getByLabel('Reading', { exact: true }).fill('## Welcome\n\nThis is the free first lesson.')
    await page.getByRole('button', { name: 'Save lesson' }).click()
    await expect(saved(page)).toBeVisible()

    await openLesson(page, 'Later')
    await page.getByLabel('Opens after (days)').fill('7')
    await page.getByRole('button', { name: 'Save lesson' }).click()
    await expect(saved(page)).toBeVisible()
    await page.getByLabel('Opens after (days)').fill('-2')
    await page.getByRole('button', { name: 'Save lesson' }).click()
    await expect(page.getByText('Days must be a whole number')).toBeVisible()

    // files: the wrong kind is refused, the right one is attached
    await openLesson(page, 'Slides')
    await page.getByLabel('File to upload').setInputFiles({ name: 'run.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('MZ') })
    await page.getByRole('button', { name: 'Upload file' }).click()
    await expect(page.getByText('That kind of file is not allowed here')).toBeVisible()
    await page.getByLabel('File to upload').setInputFiles({ name: 'week-one.pdf', mimeType: 'application/pdf', buffer: PDF })
    await page.getByRole('button', { name: 'Upload file' }).click()
    await expect(page.getByText('Uploaded.')).toBeVisible()
    await expect(page.getByTestId('current-file')).toContainText('week-one.pdf')

    await openLesson(page, 'Handout')
    await page.getByLabel('File to upload').setInputFiles({ name: 'cheatsheet.txt', mimeType: 'text/plain', buffer: Buffer.from('remember to tag everything') })
    await page.getByRole('button', { name: 'Upload file' }).click()
    await expect(page.getByText('Uploaded.')).toBeVisible()

    await page.goto(editUrl)
    await page.getByRole('button', { name: 'Publish' }).click()
    await expect(page.getByText('Published', { exact: true })).toBeVisible()
    slug = (await page.getByRole('link', { name: 'View public page' }).getAttribute('href'))!.replace('/courses/', '')
  })

  test('a visitor opens free previews without signing in, and nothing else', async ({ page, browser, baseURL }) => {
    await page.goto(`/courses/${slug}`)
    await expect(page.getByRole('link', { name: 'Beta' })).toHaveCount(0) // only previews are links
    await page.getByRole('link', { name: 'Alpha' }).click()
    await expect(page.getByTestId('preview-banner')).toContainText(title)
    await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible()

    await page.goto(`/courses/${slug}`)
    await page.getByRole('link', { name: 'Slides' }).click()
    await expect(page.locator('iframe')).toHaveAttribute('src', `/api/lesson-file/${ids.Slides}`)

    const anon = await browser.newContext({ baseURL })
    const file = await anon.request.get(`/api/lesson-file/${ids.Slides}`, { maxRedirects: 0 })
    expect(file.status()).toBe(302)
    const signed = await anon.request.get(file.headers().location!)
    expect(signed.status()).toBe(200)
    expect(signed.headers()['content-type']).toContain('application/pdf')
    // a file that is not a preview is not served, and neither is a made-up lesson or someone else's preview URL
    expect((await anon.request.get(`/api/lesson-file/${ids.Handout}`, { maxRedirects: 0 })).status()).toBe(401)
    expect((await anon.request.get('/api/lesson-file/00000000-0000-4000-8000-000000000000', { maxRedirects: 0 })).status()).toBe(401)
    expect((await anon.request.get(`/courses/${slug}/preview/${ids.Beta}`)).status()).toBe(404)
    await anon.close()
  })

  test('a learner is held to the order, can download, and unlocks the next lesson by finishing one', async ({ page }) => {
    await signIn(page, `ordered-${stamp}@example.com`, `/courses/${slug}`)
    await page.getByRole('button', { name: 'Enrol for free' }).first().click()
    await page.waitForURL(/\/(dashboard|learn)/)
    await page.goto(`/learn/${slug}`)
    const locked = page.locator('[data-locked]').filter({ visible: true })
    await expect(locked).toHaveCount(5) // everything after Alpha
    await expect(page.locator('[data-locked]', { hasText: 'Later' }).filter({ visible: true })).toContainText('Opens')

    // a hand-made request cannot skip ahead either
    expect((await page.request.post('/api/progress', { data: { lessonId: ids.Gamma, complete: true } })).status()).toBe(409)
    await page.goto(`/learn/${slug}/${ids.Gamma}`)
    await expect(page.getByText('This course is taken in order.')).toBeVisible()
    await page.getByRole('link', { name: 'Alpha' }).first().click()
    await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible()
    await expect(page.getByText('Completed', { exact: true }).filter({ visible: true })).toBeVisible()

    await page.goto(`/learn/${slug}`)
    await expect(page.locator('[data-locked]').filter({ visible: true })).toHaveCount(4)
    await page.getByRole('link', { name: /Gamma/ }).first().click()
    await expect(page.getByText('This course is taken in order.')).toHaveCount(0)
    await expect(page.getByText('Completed', { exact: true }).filter({ visible: true })).toBeVisible()
    await page.goto(`/learn/${slug}/${ids.Beta}`)
    await expect(page.getByText('Completed', { exact: true }).filter({ visible: true })).toBeVisible()

    // the PDF lesson shows the file; the download lesson hands nothing out
    await page.goto(`/learn/${slug}/${ids.Slides}`)
    await expect(page.locator('.pdfr, .pdfr-fallback')).toBeVisible()
    await expect(page.getByRole('link', { name: /download/i })).toHaveCount(0)
    await page.goto(`/learn/${slug}/${ids.Handout}`)
    await expect(page.getByTestId('download-link')).toHaveCount(0)
    await expect(page.getByText('Course files are not offered for download.')).toBeVisible()
    expect((await page.request.get(`/api/lesson-file/${ids.Handout}?download=1`, { maxRedirects: 0 })).status()).toBe(404)
  })

  test('someone who is not enrolled cannot get a lesson file', async ({ page }) => {
    await signIn(page, `outsider-${stamp}@example.com`, '/courses')
    expect((await page.request.get(`/api/lesson-file/${ids.Handout}`, { maxRedirects: 0 })).status()).toBe(404)
  })
})
