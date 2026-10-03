/**
 * Allow-listed iframe embeds for the `embed` block.
 *
 * The stored block only keeps the URL the user pasted (`props.url`). The
 * iframe `src` is always re-derived from it here at render time, so a
 * tampered document can never point an iframe at an arbitrary origin.
 */

export interface EmbedProvider {
  id: string
  name: string
  /** Default frame height in px. */
  height: number
  /** Return the iframe src for a page URL, or null if this provider doesn't match. */
  toEmbedUrl: (url: URL) => string | null
}

export interface ResolvedEmbed {
  provider: EmbedProvider
  embedUrl: string
  height: number
}

function hostIs(url: URL, ...hosts: string[]): boolean {
  const host = url.hostname.toLowerCase().replace(/^www\./, '')

  return hosts.includes(host)
}

const ID = /^[\w-]+$/

export const EMBED_PROVIDERS: EmbedProvider[] = [
  {
    id: 'youtube',
    name: 'YouTube',
    height: 400,
    toEmbedUrl(url) {
      let id: string | null = null

      if (hostIs(url, 'youtu.be')) {
        id = url.pathname.slice(1)
      } else if (hostIs(url, 'youtube.com', 'm.youtube.com', 'youtube-nocookie.com')) {
        id = url.searchParams.get('v') ?? /^\/(?:embed|shorts|live)\/([\w-]+)/.exec(url.pathname)?.[1] ?? null
      }

      return id && /^[\w-]{11}$/.test(id) ? `https://www.youtube.com/embed/${id}` : null
    },
  },
  {
    id: 'vimeo',
    name: 'Vimeo',
    height: 400,
    toEmbedUrl(url) {
      if (!hostIs(url, 'vimeo.com', 'player.vimeo.com')) {
        return null
      }

      const id = /\/(?:video\/)?(\d+)/.exec(url.pathname)?.[1]

      return id ? `https://player.vimeo.com/video/${id}` : null
    },
  },
  {
    id: 'loom',
    name: 'Loom',
    height: 400,
    toEmbedUrl(url) {
      const id = hostIs(url, 'loom.com') ? /^\/(?:share|embed)\/([\w-]+)/.exec(url.pathname)?.[1] : null

      return id ? `https://www.loom.com/embed/${id}` : null
    },
  },
  {
    id: 'figma',
    name: 'Figma',
    height: 450,
    toEmbedUrl(url) {
      if (!hostIs(url, 'figma.com') || !/^\/(?:file|design|proto|board|slides)\//.test(url.pathname)) {
        return null
      }

      return `https://www.figma.com/embed?embed_host=xproeditor&url=${encodeURIComponent(url.href)}`
    },
  },
  {
    id: 'codepen',
    name: 'CodePen',
    height: 400,
    toEmbedUrl(url) {
      const m = hostIs(url, 'codepen.io')
        ? /^\/((?:team\/)?[\w-]+)\/(?:pen|embed|full|details)\/([\w-]+)/.exec(url.pathname)
        : null

      return m ? `https://codepen.io/${m[1]}/embed/${m[2]}?default-tab=result` : null
    },
  },
  {
    id: 'codesandbox',
    name: 'CodeSandbox',
    height: 500,
    toEmbedUrl(url) {
      if (!hostIs(url, 'codesandbox.io')) {
        return null
      }

      const id = /^\/(?:s|embed|p\/sandbox|p\/devbox)\/([\w-]+)/.exec(url.pathname)?.[1]

      return id && ID.test(id) ? `https://codesandbox.io/embed/${id}` : null
    },
  },
  {
    id: 'spotify',
    name: 'Spotify',
    height: 352,
    toEmbedUrl(url) {
      const m = hostIs(url, 'open.spotify.com')
        ? /^\/(?:embed\/)?(track|album|playlist|episode|show|artist)\/([\w]+)/.exec(url.pathname)
        : null

      return m ? `https://open.spotify.com/embed/${m[1]}/${m[2]}` : null
    },
  },
  {
    id: 'soundcloud',
    name: 'SoundCloud',
    height: 166,
    toEmbedUrl(url) {
      if (!hostIs(url, 'soundcloud.com') || url.pathname.split('/').filter(Boolean).length < 2) {
        return null
      }

      return `https://w.soundcloud.com/player/?url=${encodeURIComponent(url.href)}`
    },
  },
  {
    id: 'google-maps',
    name: 'Google Maps',
    height: 450,
    toEmbedUrl(url) {
      if (hostIs(url, 'google.com') && url.pathname.startsWith('/maps/embed')) {
        return `https://www.google.com${url.pathname}${url.search}`
      }

      return null
    },
  },
]

/** Pull the `src` out of a pasted `<iframe …>` snippet, or return the input. */
export function extractEmbedSource(input: string): string {
  const trimmed = input.trim()
  const iframe = /<iframe[^>]*\ssrc\s*=\s*["']([^"']+)["']/i.exec(trimmed)

  return iframe ? iframe[1].replace(/&amp;/g, '&') : trimmed
}

/**
 * Resolve a pasted URL (or `<iframe>` snippet) to an allow-listed embed.
 * Returns null for anything that isn't a known provider.
 */
export function resolveEmbed(
  input: string | undefined | null,
  providers: EmbedProvider[] = EMBED_PROVIDERS,
): ResolvedEmbed | null {
  if (!input) {
    return null
  }

  let url: URL

  try {
    const raw = extractEmbedSource(input)
    url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`)
  } catch {
    return null
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return null
  }

  for (const provider of providers) {
    const embedUrl = provider.toEmbedUrl(url)

    if (embedUrl) {
      return { provider, embedUrl, height: provider.height }
    }
  }

  return null
}

/** Clamp a stored embed height to something sane. */
export function embedFrameHeight(height: unknown, fallback: number): number {
  const n = typeof height === 'number' && Number.isFinite(height) ? height : fallback

  return Math.min(1200, Math.max(80, Math.round(n)))
}
