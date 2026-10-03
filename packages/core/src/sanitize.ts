/**
 * Input hardening shared by every render and import path.
 *
 * Documents are plain JSON that host apps load from storage, the clipboard,
 * an AI model or a pasted web page — none of it can be trusted. Everything
 * that ends up in an `href`, `src` or `style` attribute goes through here.
 */

import { generateBlockId, normalizeSpans } from './ops'
import type { Block, BlockProps, BlockType, InlineMarks, InlineSpan } from './types'
import { BLOCK_TYPES } from './types'

const SAFE_SCHEMES = new Set(['http:', 'https:', 'mailto:', 'tel:'])
/** Schemes media elements may load but links must never navigate to. */
const MEDIA_SCHEMES = new Set(['blob:'])

export interface SanitizeUrlOptions {
  /** Allow `blob:` URLs (object URLs from the default upload fallback). */
  allowBlob?: boolean
  /** Allow `data:image/*` URLs (inline images). Never applies to links. */
  allowDataImage?: boolean
}

/**
 * Return `url` when it is safe to put in an `href`/`src`, otherwise `''`.
 *
 * Allows http(s), mailto, tel and relative URLs (`/a`, `./a`, `#a`, `?a`,
 * `a/b`). Rejects `javascript:`, `vbscript:`, `data:` (unless an image and
 * `allowDataImage` is set) and any other scheme, including obfuscated forms
 * such as `java\nscript:` or `JaVaScRiPt:`.
 */
export function sanitizeUrl(url: unknown, options: SanitizeUrlOptions = {}): string {
  if (typeof url !== 'string') {
    return ''
  }

  // Browsers ignore ASCII whitespace/control chars inside a scheme, so strip
  // them before deciding — `java\tscript:` must not slip through.
  // eslint-disable-next-line no-control-regex
  const trimmed = url.replace(/[\u0000-\u001F\u007F]/g, '').trim()

  if (!trimmed) {
    return ''
  }

  const schemeMatch = /^([a-z][a-z0-9+.-]*):/i.exec(trimmed)

  if (!schemeMatch) {
    // Relative URL (or protocol-relative `//host`) — no scheme to abuse.
    return trimmed
  }

  const scheme = `${schemeMatch[1].toLowerCase()}:`

  if (SAFE_SCHEMES.has(scheme)) {
    return trimmed
  }

  if (options.allowBlob && MEDIA_SCHEMES.has(scheme)) {
    return trimmed
  }

  if (options.allowDataImage && scheme === 'data:' && /^data:image\/(png|gif|jpe?g|webp|avif|bmp);/i.test(trimmed)) {
    return trimmed
  }

  return ''
}

/** `sanitizeUrl` preset for `<img>/<video>/<audio>` sources. */
export function sanitizeMediaUrl(url: unknown): string {
  return sanitizeUrl(url, { allowBlob: true, allowDataImage: true })
}

/** `sanitizeUrl` preset for links and downloads (object URLs are fine to download). */
export function sanitizeLinkUrl(url: unknown, options: { allowBlob?: boolean } = {}): string {
  return sanitizeUrl(url, { allowBlob: options.allowBlob })
}

/**
 * Return a CSS colour value that is safe to drop into a `style` attribute,
 * or `''`. Accepts hex, named colours, `rgb()/rgba()/hsl()/hsla()/oklch()…`
 * and `var(--token, fallback)` — anything that cannot terminate the
 * declaration (`;`), the attribute (`"`/`'`) or load a resource (`url(`).
 */
export function sanitizeCssColor(value: unknown): string {
  if (typeof value !== 'string') {
    return ''
  }

  const v = value.trim()

  if (!v || v.length > 120) {
    return ''
  }

  if (/[;"'<>{}\\]/.test(v) || /url\s*\(|expression\s*\(|@import/i.test(v)) {
    return ''
  }

  if (!/^[#a-z0-9(),.%\s/+-]+$/i.test(v)) {
    return ''
  }

  return v
}

const BOOLEAN_MARK_KEYS = ['bold', 'italic', 'underline', 'strikethrough', 'code'] as const

/** Keep only well-formed marks; drop unsafe links and colours. */
export function sanitizeMarks(raw: unknown): InlineMarks | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined
  }

  const input = raw as Record<string, unknown>
  const out: InlineMarks = {}

  for (const key of BOOLEAN_MARK_KEYS) {
    if (input[key] === true) {
      out[key] = true
    }
  }

  const link = sanitizeLinkUrl(input.link)

  if (link) {
    out.link = link
  }

  const color = sanitizeCssColor(input.color)

  if (color) {
    out.color = color
  }

  const highlight = sanitizeCssColor(input.highlight)

  if (highlight) {
    out.highlight = highlight
  }

  return Object.keys(out).length > 0 ? out : undefined
}

/** Coerce arbitrary input into a clean, normalized span list. */
export function sanitizeSpans(raw: unknown): InlineSpan[] {
  if (!Array.isArray(raw)) {
    return []
  }

  const spans: InlineSpan[] = []

  for (const item of raw) {
    if (typeof item === 'string') {
      spans.push({ text: item })
      continue
    }

    if (!item || typeof item !== 'object') {
      continue
    }

    const span = item as Record<string, unknown>
    const text = typeof span.text === 'string' ? span.text : span.text == null ? '' : String(span.text)

    if (!text) {
      continue
    }

    spans.push({ text, marks: sanitizeMarks(span.marks) })
  }

  return normalizeSpans(spans)
}

const MAX_INDENT = 8

function sanitizeProps(raw: unknown): BlockProps {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {}
  }

  // Shallow copy so callers can't mutate the source through the result.
  const props = { ...(raw as Record<string, unknown>) } as BlockProps & Record<string, unknown>

  if (props.indent !== undefined) {
    const n = Math.floor(Number(props.indent))

    if (Number.isFinite(n) && n > 0) {
      props.indent = Math.min(n, MAX_INDENT)
    } else {
      delete props.indent
    }
  }

  if (props.color !== undefined) {
    const color = sanitizeCssColor(props.color)

    if (color) {
      props.color = color
    } else {
      delete props.color
    }
  }

  for (const key of ['url', 'caption', 'name', 'mime', 'title', 'description', 'favicon', 'image', 'icon', 'code', 'language'] as const) {
    if (props[key] !== undefined && typeof props[key] !== 'string') {
      delete props[key]
    }
  }

  return props
}

const BLOCK_TYPE_SET = new Set<string>(BLOCK_TYPES)

/** True for every block type this version of the editor can render. */
export function isKnownBlockType(type: unknown): type is BlockType {
  return typeof type === 'string' && BLOCK_TYPE_SET.has(type)
}

/**
 * Validate one untrusted block. Unknown block types degrade to a paragraph
 * (keeping their text) instead of crashing the renderer; non-objects are
 * dropped (`null`).
 */
export function sanitizeBlock(raw: unknown): Block | null {
  if (!raw || typeof raw !== 'object') {
    return null
  }

  const input = raw as Record<string, unknown>
  const known = isKnownBlockType(input.type)

  return {
    id: typeof input.id === 'string' && input.id ? input.id : generateBlockId(),
    type: known ? (input.type as BlockType) : 'paragraph',
    content: sanitizeSpans(input.content),
    props: sanitizeProps(input.props),
  }
}

/** Validate an untrusted block list (storage, clipboard, AI output). */
export function sanitizeBlocks(raw: unknown): Block[] {
  if (!Array.isArray(raw)) {
    return []
  }

  const out: Block[] = []
  const seen = new Set<string>()

  for (const item of raw) {
    const block = sanitizeBlock(item)

    if (!block) {
      continue
    }

    // Duplicate ids break keyed rendering and every id-based lookup.
    if (seen.has(block.id)) {
      block.id = generateBlockId()
    }

    seen.add(block.id)
    out.push(block)
  }

  return out
}
