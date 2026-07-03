import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

export interface PopoverContextValue {
  open: boolean
  setOpen: (value: boolean) => void
  triggerRef: React.MutableRefObject<HTMLElement | null>
}

export const PopoverContext = createContext<PopoverContextValue | null>(null)

function usePopoverContext(component: string): PopoverContextValue {
  const ctx = useContext(PopoverContext)
  if (!ctx) throw new Error(`<${component}> must be used inside <Popover>`)
  return ctx
}

export function Popover({
  open,
  onOpenChange,
  children,
}: {
  open: boolean
  onOpenChange: (value: boolean) => void
  children?: ReactNode
}) {
  const triggerRef = useRef<HTMLElement | null>(null)

  return (
    <PopoverContext.Provider value={{ open, setOpen: onOpenChange, triggerRef }}>
      {children}
    </PopoverContext.Provider>
  )
}

export function PopoverTrigger({ children }: { children?: ReactNode }) {
  const ctx = usePopoverContext('PopoverTrigger')
  const spanRef = useRef<HTMLSpanElement | null>(null)

  useEffect(() => {
    ctx.triggerRef.current = spanRef.current
  })

  return (
    <span ref={spanRef} onClick={() => ctx.setOpen(!ctx.open)}>
      {children}
    </span>
  )
}

export function PopoverContent({
  align = 'start',
  side = 'bottom',
  sideOffset = 6,
  className,
  style,
  onMouseDown,
  children,
}: {
  align?: 'start' | 'center' | 'end'
  side?: 'top' | 'bottom' | 'left' | 'right'
  sideOffset?: number
  className?: string
  style?: CSSProperties
  onMouseDown?: React.MouseEventHandler
  children?: ReactNode
}) {
  const ctx = usePopoverContext('PopoverContent')
  const contentRef = useRef<HTMLDivElement | null>(null)
  const [position, setPosition] = useState<CSSProperties>({ position: 'fixed', top: 0, left: 0 })

  function reposition() {
    const trigger = ctx.triggerRef.current
    const content = contentRef.current
    if (!trigger || !content) return

    const anchor = (trigger.firstElementChild as HTMLElement | null) ?? trigger
    const rect = anchor.getBoundingClientRect()
    const contentRect = content.getBoundingClientRect()

    let top = rect.bottom + sideOffset
    let left = rect.left

    if (side === 'top') top = rect.top - contentRect.height - sideOffset
    if (side === 'left') {
      top = rect.top
      left = rect.left - contentRect.width - sideOffset
    }
    if (side === 'right') {
      top = rect.top
      left = rect.right + sideOffset
    }

    if (side === 'top' || side === 'bottom') {
      if (align === 'center') left = rect.left + rect.width / 2 - contentRect.width / 2
      if (align === 'end') left = rect.right - contentRect.width
    }

    const maxLeft = window.innerWidth - contentRect.width - 8
    left = Math.min(Math.max(8, left), Math.max(8, maxLeft))
    top = Math.min(Math.max(8, top), window.innerHeight - 8)

    setPosition({ position: 'fixed', top, left })
  }

  useLayoutEffect(() => {
    if (!ctx.open) return

    reposition()

    function onOutsideDown(event: MouseEvent) {
      if (document.body.dataset.colorPickerDragging === 'true') return

      const target = event.target as Node
      if (contentRef.current?.contains(target)) return
      if (ctx.triggerRef.current?.contains(target)) return

      ctx.setOpen(false)
    }

    function onKeydown(event: KeyboardEvent) {
      if (event.key === 'Escape') ctx.setOpen(false)
    }

    window.addEventListener('mousedown', onOutsideDown, true)
    window.addEventListener('resize', reposition)
    window.addEventListener('keydown', onKeydown)

    return () => {
      window.removeEventListener('mousedown', onOutsideDown, true)
      window.removeEventListener('resize', reposition)
      window.removeEventListener('keydown', onKeydown)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.open])

  if (!ctx.open) return null

  return createPortal(
    <div
      ref={contentRef}
      className={['xpe-popover-content', className].filter(Boolean).join(' ')}
      style={{ ...position, ...style }}
      onMouseDown={onMouseDown}
    >
      {children}
    </div>,
    document.body,
  )
}
