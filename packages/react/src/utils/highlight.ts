import { escapeHtml } from '@xproeditor/core'

type Highlighter = typeof import('highlight.js/lib/common').default

let highlighter: Highlighter | null = null
let loading: Promise<Highlighter | null> | null = null

/**
 * Load highlight.js on demand. It is the heaviest dependency of the read-only
 * renderer, so pages without code blocks never download it and pages with
 * code blocks get it as a separate chunk instead of in the main bundle.
 */
export function loadHighlighter(): Promise<Highlighter | null> {
  if (!loading) {
    loading = import('highlight.js/lib/common')
      .then((mod) => {
        highlighter = (mod as { default?: Highlighter }).default ?? (mod as unknown as Highlighter)
        return highlighter
      })
      .catch(() => null)
  }

  return loading
}

export function isHighlighterReady(): boolean {
  return highlighter !== null
}

/** Highlighted HTML once highlight.js has loaded; escaped plain code until then. */
export function highlightCode(code: string, language?: string): string {
  try {
    if (highlighter && language && language !== 'plaintext' && highlighter.getLanguage(language)) {
      return highlighter.highlight(code, { language }).value
    }
  } catch {
    /* fall through to plain text */
  }

  return escapeHtml(code)
}
