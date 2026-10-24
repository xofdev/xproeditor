import { useEffect, useState, type ReactNode } from 'react'

/** `false` during prerender and the hydration pass, `true` once mounted in the browser. */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => setHydrated(true), [])

  return hydrated
}

/**
 * Renders `fallback` in the prerendered HTML (crawlers and first paint see
 * real content) and swaps in `children` — the interactive editor — after
 * hydration.
 */
export function ClientOnly({ children, fallback }: { children: () => ReactNode; fallback: ReactNode }) {
  return useHydrated() ? <>{children()}</> : <>{fallback}</>
}
