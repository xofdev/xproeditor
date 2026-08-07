/**
 * Run with: npx vitest run packages/core/src/selection.test.ts
 */
import { describe, expect, it } from 'vitest'
import { applyMarkToRange, createBlock, rangeMarkValue } from './ops'
import {
  applyMarkToTextRange,
  deleteTextRange,
  extractTextRangeAsBlocks,
  fullBlockTextRange,
  getTextRangeSegments,
  isBlockCoveredByTextRange,
  isCrossBlockTextRange,
  isFullDocumentRange,
  isManagedMultiBlockRange,
  isTextRangeCollapsed,
  normalizeTextRange,
  rangeHasMarkAcrossSegments,
  rangeMarkValueAcrossSegments,
  resolveHistoryShortcut,
  resolveSelectAllShortcut,
  selectionEndOffset,
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

  it('accepts non-text block endpoints', () => {
    const blocks = [
      p('a', 'hello'),
      createBlock('divider', { id: 'd' }),
      p('b', 'world'),
    ]
    const range = {
      anchor: { blockId: 'a', offset: 0 },
      focus: { blockId: 'd', offset: 1 },
    }

    expect(normalizeTextRange(range, blocks)).toEqual({
      startBlockId: 'a',
      startOffset: 0,
      endBlockId: 'd',
      endOffset: 1,
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

  it('deletes trailing non-text when range ends on it', () => {
    const blocks = [
      p('a', 'hello'),
      createBlock('button', { id: 'btn', content: [{ text: 'Go' }] }),
      createBlock('divider', { id: 'd' }),
    ]
    const range = {
      anchor: { blockId: 'a', offset: 0 },
      focus: { blockId: 'd', offset: 1 },
    }

    const result = deleteTextRange(blocks, range, blocks)

    expect(result?.focusBlockId).toBeDefined()
    expect(blocks.map(b => b.type)).not.toContain('divider')
    expect(blocks.every(b => b.id !== 'btn')).toBe(true)
  })

  it('deletes a single non-text block selection', () => {
    const blocks = [p('a', 'hi'), createBlock('divider', { id: 'd' }), p('b', 'yo')]
    const range = {
      anchor: { blockId: 'd', offset: 0 },
      focus: { blockId: 'd', offset: 1 },
    }

    const result = deleteTextRange(blocks, range, blocks)

    expect(blocks.map(b => b.id)).toEqual(['a', 'b'])
    expect(result?.focusBlockId).toBeTruthy()
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

  it('includes non-text blocks between text endpoints', () => {
    const blocks = [
      p('a', 'hello'),
      createBlock('divider', { id: 'd' }),
      createBlock('image', { id: 'img', props: { url: 'https://example.com/x.png' } }),
      p('b', 'world'),
    ]
    const range = {
      anchor: { blockId: 'a', offset: 0 },
      focus: { blockId: 'b', offset: 5 },
    }

    const extracted = extractTextRangeAsBlocks(range, blocks, blocks)

    expect(extracted.map(b => b.type)).toEqual([
      'paragraph',
      'divider',
      'image',
      'paragraph',
    ])
    expect(extracted[2].props.url).toBe('https://example.com/x.png')
  })

  it('includes trailing non-text when focus ends on it', () => {
    const blocks = [
      p('a', 'hello'),
      createBlock('button', { id: 'btn', content: [{ text: 'Click' }] }),
      createBlock('image', { id: 'img', props: { url: 'https://example.com/x.png' } }),
    ]
    const range = {
      anchor: { blockId: 'a', offset: 0 },
      focus: { blockId: 'img', offset: 1 },
    }

    const extracted = extractTextRangeAsBlocks(range, blocks, blocks)

    expect(extracted.map(b => b.type)).toEqual(['paragraph', 'button', 'image'])
  })
})

describe('isBlockCoveredByTextRange', () => {
  it('covers non-text between and at endpoints', () => {
    const blocks = [
      p('a', 'hello'),
      createBlock('divider', { id: 'd' }),
      p('b', 'world'),
    ]
    const throughDivider = {
      anchor: { blockId: 'a', offset: 0 },
      focus: { blockId: 'd', offset: 1 },
    }

    expect(isBlockCoveredByTextRange('d', throughDivider, blocks, blocks)).toBe(true)
    expect(isBlockCoveredByTextRange('a', throughDivider, blocks, blocks)).toBe(true)
    expect(isBlockCoveredByTextRange('b', throughDivider, blocks, blocks)).toBe(false)
  })
})

describe('fullBlockTextRange', () => {
  it('spans first to last including trailing non-text', () => {
    const blocks = [
      p('a', 'hello'),
      createBlock('divider', { id: 'd' }),
    ]

    expect(fullBlockTextRange(blocks)).toEqual({
      anchor: { blockId: 'a', offset: 0 },
      focus: { blockId: 'd', offset: 1 },
    })
    expect(selectionEndOffset(blocks[1])).toBe(1)
  })
})

describe('isFullDocumentRange', () => {
  it('matches fullBlockTextRange endpoints', () => {
    const blocks = [p('a', 'hi'), p('b', 'yo'), createBlock('divider', { id: 'd' })]
    const full = fullBlockTextRange(blocks)!

    expect(isFullDocumentRange(full, blocks)).toBe(true)
    expect(isFullDocumentRange({
      anchor: { blockId: 'a', offset: 0 },
      focus: { blockId: 'b', offset: 2 },
    }, blocks)).toBe(false)
  })
})

describe('resolveHistoryShortcut', () => {
  it('maps Ctrl/Cmd+Z, Shift+Z, and Ctrl+Y', () => {
    expect(resolveHistoryShortcut({
      key: 'z',
      ctrlKey: true,
      metaKey: false,
      shiftKey: false,
    })).toBe('undo')

    expect(resolveHistoryShortcut({
      key: 'z',
      ctrlKey: false,
      metaKey: true,
      shiftKey: false,
    })).toBe('undo')

    expect(resolveHistoryShortcut({
      key: 'z',
      ctrlKey: false,
      metaKey: true,
      shiftKey: true,
    })).toBe('redo')

    expect(resolveHistoryShortcut({
      key: 'y',
      ctrlKey: true,
      metaKey: false,
      shiftKey: false,
    })).toBe('redo')

    expect(resolveHistoryShortcut({
      key: 'z',
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
    })).toBeNull()
  })
})

describe('resolveSelectAllShortcut', () => {
  it('escalates none → block → document and noops at document', () => {
    expect(resolveSelectAllShortcut({
      stage: 'none',
      documentAlreadySelected: false,
      blockAlreadySelected: false,
      hasActiveBlock: true,
    })).toEqual({ action: 'select-block', stage: 'block' })

    expect(resolveSelectAllShortcut({
      stage: 'block',
      documentAlreadySelected: false,
      blockAlreadySelected: true,
      hasActiveBlock: true,
    })).toEqual({ action: 'select-document', stage: 'document' })

    expect(resolveSelectAllShortcut({
      stage: 'document',
      documentAlreadySelected: true,
      blockAlreadySelected: false,
      hasActiveBlock: false,
    })).toEqual({ action: 'noop', stage: 'document' })
  })

  it('escalates when the block is already fully selected without stage', () => {
    expect(resolveSelectAllShortcut({
      stage: 'none',
      documentAlreadySelected: false,
      blockAlreadySelected: true,
      hasActiveBlock: true,
    })).toEqual({ action: 'select-document', stage: 'document' })
  })

  it('selects the whole document when there is no active block', () => {
    expect(resolveSelectAllShortcut({
      stage: 'none',
      documentAlreadySelected: false,
      blockAlreadySelected: false,
      hasActiveBlock: false,
    })).toEqual({ action: 'select-document', stage: 'document' })
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

  it('applies and clears marks across whole-block multi-select ranges', () => {
    const blocks = [p('a', 'alpha'), p('b', 'bravo'), p('c', 'charlie')]
    const range = fullBlockTextRange(blocks)
    expect(range).not.toBeNull()

    applyMarkToTextRange(blocks, range!, blocks, 'bold', true)
    expect(rangeHasMarkAcrossSegments(range!, blocks, blocks, 'bold')).toBe(true)

    applyMarkToTextRange(blocks, range!, blocks, 'italic', true)
    expect(rangeHasMarkAcrossSegments(range!, blocks, blocks, 'italic')).toBe(true)

    applyMarkToTextRange(blocks, range!, blocks, 'color', '#ff0000')
    expect(rangeHasMarkAcrossSegments(range!, blocks, blocks, 'color')).toBe(true)

    applyMarkToTextRange(blocks, range!, blocks, 'bold', null)
    applyMarkToTextRange(blocks, range!, blocks, 'italic', null)
    applyMarkToTextRange(blocks, range!, blocks, 'color', null)
    expect(rangeHasMarkAcrossSegments(range!, blocks, blocks, 'bold')).toBe(false)
    expect(rangeHasMarkAcrossSegments(range!, blocks, blocks, 'italic')).toBe(false)
    expect(rangeHasMarkAcrossSegments(range!, blocks, blocks, 'color')).toBe(false)
  })

  it('applies and clears link marks across multi-block ranges', () => {
    const blocks = [p('a', 'alpha'), p('b', 'bravo')]
    const range = {
      anchor: { blockId: 'a', offset: 0 },
      focus: { blockId: 'b', offset: 5 },
    }

    applyMarkToTextRange(blocks, range, blocks, 'link', 'https://example.com')
    expect(rangeMarkValueAcrossSegments(range, blocks, blocks, 'link')).toBe('https://example.com')
    expect(rangeMarkValue(blocks[0]!.content, 0, 5, 'link')).toBe('https://example.com')
    expect(rangeMarkValue(blocks[1]!.content, 0, 5, 'link')).toBe('https://example.com')

    applyMarkToTextRange(blocks, range, blocks, 'link', null)
    expect(rangeMarkValueAcrossSegments(range, blocks, blocks, 'link')).toBeNull()
  })
})

describe('applyMarkToRange link', () => {
  it('writes and clears marks.link on a single-block range', () => {
    const block = p('a', 'hello world')
    block.content = applyMarkToRange(block.content, 0, 5, 'link', 'https://x.test')
    expect(rangeMarkValue(block.content, 0, 5, 'link')).toBe('https://x.test')
    expect(rangeMarkValue(block.content, 6, 11, 'link')).toBeNull()

    block.content = applyMarkToRange(block.content, 0, 5, 'link', null)
    expect(rangeMarkValue(block.content, 0, 5, 'link')).toBeNull()
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

  it('treats whole non-text selection as managed multi-block range', () => {
    const blocks = [p('a', 'hi'), createBlock('divider', { id: 'd' })]
    const range = {
      anchor: { blockId: 'd', offset: 0 },
      focus: { blockId: 'd', offset: 1 },
    }

    expect(isManagedMultiBlockRange(range, blocks)).toBe(true)
    expect(isTextRangeCollapsed(range, blocks)).toBe(false)
  })
})
