/**
 * Helpers for the `bookmark` block (link preview / web bookmark).
 */

export interface BookmarkMeta {
  title?: string
  description?: string
  favicon?: string
  /** Open Graph / social preview image */
  image?: string
}

/** Host-supplied fetcher for link metadata (OG tags, favicon, …). */
export type FetchBookmarkMetaFn = (url: string) => Promise<BookmarkMeta | null | undefined>

/** Normalize a pasted URL: trim, add https:// when scheme is missing. */
export function normalizeBookmarkUrl(input: string): string | null {
  const raw = input.trim()
  if (!raw) return null

  let candidate = raw
  if (!/^[a-z][a-z0-9+.-]*:/i.test(candidate)) {
    candidate = `https://${candidate}`
  }

  try {
    const url = new URL(candidate)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    if (!url.hostname) return null
    return url.href
  } catch {
    return null
  }
}

/** Hostname for display (strips leading `www.`). */
export function bookmarkHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, '')
  } catch {
    return url
  }
}

/** Best-effort title for plain-text / card fallback. */
export function bookmarkDisplayTitle(props: {
  url?: string
  title?: string
}): string {
  const title = props.title?.trim()
  if (title) return title
  if (props.url) return bookmarkHostname(props.url)
  return 'Bookmark'
}
