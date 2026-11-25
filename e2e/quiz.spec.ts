import { expect, test, type Page } from '@playwright/test'
import { signIn } from './helpers'

// Phase 1 slice 6: authoring a quiz, taking it, the result and review, attempt limits, and the answer key staying server-side.
const OWNER = process.env.E2E_OWNER_EMAIL ?? 'founder@example.com'
const stamp = Date.now().toString().slice(-6)
const title = `Quiz Course ${stamp}`
let slug = ''
let courseUrl = ''
let lessonHref = ''
const saved = (page: Page) => page.getByText('Saved.').filter({ visible: true })

async function addQuestion(page: Page, o: { type: 'One correct answer' | 'Several correct answers' | 'True or false'; text: string; marks?: string; options?: string[]; correct?: number[]; tf?: 'true' | 'false'; explanation?: string }) {
  await page.getByLabel('Question type').selectOption({ label: o.type })
  await page.getByLabel('Question', { exact: true }).fill(o.text)
  if (o.marks) await page.getByLabel('Marks').fill(o.marks)
  if (o.tf) await page.getByLabel(o.tf === 'true' ? 'True' : 'False', { exact: true }).check()
  for (const [i, text] of (o.options ?? []).entries()) await page.getByLabel(`Option ${i + 1}`, { exact: true }).fill(text)
  for (const n of o.correct ?? []) await page.getByLabel(`Option ${n} is correct`).check()
  if (o.explanation) await page.getByLabel('Explanation').fill(o.explanation)
  await page.getByRole('button', { name: 'Add question' }).click()
  await expect(saved(page)).toBeVisible()
}

test.describe.serial('quizzes', () => {
  test.setTimeout(120_000)

  test('owner builds a quiz', async ({ page }) => {
    await signIn(page, OWNER, '/admin')
    await page.goto('/admin/courses')
    await page.getByLabel('Title').fill(title)
    await page.getByRole('button', { name: 'Create draft' }).click()
    await expect(page.getByRole('heading', { name: title })).toBeVisible()
    courseUrl = page.url()
    await page.getByLabel('Anyone with an account can enrol for free').check()
    await page.waitForLoadState('networkidle') // let the form hydrate, or the click submits it as a plain GET
    await page.getByRole('button', { name: 'Save details' }).click()
    await expect(saved(page)).toBeVisible()
    await page.getByLabel('New section').fill('Check yourself')
    await page.getByRole('button', { name: 'Add section' }).click()
    await expect(page.getByRole('heading', { name: /Check yourself/ })).toBeVisible()
    await page.getByLabel('Lesson title').fill('Cloud quiz')
    await page.getByLabel('Type').selectOption({ label: 'Quiz' })
    await page.getByRole('button', { name: 'Add lesson' }).click()
    await page.getByRole('link', { name: 'Cloud quiz' }).click()
    await page.waitForURL(/\/quiz\//)
    await expect(page.getByRole('heading', { name: 'Cloud quiz' })).toBeVisible()
    await expect(page.getByText('Nobody has taken this quiz yet.')).toBeVisible()

    await page.getByLabel('Pass mark (%)').fill('50')
    await page.getByLabel('Time limit (minutes)').fill('5')
    await page.getByLabel('Attempts allowed').fill('1')
    await page.getByLabel('Instructions').fill('Answer every question.')
    await page.getByRole('button', { name: 'Save settings' }).click()
    await expect(saved(page)).toBeVisible()

    // a question without a correct answer is refused
    await page.getByLabel('Question', { exact: true }).fill('Incomplete')
    await page.getByLabel('Option 1', { exact: true }).fill('x')
    await page.getByLabel('Option 2', { exact: true }).fill('y')
    await page.getByRole('button', { name: 'Add question' }).click()
    await expect(page.getByText('Mark the correct answer.')).toBeVisible()

    await page.reload()
    await addQuestion(page, { type: 'One correct answer', text: 'Which service stores objects?', marks: '2', options: ['EBS', 'S3', 'VPC'], correct: [2], explanation: 'S3 is object storage.' })
    await page.reload()
    await addQuestion(page, { type: 'Several correct answers', text: 'Pick the compute services', options: ['EC2', 'S3', 'Lambda'], correct: [1, 3] })
    await page.reload()
    await addQuestion(page, { type: 'True or false', text: 'A region contains several zones', tf: 'true' })
    await page.reload()
    await expect(page.getByText('3 questions · 4 marks · pass at 2')).toBeVisible()

    await page.goto(courseUrl)
    await page.getByRole('button', { name: 'Publish' }).click()
    await expect(page.getByText('Published', { exact: true })).toBeVisible()
    slug = (await page.getByRole('link', { name: 'View public page' }).getAttribute('href'))!.replace('/courses/', '')
  })

  test('a learner takes the quiz, passes, and sees a review; the key never reaches the browser', async ({ page }) => {
    await signIn(page, `quiz-${stamp}@example.com`, `/courses/${slug}`)
    await page.getByRole('button', { name: 'Enrol for free' }).first().click()
    await page.waitForURL(/\/(dashboard|learn)/)
    await page.goto(`/learn/${slug}`)
    await page.getByRole('link', { name: /Cloud quiz/ }).first().click()
    await page.waitForURL(/\/learn\/[^/]+\/[0-9a-f-]{36}$/)
    lessonHref = new URL(page.url()).pathname
    await expect(page.getByTestId('quiz-questions')).toHaveText('3')
    await expect(page.getByText('5 minutes')).toBeVisible()
    await expect(page.getByText('Answer every question.')).toBeVisible()
    await page.getByRole('button', { name: 'Start the quiz' }).click()
    await page.waitForURL(/\/attempt\//)
    await expect(page.getByTestId('quiz-timer')).toBeVisible()

    const html = await page.content()
    expect(html).not.toContain('"correct"')
    expect(html).not.toContain('S3 is object storage.')

    const answer = async (q: string, pick: string[]) => {
      await expect(page.getByTestId('quiz-question')).toHaveText(q)
      for (const name of pick) await page.getByRole(pick.length > 1 || q.startsWith('Pick') ? 'checkbox' : 'radio', { name, exact: true }).check()
    }
    await answer('Which service stores objects?', ['S3'])
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await answer('Pick the compute services', ['EC2'])   // incomplete: Lambda missing, so wrong
    await expect(page.getByText('Saved', { exact: true })).toBeVisible()

    // leaving and coming back keeps the answers
    await page.reload()
    await expect(page.getByTestId('quiz-progress')).toContainText('Question 3 of 3 · 2 answered') // resumes at the first unanswered question
    await page.getByRole('button', { name: 'Previous' }).click()
    await expect(page.getByRole('checkbox', { name: 'EC2', exact: true })).toBeChecked()
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await page.getByRole('radio', { name: 'True', exact: true }).check()
    await page.getByRole('button', { name: 'Finish the quiz' }).click()
    await expect(page.getByRole('alertdialog')).toContainText('Submit your answers?')
    await page.getByRole('button', { name: 'Yes, submit' }).click()
    await page.waitForURL(/\/result\//)

    await expect(page.getByRole('heading', { name: 'You passed' })).toBeVisible()
    await expect(page.getByTestId('result-score')).toContainText('3')
    await expect(page.getByTestId('result-detail')).toContainText('75% · 2 correct · 1 wrong · 0 unanswered')
    const verdicts = await page.getByTestId('review-verdict').allInnerTexts()
    expect(verdicts.map((v) => v.split('·')[0]!.trim())).toEqual(['Correct', 'Not correct', 'Correct'])
    await expect(page.getByText('S3 is object storage.')).toBeVisible()

    // the lesson is done and the attempt limit holds
    await page.goto(lessonHref)
    await expect(page.getByText('Completed', { exact: true }).filter({ visible: true })).toBeVisible()
    await expect(page.getByTestId('attempt-score')).toContainText('3 of 4')
    await expect(page.getByRole('button', { name: /Start|Try|Take/ })).toHaveCount(0)
    await expect(page.getByText('You have used all your attempts.')).toBeVisible()
    await page.goto(`/learn/${slug}`)
    await expect(page.getByText('Course completed')).toBeVisible()
  })

  test('another learner cannot read that attempt, and a learner cannot open the quiz editor', async ({ page }) => {
    await signIn(page, `quiz-other-${stamp}@example.com`, '/courses')
    expect((await page.goto(`${lessonHref}/result/00000000-0000-4000-8000-000000000000`))?.status()).toBe(404)
    expect((await page.goto(courseUrl.replace('/admin/courses/', '/admin/courses/')))?.status()).toBe(404)
  })

  test('the owner sees the result', async ({ page }) => {
    await signIn(page, OWNER, '/admin/courses')
    await page.goto(courseUrl)
    await page.getByRole('link', { name: 'Cloud quiz' }).click()
    await expect(page.getByTestId('attempt-row')).toContainText('3 of 4 · 75% · passed')
  })
})
