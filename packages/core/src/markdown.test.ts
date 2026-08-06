import { describe, expect, it } from 'vitest'
import {
  blocksToMarkdownLossy,
  looksLikeMarkdown,
  markdownToBlocks,
  tryParseMarkdownToBlocks,
} from './markdown'
import { createBlock } from './ops'
import { BUTTON_COLOR_PRESETS } from './types'
import { blocksToHtmlContent } from './clipboard'
import { htmlToBlocks } from './normalize'
import {
  applyAISuggestion,
  DEFAULT_AI_COMMANDS,
  filterAICommands,
  parseAIResponseToBlocks,
} from './ai'

describe('markdown', () => {
  it('detects markdown-ish plain text', () => {
    expect(looksLikeMarkdown('# Hello')).toBe(true)
    expect(looksLikeMarkdown('- item')).toBe(true)
    expect(looksLikeMarkdown('just a sentence')).toBe(false)
  })

  it('parses headings, lists, code, and todos', () => {
    const md = [
      '# Title',
      '',
      'A **bold** paragraph',
      '',
      '- one',
      '- [x] done',
      '',
      '```ts',
      'const x = 1',
      '```',
      '',
      '> quote me',
      '',
      '---',
    ].join('\n')

    const blocks = markdownToBlocks(md)

    expect(blocks.map(b => b.type)).toEqual([
      'heading_1',
      'paragraph',
      'bulleted_list_item',
      'to_do',
      'code',
      'quote',
      'divider',
    ])
    expect(blocks[1].content.some(s => s.marks?.bold)).toBe(true)
    expect(blocks[3].props.checked).toBe(true)
    expect(blocks[4].props.code).toBe('const x = 1')
  })

  it('round-trips a simple doc lossily', () => {
    const blocks = [
      createBlock('heading_1', { content: [{ text: 'Hi' }] }),
      createBlock('paragraph', { content: [{ text: 'Body', marks: { italic: true } }] }),
    ]
    const md = blocksToMarkdownLossy(blocks)
    const again = markdownToBlocks(md)

    expect(again[0].type).toBe('heading_1')
    expect(again[1].content.some(s => s.marks?.italic)).toBe(true)
  })

  it('tryParse returns null for plain prose', () => {
    expect(tryParseMarkdownToBlocks('hello world')).toBeNull()
  })
})

describe('button html round-trip', () => {
  it('exports data-xpe attributes and reimports as button', () => {
    const block = createBlock('button', {
      content: [{ text: 'Buy now' }],
      props: {
        url: 'https://shop.example',
        buttonStyle: 'outline',
        color: BUTTON_COLOR_PRESETS[0],
        align: 'center',
        openInNewTab: true,
      },
    })
    const html = blocksToHtmlContent([block])
    expect(html).toContain('data-xpe-type="button"')
    expect(html).toContain('data-xpe-color=')

    const parsed = htmlToBlocks(html)
    expect(parsed[0]?.type).toBe('button')
    expect(parsed[0]?.props.url).toBe('https://shop.example')
    expect(parsed[0]?.props.buttonStyle).toBe('outline')
    expect(parsed[0]?.props.color).toBe(BUTTON_COLOR_PRESETS[0])
    expect(parsed[0]?.props.openInNewTab).toBe(true)
  })
})

describe('ai helpers', () => {
  it('filters commands by selection', () => {
    const withSel = filterAICommands(DEFAULT_AI_COMMANDS, '', true)
    expect(withSel.every(c => !c.requiresNoSelection)).toBe(true)

    const noSel = filterAICommands(DEFAULT_AI_COMMANDS, '', false)
    expect(noSel.every(c => !c.requiresSelection)).toBe(true)
  })

  it('parses markdown AI responses', () => {
    const blocks = parseAIResponseToBlocks({ text: '## Section\n\nHello' })
    expect(blocks[0].type).toBe('heading_2')
  })

  it('applies update suggestions by replacing block ids', () => {
    const doc = [
      createBlock('paragraph', { id: 'a', content: [{ text: 'old' }] }),
      createBlock('paragraph', { id: 'b', content: [{ text: 'keep' }] }),
    ]
    const result = applyAISuggestion(doc, {
      id: 's1',
      kind: 'update',
      replaceBlockIds: ['a'],
      blocks: [createBlock('paragraph', { content: [{ text: 'new' }] })],
    }, null)

    expect(result.blocks).toHaveLength(2)
    expect(result.blocks[0].content[0].text).toBe('new')
    expect(result.blocks[1].id).toBe('b')
  })
})
