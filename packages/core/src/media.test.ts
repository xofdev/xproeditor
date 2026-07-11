import { describe, expect, it } from 'vitest'
import { blocksToHtmlContent } from './clipboard'
import { blockTypeForFile, formatFileSize } from './media'
import { createBlock } from './ops'
import { blockToPlainText, buildBlocksContent } from './serialize'

describe('audio/file block model', () => {
  it('createBlock defaults url for audio and file', () => {
    expect(createBlock('audio').props.url).toBe('')
    expect(createBlock('file').props.url).toBe('')
  })

  it('plain text uses caption for audio and name for file', () => {
    const audio = createBlock('audio', { props: { url: 'a.mp3', caption: 'My song' } })
    const file = createBlock('file', { props: { url: 'r.pdf', name: 'report.pdf' } })
    expect(blockToPlainText(audio)).toBe('My song')
    expect(blockToPlainText(file)).toBe('report.pdf')
  })

  it('exports audio and file blocks to HTML', () => {
    const blocks = [
      createBlock('audio', { props: { url: 'https://x.test/a.mp3' } }),
      createBlock('file', { props: { url: 'https://x.test/r.pdf', name: 'report.pdf' } }),
    ]
    const html = blocksToHtmlContent(blocks)
    expect(html).toContain('<audio controls src="https://x.test/a.mp3">')
    expect(html).toContain('<a href="https://x.test/r.pdf" download>report.pdf</a>')
  })

  it('round-trips through buildBlocksContent', () => {
    const blocks = [createBlock('file', { props: { url: 'f.zip', name: 'f.zip', size: 2048 } })]
    const content = buildBlocksContent(blocks)
    expect(content.blocks[0].type).toBe('file')
    expect(content.text).toBe('f.zip')
  })
})

describe('media helpers', () => {
  it('maps MIME types to block types', () => {
    expect(blockTypeForFile({ type: 'image/png' })).toBe('image')
    expect(blockTypeForFile({ type: 'video/mp4' })).toBe('video')
    expect(blockTypeForFile({ type: 'audio/mpeg' })).toBe('audio')
    expect(blockTypeForFile({ type: 'application/pdf' })).toBe('file')
    expect(blockTypeForFile({})).toBe('file')
  })

  it('formats file sizes', () => {
    expect(formatFileSize(0)).toBe('0 B')
    expect(formatFileSize(999)).toBe('999 B')
    expect(formatFileSize(2048)).toBe('2 KB')
    expect(formatFileSize(3.4 * 1024 * 1024)).toBe('3.4 MB')
    expect(formatFileSize(undefined)).toBe('')
  })
})
