export function IconValueDisplay({ icon, className }: { icon: string; className?: string }) {
  return <span className={['xpe-icon-value', className].filter(Boolean).join(' ')}>{icon}</span>
}
