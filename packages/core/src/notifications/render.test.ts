import { describe, expect, it } from 'vitest'
import { renderTemplate, safeDisplayName, textToHtml } from './render'

describe('renderTemplate', () => {
  it('fills known variables and blanks unknown ones', () => {
    expect(renderTemplate('Hi {{member.name}}, order {{ order.no }} {{nope}}!', { 'member.name': 'Asha', 'order.no': 'ORD-1' })).toBe('Hi Asha, order ORD-1 !')
  })
  it('does not interpret values as templates', () => {
    expect(renderTemplate('{{a}}', { a: '{{b}}', b: 'x' })).toBe('{{b}}')
  })
})

describe('textToHtml', () => {
  it('escapes markup, keeps paragraphs and links', () => {
    const html = textToHtml('Hi <b>x</b>\n\nOpen https://a.test/p?q=1&r=2')
    expect(html).toContain('<p>Hi &lt;b&gt;x&lt;/b&gt;</p>')
    expect(html).toContain('<a href="https://a.test/p?q=1&amp;r=2">')
    expect(html).not.toContain('<b>')
  })
})

describe('safeDisplayName', () => {
  it('removes header-breaking characters', () => {
    expect(safeDisplayName('Cloud "Cadre" <x@y>\r\nBcc: z')).toBe('Cloud Cadre x@yBcc: z')
    expect(safeDisplayName('   ')).toBe('Academy')
  })
})
