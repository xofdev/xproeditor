import { describe, expect, it } from 'vitest'
import {
  BLOCKS_CLIPBOARD_MIME,
  blocksToClipboardJson,
  blocksToClipboardPayload,
  blocksToHtmlContent,
  blocksToPlainTextExport,
  cloneBlocksForClipboard,
  parseBlocksFromClipboardData,
  writeBlocksToClipboardData,
} from './clipboard'
import { createBlock } from './ops'
import { createDefaultTableData } from './table'
import type { Block } from './types'

/**
 * Minimal DataTransfer stand-in. jsdom ships a DataTransfer whose setData is a
 * no-op, so round-trip tests need a real backing store.
 */
function fakeDataTransfer(initial: Record<string, string> = {}): DataTransfer {
  const store = new Map<string, string>(Object.entries(initial))

  return {
    getData: (type: string) => store.get(type) ?? '',
    setData: (type: string, value: string) => void store.set(type, value),
    clearData: () => store.clear(),
  } as unknown as DataTransfer
}

const sample: Block[] = [
  createBlock('heading_1', { content: [{ text: 'Title' }] }),
  createBlock('paragraph', { content: [{ text: 'Bold', marks: { bold: true } }, { text: ' tail' }] }),
  createBlock('bulleted_list_item', { content: [{ text: 'Item' }] }),
]

describe('cloneBlocksForClipboard', () => {
  it('gives the copies fresh ids so pasting cannot duplicate an id', () => {
    const copies = cloneBlocksForClipboard(sample)

    expect(copies).toHaveLength(sample.length)
    copies.forEach((copy, i) => expect(copy.id).not.toBe(sample[i].id))
  })

  it('deep-copies content so editing a copy cannot mutate the original', () => {
    const [copy] = cloneBlocksForClipboard([sample[1]])
    copy.content[0].text = 'mutated'

    expect(sample[1].content[0].text).toBe('Bold')
  })
})

describe('blocksToPlainTextExport', () => {
  it('joins one block per line', () => {
    expect(blocksToPlainTextExport(sample)).toBe('Title\nBold tail\nItem')
  })

  it('exports a code block as its code, not its spans', () => {
    const code = createBlock('code', { props: { code: 'const a = 1', language: 'ts' } })

    expect(blocksToPlainTextExport([code])).toBe('const a = 1')
  })

  it('exports a divider as an empty line rather than dropping it', () => {
    expect(blocksToPlainTextExport([createBlock('divider')])).toBe('')
  })

  it('exports every visible table cell', () => {
    const table = createBlock('table', { props: { table: createDefaultTableData() } })
    const text = blocksToPlainTextExport([table])

    // 2x3 default grid, all cells empty -> 6 blank lines
    expect(text.split('\n')).toHaveLength(6)
  })
})

describe('blocksToHtmlContent', () => {
  it('maps block types onto semantic tags', () => {
    const html = blocksToHtmlContent(sample)

    expect(html).toContain('<h1>Title</h1>')
    expect(html).toContain('<strong>Bold</strong>')
    expect(html).toContain('<li>')
  })

  it('renders a divider as an hr and a code block as pre/code', () => {
    const html = blocksToHtmlContent([
      createBlock('divider'),
      createBlock('code', { props: { code: 'x < y' } }),
    ])

    expect(html).toContain('<hr>')
    expect(html).toContain('<pre><code>x &lt; y</code></pre>')
  })

  it('omits an image with no url instead of emitting a broken tag', () => {
    expect(blocksToHtmlContent([createBlock('image')])).not.toContain('<img')
  })

  it('carries an explicit dir onto the element', () => {
    const rtl = createBlock('paragraph', { content: [{ text: 'مرحبا' }], props: { dir: 'rtl' } })

    expect(blocksToHtmlContent([rtl])).toContain('dir="rtl"')
  })
})

describe('clipboard round-trip', () => {
  it('writes all three flavours and reads the blocks back', () => {
    const data = fakeDataTransfer()
    writeBlocksToClipboardData(data, sample)

    expect(data.getData('text/plain')).toBe('Title\nBold tail\nItem')
    expect(data.getData('text/html')).toContain('data-xlog-blocks=')

    const parsed = parseBlocksFromClipboardData(data)

    expect(parsed).not.toBeNull()
    expect(parsed?.map((b) => b.type)).toEqual(['heading_1', 'paragraph', 'bulleted_list_item'])
    expect(parsed?.[1].content[0].marks?.bold).toBe(true)
  })

  it('prefers the native mime over the html payload', () => {
    const onlyParagraph = blocksToClipboardJson([createBlock('paragraph', { content: [{ text: 'native' }] })])
    const data = fakeDataTransfer({
      [BLOCKS_CLIPBOARD_MIME]: onlyParagraph,
      'text/html': blocksToClipboardPayload(sample).html,
    })

    expect(parseBlocksFromClipboardData(data)?.map((b) => b.type)).toEqual(['paragraph'])
  })

  it('recovers blocks embedded in the html attribute when the native mime is absent', () => {
    const data = fakeDataTransfer({ 'text/html': blocksToClipboardPayload(sample).html })

    expect(parseBlocksFromClipboardData(data)).toHaveLength(3)
  })

  it('recovers blocks from a plain-text json payload', () => {
    const data = fakeDataTransfer({ 'text/plain': blocksToClipboardJson(sample) })

    expect(parseBlocksFromClipboardData(data)).toHaveLength(3)
  })

  it('returns null for foreign clipboard content so the caller falls back to html paste', () => {
    expect(parseBlocksFromClipboardData(fakeDataTransfer({ 'text/plain': 'just text' }))).toBeNull()
    expect(parseBlocksFromClipboardData(fakeDataTransfer({ 'text/html': '<p>from the web</p>' }))).toBeNull()
    expect(parseBlocksFromClipboardData(fakeDataTransfer())).toBeNull()
  })

  it('survives a malformed native payload without throwing', () => {
    const data = fakeDataTransfer({ [BLOCKS_CLIPBOARD_MIME]: '{ not json' })

    expect(parseBlocksFromClipboardData(data)).toBeNull()
  })

  it('assigns fresh ids on paste so copy-then-paste cannot collide', () => {
    const data = fakeDataTransfer()
    writeBlocksToClipboardData(data, sample)
    const parsed = parseBlocksFromClipboardData(data) ?? []

    expect(parsed.map((b) => b.id)).not.toEqual(sample.map((b) => b.id))
  })
})
