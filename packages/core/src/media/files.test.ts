import { describe, expect, it } from 'vitest'
import { checkFile, extOf, humanSize, safeFilename } from './files'

describe('checkFile', () => {
  it('accepts a PDF in a PDF lesson and nothing else', () => {
    expect(checkFile('pdf', 'Notes.PDF', 1000)).toEqual({ ok: true, ext: 'pdf' })
    expect(checkFile('pdf', 'notes.docx', 1000)).toEqual({ ok: false, reason: 'type' })
    expect(checkFile('pdf', 'notes', 1000)).toEqual({ ok: false, reason: 'type' })
  })
  it('accepts office files and archives as downloads but never scripts or executables', () => {
    expect(checkFile('download', 'slides.pptx', 5)).toEqual({ ok: true, ext: 'pptx' })
    for (const bad of ['run.exe', 'x.sh', 'page.html', 'icon.svg', 'a.js', 'a.php']) expect(checkFile('download', bad, 5)).toEqual({ ok: false, reason: 'type' })
  })
  it('enforces size and rejects empty or non-numeric sizes', () => {
    expect(checkFile('pdf', 'a.pdf', 101 * 1024 * 1024)).toEqual({ ok: false, reason: 'size' })
    expect(checkFile('pdf', 'a.pdf', 0)).toEqual({ ok: false, reason: 'empty' })
    expect(checkFile('pdf', 'a.pdf', Number.NaN)).toEqual({ ok: false, reason: 'empty' })
  })
})

describe('names and sizes', () => {
  it('takes the last extension only', () => {
    expect(extOf('a.tar.zip')).toBe('zip')
    expect(extOf('noext')).toBe('')
  })
  it('strips path parts and header-breaking characters', () => {
    expect(safeFilename('../../etc/pa"sswd.pdf')).toBe('....etcpasswd.pdf')
    expect(safeFilename('  ')).toBe('file')
    expect(safeFilename('a\r\nb.pdf')).toBe('ab.pdf')
  })
  it('formats sizes', () => {
    expect(humanSize(2048)).toBe('2 KB')
    expect(humanSize(5 * 1024 * 1024)).toBe('5.0 MB')
  })
})
