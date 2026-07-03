/** Caret/selection helpers for per-block contenteditable elements. */

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

/** Map pointer coordinates to a block id + text offset inside `rootEl`. */
export function caretPointFromClient(
  rootEl: HTMLElement,
  x: number,
  y: number,
): { blockId: string; offset: number } | null {
  const range = caretRangeFromPoint(x, y)

  if (!range || !rootEl.contains(range.startContainer)) {
    return null
  }

  const blockEl = (range.startContainer.nodeType === Node.ELEMENT_NODE
    ? (range.startContainer as HTMLElement)
    : range.startContainer.parentElement
  )?.closest('[data-block-id]')

  if (!blockEl || !rootEl.contains(blockEl)) {
    return null
  }

  const blockId = blockEl.getAttribute('data-block-id')

  if (!blockId) {
    return null
  }

  const editable = blockEl.querySelector('.etb') as HTMLElement | null

  if (!editable) {
    return null
  }

  const offset = positionToOffset(editable, range.startContainer, range.startOffset)

  return { blockId, offset }
}
