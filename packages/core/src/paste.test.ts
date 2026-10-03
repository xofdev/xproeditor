import { describe, expect, it } from 'vitest'
import { createBlock, spansToText } from './ops'
import { pasteBlocksIntoTextBlock, plainTextToBlocks } from './paste'
import type { Block } from './types'

function doc(...blocks: Block[]) {
  return blocks
}

function texts(blocks: Block[]) {
  return blocks.map(b => `${b.type}:${spansToText(b.content)}`)
}

describe('pasteBlocksIntoTextBlock', () => {
  it('splits multi-line text around the caret (X|Y + a⏎b → Xa, bY)', () => {
    const target = createBlock('paragraph', { content: [{ text: 'XY' }] })
    const blocks = doc(target)
    const focus = pasteBlocksIntoTextBlock(blocks, target.id, { start: 1, end: 1 }, plainTextToBlocks('a\nb'))

    expect(texts(blocks)).toEqual(['paragraph:Xa', 'paragraph:bY'])
    expect(focus).toEqual({ blockId: blocks[1].id, offset: 1 })
  })

  it('merges a single pasted line inline and keeps the caret after it', () => {
    const target = createBlock('bulleted_list_item', { content: [{ text: 'XY' }] })
    const blocks = doc(target)
    const focus = pasteBlocksIntoTextBlock(blocks, target.id, { start: 1, end: 1 }, plainTextToBlocks('abc'))

    expect(texts(blocks)).toEqual(['bulleted_list_item:XabcY'])
    expect(focus).toEqual({ blockId: target.id, offset: 4 })
  })

  it('replaces the selected range', () => {
    const target = createBlock('paragraph', { content: [{ text: 'Hello world' }] })
    const blocks = doc(target)
    pasteBlocksIntoTextBlock(blocks, target.id, { start: 6, end: 11 }, plainTextToBlocks('there'))

    expect(texts(blocks)).toEqual(['paragraph:Hello there'])
  })

  it('lets an empty block adopt the type of a pasted heading', () => {
    const target = createBlock('paragraph')
    const blocks = doc(target)
    pasteBlocksIntoTextBlock(blocks, target.id, { start: 0, end: 0 }, [
      createBlock('heading_2', { content: [{ text: 'Title' }] }),
      createBlock('paragraph', { content: [{ text: 'Body' }] }),
    ])

    expect(texts(blocks)).toEqual(['heading_2:Title', 'paragraph:Body'])
    expect(blocks[0].id).toBe(target.id)
  })

  it('replaces an empty block with pasted non-text blocks (no stray paragraph)', () => {
    const target = createBlock('paragraph')
    const image = createBlock('image', { props: { url: 'https://a/b.png' } })
    const blocks = doc(createBlock('heading_1', { content: [{ text: 'H' }] }), target)
    const focus = pasteBlocksIntoTextBlock(blocks, target.id, { start: 0, end: 0 }, [image])

    expect(blocks.map(b => b.type)).toEqual(['heading_1', 'image'])
    expect(focus).toEqual({ blockId: image.id, offset: null })
  })

  it('splits text around a pasted non-text block', () => {
    const target = createBlock('paragraph', { content: [{ text: 'XY' }] })
    const blocks = doc(target)
    pasteBlocksIntoTextBlock(blocks, target.id, { start: 1, end: 1 }, [createBlock('divider')])

    expect(texts(blocks)).toEqual(['paragraph:X', 'divider:', 'paragraph:Y'])
  })

  it('keeps the target after a non-text paste at the very start', () => {
    const target = createBlock('quote', { content: [{ text: 'XY' }] })
    const blocks = doc(target)
    const focus = pasteBlocksIntoTextBlock(blocks, target.id, { start: 0, end: 0 }, [createBlock('divider')])

    expect(texts(blocks)).toEqual(['divider:', 'quote:XY'])
    expect(focus).toEqual({ blockId: target.id, offset: 0 })
  })

  it('appends the tail to the last pasted text block', () => {
    const target = createBlock('paragraph', { content: [{ text: 'XY' }] })
    const blocks = doc(target)
    pasteBlocksIntoTextBlock(blocks, target.id, { start: 1, end: 1 }, [
      createBlock('paragraph', { content: [{ text: 'a' }] }),
      createBlock('divider'),
      createBlock('heading_3', { content: [{ text: 'h' }] }),
    ])

    expect(texts(blocks)).toEqual(['paragraph:Xa', 'divider:', 'heading_3:hY'])
  })

  it('inserts after a non-text target', () => {
    const code = createBlock('code')
    const blocks = doc(code)
    pasteBlocksIntoTextBlock(blocks, code.id, { start: 0, end: 0 }, plainTextToBlocks('a'))

    expect(blocks.map(b => b.type)).toEqual(['code', 'paragraph'])
  })
})
