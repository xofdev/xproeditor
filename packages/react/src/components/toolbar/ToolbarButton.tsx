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
      // Icon-only buttons: expose the tooltip as the accessible name and the toggle state.
      aria-label={rest['aria-label'] ?? (typeof rest.title === 'string' ? rest.title : undefined)}
      aria-pressed={active === undefined ? undefined : active}
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
