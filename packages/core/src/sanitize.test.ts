import { describe, expect, it } from 'vitest'
import { parseAIResponseToBlocks } from './ai'
import { blocksToClipboardJson, blocksToHtmlContent, parseBlocksFromClipboardData } from './clipboard'
import { parseInlineHtml, spansToHtml } from './html'
import { normalizeContent } from './normalize'
import { createBlock } from './ops'
import {
  sanitizeBlocks,
  sanitizeCssColor,
  sanitizeLinkUrl,
  sanitizeMediaUrl,
  sanitizeUrl,
} from './sanitize'
import { normalizeTableData } from './table'

function clipboard(data: Record<string, string>): DataTransfer {
  return { getData: (type: string) => data[type] ?? '' } as unknown as DataTransfer
}

describe('sanitizeUrl', () => {
  it('keeps safe absolute and relative URLs', () => {
    for (const url of [
      'https://example.com/a?b=1#c',
      'http://example.com',
      'mailto:hi@example.com',
      'tel:+15551234',
      '/docs/intro',
      './a',
      '../b',
      '#heading',
      '?q=1',
      '//cdn.example.com/x.png',
      'page.html',
    ]) {
      expect(sanitizeUrl(url)).toBe(url)
    }
  })

  it('rejects script and data schemes, including obfuscated forms', () => {
    for (const url of [
      'javascript:alert(1)',
      'JaVaScRiPt:alert(1)',
      ' javascript:alert(1)',
      'java\nscript:alert(1)',
      'java\tscript:alert(1)',
      'vbscript:msgbox(1)',
      'data:text/html,<script>alert(1)</script>',
      'file:///etc/passwd',
    ]) {
      expect(sanitizeUrl(url)).toBe('')
    }
  })

  it('only lets media sources use blob: and data:image', () => {
    expect(sanitizeLinkUrl('blob:https://a/1')).toBe('')
    expect(sanitizeLinkUrl('blob:https://a/1', { allowBlob: true })).toBe('blob:https://a/1')
    expect(sanitizeMediaUrl('blob:https://a/1')).toBe('blob:https://a/1')
    expect(sanitizeMediaUrl('data:image/png;base64,AAAA')).toBe('data:image/png;base64,AAAA')
    expect(sanitizeMediaUrl('data:image/svg+xml;base64,AAAA')).toBe('')
    expect(sanitizeLinkUrl('data:image/png;base64,AAAA')).toBe('')
  })

  it('treats non-strings as empty', () => {
    expect(sanitizeUrl(undefined)).toBe('')
    expect(sanitizeUrl(42)).toBe('')
  })
})

describe('sanitizeCssColor', () => {
  it('accepts real colour syntaxes', () => {
    for (const c of ['#fff', '#112233', 'red', 'rgb(1, 2, 3)', 'rgba(1,2,3,0.5)', 'hsl(10 20% 30%)', 'var(--xpe-border, #eceef1)']) {
      expect(sanitizeCssColor(c)).toBe(c)
    }
  })

  it('rejects declaration / attribute break-outs and resource loads', () => {
    for (const c of ['red;position:fixed', 'red" onmouseover="alert(1)', "red'", 'url(https://x)', 'expression(alert(1))', 'red}body{', '<b>']) {
      expect(sanitizeCssColor(c)).toBe('')
    }
  })
})

describe('spansToHtml hardening', () => {
  it('renders unsafe links as plain text', () => {
    const html = spansToHtml([{ text: 'x', marks: { link: 'javascript:alert(1)' } }])

    expect(html).toBe('x')
  })

  it('cannot be broken out of the style attribute', () => {
    const html = spansToHtml([{ text: 'x', marks: { color: 'red" onmouseover="alert(1)' } }])

    expect(html).not.toContain('onmouseover')
    expect(html).toBe('x')
  })

  it('escapes quotes in link hrefs', () => {
    const html = spansToHtml([{ text: 'x', marks: { link: 'https://a.com/"onclick="b' } }])

    expect(html).toContain('href="https://a.com/&quot;onclick=&quot;b"')
  })

  it('drops unsafe links when parsing pasted HTML', () => {
    const spans = parseInlineHtml('<a href="javascript:alert(1)">evil</a> <a href="https://ok.com">ok</a>')

    expect(spans.find(s => s.text === 'evil')?.marks?.link).toBeUndefined()
    expect(spans.find(s => s.text === 'ok')?.marks?.link).toBe('https://ok.com')
  })
})

describe('sanitizeBlocks', () => {
  it('degrades unknown block types to paragraphs and keeps their text', () => {
    const [block] = sanitizeBlocks([{ id: 'a', type: 'mystery', content: [{ text: 'hi' }], props: {} }])

    expect(block.type).toBe('paragraph')
    expect(block.content).toEqual([{ text: 'hi' }])
  })

  it('coerces malformed content, props and ids', () => {
    const blocks = sanitizeBlocks([
      null,
      'nope',
      { type: 'paragraph', content: [{ text: 5 }, 'raw', { text: '' }, null], props: 'x' },
      { id: 'dup', type: 'paragraph', content: [], props: { indent: -3 } },
      { id: 'dup', type: 'paragraph', content: [], props: { indent: 99, color: 'red;x:y' } },
    ])

    expect(blocks).toHaveLength(3)
    expect(blocks[0].content).toEqual([{ text: '5raw' }])
    expect(blocks[0].props).toEqual({})
    expect(blocks[1].props.indent).toBeUndefined()
    expect(blocks[2].props.indent).toBe(8)
    expect(blocks[2].props.color).toBeUndefined()
    expect(blocks[1].id).not.toBe(blocks[2].id)
  })

  it('strips unsafe marks', () => {
    const [block] = sanitizeBlocks([{
      type: 'paragraph',
      content: [{ text: 'x', marks: { bold: 'yes', italic: true, link: 'javascript:1', color: 'red' } }],
    }])

    expect(block.content[0].marks).toEqual({ italic: true, color: 'red' })
  })

  it('is applied when loading stored content', () => {
    const blocks = normalizeContent({
      format: 'blocks',
      version: 1,
      text: '',
      blocks: [{ id: 'a', type: 'paragraph', content: [{ text: 'x', marks: { link: 'javascript:1' } }], props: {} }],
    })

    expect(blocks[0].content[0].marks).toBeUndefined()
  })

  it('is applied to clipboard JSON', () => {
    const json = JSON.stringify({ format: 'blocks', version: 1, blocks: [{ type: 'evil', content: [{ text: 'a' }] }] })
    const pasted = parseBlocksFromClipboardData(clipboard({ 'application/x-xlog-blocks+json': json }))

    expect(pasted?.[0].type).toBe('paragraph')
  })

  it('round-trips legitimate clipboard JSON unchanged apart from ids', () => {
    const original = [createBlock('heading_2', { content: [{ text: 'T', marks: { bold: true } }] })]
    const pasted = parseBlocksFromClipboardData(clipboard({ 'application/x-xlog-blocks+json': blocksToClipboardJson(original) }))

    expect(pasted?.[0].type).toBe('heading_2')
    expect(pasted?.[0].content).toEqual(original[0].content)
    expect(pasted?.[0].id).not.toBe(original[0].id)
  })

  it('is applied to structured AI output', () => {
    const blocks = parseAIResponseToBlocks({
      blocks: [{ id: '', type: 'paragraph', content: [{ text: 'a', marks: { link: 'javascript:x' } }], props: {} }],
    })

    expect(blocks[0].id).not.toBe('')
    expect(blocks[0].content[0].marks).toBeUndefined()
  })
})

describe('table colour hardening', () => {
  it('drops unsafe cell and table colours', () => {
    const table = normalizeTableData({
      rows: [[{ content: [], background: 'red;x:y' }]],
      style: { background: 'url(x)', headerBackground: '#fff', border: { color: '"><b>' } },
    })

    expect(table.rows[0][0].background).toBeUndefined()
    expect(table.style?.background).toBeUndefined()
    expect(table.style?.headerBackground).toBe('#fff')
    expect(table.style?.border?.color).toBe('var(--xpe-border, #eceef1)')
  })

  it('exports safe HTML for hostile stored blocks', () => {
    const html = blocksToHtmlContent([
      { id: 'a', type: 'paragraph', content: [{ text: 'x', marks: { link: 'javascript:alert(1)', color: 'red" onload="x' } }], props: {} },
    ])

    expect(html).not.toContain('javascript:')
    expect(html).not.toContain('onload')
  })
})

describe('heading anchors', () => {
  it('keeps non-Latin heading text in anchors', async () => {
    const { extractHeadings } = await import('./serialize')
    const headings = extractHeadings([
      createBlock('heading_1', { content: [{ text: 'سلام دنیا' }] }),
      createBlock('heading_2', { content: [{ text: 'Привет мир' }] }),
      createBlock('heading_2', { content: [{ text: 'Hello, World!' }] }),
    ])

    expect(headings.map(h => h.id)).toEqual(['سلام-دنیا', 'привет-мир', 'hello-world'])
  })
})

describe('getDocumentStats', () => {
  it('counts words across scripts', async () => {
    const { getDocumentStats } = await import('./serialize')
    const stats = getDocumentStats([
      createBlock('paragraph', { content: [{ text: 'Hello, world! It’s fine.' }] }),
      createBlock('paragraph', { content: [{ text: 'من می‌خواهم بنویسم' }] }),
      createBlock('paragraph', { content: [{ text: '你好世界' }] }),
      createBlock('divider'),
    ])

    expect(stats.words).toBe(4 + 3 + 4)
    expect(stats.blocks).toBe(4)
    expect(stats.readingTimeMinutes).toBe(1)
    expect(getDocumentStats([]).readingTimeMinutes).toBe(0)
  })
})

describe('resolveBlockDirection', () => {
  it('inherits the editor direction for text without strong characters', async () => {
    const { resolveBlockDirection } = await import('./ops')
    const block = (text: string) => createBlock('paragraph', { content: [{ text }] })

    expect(resolveBlockDirection(block('/'), 'rtl')).toBe('rtl')
    expect(resolveBlockDirection(block('123 — 😀'), 'rtl')).toBe('rtl')
    expect(resolveBlockDirection(block('Hello'), 'rtl')).toBe('ltr')
    expect(resolveBlockDirection(block('سلام world'), 'ltr')).toBe('rtl')
    expect(resolveBlockDirection(block('Привет'), 'rtl')).toBe('ltr')
  })
})
