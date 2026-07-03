import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { PopoverContent, PopoverContext } from './Popover'
import { cn } from '../utils/cn'

interface DropdownContextValue {
  open: boolean
  setOpen: (value: boolean) => void
  triggerRef: React.MutableRefObject<HTMLElement | null>
}

const DropdownContext = createContext<DropdownContextValue | null>(null)

function useDropdownContext(component: string): DropdownContextValue {
  const ctx = useContext(DropdownContext)
  if (!ctx) throw new Error(`<${component}> must be used inside <DropdownMenu>`)
  return ctx
}

export function DropdownMenu({ children }: { children?: ReactNode }) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLElement | null>(null)

  return (
    <DropdownContext.Provider value={{ open, setOpen, triggerRef }}>
      {children}
    </DropdownContext.Provider>
  )
}

export function DropdownMenuTrigger({ children }: { children?: ReactNode }) {
  const ctx = useDropdownContext('DropdownMenuTrigger')
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

export function DropdownMenuContent({
  align = 'start',
  className,
  children,
}: {
  align?: 'start' | 'center' | 'end'
  className?: string
  children?: ReactNode
}) {
  const ctx = useDropdownContext('DropdownMenuContent')

  return (
    <PopoverContext.Provider value={ctx}>
      <PopoverContent
        align={align}
        side="bottom"
        sideOffset={4}
        className={cn('xpe-dropdown-content', className)}
      >
        {children}
      </PopoverContent>
    </PopoverContext.Provider>
  )
}

export function DropdownMenuItem({
  className,
  onClick,
  children,
}: {
  className?: string
  onClick?: React.MouseEventHandler<HTMLButtonElement>
  children?: ReactNode
}) {
  const ctx = useDropdownContext('DropdownMenuItem')

  return (
    <button
      type="button"
      className={cn('xpe-dropdown-item', className)}
      onClick={(e) => {
        onClick?.(e)
        ctx.setOpen(false)
      }}
    >
      {children}
    </button>
  )
}
