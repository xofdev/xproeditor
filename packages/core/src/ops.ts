import { createDefaultTableData } from './table'
import type { Block, BlockProps, BlockType, InlineMarks, InlineSpan, MarkName } from './types'
import { isTextBlock } from './types'

let counter = 0

export function generateBlockId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  counter += 1

  return `blk-${Date.now().toString(36)}-${counter.toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function createBlock(
  type: BlockType,
  partial: Partial<Block> = {},
  options?: { defaultDir?: 'ltr' | 'rtl' },
): Block {
  const props: BlockProps = { ...(partial.props ?? {}) }

  if (
    options?.defaultDir &&
    props.dir === undefined &&
    (type === 'paragraph' ||
      type === 'heading_1' ||
      type === 'heading_2' ||
      type === 'heading_3' ||
      type === 'bulleted_list_item' ||
      type === 'numbered_list_item' ||
      type === 'to_do' ||
      type === 'toggle' ||
      type === 'quote' ||
      type === 'callout')
  ) {
    props.dir = options.defaultDir
  }

  if (type === 'code' && props.language === undefined) {
props.language = 'plaintext'
}

  if (type === 'code' && props.code === undefined) {
props.code = ''
}

  if (type === 'to_do' && props.checked === undefined) {
props.checked = false
}

  if (type === 'callout' && props.icon === undefined) {
props.icon = '💡'
}

  if ((type === 'video' || type === 'audio' || type === 'file') && props.url === undefined) {
props.url = ''
}

  if (type === 'video' && props.provider === undefined) {
props.provider = 'file'
}

  if (type === 'table' && !props.table) {
    props.table = createDefaultTableData()
  }

  return {
    id: partial.id ?? generateBlockId(),
    type,
    content: partial.content ?? [],
    props,
  }
}

export function cloneBlock(block: Block, newId = true): Block {
  const copy: Block = JSON.parse(JSON.stringify(block))

  if (newId) {
copy.id = generateBlockId()
}

  return copy
}

// ─── Span helpers ─────────────────────────────────────────────────────────────

export function spansToText(spans: InlineSpan[]): string {
  return spans.map(s => s.text).join('')
}

function marksEqual(a?: InlineMarks, b?: InlineMarks): boolean {
  const ka = a ? Object.keys(a).filter(k => (a as Record<string, unknown>)[k] !== undefined) : []
  const kb = b ? Object.keys(b).filter(k => (b as Record<string, unknown>)[k] !== undefined) : []

  if (ka.length !== kb.length) {
return false
}

  return ka.every(k => (a as Record<string, unknown>)[k] === (b as Record<string, unknown>)[k])
}

/** Merge adjacent spans with identical marks and drop empty ones. */
export function normalizeSpans(spans: InlineSpan[]): InlineSpan[] {
  const out: InlineSpan[] = []

  for (const span of spans) {
    const text = span.text ?? ''

    if (!text) {
continue
}

    const last = out[out.length - 1]

    if (last && marksEqual(last.marks, span.marks)) {
      last.text += text
    } else {
      out.push({ text, marks: span.marks ? { ...span.marks } : undefined })
    }
  }

  return out
}

/** Slice spans into [before start][start..end][after end]. */
export function splitSpansAt(spans: InlineSpan[], offset: number): [InlineSpan[], InlineSpan[]] {
  const before: InlineSpan[] = []
  const after: InlineSpan[] = []
  let pos = 0

  for (const span of spans) {
    const end = pos + span.text.length

    if (end <= offset) {
      before.push(span)
    } else if (pos >= offset) {
      after.push(span)
    } else {
      const cut = offset - pos
      before.push({ text: span.text.slice(0, cut), marks: span.marks ? { ...span.marks } : undefined })
      after.push({ text: span.text.slice(cut), marks: span.marks ? { ...span.marks } : undefined })
    }

    pos = end
  }

  return [normalizeSpans(before), normalizeSpans(after)]
}

export function sliceSpans(spans: InlineSpan[], start: number, end: number): InlineSpan[] {
  const [, rest] = splitSpansAt(spans, start)
  const [middle] = splitSpansAt(rest, end - start)

  return middle
}

/** True if every character in [start,end) carries the mark (link/color: any value). */
export function rangeHasMark(spans: InlineSpan[], start: number, end: number, mark: MarkName): boolean {
  if (end <= start) {
return false
}

  const middle = sliceSpans(spans, start, end)

  if (middle.length === 0) {
return false
}

  return middle.every(s => s.marks && s.marks[mark] !== undefined && s.marks[mark] !== false)
}

/** Uniform string mark value across [start,end), or null when mixed/absent. */
export function rangeMarkValue(
  spans: InlineSpan[],
  start: number,
  end: number,
  mark: 'color' | 'highlight' | 'link',
): string | null {
  if (end <= start) {
    return null
  }

  const middle = sliceSpans(spans, start, end)

  if (middle.length === 0) {
    return null
  }

  const values = middle.map((s) => {
    const value = s.marks?.[mark]

    return typeof value === 'string' ? value : null
  })

  if (values.some((value) => value === null)) {
    return null
  }

  const first = values[0]

  return values.every((value) => value === first) ? first : null
}

/**
 * Apply (or remove when value is false/undefined for booleans, null for valued marks)
 * a mark over [start,end).
 */
export function applyMarkToRange(
  spans: InlineSpan[],
  start: number,
  end: number,
  mark: MarkName,
  value: boolean | string | null,
): InlineSpan[] {
  if (end <= start) {
return spans
}

  const [before, rest] = splitSpansAt(spans, start)
  const [middle, after] = splitSpansAt(rest, end - start)
  const updated = middle.map((s) => {
    const marks: InlineMarks = { ...(s.marks ?? {}) }

    if (value === null || value === false) {
      delete marks[mark]
    } else {
      ;(marks as Record<string, boolean | string>)[mark] = value
    }

    const hasAny = Object.keys(marks).length > 0

    return { text: s.text, marks: hasAny ? marks : undefined }
  })

  return normalizeSpans([...before, ...updated, ...after])
}

/** Toggle a boolean mark over a range based on whether it's fully applied. */
export function toggleMarkInRange(spans: InlineSpan[], start: number, end: number, mark: MarkName): InlineSpan[] {
  const has = rangeHasMark(spans, start, end, mark)

  return applyMarkToRange(spans, start, end, mark, has ? null : true)
}

export function deleteRangeInSpans(spans: InlineSpan[], start: number, end: number): InlineSpan[] {
  const [before, rest] = splitSpansAt(spans, start)
  const [, after] = splitSpansAt(rest, end - start)

  return normalizeSpans([...before, ...after])
}

export function insertTextInSpans(spans: InlineSpan[], offset: number, text: string): InlineSpan[] {
  const [before, after] = splitSpansAt(spans, offset)
  // Inherit marks from the character before the caret (Notion behavior)
  const last = before[before.length - 1]
  const inherit = last?.marks ? { ...last.marks } : undefined

  return normalizeSpans([...before, { text, marks: inherit }, ...after])
}

// ─── Direction detection ──────────────────────────────────────────────────────

const RTL_CHAR = /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/

export function detectDir(text: string): 'rtl' | 'ltr' {
  for (const ch of text) {
    if (RTL_CHAR.test(ch)) {
return 'rtl'
}

    if (/[A-Za-z]/.test(ch)) {
return 'ltr'
}
  }

  return 'ltr'
}

/** Resolve layout direction for block chrome (gutter, list markers, callout icon). */
export function resolveBlockDirection(
  block: Block,
  editorDir: 'ltr' | 'rtl' = 'ltr',
): 'ltr' | 'rtl' {
  const explicit = block.props.dir

  if (explicit === 'rtl' || explicit === 'ltr') {
    return explicit
  }

  if (isTextBlock(block.type)) {
    const text = spansToText(block.content)

    if (text.trim()) {
      return detectDir(text)
    }
  }

  return editorDir
}
