import { describe, expect, it } from 'vitest'
import {
  bookmarkDisplayTitle,
  bookmarkHostname,
  normalizeBookmarkUrl,
} from './bookmark'
import { blocksToHtmlContent } from './clipboard'
import { htmlToBlocks } from './normalize'
import { createBlock } from './ops'
import { blockToPlainText, buildBlocksContent } from './serialize'
import { isTextBlock } from './types'

describe('bookmark helpers', () => {
  it('normalizes bare domains and rejects invalid urls', () => {
    expect(normalizeBookmarkUrl('example.com/path')).toBe('https://example.com/path')
    expect(normalizeBookmarkUrl('https://example.com')).toBe('https://example.com/')
    expect(normalizeBookmarkUrl('')).toBeNull()
    expect(normalizeBookmarkUrl('ftp://example.com')).toBeNull()
    expect(normalizeBookmarkUrl('not a url')).toBeNull()
  })

  it('derives hostname and display title', () => {
    expect(bookmarkHostname('https://www.example.com/a')).toBe('example.com')
    expect(bookmarkDisplayTitle({ url: 'https://www.example.com', title: 'Hello' })).toBe('Hello')
    expect(bookmarkDisplayTitle({ url: 'https://www.example.com' })).toBe('example.com')
  })
})

describe('bookmark block model', () => {
  it('createBlock defaults url to empty string', () => {
    const block = createBlock('bookmark')
    expect(block.type).toBe('bookmark')
    expect(block.props.url).toBe('')
  })

  it('is not a text block', () => {
    expect(isTextBlock('bookmark')).toBe(false)
  })

  it('plain text prefers title + url', () => {
    const block = createBlock('bookmark', {
      props: { url: 'https://example.com', title: 'Example' },
    })
    expect(blockToPlainText(block)).toBe('Example\nhttps://example.com')
  })

  it('exports HTML with data-xpe attributes and round-trips', () => {
    const block = createBlock('bookmark', {
      props: {
        url: 'https://example.com',
        title: 'Example',
        description: 'A site',
        favicon: 'https://example.com/favicon.ico',
        image: 'https://example.com/og.png',
      },
    })
    const html = blocksToHtmlContent([block])
    expect(html).toContain('data-xpe-type="bookmark"')
    expect(html).toContain('data-xpe-url="https://example.com"')
    expect(html).toContain('data-xpe-title="Example"')
    expect(html).toContain('data-xpe-description="A site"')
    expect(html).toContain('data-xpe-favicon=')
    expect(html).toContain('data-xpe-image=')

    const parsed = htmlToBlocks(html)
    expect(parsed[0]?.type).toBe('bookmark')
    expect(parsed[0]?.props.url).toBe('https://example.com')
    expect(parsed[0]?.props.title).toBe('Example')
    expect(parsed[0]?.props.description).toBe('A site')
    expect(parsed[0]?.props.favicon).toBe('https://example.com/favicon.ico')
    expect(parsed[0]?.props.image).toBe('https://example.com/og.png')
  })

  it('round-trips through buildBlocksContent', () => {
    const blocks = [
      createBlock('bookmark', {
        props: { url: 'https://x.test', title: 'X' },
      }),
    ]
    const content = buildBlocksContent(blocks)
    expect(content.blocks[0].type).toBe('bookmark')
    expect(content.text).toContain('https://x.test')
  })
})
