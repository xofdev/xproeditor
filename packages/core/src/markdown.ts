/**
 * Lossy Markdown ↔ Block[] conversion (BlockNote-style).
 * Paste path prefers markdown when clipboard looks like MD; JSON/HTML remain
 * the lossless formats.
 */

import { createBlock, normalizeSpans } from './ops'
import { sanitizeLinkUrl, sanitizeMediaUrl } from './sanitize'
import { normalizeTableData } from './table'
import type { Block, BlockType, InlineMarks, InlineSpan } from './types'
import { isTextBlock } from './types'
import { blockToPlainText } from './serialize'

function escapeMd(text: string): string {
  return text.replace(/([\\`*_{}[\]()#+\-.!|>~])/g, '\\$1')
}

/** Escape inline syntax characters in plain text so it re-imports verbatim. */
function escapeMdInline(text: string): string {
  return text.replace(/([\\`*_[\]~])/g, '\\$1')
}

/** Escape a leading character that would otherwise start a block construct. */
function escapeMdLineStart(text: string): string {
  return text
    .replace(/^(\s*)([#>+-])(?=\s)/, '$1\\$2')
    .replace(/^(\s*)(\d+)([.)])(?=\s)/, '$1$2\\$3')
}

function spansToMarkdownInline(spans: InlineSpan[]): string {
  return spans.map((span) => {
    const marks = span.marks
    const raw = span.text.replace(/\n/g, ' ')

    if (marks?.code) {
      // Pick a fence longer than any backtick run inside the code span.
      const longest = Math.max(0, ...(raw.match(/`+/g) ?? []).map(run => run.length))
      const fence = '`'.repeat(longest + 1)
      const pad = raw.startsWith('`') || raw.endsWith('`') ? ' ' : ''
      let text = `${fence}${pad}${raw}${pad}${fence}`

      if (marks.link) {
        text = `[${text}](${marks.link})`
      }

      return text
    }

    let text = escapeMdInline(raw)

    if (!marks || !text.trim()) {
      return text
    }

    // Markdown emphasis can't start/end on whitespace — keep it outside.
    const lead = /^\s*/.exec(text)?.[0] ?? ''
    const trail = /\s*$/.exec(text)?.[0] ?? ''
    text = text.slice(lead.length, text.length - trail.length)

    if (marks.bold) {
      text = `**${text}**`
    }

    if (marks.italic) {
      text = `*${text}*`
    }

    if (marks.strikethrough) {
      text = `~~${text}~~`
    }

    if (marks.link) {
      text = `[${text}](${marks.link})`
    }

    return `${lead}${text}${trail}`
  }).join('')
}

const INLINE_TOKEN_RE = new RegExp(
  [
    // 1: backslash escape
    '(\\\\[\\\\`*_{}()#+.!|>~\\[\\]\\-])',
    // 2: code span (any fence length)
    '((`+)(?!`)[\\s\\S]*?[^`]\\3(?!`))',
    // 4: link [text](url "title")
    '(\\[[^\\]]+\\]\\([^)\\s]+(?:\\s+"[^"]*")?\\))',
    // 5: bold **x**
    '(\\*\\*(?!\\s)[^*]+?(?<!\\s)\\*\\*)',
    // 6: bold __x__ (not inside words)
    '((?<![\\p{L}\\p{N}_])__(?!\\s)[^_]+?(?<!\\s)__(?![\\p{L}\\p{N}_]))',
    // 7: italic *x*
    '(\\*(?!\\s)[^*]+?(?<!\\s)\\*)',
    // 8: italic _x_ (not inside words — keeps snake_case intact)
    '((?<![\\p{L}\\p{N}_])_(?!\\s)[^_]+?(?<!\\s)_(?![\\p{L}\\p{N}_]))',
    // 9: strikethrough ~~x~~
    '(~~(?!\\s)[^~]+?(?<!\\s)~~)',
  ].join('|'),
  'gu',
)

function withMark(spans: InlineSpan[], marks: InlineMarks): InlineSpan[] {
  return spans.map(span => ({ text: span.text, marks: { ...marks, ...(span.marks ?? {}) } }))
}

function parseInlineMarkdown(line: string): InlineSpan[] {
  const spans: InlineSpan[] = []
  const re = new RegExp(INLINE_TOKEN_RE.source, INLINE_TOKEN_RE.flags)
  let last = 0
  let match: RegExpExecArray | null

  while ((match = re.exec(line)) !== null) {
    if (match.index > last) {
      spans.push({ text: line.slice(last, match.index) })
    }

    const raw = match[0]

    if (match[1]) {
      spans.push({ text: raw.slice(1) })
    } else if (match[2]) {
      const fence = match[3].length
      let code = raw.slice(fence, -fence)

      if (code.length > 2 && code.startsWith(' ') && code.endsWith(' ')) {
        code = code.slice(1, -1)
      }

      spans.push({ text: code, marks: { code: true } })
    } else if (match[4]) {
      const m = /^\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)$/.exec(raw)
      const href = m ? sanitizeLinkUrl(m[2]) : ''

      if (m && href) {
        spans.push(...withMark(parseInlineMarkdown(m[1]), { link: href }))
      } else {
        spans.push(...parseInlineMarkdown(m ? m[1] : raw))
      }
    } else if (match[5] || match[6]) {
      spans.push(...withMark(parseInlineMarkdown(raw.slice(2, -2)), { bold: true }))
    } else if (match[7] || match[8]) {
      spans.push(...withMark(parseInlineMarkdown(raw.slice(1, -1)), { italic: true }))
    } else if (match[9]) {
      spans.push(...withMark(parseInlineMarkdown(raw.slice(2, -2)), { strikethrough: true }))
    }

    last = match.index + raw.length
  }

  if (last < line.length) {
    spans.push({ text: line.slice(last) })
  }

  return normalizeSpans(spans.length ? spans : [{ text: line }])
}

function looksLikeTableSeparator(line: string): boolean {
  return /^\|?[\s:|-]+\|[\s:|-]+/.test(line.trim())
}

function parseTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '')

  return trimmed.split(/(?<!\\)\|/).map(c => c.trim().replace(/\\\|/g, '|'))
}

/** Leading whitespace width (tab = 4 columns). */
function indentWidth(line: string): number {
  let width = 0

  for (const ch of line) {
    if (ch === ' ') {
      width += 1
    } else if (ch === '\t') {
      width += 4
    } else {
      break
    }
  }

  return width
}

/**
 * Detect whether plain text is more likely Markdown than plain paragraphs.
 * Used by paste handlers when `text/html` is absent or deprioritized.
 */
export function looksLikeMarkdown(text: string): boolean {
  const t = text.trim()

  if (!t) {
    return false
  }

  if (/^#{1,6}\s+\S/m.test(t)) {
    return true
  }

  if (/^```/m.test(t)) {
    return true
  }

  if (/^>\s+\S/m.test(t)) {
    return true
  }

  if (/^\s*(\*|-|\+|\d+[.)])\s+\S/m.test(t)) {
    return true
  }

  if (/^---+$/m.test(t) || /^\*\*\*+$/m.test(t)) {
    return true
  }

  if (/\[.+\]\(.+\)/.test(t)) {
    return true
  }

  if (/\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|~~[^~]+~~/.test(t)) {
    return true
  }

  if (/^\|.+\|$/m.test(t) && looksLikeTableSeparator(t.split('\n').find(l => looksLikeTableSeparator(l)) ?? '')) {
    return true
  }

  return false
}

const LIST_ITEM_RE = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/

/** Parse CommonMark/GFM-ish markdown into blocks (lossy). */
export function markdownToBlocks(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n')
  const out: Block[] = []
  /** Indent widths of the open list levels, for nested list items. */
  let listStack: number[] = []
  let i = 0

  const listIndent = (width: number): number => {
    while (listStack.length > 0 && listStack[listStack.length - 1] > width) {
      listStack.pop()
    }

    if (listStack.length === 0 || listStack[listStack.length - 1] < width) {
      listStack.push(width)
    }

    return Math.min(listStack.length - 1, 8)
  }

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    if (!trimmed) {
      i += 1
      continue
    }

    const listMatch = LIST_ITEM_RE.exec(line)

    if (!listMatch) {
      listStack = []
    }

    if (/^(?:-\s*){3,}$/.test(trimmed) || /^(?:\*\s*){3,}$/.test(trimmed) || /^(?:_\s*){3,}$/.test(trimmed)) {
      out.push(createBlock('divider'))
      i += 1
      continue
    }

    const heading = /^(#{1,6})\s+(.*?)(?:\s+#+)?$/.exec(trimmed)

    if (heading) {
      const level = Math.min(heading[1].length, 3) as 1 | 2 | 3
      out.push(createBlock(`heading_${level}`, {
        content: parseInlineMarkdown(heading[2]),
      }))
      i += 1
      continue
    }

    const fenceMatch = /^(`{3,}|~{3,})\s*([\w#+.-]*)/.exec(trimmed)

    if (fenceMatch) {
      const fence = fenceMatch[1]
      const lang = fenceMatch[2] || 'plaintext'
      const fenceIndent = indentWidth(line)
      const body: string[] = []
      i += 1

      while (i < lines.length && !lines[i].trim().startsWith(fence)) {
        // Drop the fence's own indentation from each body line.
        body.push(lines[i].replace(new RegExp(`^ {0,${fenceIndent}}`), ''))
        i += 1
      }

      if (i < lines.length) {
        i += 1
      }

      out.push(createBlock('code', { props: { language: lang, code: body.join('\n') } }))
      continue
    }

    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = []

      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].replace(/^\s*>\s?/, ''))
        i += 1
      }

      out.push(createBlock('quote', {
        content: parseInlineMarkdown(quoteLines.join(' ').trim()),
      }))
      continue
    }

    if (
      trimmed.startsWith('|')
      && i + 1 < lines.length
      && looksLikeTableSeparator(lines[i + 1])
    ) {
      const header = parseTableRow(lines[i])
      i += 2
      const rows = [header.map(cell => ({ content: parseInlineMarkdown(cell) }))]

      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(parseTableRow(lines[i]).map(cell => ({ content: parseInlineMarkdown(cell) })))
        i += 1
      }

      // Normalize column counts
      const cols = Math.max(...rows.map(r => r.length), 1)
      const normalizedRows = rows.map(r => {
        const cells = [...r]

        while (cells.length < cols) {
          cells.push({ content: [] })
        }

        return cells.slice(0, cols)
      })

      out.push(createBlock('table', {
        props: { table: normalizeTableData({ hasHeader: true, rows: normalizedRows }) },
      }))
      continue
    }

    if (listMatch) {
      const indent = listIndent(indentWidth(listMatch[1]))
      const marker = listMatch[2]
      const body = listMatch[3]
      const todo = /^\[([ xX])\]\s+(.*)$/.exec(body)
      let type: BlockType = /\d/.test(marker) ? 'numbered_list_item' : 'bulleted_list_item'
      let content = body
      const props: Block['props'] = indent ? { indent } : {}

      if (todo && type === 'bulleted_list_item') {
        type = 'to_do'
        content = todo[2]
        props.checked = todo[1].toLowerCase() === 'x'
      }

      out.push(createBlock(type, { content: parseInlineMarkdown(content), props }))
      i += 1
      continue
    }

    const image = /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)$/.exec(trimmed)

    if (image) {
      const url = sanitizeMediaUrl(image[2])

      if (url) {
        out.push(createBlock('image', {
          props: { url, caption: image[1] },
        }))
      }

      i += 1
      continue
    }

    // Paragraph: merge consecutive non-blank non-block lines
    const para: string[] = [trimmed]
    i += 1

    while (i < lines.length) {
      const next = lines[i].trim()

      if (!next) {
        break
      }

      if (
        /^(#{1,6})\s+/.test(next)
        || /^(`{3,}|~{3,})/.test(next)
        || next.startsWith('>')
        || LIST_ITEM_RE.test(lines[i])
        || /^---+$/.test(next)
        || next.startsWith('|')
        || /^!\[/.test(next)
      ) {
        break
      }

      para.push(next)
      i += 1
    }

    out.push(createBlock('paragraph', {
      content: parseInlineMarkdown(para.join(' ')),
    }))
  }

  return out
}

/** Export blocks to Markdown. Custom blocks degrade lossily. */
export function blocksToMarkdownLossy(blocks: Block[]): string {
  const parts: string[] = []
  let numberedCounters: number[] = []
  let previousListLike = false

  const push = (text: string, listLike = false) => {
    // List items stay tight (single newline); everything else is a paragraph.
    if (parts.length > 0) {
      parts.push(listLike && previousListLike ? '\n' : '\n\n')
    }

    parts.push(text)
    previousListLike = listLike
  }

  for (const block of blocks) {
    const indent = block.props.indent ?? 0
    const pad = '  '.repeat(indent)
    const inline = () => escapeMdLineStart(spansToMarkdownInline(block.content))

    if (block.type !== 'numbered_list_item') {
      numberedCounters = numberedCounters.slice(0, indent)
    }

    switch (block.type) {
      case 'heading_1':
        push(`# ${spansToMarkdownInline(block.content)}`)
        break
      case 'heading_2':
        push(`## ${spansToMarkdownInline(block.content)}`)
        break
      case 'heading_3':
        push(`### ${spansToMarkdownInline(block.content)}`)
        break
      case 'quote':
        push(`${pad}> ${spansToMarkdownInline(block.content)}`)
        break
      case 'bulleted_list_item':
        push(`${pad}- ${spansToMarkdownInline(block.content)}`, true)
        break
      case 'numbered_list_item': {
        numberedCounters = numberedCounters.slice(0, indent + 1)
        numberedCounters[indent] = (numberedCounters[indent] ?? 0) + 1
        push(`${pad}${numberedCounters[indent]}. ${spansToMarkdownInline(block.content)}`, true)
        break
      }
      case 'to_do':
        push(`${pad}- [${block.props.checked ? 'x' : ' '}] ${spansToMarkdownInline(block.content)}`, true)
        break
      case 'code': {
        const lang = block.props.language && block.props.language !== 'plaintext'
          ? block.props.language
          : ''
        const code = block.props.code ?? ''
        const longest = Math.max(2, ...(code.match(/`{3,}/g) ?? []).map(run => run.length))
        const fence = '`'.repeat(longest + 1)
        push(`${fence}${lang}\n${code}\n${fence}`)
        break
      }
      case 'divider':
        push('---')
        break
      case 'image':
        if (block.props.url) {
          push(`![${escapeMd(block.props.caption ?? '')}](${block.props.url})`)
        }
        break
      case 'video':
      case 'audio':
      case 'file':
      case 'embed':
        if (block.props.url) {
          push(`[${escapeMd(blockToPlainText(block) || block.props.url)}](${block.props.url})`)
        }
        break
      case 'button': {
        const label = spansToMarkdownInline(block.content) || 'Button'
        const url = block.props.url ?? ''
        push(url ? `[${label}](${url})` : label)
        break
      }
      case 'bookmark': {
        const url = block.props.url ?? ''
        if (!url) break
        const label = escapeMd(block.props.title || url)
        push(`[${label}](${url})`)
        break
      }
      case 'callout': {
        const icon = block.props.icon ? `${block.props.icon} ` : ''
        push(`${pad}> ${icon}${spansToMarkdownInline(block.content)}`)
        break
      }
      case 'toggle':
      case 'toggle_heading_1':
      case 'toggle_heading_2':
      case 'toggle_heading_3': {
        const toggleHeading = /^toggle_heading_([1-3])$/.exec(block.type)
        if (toggleHeading) {
          push(`${'#'.repeat(Number(toggleHeading[1]))} ${spansToMarkdownInline(block.content)}`)
        } else {
          push(`${pad}${inline()}`)
        }
        break
      }
      case 'table_of_contents':
        break
      case 'table': {
        const table = normalizeTableData(block.props.table)

        if (!table.rows.length) {
          break
        }

        const cells = (row: typeof table.rows[0]) =>
          row.filter(c => !c.hidden).map(c => spansToMarkdownInline(c.content).replace(/\|/g, '\\|'))

        const lines: string[] = []
        const header = cells(table.rows[0])
        lines.push(`| ${header.join(' | ')} |`)
        lines.push(`| ${header.map(() => '---').join(' | ')} |`)

        for (let r = 1; r < table.rows.length; r++) {
          lines.push(`| ${cells(table.rows[r]).join(' | ')} |`)
        }

        push(lines.join('\n'))
        break
      }
      default:
        if (isTextBlock(block.type)) {
          push(`${pad}${inline()}`)
        } else {
          const plain = blockToPlainText(block)

          if (plain) {
            push(plain)
          }
        }
    }
  }

  return parts.join('')
}

/** Prefer markdown when plain text looks like MD; otherwise empty (caller falls through). */
export function tryParseMarkdownToBlocks(text: string): Block[] | null {
  if (!looksLikeMarkdown(text)) {
    return null
  }

  const blocks = markdownToBlocks(text)

  return blocks.length ? blocks : null
}
