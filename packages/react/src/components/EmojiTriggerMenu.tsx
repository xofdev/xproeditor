import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { lockPageScroll, syncThemeVars } from '@xproeditor/core'
import { EmojiPicker } from '../ui'

export interface EmojiTriggerMenuProps {
  query: string
  /** Caret anchor in viewport coordinates: menu opens below `y`, flips above `top` when needed. */
  position: { x: number; y: number; top?: number }
  dir?: 'ltr' | 'rtl'
  themeSource?: HTMLElement | null
  onSelect: (emoji: string) => void
}

export function EmojiTriggerMenu({ query, position, dir, themeSource, onSelect }: EmojiTriggerMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null)
  const [placed, setPlaced] = useState<{ left: number; top: number }>({
    left: position.x,
    top: position.y,
  })

  useLayoutEffect(() => {
    const unlock = lockPageScroll()
    return unlock
  }, [])

  useLayoutEffect(() => {
    function place() {
      const el = menuRef.current
      if (!el) return

      if (themeSource) syncThemeVars(themeSource, el)

      const margin = 8
      const gap = 6
      const { width, height } = el.getBoundingClientRect()
      const anchorTop = position.top ?? position.y
      let left = dir === 'rtl' ? position.x - width : position.x
      left = Math.max(margin, Math.min(left, window.innerWidth - width - margin))
      let top = position.y + gap

      if (top + height > window.innerHeight - margin) {
        top = Math.max(margin, anchorTop - height - gap)
      }

      setPlaced({ left, top })
    }

    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [position, dir, themeSource, query])

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[80] border bg-[var(--xpe-surface)] border-[var(--xpe-border)] rounded-[var(--xpe-radius)] [box-shadow:var(--xpe-shadow)] overflow-hidden"
      style={{ left: placed.left, top: placed.top }}
      dir={dir}
      onMouseDown={(e) => e.preventDefault()}
    >
      <EmojiPicker query={query} onSelect={onSelect} />
    </div>,
    document.body,
  )
}
