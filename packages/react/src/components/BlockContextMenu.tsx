import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, Copy, Palette, Trash2 } from 'lucide-react'
import { syncThemeVars } from '@xproeditor/core'

export interface BlockContextMenuProps {
  position: { x: number; y: number }
  /** Background color swatches — only shown when the block supports one (e.g. callout). */
  colorPresets?: string[]
  currentColor?: string
  themeSource?: HTMLElement | null
  onColor?: (color: string) => void
  onDuplicate: () => void
  onDelete: () => void
  onClose: () => void
}

type View = 'root' | 'color'

export function BlockContextMenu({
  position,
  colorPresets,
  currentColor,
  themeSource,
  onColor,
  onDuplicate,
  onDelete,
  onClose,
}: BlockContextMenuProps) {
  const [view, setView] = useState<View>('root')
  const menuRef = useRef<HTMLDivElement | null>(null)
  const [placed, setPlaced] = useState({ left: position.x, top: position.y })

  useLayoutEffect(() => {
    const el = menuRef.current
    if (!el) return

    if (themeSource) syncThemeVars(themeSource, el)

    const margin = 8
    const { width, height } = el.getBoundingClientRect()
    const left = Math.max(margin, Math.min(position.x, window.innerWidth - width - margin))
    const top = Math.max(margin, Math.min(position.y, window.innerHeight - height - margin))
    setPlaced({ left, top })
  }, [position, themeSource, view])

  useLayoutEffect(() => {
    function onOutside(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) onClose()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('mousedown', onOutside, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onOutside, true)
      window.removeEventListener('keydown', onKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return createPortal(
    <div
      ref={menuRef}
      className="xpe-popover-content xpe-scroll fixed z-[80] w-52 overflow-y-auto py-1.5"
      style={{ left: placed.left, top: placed.top }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {view === 'root' ? (
        <>
          {colorPresets && (
            <button
              type="button"
              className="flex w-full items-center gap-2.5 px-3 py-1.5 text-start text-[13px] text-[var(--xpe-foreground)] hover:bg-[var(--xpe-surface-hover)]"
              onClick={() => setView('color')}
            >
              <Palette className="h-3.5 w-3.5 text-[var(--xpe-muted-foreground)]" />
              <span className="flex-1">Color</span>
              <ChevronRight className="h-3.5 w-3.5 text-[var(--xpe-muted-foreground)]" />
            </button>
          )}
          <button
            type="button"
            className="flex w-full items-center gap-2.5 px-3 py-1.5 text-start text-[13px] text-[var(--xpe-foreground)] hover:bg-[var(--xpe-surface-hover)]"
            onClick={() => {
              onDuplicate()
              onClose()
            }}
          >
            <Copy className="h-3.5 w-3.5 text-[var(--xpe-muted-foreground)]" />
            Duplicate
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2.5 px-3 py-1.5 text-start text-[13px] text-[var(--xpe-danger)] hover:bg-[var(--xpe-surface-hover)]"
            onClick={() => {
              onDelete()
              onClose()
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-1.5 text-start text-[12px] font-medium text-[var(--xpe-muted-foreground)] hover:text-[var(--xpe-foreground)]"
            onClick={() => setView('root')}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Color
          </button>
          <div className="grid grid-cols-7 gap-1.5 px-3 py-1.5">
            {colorPresets?.map((color) => (
              <button
                key={color}
                type="button"
                className={`h-6 w-6 rounded-full border transition-transform hover:scale-110 ${
                  currentColor === color
                    ? 'border-[var(--xpe-ring)] ring-2 ring-[var(--xpe-ring)]'
                    : 'border-[var(--xpe-border)]'
                }`}
                style={{ background: color }}
                title={color}
                onClick={() => {
                  onColor?.(color)
                  onClose()
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>,
    document.body,
  )
}
