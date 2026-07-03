import { normalizeSpans } from './ops'
import type { InlineMarks, InlineSpan } from './types'

export function escapeHtml(text: string | null | undefined): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Render spans to the inline HTML used inside contenteditable text blocks
 * and the public renderer. Round-trips with `parseInlineHtml`.
 */
export function spansToHtml(spans: InlineSpan[]): string {
  return spans
    .map((span) => {
      let html = escapeHtml(span.text)
      const m = span.marks

      if (!m) {
return html
}

      if (m.code) {
html = `<code>${html}</code>`
}

      if (m.bold) {
html = `<strong>${html}</strong>`
}

      if (m.italic) {
html = `<em>${html}</em>`
}

      if (m.underline) {
html = `<u>${html}</u>`
}

      if (m.strikethrough) {
html = `<s>${html}</s>`
}

      const styles: string[] = []

      if (m.color) {
styles.push(`color:${m.color}`)
}

      if (m.highlight) {
styles.push(`background-color:${m.highlight}`)
}

      if (styles.length) {
html = `<span style="${styles.join(';')}">${html}</span>`
}

      if (m.link) {
html = `<a href="${escapeHtml(m.link)}" target="_blank" rel="noopener noreferrer">${html}</a>`
}

      return html
    })
    .join('')
}

/** Parse inline DOM (a contenteditable block's children) back into spans. */
export function parseInlineNodes(nodes: Iterable<Node>, inherited: InlineMarks = {}): InlineSpan[] {
  const spans: InlineSpan[] = []

  for (const node of nodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? ''

      if (text) {
        const hasMarks = Object.keys(inherited).length > 0
        spans.push({ text, marks: hasMarks ? { ...inherited } : undefined })
      }

      continue
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
continue
}

    const el = node as HTMLElement
    const tag = el.tagName.toLowerCase()

    if (tag === 'br') {
      spans.push({ text: '\n', marks: Object.keys(inherited).length ? { ...inherited } : undefined })
      continue
    }

    const marks: InlineMarks = { ...inherited }

    if (tag === 'strong' || tag === 'b') {
marks.bold = true
}

    if (tag === 'em' || tag === 'i') {
marks.italic = true
}

    if (tag === 'u') {
marks.underline = true
}

    if (tag === 's' || tag === 'strike' || tag === 'del') {
marks.strikethrough = true
}

    if (tag === 'code') {
marks.code = true
}

    if (tag === 'a') {
      const href = el.getAttribute('href')

      if (href) {
marks.link = href
}
    }

    const color = el.style?.color

    if (color) {
marks.color = color
}

    const bg = el.style?.backgroundColor

    if (bg) {
marks.highlight = bg
}

    const fw = el.style?.fontWeight

    if (fw === 'bold' || Number(fw) >= 600) {
marks.bold = true
}

    if (el.style?.fontStyle === 'italic') {
marks.italic = true
}

    const deco = el.style?.textDecorationLine || el.style?.textDecoration || ''

    if (deco.includes('underline')) {
marks.underline = true
}

    if (deco.includes('line-through')) {
marks.strikethrough = true
}

    spans.push(...parseInlineNodes(el.childNodes, marks))
  }

  return spans
}

export function parseInlineHtml(html: string): InlineSpan[] {
  if (typeof DOMParser === 'undefined') {
return [{ text: html.replace(/<[^>]*>/g, '') }]
}

  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html')
  const root = doc.body.firstElementChild

  if (!root) {
return []
}

  return normalizeSpans(parseInlineNodes(root.childNodes))
}

/** Read spans straight from a live contenteditable element. */
export function elementToSpans(el: HTMLElement): InlineSpan[] {
  return normalizeSpans(parseInlineNodes(el.childNodes))
}
