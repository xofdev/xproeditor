import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../../utils/cn'

export interface ToolbarButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
  wide?: boolean
}

export function ToolbarButton({ active, wide, className, ...rest }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        'ebt-btn',
        active && 'ebt-active',
        wide && '!w-auto gap-1 px-2 text-xs font-medium text-[var(--xpe-muted-foreground)]',
        className,
      )}
      {...rest}
    />
  )
}
