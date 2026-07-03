import {
  applyMarkToRange,
  cloneBlock,
  deleteRangeInSpans,
  normalizeSpans,
  rangeHasMark,
  rangeMarkValue,
  sliceSpans,
  spansToText,
  splitSpansAt,
} from './ops'
import type { Block, MarkName } from './types'
import { isTextBlock } from './types'

export type TextPoint = { blockId: string; offset: number }

export type TextRangeSelection = {
  anchor: TextPoint
  focus: TextPoint
}

export interface NormalizedTextRange {
  startBlockId: string
  startOffset: number
  endBlockId: string
  endOffset: number
}

export interface TextRangeSegment {
  blockId: string
  block: Block
  start: number
  end: number
  fullBlock: boolean
}

function blockLength(block: Block): number {
  return isTextBlock(block.type) ? spansToText(block.content).length : 0
}

function visibleTextBlockIndex(visibleBlocks: Block[], blockId: string): number {
  return visibleBlocks.findIndex(b => b.id === blockId && isTextBlock(b.type))
}

function clampOffset(block: Block, offset: number): number {
  return Math.max(0, Math.min(offset, blockLength(block)))
}

/** Order anchor/focus into document order using visible text blocks. */
export function normalizeTextRange(
  range: TextRangeSelection,
  visibleBlocks: Block[],
): NormalizedTextRange | null {
  const anchorIdx = visibleTextBlockIndex(visibleBlocks, range.anchor.blockId)
  const focusIdx = visibleTextBlockIndex(visibleBlocks, range.focus.blockId)

  if (anchorIdx === -1 || focusIdx === -1) {
    return null
  }

  const anchorBlock = visibleBlocks[anchorIdx]
  const focusBlock = visibleBlocks[focusIdx]
  const anchorOffset = clampOffset(anchorBlock, range.anchor.offset)
  const focusOffset = clampOffset(focusBlock, range.focus.offset)

  if (anchorIdx < focusIdx || (anchorIdx === focusIdx && anchorOffset <= focusOffset)) {
    return {
      startBlockId: range.anchor.blockId,
      startOffset: anchorOffset,
      endBlockId: range.focus.blockId,
      endOffset: focusOffset,
    }
  }

  return {
    startBlockId: range.focus.blockId,
    startOffset: focusOffset,
    endBlockId: range.anchor.blockId,
    endOffset: anchorOffset,
  }
}

export function isTextRangeCollapsed(
  range: TextRangeSelection,
  visibleBlocks: Block[],
): boolean {
  const normalized = normalizeTextRange(range, visibleBlocks)

  if (!normalized) {
    return true
  }

  return normalized.startBlockId === normalized.endBlockId
    && normalized.startOffset === normalized.endOffset
}

export function isCrossBlockTextRange(
  range: TextRangeSelection,
  visibleBlocks: Block[],
): boolean {
  const normalized = normalizeTextRange(range, visibleBlocks)

  if (!normalized) {
    return false
  }

  return normalized.startBlockId !== normalized.endBlockId
}

/** Segments for each text block touched by the range. */
export function getTextRangeSegments(
  range: TextRangeSelection,
  blocks: Block[],
  visibleBlocks: Block[],
): TextRangeSegment[] {
  const normalized = normalizeTextRange(range, visibleBlocks)

  if (!normalized || isTextRangeCollapsed(range, visibleBlocks)) {
    return []
  }

  const startIdx = visibleTextBlockIndex(visibleBlocks, normalized.startBlockId)
  const endIdx = visibleTextBlockIndex(visibleBlocks, normalized.endBlockId)

  if (startIdx === -1 || endIdx === -1) {
    return []
  }

  const segments: TextRangeSegment[] = []

  for (let i = startIdx; i <= endIdx; i++) {
    const visible = visibleBlocks[i]

    if (!isTextBlock(visible.type)) {
      continue
    }

    const block = blocks.find(b => b.id === visible.id)

    if (!block || !isTextBlock(block.type)) {
      continue
    }

    const len = blockLength(block)
    let start = 0
    let end = len

    if (i === startIdx) {
      start = normalized.startOffset
    }

    if (i === endIdx) {
      end = normalized.endOffset
    }

    if (end <= start) {
      continue
    }

    segments.push({
      blockId: block.id,
      block,
      start,
      end,
      fullBlock: start === 0 && end >= len,
    })
  }

  return segments
}

export function isBlockFullySelected(
  blockId: string,
  range: TextRangeSelection,
  blocks: Block[],
  visibleBlocks: Block[],
): boolean {
  const block = blocks.find(b => b.id === blockId)

  if (!block || !isTextBlock(block.type)) {
    return false
  }

  const segments = getTextRangeSegments(range, blocks, visibleBlocks)
  const segment = segments.find(s => s.blockId === blockId)

  if (!segment) {
    return false
  }

  return segment.fullBlock
}

export function getPartialTextHighlight(
  blockId: string,
  range: TextRangeSelection,
  blocks: Block[],
  visibleBlocks: Block[],
): { start: number; end: number } | null {
  const segments = getTextRangeSegments(range, blocks, visibleBlocks)
  const segment = segments.find(s => s.blockId === blockId)

  if (!segment || segment.fullBlock) {
    return null
  }

  return { start: segment.start, end: segment.end }
}

export interface DeleteTextRangeResult {
  focusBlockId: string
  focusOffset: number
}

/** Mutates `blocks` in place. Returns caret position after delete. */
export function deleteTextRange(
  blocks: Block[],
  range: TextRangeSelection,
  visibleBlocks: Block[],
): DeleteTextRangeResult | null {
  const normalized = normalizeTextRange(range, visibleBlocks)

  if (!normalized || isTextRangeCollapsed(range, visibleBlocks)) {
    return null
  }

  const startIdx = blocks.findIndex(b => b.id === normalized.startBlockId)
  const endIdx = blocks.findIndex(b => b.id === normalized.endBlockId)

  if (startIdx === -1 || endIdx === -1) {
    return null
  }

  const startBlock = blocks[startIdx]
  const endBlock = blocks[endIdx]

  if (!isTextBlock(startBlock.type) || !isTextBlock(endBlock.type)) {
    return null
  }

  if (normalized.startBlockId === normalized.endBlockId) {
    startBlock.content = deleteRangeInSpans(
      startBlock.content,
      normalized.startOffset,
      normalized.endOffset,
    )

    return { focusBlockId: startBlock.id, focusOffset: normalized.startOffset }
  }

  const [before] = splitSpansAt(startBlock.content, normalized.startOffset)
  const [, after] = splitSpansAt(endBlock.content, normalized.endOffset)
  startBlock.content = normalizeSpans([...before, ...after])

  const removeCount = endIdx - startIdx

  if (removeCount > 0) {
    blocks.splice(startIdx + 1, removeCount)
  }

  return {
    focusBlockId: startBlock.id,
    focusOffset: spansToText(before).length,
  }
}

/** Extract selected content as blocks for clipboard (cloned with new ids). */
export function extractTextRangeAsBlocks(
  range: TextRangeSelection,
  blocks: Block[],
  visibleBlocks: Block[],
): Block[] {
  const segments = getTextRangeSegments(range, blocks, visibleBlocks)

  return segments.map((segment) => {
    const content = sliceSpans(segment.block.content, segment.start, segment.end)

    return cloneBlock({
      ...segment.block,
      content,
    })
  })
}

/** True when every segment in range is a full block (whole-block selection). */
export function isWholeBlockTextRange(
  range: TextRangeSelection,
  blocks: Block[],
  visibleBlocks: Block[],
): boolean {
  const segments = getTextRangeSegments(range, blocks, visibleBlocks)

  if (segments.length === 0) {
    return false
  }

  return segments.every(s => s.fullBlock)
}

/** Mutates blocks in place — apply mark to every segment in the range. */
export function applyMarkToTextRange(
  blocks: Block[],
  range: TextRangeSelection,
  visibleBlocks: Block[],
  mark: MarkName,
  value: boolean | string | null,
): void {
  const segments = getTextRangeSegments(range, blocks, visibleBlocks)

  for (const segment of segments) {
    const block = blocks.find(b => b.id === segment.blockId)

    if (!block || !isTextBlock(block.type)) {
      continue
    }

    block.content = applyMarkToRange(block.content, segment.start, segment.end, mark, value)
  }
}

export function rangeHasMarkAcrossSegments(
  range: TextRangeSelection,
  blocks: Block[],
  visibleBlocks: Block[],
  mark: MarkName,
): boolean {
  const segments = getTextRangeSegments(range, blocks, visibleBlocks)

  if (segments.length === 0) {
    return false
  }

  return segments.every((segment) => {
    const block = blocks.find(b => b.id === segment.blockId)

    if (!block || !isTextBlock(block.type)) {
      return false
    }

    return rangeHasMark(block.content, segment.start, segment.end, mark)
  })
}

export function rangeMarkValueAcrossSegments(
  range: TextRangeSelection,
  blocks: Block[],
  visibleBlocks: Block[],
  mark: 'color' | 'highlight' | 'link',
): string | null {
  const segments = getTextRangeSegments(range, blocks, visibleBlocks)

  if (segments.length === 0) {
    return null
  }

  let unified: string | null | undefined

  for (const segment of segments) {
    const block = blocks.find(b => b.id === segment.blockId)

    if (!block || !isTextBlock(block.type)) {
      return null
    }

    const value = rangeMarkValue(block.content, segment.start, segment.end, mark)

    if (value === null) {
      return null
    }

    if (unified === undefined) {
      unified = value
    } else if (unified !== value) {
      return null
    }
  }

  return unified ?? null
}

/** Build a text range selecting full content of visible text blocks from first to last. */
export function fullBlockTextRange(visibleBlocks: Block[]): TextRangeSelection | null {
  const textBlocks = visibleBlocks.filter(b => isTextBlock(b.type))

  if (textBlocks.length === 0) {
    return null
  }

  const first = textBlocks[0]
  const last = textBlocks[textBlocks.length - 1]

  return {
    anchor: { blockId: first.id, offset: 0 },
    focus: { blockId: last.id, offset: blockLength(last) },
  }
}

/** Build a text range selecting full content of a single block. */
export function fullBlockContentRange(block: Block): TextRangeSelection | null {
  if (!isTextBlock(block.type)) {
    return null
  }

  const len = blockLength(block)

  return {
    anchor: { blockId: block.id, offset: 0 },
    focus: { blockId: block.id, offset: len },
  }
}
