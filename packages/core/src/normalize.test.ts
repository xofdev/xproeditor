import { describe, expect, it } from 'vitest'
import { htmlToBlocks, normalizeContent } from './normalize'
import { buildBlocksContent } from './serialize'
import { createBlock } from './ops'

function types(html: string): string[] {
  return htmlToBlocks(html).map((b) => b.type)
}

function firstText(html: string): string {
  return htmlToBlocks(html)[0]?.content.map((s) => s.text).join('') ?? ''
}

describe('htmlToBlocks', () => {
  it('maps heading levels onto heading blocks', () => {
    expect(types('<h1>A</h1><h2>B</h2><h3>C</h3>')).toEqual(['heading_1', 'heading_2', 'heading_3'])
  })

  it('maps paragraphs, quotes and dividers', () => {
    expect(types('<p>A</p><blockquote>B</blockquote><hr>')).toEqual(['paragraph', 'quote', 'divider'])
  })

  it('expands list items into one block each', () => {
    expect(types('<ul><li>one</li><li>two</li></ul>')).toEqual([
      'bulleted_list_item',
      'bulleted_list_item',
    ])
    expect(types('<ol><li>one</li></ol>')).toEqual(['numbered_list_item'])
  })

  it('maps pre/code onto a code block carrying the source in props', () => {
    const [block] = htmlToBlocks('<pre><code>const a = 1</code></pre>')

    expect(block.type).toBe('code')
    expect(block.props.code).toBe('const a = 1')
  })

  it('preserves inline marks', () => {
    const [block] = htmlToBlocks('<p><strong>bold</strong> and <em>italic</em></p>')
    const bold = block.content.find((s) => s.text === 'bold')
    const italic = block.content.find((s) => s.text === 'italic')

    expect(bold?.marks?.bold).toBe(true)
    expect(italic?.marks?.italic).toBe(true)
  })

  it('preserves link hrefs as a link mark', () => {
    const [block] = htmlToBlocks('<p><a href="https://example.test">site</a></p>')

    expect(block.content[0].marks?.link).toBe('https://example.test')
  })

  it('wraps bare top-level text in a paragraph', () => {
    expect(types('loose text')).toEqual(['paragraph'])
    expect(firstText('loose text')).toBe('loose text')
  })

  it('drops whitespace-only content instead of creating empty blocks', () => {
    expect(htmlToBlocks('   \n  ')).toEqual([])
    expect(htmlToBlocks('')).toEqual([])
  })

  it('decodes entities rather than leaving them escaped', () => {
    expect(firstText('<p>a &amp; b</p>')).toBe('a & b')
  })

  it('drops script and style source instead of pasting it as text', () => {
    const text = (html: string) =>
      htmlToBlocks(html)
        .map((b) => b.content.map((s) => s.text).join(''))
        .join(' ')

    expect(text('<p>safe</p><script>alert(1)</script>')).toBe('safe')
    expect(text('<p>safe</p><style>.a{color:red}</style>')).toBe('safe')
    expect(text('<div><p>safe</p><script>alert(1)</script></div>')).toBe('safe')
  })
})

describe('normalizeContent', () => {
  it('returns an empty list for null, undefined and non-objects', () => {
    expect(normalizeContent(null)).toEqual([])
    expect(normalizeContent(undefined)).toEqual([])
    expect(normalizeContent('nope' as unknown as Record<string, unknown>)).toEqual([])
  })

  it('round-trips content produced by buildBlocksContent', () => {
    const blocks = [
      createBlock('heading_1', { content: [{ text: 'Title' }] }),
      createBlock('paragraph', { content: [{ text: 'Body' }] }),
    ]
    const restored = normalizeContent(
      buildBlocksContent(blocks) as unknown as Record<string, unknown>,
    )

    expect(restored.map((b) => b.type)).toEqual(['heading_1', 'paragraph'])
    expect(restored[0].content[0].text).toBe('Title')
  })

  it('gives every restored block an id and a props object', () => {
    const restored = normalizeContent({
      format: 'blocks',
      version: 1,
      blocks: [{ type: 'paragraph', content: [{ text: 'x' }] }],
      text: 'x',
    } as unknown as Record<string, unknown>)

    expect(restored[0].id).toBeTruthy()
    expect(restored[0].props).toEqual({})
  })

  it('repairs a block whose content is not an array', () => {
    const restored = normalizeContent({
      format: 'blocks',
      version: 1,
      blocks: [{ id: 'a', type: 'paragraph', content: 'oops', props: {} }],
      text: '',
    } as unknown as Record<string, unknown>)

    expect(restored[0].content).toEqual([])
  })

  it('converts legacy TipTap JSON', () => {
    const restored = normalizeContent({
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Legacy' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Body' }] },
      ],
    })

    expect(restored.map((b) => b.type)).toEqual(['heading_2', 'paragraph'])
    expect(restored[0].content[0].text).toBe('Legacy')
  })
})
