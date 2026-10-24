export type SiteTheme = 'light' | 'dark'

const STORAGE_KEY = 'xpe-site-theme'

/** The theme the inline script in index.html applied before first paint. */
export function currentTheme(): SiteTheme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

export function applyTheme(theme: SiteTheme, persist = true) {
  const root = document.documentElement
  root.dataset.theme = theme
  // Drive the editor packages' built-in dark theme from the same toggle
  root.classList.toggle('xpe-dark', theme === 'dark')

  if (persist) {
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      /* storage blocked — the choice just won't persist */
    }
  }
}

/**
 * Swap themes with a diagonal sweep (View Transitions clip-path wipe).
 * Falls back to an instant swap.
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
