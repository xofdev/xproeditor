/**
 * Markdown-style typing shortcuts shared by both adapters.
 *
 * - Block shortcuts turn a paragraph into another block type when a prefix
 *   such as `# `, `- `, `1. ` or `[x] ` is typed at its start.
 * - Inline shortcuts apply a mark when the closing delimiter of `**bold**`,
 *   `*italic*`, `_italic_`, `` `code` `` or `~~strike~~` is typed.
 */

import { applyMarkToRange, deleteRangeInSpans, spansToText } from './ops'
import type { BlockProps, BlockType, InlineSpan, MarkName } from './types'

export interface BlockShortcutMatch {
  type: BlockType
  /** Characters of the prefix to strip from the start of the block. */
  prefixLength: number
  /** Extra props for the new block (e.g. `checked` for `[x] `). */
  props?: Partial<BlockProps>
}

const BLOCK_SHORTCUTS: Array<{ re: RegExp; type: BlockType; props?: (m: RegExpExecArray) => Partial<BlockProps> }> = [
  { re: /^### $/, type: 'heading_3' },
  { re: /^## $/, type: 'heading_2' },
  { re: /^# $/, type: 'heading_1' },
  { re: /^>> $/, type: 'toggle' },
  { re: /^> $/, type: 'quote' },
  { re: /^" $/, type: 'quote' },
  { re: /^[-*+] $/, type: 'bulleted_list_item' },
  { re: /^\d{1,3}[.)] $/, type: 'numbered_list_item' },
  { re: /^\[ ?\] $/, type: 'to_do', props: () => ({ checked: false }) },
  { re: /^\[[xX]\] $/, type: 'to_do', props: () => ({ checked: true }) },
]

/**
 * Detect a block-type shortcut typed at the start of a paragraph. Only fires
 * when the caret sits right after the prefix, so pasting `# ` mid-text or
 * editing an existing `- item` paragraph never converts it.
 */
export function matchBlockShortcut(text: string, caret: number | null): BlockShortcutMatch | null {
  if (caret === null || caret < 2 || caret > 6) {
    return null
  }

  const prefix = text.slice(0, caret)

  for (const shortcut of BLOCK_SHORTCUTS) {
    const m = shortcut.re.exec(prefix)

    if (m) {
      return { type: shortcut.type, prefixLength: caret, props: shortcut.props?.(m) }
    }
  }

  return null
}

export interface InlineShortcutResult {
  spans: InlineSpan[]
  /** Caret offset after the delimiters were removed. */
  caret: number
  mark: MarkName
  /** Range that received the mark. */
  start: number
  end: number
}

const INLINE_SHORTCUTS: Array<{ re: RegExp; mark: MarkName; delimiter: number }> = [
  { re: /(^|[^*])\*\*([^*\s](?:[^*]*[^*\s])?)\*\*$/u, mark: 'bold', delimiter: 2 },
  { re: /(^|[^\p{L}\p{N}_])__([^_\s](?:[^_]*[^_\s])?)__$/u, mark: 'bold', delimiter: 2 },
  { re: /(^|[^~])~~([^~\s](?:[^~]*[^~\s])?)~~$/u, mark: 'strikethrough', delimiter: 2 },
  { re: /(^|[^`])`([^`]+)`$/u, mark: 'code', delimiter: 1 },
  { re: /(^|[^*\p{L}\p{N}])\*([^*\s](?:[^*]*[^*\s])?)\*$/u, mark: 'italic', delimiter: 1 },
  { re: /(^|[^\p{L}\p{N}_])_([^_\s](?:[^_]*[^_\s])?)_$/u, mark: 'italic', delimiter: 1 },
]

/**
 * Apply an inline Markdown shortcut whose closing delimiter ends at `caret`.
 * Returns the rewritten spans and the new caret, or null when nothing matched.
 * Text already inside inline code is left alone.
 */
export function applyInlineMarkdownShortcut(
  spans: InlineSpan[],
  caret: number | null,
): InlineShortcutResult | null {
  if (caret === null || caret < 3) {
    return null
  }

  const text = spansToText(spans)
  const before = text.slice(0, caret)

  for (const shortcut of INLINE_SHORTCUTS) {
    const m = shortcut.re.exec(before)

    if (!m) {
      continue
    }

    const d = shortcut.delimiter
    const inner = m[2]
    const openStart = m.index + m[1].length
    const closeStart = caret - d

    if (spanHasMarkAt(spans, openStart, 'code') || spanHasMarkAt(spans, closeStart, 'code')) {
      return null
    }

    // Remove the closing delimiter first so the opening offsets stay valid.
    let next = deleteRangeInSpans(spans, closeStart, caret)
    next = deleteRangeInSpans(next, openStart, openStart + d)
    next = applyMarkToRange(next, openStart, openStart + inner.length, shortcut.mark, true)

    return {
      spans: next,
      caret: caret - d * 2,
      mark: shortcut.mark,
      start: openStart,
      end: openStart + inner.length,
    }
  }

  return null
}

function spanHasMarkAt(spans: InlineSpan[], offset: number, mark: MarkName): boolean {
  let pos = 0

  for (const span of spans) {
    const end = pos + span.text.length

    if (offset >= pos && offset < end) {
      return !!span.marks?.[mark]
    }

    pos = end
  }

  return false
}

/**
 * After an inline shortcut, the browser keeps typing inside the formatted
 * element. Strip `mark` from text typed at `from..caret` so the formatting
 * stops at the closing delimiter, like Notion and Google Docs.
 */
export function exitMarkAfterShortcut(
  spans: InlineSpan[],
  from: number,
  caret: number,
  mark: MarkName,
): InlineSpan[] {
  if (caret <= from) {
    return spans
  }

  return applyMarkToRange(spans, from, caret, mark, null)
}
