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

/**
 * Exclusive end offset for a selection endpoint on `block`.
 * Text blocks use content length; non-text blocks use 1 (whole-block edge).
 */
export function selectionEndOffset(block: Block): number {
  return isTextBlock(block.type) ? blockLength(block) : 1
}

function visibleBlockIndex(visibleBlocks: Block[], blockId: string): number {
  return visibleBlocks.findIndex(b => b.id === blockId)
}

function clampOffset(block: Block, offset: number): number {
  if (!isTextBlock(block.type)) {
    return Math.max(0, Math.min(offset, 1))
  }

  return Math.max(0, Math.min(offset, blockLength(block)))
}

function pointOrderKey(
  block: Block,
  offset: number,
  index: number,
): { index: number; offset: number } {
  return { index, offset: clampOffset(block, offset) }
}

/** Order anchor/focus into document order using visible blocks (text + non-text). */
export function normalizeTextRange(
  range: TextRangeSelection,
  visibleBlocks: Block[],
): NormalizedTextRange | null {
  const anchorIdx = visibleBlockIndex(visibleBlocks, range.anchor.blockId)
  const focusIdx = visibleBlockIndex(visibleBlocks, range.focus.blockId)

  if (anchorIdx === -1 || focusIdx === -1) {
    return null
  }

  const anchorBlock = visibleBlocks[anchorIdx]
  const focusBlock = visibleBlocks[focusIdx]
  const anchor = pointOrderKey(anchorBlock, range.anchor.offset, anchorIdx)
  const focus = pointOrderKey(focusBlock, range.focus.offset, focusIdx)

  if (anchor.index < focus.index || (anchor.index === focus.index && anchor.offset <= focus.offset)) {
    return {
      startBlockId: range.anchor.blockId,
      startOffset: anchor.offset,
      endBlockId: range.focus.blockId,
      endOffset: focus.offset,
    }
  }

  return {
    startBlockId: range.focus.blockId,
    startOffset: focus.offset,
    endBlockId: range.anchor.blockId,
    endOffset: anchor.offset,
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

/** True when the range spans multiple blocks or covers a whole non-text block. */
export function isManagedMultiBlockRange(
  range: TextRangeSelection,
  visibleBlocks: Block[],
): boolean {
  const normalized = normalizeTextRange(range, visibleBlocks)

  if (!normalized || isTextRangeCollapsed(range, visibleBlocks)) {
    return false
  }

  if (normalized.startBlockId !== normalized.endBlockId) {
    return true
  }

  const block = visibleBlocks.find(b => b.id === normalized.startBlockId)

  return !!block && !isTextBlock(block.type)
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

  const startIdx = visibleBlockIndex(visibleBlocks, normalized.startBlockId)
  const endIdx = visibleBlockIndex(visibleBlocks, normalized.endBlockId)

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

  if (!block) {
    return false
  }

  if (!isTextBlock(block.type)) {
    return isBlockCoveredByTextRange(blockId, range, blocks, visibleBlocks)
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

  if (startIdx === endIdx) {
    if (isTextBlock(startBlock.type)) {
      startBlock.content = deleteRangeInSpans(
        startBlock.content,
        normalized.startOffset,
        normalized.endOffset,
      )

      return { focusBlockId: startBlock.id, focusOffset: normalized.startOffset }
    }

    blocks.splice(startIdx, 1)
    const neighbor = blocks[Math.min(startIdx, blocks.length - 1)]

    if (!neighbor) {
      return null
    }

    return {
      focusBlockId: neighbor.id,
      focusOffset: isTextBlock(neighbor.type) ? 0 : 0,
    }
  }

  const before = isTextBlock(startBlock.type)
    ? splitSpansAt(startBlock.content, normalized.startOffset)[0]
    : []
  const after = isTextBlock(endBlock.type)
    ? splitSpansAt(endBlock.content, normalized.endOffset)[1]
    : []

  if (isTextBlock(startBlock.type) && isTextBlock(endBlock.type)) {
    startBlock.content = normalizeSpans([...before, ...after])
    blocks.splice(startIdx + 1, endIdx - startIdx)

    return {
      focusBlockId: startBlock.id,
      focusOffset: spansToText(before).length,
    }
  }

  if (isTextBlock(startBlock.type)) {
    startBlock.content = normalizeSpans(before)
    blocks.splice(startIdx + 1, endIdx - startIdx)

    return {
      focusBlockId: startBlock.id,
      focusOffset: spansToText(before).length,
    }
  }

  if (isTextBlock(endBlock.type)) {
    endBlock.content = normalizeSpans(after)
    blocks.splice(startIdx, endIdx - startIdx)

    return {
      focusBlockId: endBlock.id,
      focusOffset: 0,
    }
  }

  blocks.splice(startIdx, endIdx - startIdx + 1)
  const neighbor = blocks[Math.min(startIdx, blocks.length - 1)]

  if (!neighbor) {
    return null
  }

  return {
    focusBlockId: neighbor.id,
    focusOffset: isTextBlock(neighbor.type) ? 0 : 0,
  }
}

/**
 * True when a block sits inside a managed cross-block range (including
 * non-text blocks between the endpoints — images, code, dividers, etc.).
 */
export function isBlockCoveredByTextRange(
  blockId: string,
  range: TextRangeSelection,
  blocks: Block[],
  visibleBlocks: Block[],
): boolean {
  const normalized = normalizeTextRange(range, visibleBlocks)

  if (!normalized || isTextRangeCollapsed(range, visibleBlocks)) {
    return false
  }

  const startIdx = blocks.findIndex(b => b.id === normalized.startBlockId)
  const endIdx = blocks.findIndex(b => b.id === normalized.endBlockId)
  const idx = blocks.findIndex(b => b.id === blockId)

  if (startIdx === -1 || endIdx === -1 || idx === -1) {
    return false
  }

  if (idx < startIdx || idx > endIdx) {
    return false
  }

  const block = blocks[idx]

  if (!isTextBlock(block.type)) {
    // Endpoint non-text: covered when the range actually includes the block edge.
    if (idx === startIdx && normalized.startOffset >= 1) {
      return false
    }

    if (idx === endIdx && normalized.endOffset <= 0) {
      return false
    }

    return true
  }

  return isBlockFullySelected(blockId, range, blocks, visibleBlocks)
    || getPartialTextHighlight(blockId, range, blocks, visibleBlocks) !== null
}

/** Extract selected content as blocks for clipboard (cloned with new ids). */
export function extractTextRangeAsBlocks(
  range: TextRangeSelection,
  blocks: Block[],
  visibleBlocks: Block[],
): Block[] {
  const normalized = normalizeTextRange(range, visibleBlocks)

  if (!normalized || isTextRangeCollapsed(range, visibleBlocks)) {
    return []
  }

  const startIdx = blocks.findIndex(b => b.id === normalized.startBlockId)
  const endIdx = blocks.findIndex(b => b.id === normalized.endBlockId)

  if (startIdx === -1 || endIdx === -1) {
    return []
  }

  const result: Block[] = []

  for (let i = startIdx; i <= endIdx; i++) {
    const block = blocks[i]

    if (!isTextBlock(block.type)) {
      if (i === startIdx && normalized.startOffset >= 1) {
        continue
      }

      if (i === endIdx && normalized.endOffset <= 0) {
        continue
      }

      result.push(cloneBlock(block))
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

    result.push(cloneBlock({
      ...block,
      content: sliceSpans(block.content, start, end),
    }))
  }

  return result
}

/** True when every segment in range is a full block (whole-block selection). */
export function isWholeBlockTextRange(
  range: TextRangeSelection,
  blocks: Block[],
  visibleBlocks: Block[],
): boolean {
  const segments = getTextRangeSegments(range, blocks, visibleBlocks)

  if (segments.length === 0) {
    return isManagedMultiBlockRange(range, visibleBlocks)
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

/** Build a text range selecting every visible block from first to last. */
export function fullBlockTextRange(visibleBlocks: Block[]): TextRangeSelection | null {
  if (visibleBlocks.length === 0) {
    return null
  }

  const first = visibleBlocks[0]
  const last = visibleBlocks[visibleBlocks.length - 1]

  return {
    anchor: { blockId: first.id, offset: 0 },
    focus: { blockId: last.id, offset: selectionEndOffset(last) },
  }
}

/** Build a text range selecting full content of a single block. */
export function fullBlockContentRange(block: Block): TextRangeSelection | null {
  return {
    anchor: { blockId: block.id, offset: 0 },
    focus: { blockId: block.id, offset: selectionEndOffset(block) },
  }
}

/** True when `range` already covers every visible block (document select-all). */
export function isFullDocumentRange(
  range: TextRangeSelection,
  visibleBlocks: Block[],
): boolean {
  const full = fullBlockTextRange(visibleBlocks)

  if (!full) {
    return false
  }

  const normalized = normalizeTextRange(range, visibleBlocks)
  const fullNormalized = normalizeTextRange(full, visibleBlocks)

  if (!normalized || !fullNormalized) {
    return false
  }

  return normalized.startBlockId === fullNormalized.startBlockId
    && normalized.startOffset === fullNormalized.startOffset
    && normalized.endBlockId === fullNormalized.endBlockId
    && normalized.endOffset === fullNormalized.endOffset
}

/** Two-stage Ctrl/Cmd+A: in-block first, then whole document. */
export type SelectAllStage = 'none' | 'block' | 'document'

export type SelectAllAction = 'select-block' | 'select-document' | 'noop'

/**
 * Decide the next select-all action from the current stage and whether the
 * active block / document is already fully selected (browser or managed).
 */
export function resolveSelectAllShortcut(input: {
  stage: SelectAllStage
  documentAlreadySelected: boolean
  blockAlreadySelected: boolean
  hasActiveBlock: boolean
}): { action: SelectAllAction; stage: SelectAllStage } {
  if (input.documentAlreadySelected || input.stage === 'document') {
    return { action: 'noop', stage: 'document' }
  }

  if (input.stage === 'block' || input.blockAlreadySelected) {
    return { action: 'select-document', stage: 'document' }
  }

  if (!input.hasActiveBlock) {
    return { action: 'select-document', stage: 'document' }
  }

  return { action: 'select-block', stage: 'block' }
}

export type HistoryShortcut = 'undo' | 'redo'

/**
 * Map Ctrl/Cmd+Z / Shift+Ctrl/Cmd+Z / Ctrl+Y to document history actions.
 * Callers must invoke this before any contenteditable/textarea bail-out so
 * editor history wins over the browser's field-local undo stack.
 */
export function resolveHistoryShortcut(input: {
  key: string
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
}): HistoryShortcut | null {
  if (!(input.ctrlKey || input.metaKey)) return null

  const key = input.key.toLowerCase()

  if (key === 'z') return input.shiftKey ? 'redo' : 'undo'
  if (key === 'y') return 'redo'

  return null
}
