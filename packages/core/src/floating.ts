import { getCaretClientRect } from './dom'

/**
 * Viewport placement for floating editor UI (AI menu, and any host popover).
 * Pure: give it the anchor and the panel's measured size, get coordinates
 * for a `position: fixed` element.
 */

/** Anchor in viewport coordinates: `x` is the inline-start edge, `top`/`bottom` the anchor line. */
export interface FloatingAnchor {
  x: number
  top: number
  bottom: number
}

export interface FloatingPlacement {
  left: number
  top: number
  side: 'below' | 'above'
  /** Height available on the chosen side — cap the panel's max-height with it. */
  maxHeight: number
}

export interface PlaceFloatingOptions {
  /** RTL panels grow toward the start: their right edge hugs `anchor.x`. */
  dir?: 'ltr' | 'rtl'
  /** Space kept to the viewport edges (default 8). */
  margin?: number
  /** Space between anchor and panel (default 6). */
  gap?: number
  /** Defaults to the window size. */
  viewport?: { width: number; height: number }
}

/**
 * Below the anchor when the panel fits, above when it fits there instead,
 * otherwise on the roomier side — always clamped inside the viewport.
 */
export function placeFloating(
  anchor: FloatingAnchor,
  size: { width: number; height: number },
  options: PlaceFloatingOptions = {},
): FloatingPlacement {
  const margin = options.margin ?? 8
  const gap = options.gap ?? 6
  const vw = options.viewport?.width ?? window.innerWidth
  const vh = options.viewport?.height ?? window.innerHeight

  let left = options.dir === 'rtl' ? anchor.x - size.width : anchor.x
  left = Math.max(margin, Math.min(left, vw - size.width - margin))

  const spaceBelow = vh - anchor.bottom - gap - margin
  const spaceAbove = anchor.top - gap - margin
  const side: 'below' | 'above' =
    size.height <= spaceBelow || spaceBelow >= spaceAbove ? 'below' : 'above'
  const maxHeight = Math.max(120, side === 'below' ? spaceBelow : spaceAbove)
  const height = Math.min(size.height, maxHeight)

  let top = side === 'below' ? anchor.bottom + gap : anchor.top - gap - height
  top = Math.max(margin, Math.min(top, vh - height - margin))

  return { left, top, side, maxHeight }
}

/**
 * Best anchor for editor UI opened without a pointer position (toolbar
 * buttons, block menus, keyboard shortcuts): the caret when it is inside
 * `root`, else the given block's row, else the top of the editor.
 */
export function resolveEditorAnchor(root: HTMLElement | null, blockId?: string | null): FloatingAnchor {
  const sel = typeof window !== 'undefined' ? window.getSelection() : null
  const caretInside = !!(root && sel && sel.rangeCount > 0 && root.contains(sel.anchorNode))

  if (caretInside) {
    const caret = getCaretClientRect()

    if (caret && (caret.width || caret.height || caret.top)) {
      return { x: caret.left, top: caret.top, bottom: caret.bottom }
    }
  }

  const row =
    root && blockId ? root.querySelector<HTMLElement>(`[data-block-id="${CSS.escape(blockId)}"]`) : null
  const text = row?.querySelector<HTMLElement>('[contenteditable]') ?? row

  if (text) {
    const rect = text.getBoundingClientRect()
    const rtl = getComputedStyle(text).direction === 'rtl'
    // Anchor on the first line, not the whole (possibly tall) block.
    const lineBottom = Math.min(rect.bottom, rect.top + 28)
    return { x: rtl ? rect.right : rect.left, top: rect.top, bottom: lineBottom }
  }

  const box = root?.getBoundingClientRect()

  if (!box) {
    return { x: 24, top: 24, bottom: 56 }
  }

  const rtl = getComputedStyle(root as HTMLElement).direction === 'rtl'
  const top = Math.max(box.top, 0)
  return { x: rtl ? box.right - 24 : box.left + 24, top, bottom: top + 32 }
}
