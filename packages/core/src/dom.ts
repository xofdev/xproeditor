/** Caret/selection helpers for per-block contenteditable elements. */

// ─── Theme variable sync across portal boundaries ─────────────────────────────

/** Every `--xpe-*` custom property the editor packages read for theming. */
export const XPE_THEME_VARS = [
  '--xpe-background',
  '--xpe-foreground',
  '--xpe-muted-foreground',
  '--xpe-muted',
  '--xpe-border',
  '--xpe-primary',
  '--xpe-primary-foreground',
  '--xpe-primary-muted',
  '--xpe-surface',
  '--xpe-surface-hover',
  '--xpe-ring',
  '--xpe-danger',
  '--xpe-danger-muted',
  '--xpe-radius',
  '--xpe-shadow',
  '--xpe-font',
  '--xpe-font-mono',
  '--xpe-code-bg',
  '--xpe-code-fg',
  '--xpe-code-header-bg',
  '--xpe-code-muted',
] as const

/**
 * Copy resolved `--xpe-*` values from `source` onto `target` as inline
 * custom properties. Needed because floating UI (slash menu, popovers,
 * bubble toolbar) is portaled to `document.body` to escape clipping/overflow
 * — which also escapes any scoped theme class applied to an ancestor of the
 * editor, breaking CSS variable inheritance. Call this once the portaled
 * element exists, using any element still inside the themed scope (e.g. the
 * popover trigger, or the editor root) as `source`.
 *
 * Also mirrors the source's resolved `font-family` onto `--xpe-font` (and the
 * target's own `font-family`) so portaled chrome matches the editor even when
 * the host only set a CSS `font-family` on an ancestor, not `--xpe-font`.
 */
export function syncThemeVars(source: Element, target: HTMLElement): void {
  const computed = getComputedStyle(source)

  for (const name of XPE_THEME_VARS) {
    const value = computed.getPropertyValue(name).trim()

    if (value) {
      target.style.setProperty(name, value)
    }
  }

  const face = computed.fontFamily.trim()
  if (face) {
    target.style.setProperty('--xpe-font', face)
    target.style.fontFamily = 'var(--xpe-font)'
  }
}

// ─── Page scroll lock (for floating menus like the slash command popover) ────

let scrollLockCount = 0
let savedBodyOverflow = ''

/**
 * Reference-counted page-scroll lock: while any caller holds a lock, the
 * document can't scroll behind an open popover (Notion-style). Call the
 * returned function to release — safe to call multiple times.
 */
export function lockPageScroll(): () => void {
  if (typeof document === 'undefined') {
return () => {}
}

  if (scrollLockCount === 0) {
    savedBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }

  scrollLockCount++
  let released = false

  return () => {
    if (released) {
return
}

    released = true
    scrollLockCount = Math.max(0, scrollLockCount - 1)

    if (scrollLockCount === 0) {
      document.body.style.overflow = savedBodyOverflow
    }
  }
}

/** Text offset of a (node, nodeOffset) position inside `el`. BR elements count as 1 char. */
function positionToOffset(el: HTMLElement, node: Node, nodeOffset: number): number {
  const range = document.createRange()
  range.selectNodeContents(el)

  try {
    range.setEnd(node, nodeOffset)
  } catch {
    return 0
  }

  // Count text length + <br> occurrences within the range
  const frag = range.cloneContents()
  const brCount = frag.querySelectorAll?.('br').length ?? 0

  return (frag.textContent?.length ?? 0) + brCount
}

export function getSelectionOffsets(el: HTMLElement): { start: number; end: number } | null {
  const sel = window.getSelection()

  if (!sel || sel.rangeCount === 0) {
return null
}

  const range = sel.getRangeAt(0)

  if (!el.contains(range.startContainer) || !el.contains(range.endContainer)) {
return null
}

  const start = positionToOffset(el, range.startContainer, range.startOffset)
  const end = positionToOffset(el, range.endContainer, range.endOffset)

  return { start: Math.min(start, end), end: Math.max(start, end) }
}

export function getCaretOffset(el: HTMLElement): number | null {
  const offsets = getSelectionOffsets(el)

  return offsets ? offsets.start : null
}

/** Resolve a text offset back into a (node, nodeOffset) pair. */
function offsetToPosition(el: HTMLElement, offset: number): { node: Node; offset: number } {
  let remaining = offset
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode: (n) =>
      n.nodeType === Node.TEXT_NODE || (n as HTMLElement).tagName === 'BR'
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_SKIP,
  })
  let node = walker.nextNode()
  let lastText: Text | null = null

  while (node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const len = (node.textContent ?? '').length

      if (remaining <= len) {
return { node, offset: remaining }
}

      remaining -= len
      lastText = node as Text
    } else {
      // <br> counts as one character
      if (remaining <= 0) {
return { node: el, offset: 0 }
}

      remaining -= 1
    }

    node = walker.nextNode()
  }

  if (lastText) {
return { node: lastText, offset: (lastText.textContent ?? '').length }
}

  return { node: el, offset: el.childNodes.length }
}

export function setSelectionOffsets(el: HTMLElement, start: number, end = start): void {
  const sel = window.getSelection()

  if (!sel) {
return
}

  const s = offsetToPosition(el, start)
  const e = end === start ? s : offsetToPosition(el, end)
  const range = document.createRange()

  try {
    range.setStart(s.node, s.offset)
    range.setEnd(e.node, e.offset)
  } catch {
    return
  }

  sel.removeAllRanges()
  sel.addRange(range)
}

export function focusEnd(el: HTMLElement): void {
  el.focus()
  const sel = window.getSelection()

  if (!sel) {
return
}

  const range = document.createRange()
  range.selectNodeContents(el)
  range.collapse(false)
  sel.removeAllRanges()
  sel.addRange(range)
}

export function focusStart(el: HTMLElement): void {
  el.focus()
  setSelectionOffsets(el, 0)
}

function caretRect(): DOMRect | null {
  const sel = window.getSelection()

  if (!sel || sel.rangeCount === 0) {
return null
}

  const range = sel.getRangeAt(0).cloneRange()
  range.collapse(true)
  const rects = range.getClientRects()

  if (rects.length > 0) {
return rects[0]
}

  // Empty line: fall back to container rect
  const container = range.startContainer
  const el = container.nodeType === Node.ELEMENT_NODE ? (container as HTMLElement) : container.parentElement

  return el ? el.getBoundingClientRect() : null
}

const LINE_TOLERANCE = 8

export function isCaretOnFirstLine(el: HTMLElement): boolean {
  const rect = caretRect()

  if (!rect) {
return true
}

  const elRect = el.getBoundingClientRect()

  return rect.top - elRect.top < rect.height + LINE_TOLERANCE
}

export function isCaretOnLastLine(el: HTMLElement): boolean {
  const rect = caretRect()

  if (!rect) {
return true
}

  const elRect = el.getBoundingClientRect()

  return elRect.bottom - rect.bottom < rect.height + LINE_TOLERANCE
}

export function getCaretClientRect(): DOMRect | null {
  return caretRect()
}

export function getSelectionClientRect(): DOMRect | null {
  const sel = window.getSelection()

  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
return null
}

  const rect = sel.getRangeAt(0).getBoundingClientRect()

  return rect.width || rect.height ? rect : null
}

/** Client rects for a character range inside a contenteditable element. */
export function getRangeClientRects(el: HTMLElement, start: number, end: number): DOMRect[] {
  if (end <= start) {
    return []
  }

  const s = offsetToPosition(el, start)
  const e = offsetToPosition(el, end)
  const range = document.createRange()

  try {
    range.setStart(s.node, s.offset)
    range.setEnd(e.node, e.offset)
  } catch {
    return []
  }

  return Array.from(range.getClientRects())
}

function caretRangeFromPoint(x: number, y: number): Range | null {
  const doc = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
  }

  if (typeof doc.caretRangeFromPoint === 'function') {
    return doc.caretRangeFromPoint(x, y)
  }

  const pos = doc.caretPositionFromPoint?.(x, y)

  if (!pos) {
    return null
  }

  const range = document.createRange()

  try {
    range.setStart(pos.offsetNode, pos.offset)
    range.collapse(true)
  } catch {
    return null
  }

  return range
}

function nearestBlockElFromPoint(rootEl: HTMLElement, x: number, y: number): HTMLElement | null {
  const nodes = rootEl.querySelectorAll('[data-block-id]')
  let best: HTMLElement | null = null
  let bestDist = Infinity

  for (const node of nodes) {
    if (!(node instanceof HTMLElement) || !rootEl.contains(node)) {
      continue
    }

    const rect = node.getBoundingClientRect()

    if (rect.width <= 0 && rect.height <= 0) {
      continue
    }

    let dist = 0

    if (y < rect.top) {
      dist = rect.top - y
    } else if (y > rect.bottom) {
      dist = y - rect.bottom
    } else if (x < rect.left) {
      dist = rect.left - x
    } else if (x > rect.right) {
      dist = x - rect.right
    }

    // Prefer vertically nearer blocks; slight bias for horizontal hits inside.
    if (dist < bestDist) {
      bestDist = dist
      best = node
    }
  }

  return best
}

function blockElFromCaretRange(
  rootEl: HTMLElement,
  range: Range | null,
): HTMLElement | null {
  if (!range || !rootEl.contains(range.startContainer)) {
    return null
  }

  const el = (range.startContainer.nodeType === Node.ELEMENT_NODE
    ? (range.startContainer as HTMLElement)
    : range.startContainer.parentElement
  )?.closest('[data-block-id]')

  if (!el || !(el instanceof HTMLElement) || !rootEl.contains(el)) {
    return null
  }

  return el
}

/**
 * Map pointer coordinates to a selection point inside `rootEl`.
 * Text blocks resolve to a caret offset; non-text chrome blocks resolve to
 * edge offsets (0 = start half, 1 = end half) so drag-select can cover them.
 */
export function caretPointFromClient(
  rootEl: HTMLElement,
  x: number,
  y: number,
): { blockId: string; offset: number } | null {
  const range = caretRangeFromPoint(x, y)
  const blockEl = blockElFromCaretRange(rootEl, range) ?? nearestBlockElFromPoint(rootEl, x, y)

  if (!blockEl) {
    return null
  }

  const blockId = blockEl.getAttribute('data-block-id')

  if (!blockId) {
    return null
  }

  const editable = blockEl.querySelector('.etb') as HTMLElement | null

  if (editable) {
    if (range && editable.contains(range.startContainer)) {
      return {
        blockId,
        offset: positionToOffset(editable, range.startContainer, range.startOffset),
      }
    }

    // Pointer landed on text-block chrome (padding/gutter) — map to start/end.
    const rect = editable.getBoundingClientRect()
    const length = (editable.textContent?.length ?? 0)
      + (editable.querySelectorAll('br').length)

    if (y < rect.top + rect.height / 2) {
      return { blockId, offset: 0 }
    }

    return { blockId, offset: length }
  }

  // Non-text block (image, divider, table, code, …): whole-block edge.
  const rect = blockEl.getBoundingClientRect()
  const offset = y >= rect.top + rect.height / 2 ? 1 : 0

  return { blockId, offset }
}
