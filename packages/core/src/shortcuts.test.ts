import { describe, expect, it } from 'vitest'
import { spansToText } from './ops'
import { applyInlineMarkdownShortcut, exitMarkAfterShortcut, matchBlockShortcut } from './shortcuts'

describe('matchBlockShortcut', () => {
  it.each([
    ['# ', 'heading_1'],
    ['## ', 'heading_2'],
    ['### ', 'heading_3'],
    ['- ', 'bulleted_list_item'],
    ['* ', 'bulleted_list_item'],
    ['+ ', 'bulleted_list_item'],
    ['1. ', 'numbered_list_item'],
    ['7) ', 'numbered_list_item'],
    ['> ', 'quote'],
    ['" ', 'quote'],
    ['>> ', 'toggle'],
    ['[] ', 'to_do'],
    ['[ ] ', 'to_do'],
  ])('%j → %s', (prefix, type) => {
    expect(matchBlockShortcut(`${prefix}rest`, prefix.length)?.type).toBe(type)
  })

  it('marks [x] to-dos as checked', () => {
    expect(matchBlockShortcut('[x] ', 4)).toEqual({ type: 'to_do', prefixLength: 4, props: { checked: true } })
  })

  it('only fires when the caret is right after the prefix', () => {
    expect(matchBlockShortcut('# title', 7)).toBeNull()
    expect(matchBlockShortcut('#title', 1)).toBeNull()
    expect(matchBlockShortcut('1.5 ', 4)).toBeNull()
  })
})

describe('applyInlineMarkdownShortcut', () => {
  const run = (text: string) => applyInlineMarkdownShortcut([{ text }], text.length)

  it('applies bold, italic, code and strike when the closing delimiter is typed', () => {
    expect(run('a **b c**')).toMatchObject({ mark: 'bold', caret: 5, start: 2, end: 5 })
    expect(run('a *b*')?.mark).toBe('italic')
    expect(run('a _b_')?.mark).toBe('italic')
    expect(run('a __b__')?.mark).toBe('bold')
    expect(run('a `x*y`')?.mark).toBe('code')
    expect(run('a ~~gone~~')?.mark).toBe('strikethrough')
  })

  it('removes the delimiters and keeps surrounding text', () => {
    const result = applyInlineMarkdownShortcut([{ text: 'say **hi** there' }], 10)

    expect(spansToText(result!.spans)).toBe('say hi there')
    expect(result!.spans).toEqual([
      { text: 'say ' },
      { text: 'hi', marks: { bold: true } },
      { text: ' there' },
    ])
    expect(result!.caret).toBe(6)
  })

  it('waits for the second star of a bold delimiter', () => {
    expect(run('**bold*')).toBeNull()
  })

  it('ignores whitespace-padded and intra-word delimiters', () => {
    expect(run('a * b *')).toBeNull()
    expect(run('snake_case_')).toBeNull()
    expect(run('2*3*')).toBeNull()
  })

  it('does not fire inside inline code', () => {
    expect(applyInlineMarkdownShortcut([{ text: 'a **b**', marks: { code: true } }], 7)).toBeNull()
  })

  it('stops the mark for text typed after the shortcut', () => {
    const spans = [{ text: 'hi', marks: { bold: true } }, { text: '' }]
    const typed = [{ text: 'hix', marks: { bold: true } }]

    expect(exitMarkAfterShortcut(typed, 2, 3, 'bold')).toEqual([
      { text: 'hi', marks: { bold: true } },
      { text: 'x' },
    ])
    expect(exitMarkAfterShortcut(spans, 2, 2, 'bold')).toBe(spans)
  })
})
