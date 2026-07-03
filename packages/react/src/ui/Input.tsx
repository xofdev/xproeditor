import type { InputHTMLAttributes } from 'react'
import { cn } from '../utils/cn'

export function Input({
  className,
  type = 'text',
  ...rest
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input type={type} className={cn('xpe-input', className)} {...rest} />
}
