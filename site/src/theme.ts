export type SiteTheme = 'light' | 'dark'

const STORAGE_KEY = 'xpe-site-theme'

export function initialTheme(): SiteTheme {
  const stored = localStorage.getItem(STORAGE_KEY)

  if (stored === 'light' || stored === 'dark') return stored

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function applyTheme(theme: SiteTheme) {
  const root = document.documentElement
  root.dataset.theme = theme
  // Drive the editor packages' built-in dark theme from the same toggle
  root.classList.toggle('xpe-dark', theme === 'dark')
  localStorage.setItem(STORAGE_KEY, theme)
}

/**
 * Swap themes with the diagonal sweep from the reference design — a
 * View Transitions clip-path wipe. Falls back to an instant swap.
 */
export function transitionTheme(next: SiteTheme) {
  const doc = document as Document & {
    startViewTransition?: (cb: () => void) => void
  }

  if (!doc.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    applyTheme(next)
    return
  }

  doc.startViewTransition(() => applyTheme(next))
}
