/**
 * Lossy Markdown ↔ Block[] conversion (BlockNote-style).
 * Paste path prefers markdown when clipboard looks like MD; JSON/HTML remain
 * the lossless formats.
 */

import { createBlock, normalizeSpans } from './ops'
import { normalizeTableData } from './table'
import type { Block, InlineMarks, InlineSpan } from './types'
import { isTextBlock } from './types'
import { blockToPlainText } from './serialize'

function escapeMd(text: string): string {
  return text.replace(/([\\`*_{}[\]()#+\-.!|>])/g, '\\$1')
}

function spansToMarkdownInline(spans: InlineSpan[]): string {
  return spans.map((span) => {
    let text = span.text.replace(/\n/g, ' ')
    const marks = span.marks

    if (!marks) {
      return text
    }

    if (marks.code) {
      text = `\`${text.replace(/`/g, '\\`')}\``
    }

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

    return text
  }).join('')
}

function parseInlineMarkdown(line: string): InlineSpan[] {
  const spans: InlineSpan[] = []
  // Order: code, links, bold, italic, strike — pragmatic subset
  const tokenRe =
    /(`[^`]+`)|(\[[^\]]+\]\([^)]+\))|(\*\*[^*]+\*\*)|(__[^_]+__)|(\*[^*]+\*)|(_[^_]+_)|(~~[^~]+~~)/g
  let last = 0
  let match: RegExpExecArray | null

  while ((match = tokenRe.exec(line)) !== null) {
    if (match.index > last) {
      spans.push({ text: line.slice(last, match.index) })
    }

    const raw = match[0]
    const marks: InlineMarks = {}
    let text = raw

    if (raw.startsWith('`')) {
      text = raw.slice(1, -1)
      marks.code = true
    } else if (raw.startsWith('[')) {
      const m = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(raw)

      if (m) {
        text = m[1]
        marks.link = m[2]
      }
    } else if (raw.startsWith('**') || raw.startsWith('__')) {
      text = raw.slice(2, -2)
      marks.bold = true
    } else if (raw.startsWith('~~')) {
      text = raw.slice(2, -2)
      marks.strikethrough = true
    } else if (raw.startsWith('*') || raw.startsWith('_')) {
      text = raw.slice(1, -1)
      marks.italic = true
    }

    spans.push({ text, marks: Object.keys(marks).length ? marks : undefined })
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

  return trimmed.split('|').map(c => c.trim())
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

  if (/^(\*|-|\+|\d+\.)\s+\S/m.test(t)) {
    return true
  }

  if (/^---+$/m.test(t) || /^\*\*\*+$/m.test(t)) {
    return true
  }

  if (/\[.+\]\(.+\)/.test(t)) {
    return true
  }

  if (/\*\*[^*]+\*\*|__[^_]+__|`[^`]+`/.test(t)) {
    return true
  }

  if (/^\|.+\|$/m.test(t) && looksLikeTableSeparator(t.split('\n').find(l => looksLikeTableSeparator(l)) ?? '')) {
    return true
  }

  return false
}

/** Parse CommonMark/GFM-ish markdown into blocks (lossy). */
export function markdownToBlocks(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const out: Block[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    if (!trimmed) {
      i += 1
      continue
    }

    if (/^---+$/.test(trimmed) || /^\*\*\*+$/.test(trimmed) || /^___+$/.test(trimmed)) {
      out.push(createBlock('divider'))
      i += 1
      continue
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(trimmed)

    if (heading) {
      const level = Math.min(heading[1].length, 3) as 1 | 2 | 3
      out.push(createBlock(`heading_${level}`, {
        content: parseInlineMarkdown(heading[2]),
      }))
      i += 1
      continue
    }

    if (trimmed.startsWith('```')) {
      const lang = trimmed.slice(3).trim() || 'plaintext'
      const body: string[] = []
      i += 1

      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        body.push(lines[i])
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
        content: parseInlineMarkdown(quoteLines.join(' ')),
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
          cells.push({ content: [{ text: '' }] })
        }

        return cells.slice(0, cols)
      })

      out.push(createBlock('table', {
        props: { table: normalizeTableData({ hasHeader: true, rows: normalizedRows }) },
      }))
      continue
    }

    const todo = /^[-*+]\s+\[([ xX])\]\s+(.*)$/.exec(trimmed)

    if (todo) {
      out.push(createBlock('to_do', {
        content: parseInlineMarkdown(todo[2]),
        props: { checked: todo[1].toLowerCase() === 'x' },
      }))
      i += 1
      continue
    }

    const bullet = /^[-*+]\s+(.*)$/.exec(trimmed)

    if (bullet) {
      out.push(createBlock('bulleted_list_item', {
        content: parseInlineMarkdown(bullet[1]),
      }))
      i += 1
      continue
    }

    const numbered = /^(\d+)\.\s+(.*)$/.exec(trimmed)

    if (numbered) {
      out.push(createBlock('numbered_list_item', {
        content: parseInlineMarkdown(numbered[2]),
      }))
      i += 1
      continue
    }

    const image = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(trimmed)

    if (image) {
      out.push(createBlock('image', {
        props: { url: image[2], caption: image[1] },
      }))
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
        || next.startsWith('```')
        || next.startsWith('>')
        || /^[-*+]\s+/.test(next)
        || /^\d+\.\s+/.test(next)
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

  for (const block of blocks) {
    switch (block.type) {
      case 'heading_1':
        parts.push(`# ${spansToMarkdownInline(block.content)}`)
        break
      case 'heading_2':
        parts.push(`## ${spansToMarkdownInline(block.content)}`)
        break
      case 'heading_3':
        parts.push(`### ${spansToMarkdownInline(block.content)}`)
        break
      case 'quote':
        parts.push(`> ${spansToMarkdownInline(block.content)}`)
        break
      case 'bulleted_list_item':
        parts.push(`${'  '.repeat(block.props.indent ?? 0)}- ${spansToMarkdownInline(block.content)}`)
        break
      case 'numbered_list_item':
        parts.push(`${'  '.repeat(block.props.indent ?? 0)}1. ${spansToMarkdownInline(block.content)}`)
        break
      case 'to_do':
        parts.push(`- [${block.props.checked ? 'x' : ' '}] ${spansToMarkdownInline(block.content)}`)
        break
      case 'code': {
        const lang = block.props.language && block.props.language !== 'plaintext'
          ? block.props.language
          : ''
        parts.push(`\`\`\`${lang}\n${block.props.code ?? ''}\n\`\`\``)
        break
      }
      case 'divider':
        parts.push('---')
        break
      case 'image':
        parts.push(`![${escapeMd(block.props.caption ?? '')}](${block.props.url ?? ''})`)
        break
      case 'video':
      case 'audio':
      case 'file':
        if (block.props.url) {
          parts.push(`[${escapeMd(blockToPlainText(block) || block.type)}](${block.props.url})`)
        }
        break
      case 'button': {
        const label = spansToMarkdownInline(block.content) || 'Button'
        const url = block.props.url ?? ''
        parts.push(url ? `[${label}](${url})` : label)
        break
      }
      case 'callout':
      case 'toggle':
        parts.push(spansToMarkdownInline(block.content))
        break
      case 'table': {
        const table = normalizeTableData(block.props.table)

        if (!table.rows.length) {
          break
        }

        const cells = (row: typeof table.rows[0]) =>
          row.filter(c => !c.hidden).map(c => spansToMarkdownInline(c.content).replace(/\|/g, '\\|'))

        const header = cells(table.rows[0])
        parts.push(`| ${header.join(' | ')} |`)
        parts.push(`| ${header.map(() => '---').join(' | ')} |`)

        for (let r = 1; r < table.rows.length; r++) {
          parts.push(`| ${cells(table.rows[r]).join(' | ')} |`)
        }

        break
      }
      default:
        if (isTextBlock(block.type)) {
          parts.push(spansToMarkdownInline(block.content))
        } else {
          const plain = blockToPlainText(block)

          if (plain) {
            parts.push(plain)
          }
        }
    }
  }

  return parts.join('\n\n')
}

/** Prefer markdown when plain text looks like MD; otherwise empty (caller falls through). */
export function tryParseMarkdownToBlocks(text: string): Block[] | null {
  if (!looksLikeMarkdown(text)) {
    return null
  }

  const blocks = markdownToBlocks(text)

  return blocks.length ? blocks : null
}
