import { describe, expect, it } from 'vitest'
import { LIST_MAX, parseLearnerList } from './learner-list'

describe('parseLearnerList', () => {
  it('reads one address per line, lower-cased and trimmed', () => {
    const r = parseLearnerList('  Anita.Desai@Example.com \nvikram.s@example.com')
    expect(r.valid.map((e) => e.email)).toEqual(['anita.desai@example.com', 'vikram.s@example.com'])
    expect(r.invalid).toEqual([])
  })

  it('reads several addresses on one line, separated by commas, semicolons, tabs or spaces', () => {
    const r = parseLearnerList('a@x.com, b@x.com; c@x.com\td@x.com e@x.com')
    expect(r.valid.map((e) => e.email)).toEqual(['a@x.com', 'b@x.com', 'c@x.com', 'd@x.com', 'e@x.com'])
  })

  it('takes the rest of a one-address line as the name (CSV or a spreadsheet row)', () => {
    const r = parseLearnerList('anita@x.com,Anita Desai\nrohit@x.com\tRohit Menon')
    expect(r.valid).toEqual([{ email: 'anita@x.com', name: 'Anita Desai' }, { email: 'rohit@x.com', name: 'Rohit Menon' }])
  })

  it('flags what looks wrong and repeats instead of dropping them silently', () => {
    const r = parseLearnerList('rohit@gmailcom\nnot an email\nok@x.com\nOK@x.com')
    expect(r.valid.map((e) => e.email)).toEqual(['ok@x.com'])
    expect(r.invalid).toEqual(['rohit@gmailcom', 'not an email'])
    expect(r.repeats).toEqual(['ok@x.com'])
  })

  it('has no wildcards or whole-domain entries', () => {
    const r = parseLearnerList('*@example.com\n@example.com\n%@example.com')
    expect(r.valid).toEqual([])
    expect(r.invalid).toHaveLength(3)
  })

  it('stops at the limit and says so', () => {
    const many = Array.from({ length: LIST_MAX + 5 }, (_v, i) => `u${i}@x.com`).join('\n')
    const r = parseLearnerList(many)
    expect(r.valid).toHaveLength(LIST_MAX)
    expect(r.tooMany).toBe(true)
  })
})
