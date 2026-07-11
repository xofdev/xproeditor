import { describe, expect, it } from 'vitest'
import { blocksToHtmlContent } from './clipboard'
import { createBlock } from './ops'
import { blockToPlainText, buildBlocksContent } from './serialize'

describe('button block model', () => {
  it('createBlock defaults url, style, and alignment', () => {
    const block = createBlock('button')
    expect(block.props.url).toBe('')
    expect(block.props.buttonStyle).toBe('primary')
    expect(block.props.align).toBe('left')
  })

  it('plain text uses the label content', () => {
    const block = createBlock('button', { content: [{ text: 'Click me' }] })
    expect(blockToPlainText(block)).toBe('Click me')
  })

  it('exports a linked button to HTML', () => {
    const block = createBlock('button', {
      content: [{ text: 'Visit site' }],
      props: { url: 'https://example.com', openInNewTab: true },
    })
    const html = blocksToHtmlContent([block])
    expect(html).toContain('<a href="https://example.com" target="_blank" rel="noopener noreferrer">Visit site</a>')
  })

  it('exports a button with no url as plain text', () => {
    const block = createBlock('button', { content: [{ text: 'No link yet' }] })
    const html = blocksToHtmlContent([block])
    expect(html).not.toContain('<a ')
    expect(html).toContain('No link yet')
  })

  it('round-trips through buildBlocksContent', () => {
    const blocks = [createBlock('button', { content: [{ text: 'Go' }], props: { url: '/go' } })]
    const content = buildBlocksContent(blocks)
    expect(content.blocks[0].type).toBe('button')
    expect(content.text).toBe('Go')
  })
})
