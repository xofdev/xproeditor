import type { ReactNode } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '../../ui'
import { cn } from '../../utils/cn'

export interface ToolbarPopoverProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  align?: 'start' | 'center' | 'end'
  side?: 'top' | 'bottom' | 'left' | 'right'
  contentClassName?: string
  title?: string
  trigger: ReactNode
  children?: ReactNode
}

export function ToolbarPopover({
  open,
  onOpenChange,
  align = 'start',
  side = 'bottom',
  contentClassName,
  title,
  trigger,
  children,
}: ToolbarPopoverProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger>{trigger}</PopoverTrigger>
      <PopoverContent
        align={align}
        side={side}
        sideOffset={6}
        className={cn('w-auto rounded-xl border-gray-100 p-2 shadow-xl', contentClassName)}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {title && (
          <p className="mb-2 px-1 text-[11px] font-semibold tracking-wide text-gray-500 uppercase">
            {title}
          </p>
        )}
        {children}
      </PopoverContent>
    </Popover>
  )
}
