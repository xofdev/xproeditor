import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../utils/cn'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'icon'
}

export function Button({
  variant = 'default',
  size = 'md',
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn('xpe-btn', `xpe-btn--${variant}`, `xpe-btn--${size}`, className)}
      {...rest}
    />
  )
}
