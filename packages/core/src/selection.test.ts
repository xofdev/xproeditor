/**
 * Run with: npx vitest run resources/js/pro-editor/blocks/selection.test.ts
 */
import { describe, expect, it } from 'vitest'
import { createBlock } from './ops'
import {
  applyMarkToTextRange,
  deleteTextRange,
  extractTextRangeAsBlocks,
  getTextRangeSegments,
  isCrossBlockTextRange,
  isTextRangeCollapsed,
  normalizeTextRange,
  rangeHasMarkAcrossSegments,
} from './selection'
import type { Block } from './types'

function p(id: string, text: string): Block {
  return createBlock('paragraph', { id, content: [{ text }] })
}

describe('normalizeTextRange', () => {
  const visible = [p('a', 'hello'), p('b', 'world'), p('c', 'test')]

  it('orders backward selection by document position', () => {
    const range = {
      anchor: { blockId: 'c', offset: 2 },
      focus: { blockId: 'a', offset: 1 },
    }

    expect(normalizeTextRange(range, visible)).toEqual({
      startBlockId: 'a',
      startOffset: 1,
      endBlockId: 'c',
      endOffset: 2,
    })
  })

  it('clamps offsets to block length', () => {
    const range = {
      anchor: { blockId: 'a', offset: 999 },
      focus: { blockId: 'a', offset: 999 },
    }

    expect(normalizeTextRange(range, visible)).toEqual({
      startBlockId: 'a',
      startOffset: 5,
      endBlockId: 'a',
      endOffset: 5,
    })
  })
})

describe('getTextRangeSegments', () => {
  const visible = [p('a', 'hello'), p('b', 'world'), p('c', 'test')]

  it('returns three segments for cross-block range', () => {
    const range = {
      anchor: { blockId: 'a', offset: 2 },
      focus: { blockId: 'c', offset: 2 },
    }

    const segments = getTextRangeSegments(range, visible, visible)

    expect(segments).toHaveLength(3)
    expect(segments[0]).toMatchObject({ blockId: 'a', start: 2, end: 5, fullBlock: false })
    expect(segments[1]).toMatchObject({ blockId: 'b', start: 0, end: 5, fullBlock: true })
    expect(segments[2]).toMatchObject({ blockId: 'c', start: 0, end: 2, fullBlock: false })
  })
})

describe('deleteTextRange', () => {
  it('deletes within a single block', () => {
    const blocks = [p('a', 'hello world')]
    const range = {
      anchor: { blockId: 'a', offset: 5 },
      focus: { blockId: 'a', offset: 11 },
    }

    const result = deleteTextRange(blocks, range, blocks)

    expect(result).toEqual({ focusBlockId: 'a', focusOffset: 5 })
    expect(blocks[0].content).toEqual([{ text: 'hello' }])
  })

  it('merges across three blocks', () => {
    const blocks = [p('a', 'aaa'), p('b', 'bbb'), p('c', 'ccc')]
    const range = {
      anchor: { blockId: 'a', offset: 1 },
      focus: { blockId: 'c', offset: 2 },
    }

    const result = deleteTextRange(blocks, range, blocks)

    expect(result).toEqual({ focusBlockId: 'a', focusOffset: 1 })
    expect(blocks).toHaveLength(1)
    expect(blocks[0].content).toEqual([{ text: 'ac' }])
  })
})

describe('extractTextRangeAsBlocks', () => {
  it('extracts sliced content preserving block types', () => {
    const blocks = [
      createBlock('heading_1', { id: 'a', content: [{ text: 'Title' }] }),
      p('b', 'body'),
    ]
    const range = {
      anchor: { blockId: 'a', offset: 0 },
      focus: { blockId: 'b', offset: 2 },
    }

    const extracted = extractTextRangeAsBlocks(range, blocks, blocks)

    expect(extracted).toHaveLength(2)
    expect(extracted[0].type).toBe('heading_1')
    expect(extracted[0].content).toEqual([{ text: 'Title' }])
    expect(extracted[1].content).toEqual([{ text: 'bo' }])
  })
})

describe('applyMarkToTextRange', () => {
  it('applies bold across multiple blocks', () => {
    const blocks = [p('a', 'aa'), p('b', 'bb')]
    const range = {
      anchor: { blockId: 'a', offset: 1 },
      focus: { blockId: 'b', offset: 1 },
    }

    applyMarkToTextRange(blocks, range, blocks, 'bold', true)

    expect(rangeHasMarkAcrossSegments(range, blocks, blocks, 'bold')).toBe(true)
  })
})

describe('isCrossBlockTextRange', () => {
  it('detects collapsed and single-block ranges', () => {
    const blocks = [p('a', 'hi'), p('b', 'yo')]

    expect(isCrossBlockTextRange(
      { anchor: { blockId: 'a', offset: 0 }, focus: { blockId: 'a', offset: 0 } },
      blocks,
    )).toBe(false)

    expect(isCrossBlockTextRange(
      { anchor: { blockId: 'a', offset: 0 }, focus: { blockId: 'a', offset: 2 } },
      blocks,
    )).toBe(false)

    expect(isCrossBlockTextRange(
      { anchor: { blockId: 'a', offset: 0 }, focus: { blockId: 'b', offset: 1 } },
      blocks,
    )).toBe(true)

    expect(isTextRangeCollapsed(
      { anchor: { blockId: 'a', offset: 1 }, focus: { blockId: 'a', offset: 1 } },
      blocks,
    )).toBe(true)
  })
})
