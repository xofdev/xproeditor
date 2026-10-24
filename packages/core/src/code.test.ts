import { describe, expect, it } from 'vitest'
import { codeLineCount, indentCode, newlineInCode, normalizeCodeLanguage, toggleCodeComment } from './code'

/** Apply an edit described with `|` as the caret (or `[`…`]` as a selection). */
function run(src: string, fn: (v: string, s: number, e: number) => { value: string; selectionStart: number; selectionEnd: number } | null) {
  const caret = src.indexOf('|')
  const open = src.indexOf('[')
  const start = caret !== -1 ? caret : open
  const value = src.replace(/[|[\]]/g, '')
  const end = caret !== -1 ? caret : src.indexOf(']') - 1
  const out = fn(value, start, end)

  if (!out) {
    return null
  }

  return out.selectionStart === out.selectionEnd
    ? out.value.slice(0, out.selectionStart) + '|' + out.value.slice(out.selectionStart)
    : out.value.slice(0, out.selectionStart) + '[' + out.value.slice(out.selectionStart, out.selectionEnd) + ']' + out.value.slice(out.selectionEnd)
}

describe('code editing', () => {
  it('Tab inserts an indent at the caret and indents selected lines', () => {
    expect(run('a|b', (v, s, e) => indentCode(v, s, e))).toBe('a  |b')
    expect(run('[one\ntwo]', (v, s, e) => indentCode(v, s, e))).toBe('  [one\n  two]')
  })

  it('Shift+Tab outdents', () => {
    expect(run('  [one\n    two]', (v, s, e) => indentCode(v, s, e, true))).toBe('[one\n  two]')
  })

  it('Enter keeps indentation and indents after an opener', () => {
    expect(run('  foo()|', newlineInCode)).toBe('  foo()\n  |')
    expect(run('if (x) {|', newlineInCode)).toBe('if (x) {\n  |')
    expect(run('def f():|', newlineInCode)).toBe('def f():\n  |')
  })

  it('Enter between brackets puts the closer on its own line', () => {
    expect(run('  call({|})', newlineInCode)).toBe('  call({\n    |\n  })')
  })

  it('Mod+/ toggles line comments at the shallowest indent', () => {
    const commented = run('[  a\n    b]', (v, s, e) => toggleCodeComment(v, s, e, 'typescript'))
    expect(commented?.replace(/[[\]|]/g, '')).toBe('  // a\n  //   b')
    expect(run('[  // a\n  //   b]', (v, s, e) => toggleCodeComment(v, s, e, 'ts'))?.replace(/[[\]|]/g, '')).toBe('  a\n    b')
    expect(run('x|', (v, s, e) => toggleCodeComment(v, s, e, 'python'))).toBe('# x|')
    expect(run('x|', (v, s, e) => toggleCodeComment(v, s, e, 'json'))).toBeNull()
  })

  it('normalizes language aliases and counts lines', () => {
    expect(normalizeCodeLanguage('TS')).toBe('typescript')
    expect(normalizeCodeLanguage('')).toBe('plaintext')
    expect(codeLineCount('')).toBe(1)
    expect(codeLineCount('a\nb\n')).toBe(3)
  })
})

describe('splitHighlightedLines', () => {
  it('closes and reopens spans that cross line breaks', async () => {
    const { splitHighlightedLines } = await import('./code')
    expect(splitHighlightedLines('a\n<span class="c">/* x\ny */</span>\nb')).toEqual([
      'a',
      '<span class="c">/* x</span>',
      '<span class="c">y */</span>',
      'b',
    ])
    expect(splitHighlightedLines('')).toEqual([''])
    expect(splitHighlightedLines('x\n')).toEqual(['x', ''])
  })
})
