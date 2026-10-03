import { createBlock, normalizeSpans, spansToText, splitSpansAt } from './ops'
import type { Block, InlineSpan } from './types'
import { isTextBlock } from './types'

/** Where the caret should go after a paste. `offset: null` = select the block. */
export interface PasteFocus {
  blockId: string
  offset: number | null
}

export type PasteBlockFactory = (type: 'paragraph', partial: Partial<Block>) => Block

/** Split pasted plain text into one paragraph per line. */
export function plainTextToBlocks(text: string, makeBlock: PasteBlockFactory = createBlock): Block[] {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(line => makeBlock('paragraph', { content: line ? [{ text: line }] : [] }))
}

/**
 * Paste `pasted` blocks into the text block `targetId`, replacing the
 * `[start, end)` range of its text. Mutates `blocks` in place.
 *
 * The text before the caret joins the first pasted block and the text after
 * the caret joins the last one, so `X|Y` + `a⏎b` gives `Xa`, `bY` — the
 * same as Notion, Google Docs and every native text field. A non-text block
 * (image, table, …) splits the target around itself; pasting into an empty
 * block replaces it.
 */
export function pasteBlocksIntoTextBlock(
  blocks: Block[],
  targetId: string,
  range: { start: number; end: number },
  pasted: Block[],
  makeBlock: PasteBlockFactory = createBlock,
): PasteFocus | null {
  const idx = blocks.findIndex(b => b.id === targetId)
  const target = blocks[idx]

  if (!target || pasted.length === 0) {
    return null
  }

  const start = Math.max(0, Math.min(range.start, range.end))
  const end = Math.max(range.start, range.end)
  const [before, rest] = splitSpansAt(target.content, start)
  const [, after] = splitSpansAt(rest, end - start)
  const hasBefore = spansToText(before).length > 0
  const hasAfter = spansToText(after).length > 0
  const first = pasted[0]

  if (!isTextBlock(target.type)) {
    blocks.splice(idx + 1, 0, ...pasted)

    return focusAtEnd(pasted[pasted.length - 1])
  }

  if (isTextBlock(first.type)) {
    if (!hasBefore && !hasAfter && first.type !== 'paragraph') {
      // Empty target adopts the pasted block's type (e.g. pasting a heading).
      target.type = first.type
      target.props = {
        ...first.props,
        ...(target.props.indent ? { indent: target.props.indent } : {}),
        ...(target.props.dir && !first.props.dir ? { dir: target.props.dir } : {}),
      }
    }

    target.content = normalizeSpans([...before, ...first.content])
    const others = pasted.slice(1)

    if (others.length === 0) {
      const offset = spansToText(target.content).length
      target.content = normalizeSpans([...target.content, ...after])

      return { blockId: target.id, offset }
    }

    blocks.splice(idx + 1, 0, ...others)

    return attachTail(blocks, others[others.length - 1], after, hasAfter, target, makeBlock)
  }

  // First pasted block is not text (image, table, code, …).
  if (!hasBefore && !hasAfter) {
    blocks.splice(idx, 1, ...pasted)

    return focusAtEnd(pasted[pasted.length - 1])
  }

  if (!hasBefore) {
    // Caret at the very start: keep the target (with its text) after the paste.
    blocks.splice(idx, 0, ...pasted)
    target.content = normalizeSpans(after)

    return { blockId: target.id, offset: 0 }
  }

  target.content = normalizeSpans(before)
  blocks.splice(idx + 1, 0, ...pasted)

  return attachTail(blocks, pasted[pasted.length - 1], after, hasAfter, target, makeBlock)
}

function attachTail(
  blocks: Block[],
  last: Block,
  after: InlineSpan[],
  hasAfter: boolean,
  target: Block,
  makeBlock: PasteBlockFactory,
): PasteFocus {
  if (!hasAfter) {
    return focusAtEnd(last)
  }

  if (isTextBlock(last.type)) {
    const offset = spansToText(last.content).length
    last.content = normalizeSpans([...last.content, ...after])

    return { blockId: last.id, offset }
  }

  const tail = makeBlock('paragraph', {
    content: normalizeSpans(after),
    props: target.props.indent ? { indent: target.props.indent } : {},
  })
  blocks.splice(blocks.indexOf(last) + 1, 0, tail)

  return { blockId: tail.id, offset: 0 }
}

function focusAtEnd(block: Block): PasteFocus {
  if (isTextBlock(block.type)) {
    return { blockId: block.id, offset: spansToText(block.content).length }
  }

  if (block.type === 'code') {
    return { blockId: block.id, offset: (block.props.code ?? '').length }
  }

  return { blockId: block.id, offset: null }
}
