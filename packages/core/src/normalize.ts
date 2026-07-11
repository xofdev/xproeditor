import { parseInlineNodes } from './html'
import { createBlock, generateBlockId, normalizeSpans } from './ops'
import { normalizeTableData, tableCellFromText } from './table'
import type { Block, BlockType, InlineMarks, InlineSpan, TableCell } from './types'
import { isBlocksContent } from './types'

// ─── TipTap JSON → blocks ─────────────────────────────────────────────────────

interface TiptapMark {
  type: string
  attrs?: Record<string, unknown>
}

interface TiptapNode {
  type: string
  attrs?: Record<string, unknown>
  content?: TiptapNode[]
  marks?: TiptapMark[]
  text?: string
}

function tiptapMarksToInline(marks?: TiptapMark[]): InlineMarks | undefined {
  if (!marks || marks.length === 0) {
return undefined
}

  const out: InlineMarks = {}

  for (const mark of marks) {
    switch (mark.type) {
      case 'bold': out.bold = true; break
      case 'italic': out.italic = true; break
      case 'underline': out.underline = true; break
      case 'strike': out.strikethrough = true; break
      case 'code': out.code = true; break
      case 'link': {
        const href = mark.attrs?.href

        if (typeof href === 'string') {
out.link = href
}

        break
      }
      case 'textStyle': {
        const color = mark.attrs?.color

        if (typeof color === 'string') {
out.color = color
}

        break
      }
      case 'highlight': {
        const color = mark.attrs?.color
        out.highlight = typeof color === 'string' ? color : '#fef08a'
        break
      }
    }
  }

  return Object.keys(out).length > 0 ? out : undefined
}

function tiptapInlineToSpans(nodes?: TiptapNode[]): InlineSpan[] {
  if (!nodes) {
return []
}

  const spans: InlineSpan[] = []

  for (const node of nodes) {
    if (node.type === 'text' && node.text) {
      spans.push({ text: node.text, marks: tiptapMarksToInline(node.marks) })
    } else if (node.type === 'hardBreak') {
      spans.push({ text: '\n' })
    } else if (node.type === 'inlineIcon') {
      const name = node.attrs?.emoji ?? node.attrs?.icon ?? ''

      if (typeof name === 'string' && name) {
spans.push({ text: name })
}
    } else if (node.content) {
      spans.push(...tiptapInlineToSpans(node.content))
    }
  }

  return normalizeSpans(spans)
}

function parseColorFromStyle(style: string, property: 'color' | 'background-color'): string | undefined {
  const match = style.match(new RegExp(`${property}\\s*:\\s*([^;]+)`, 'i'))

  return match?.[1]?.trim()
}

function parseHtmlTableCell(cell: Element): TableCell {
  const content = normalizeSpans(parseInlineNodes(cell.childNodes))
  const colspan = Number.parseInt(cell.getAttribute('colspan') ?? '1', 10)
  const rowspan = Number.parseInt(cell.getAttribute('rowspan') ?? '1', 10)
  const style = cell.getAttribute('style') ?? ''
  const background = parseColorFromStyle(style, 'background-color') ?? cell.getAttribute('bgcolor') ?? undefined
  const textAlign = (cell as HTMLElement).style?.textAlign || style.match(/text-align:\s*([^;]+)/i)?.[1]?.trim()
  const align = textAlign === 'center' || textAlign === 'right' || textAlign === 'justify' || textAlign === 'left'
    ? textAlign
    : undefined

  return {
    content: content.length > 0 ? content : tableCellFromText(cell.textContent?.trim() ?? '').content,
    colspan: colspan > 1 ? colspan : undefined,
    rowspan: rowspan > 1 ? rowspan : undefined,
    background,
    align: align === 'left' ? undefined : align,
  }
}

function tiptapTableCell(node: TiptapNode): TableCell {
  return {
    content: tiptapInlineToSpans(node.content),
    colspan: typeof node.attrs?.colspan === 'number' && node.attrs.colspan > 1 ? node.attrs.colspan : undefined,
    rowspan: typeof node.attrs?.rowspan === 'number' && node.attrs.rowspan > 1 ? node.attrs.rowspan : undefined,
  }
}

function tiptapNodeText(node: TiptapNode): string {
  if (node.text) {
return node.text
}

  return (node.content ?? []).map(tiptapNodeText).join('')
}

function dirFromAttrs(attrs?: Record<string, unknown>): 'rtl' | 'ltr' | undefined {
  const dir = attrs?.dir

  return dir === 'rtl' || dir === 'ltr' ? dir : undefined
}

function dirFromElement(el: Element): 'rtl' | 'ltr' | undefined {
  const dir = el.getAttribute('dir')

  return dir === 'rtl' || dir === 'ltr' ? dir : undefined
}

function propsWithDir(el: Element, extra: Record<string, unknown> = {}): Record<string, unknown> {
  const dir = dirFromElement(el)

  return dir ? { ...extra, dir } : extra
}

function convertTiptapNodes(nodes: TiptapNode[], indent: number, out: Block[]): void {
  for (const node of nodes) {
    switch (node.type) {
      case 'paragraph': {
        const spans = tiptapInlineToSpans(node.content)
        out.push(createBlock('paragraph', {
          content: spans,
          props: { ...(indent ? { indent } : {}), ...(dirFromAttrs(node.attrs) ? { dir: dirFromAttrs(node.attrs) } : {}) },
        }))
        break
      }
      case 'heading': {
        const level = Math.min(Math.max(Number(node.attrs?.level) || 1, 1), 3)
        out.push(createBlock(`heading_${level}` as BlockType, {
          content: tiptapInlineToSpans(node.content),
          props: dirFromAttrs(node.attrs) ? { dir: dirFromAttrs(node.attrs) } : {},
        }))
        break
      }
      case 'bulletList':
      case 'orderedList': {
        const itemType: BlockType = node.type === 'bulletList' ? 'bulleted_list_item' : 'numbered_list_item'

        for (const li of node.content ?? []) {
          let firstParagraphUsed = false

          for (const child of li.content ?? []) {
            if (child.type === 'paragraph' && !firstParagraphUsed) {
              out.push(createBlock(itemType, {
                content: tiptapInlineToSpans(child.content),
                props: indent ? { indent } : {},
              }))
              firstParagraphUsed = true
            } else if (child.type === 'bulletList' || child.type === 'orderedList') {
              convertTiptapNodes([child], indent + 1, out)
            } else {
              convertTiptapNodes([child], indent + 1, out)
            }
          }
        }

        break
      }
      case 'taskList': {
        for (const li of node.content ?? []) {
          const checked = li.attrs?.checked === true
          const para = (li.content ?? []).find(c => c.type === 'paragraph')
          out.push(createBlock('to_do', {
            content: tiptapInlineToSpans(para?.content),
            props: { checked, ...(indent ? { indent } : {}) },
          }))
        }

        break
      }
      case 'blockquote': {
        // Flatten quote children into quote blocks
        for (const child of node.content ?? []) {
          if (child.type === 'paragraph') {
            out.push(createBlock('quote', { content: tiptapInlineToSpans(child.content) }))
          } else {
            convertTiptapNodes([child], indent, out)
          }
        }

        break
      }
      case 'codeBlock': {
        out.push(createBlock('code', {
          props: {
            language: typeof node.attrs?.language === 'string' && node.attrs.language ? node.attrs.language : 'plaintext',
            code: tiptapNodeText(node),
          },
        }))
        break
      }
      case 'horizontalRule':
        out.push(createBlock('divider'))
        break
      case 'image': {
        const src = node.attrs?.src

        if (typeof src === 'string' && src) {
          out.push(createBlock('image', {
            props: {
              url: src,
              caption: typeof node.attrs?.title === 'string' ? node.attrs.title : (typeof node.attrs?.alt === 'string' ? node.attrs.alt : ''),
            },
          }))
        }

        break
      }
      case 'table': {
        const rows: TableCell[][] = []
        let hasHeader = false

        for (const row of node.content ?? []) {
          if (row.type !== 'tableRow') {
continue
}

          const cells: TableCell[] = []

          for (const cell of row.content ?? []) {
            if (cell.type === 'tableHeader' && rows.length === 0) {
hasHeader = true
}

            cells.push(tiptapTableCell(cell))
          }

          rows.push(cells)
        }

        if (rows.length > 0) {
          out.push(createBlock('table', { props: { table: normalizeTableData({ hasHeader, rows }) } }))
        }

        break
      }
      default: {
        if (node.content) {
convertTiptapNodes(node.content, indent, out)
}
      }
    }
  }
}

export function tiptapToBlocks(doc: Record<string, unknown>): Block[] {
  const out: Block[] = []
  const content = Array.isArray(doc.content) ? (doc.content as TiptapNode[]) : []
  convertTiptapNodes(content, 0, out)

  return out
}

// ─── HTML → blocks (client only, requires DOMParser) ─────────────────────────

function convertHtmlElement(el: Element, indent: number, out: Block[]): void {
  const tag = el.tagName.toLowerCase()

  switch (tag) {
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6': {
      const level = Math.min(Number(tag[1]), 3)
      out.push(createBlock(`heading_${level}` as BlockType, {
        content: normalizeSpans(parseInlineNodes(el.childNodes)),
        props: propsWithDir(el),
      }))
      break
    }
    case 'p': {
      const spans = normalizeSpans(parseInlineNodes(el.childNodes))
      out.push(createBlock('paragraph', {
        content: spans,
        props: { ...(indent ? { indent } : {}), ...propsWithDir(el) },
      }))
      break
    }
    case 'blockquote': {
      const paragraphs = el.querySelectorAll(':scope > p')

      if (paragraphs.length > 0) {
        paragraphs.forEach(p => out.push(createBlock('quote', {
          content: normalizeSpans(parseInlineNodes(p.childNodes)),
          props: propsWithDir(p),
        })))
      } else {
        out.push(createBlock('quote', {
          content: normalizeSpans(parseInlineNodes(el.childNodes)),
          props: propsWithDir(el),
        }))
      }

      break
    }
    case 'pre': {
      const codeEl = el.querySelector('code')
      out.push(createBlock('code', {
        props: { language: 'plaintext', code: (codeEl ?? el).textContent ?? '' },
      }))
      break
    }
    case 'ul':
    case 'ol': {
      const itemType: BlockType = tag === 'ul' ? 'bulleted_list_item' : 'numbered_list_item'

      for (const li of Array.from(el.children)) {
        if (li.tagName.toLowerCase() !== 'li') {
continue
}

        const nestedLists = Array.from(li.children).filter(c => ['ul', 'ol'].includes(c.tagName.toLowerCase()))
        const inlineNodes = Array.from(li.childNodes).filter(n => !nestedLists.includes(n as Element))
        out.push(createBlock(itemType, {
          content: normalizeSpans(parseInlineNodes(inlineNodes)),
          props: { ...(indent ? { indent } : {}), ...propsWithDir(li) },
        }))

        for (const nested of nestedLists) {
convertHtmlElement(nested, indent + 1, out)
}
      }

      break
    }
    case 'hr':
      out.push(createBlock('divider'))
      break
    case 'img': {
      const src = el.getAttribute('src')

      if (src) {
out.push(createBlock('image', { props: { url: src, caption: el.getAttribute('alt') ?? '' } }))
}

      break
    }
    case 'audio': {
      const src = el.getAttribute('src') ?? el.querySelector('source')?.getAttribute('src')

      if (src) {
out.push(createBlock('audio', { props: { url: src } }))
}

      break
    }
    case 'table': {
      const rows: TableCell[][] = []
      let hasHeader = false
      el.querySelectorAll('tr').forEach((tr, i) => {
        const cells: TableCell[] = []
        tr.querySelectorAll('th, td').forEach((cell) => {
          if (cell.tagName.toLowerCase() === 'th' && i === 0) {
hasHeader = true
}

          cells.push(parseHtmlTableCell(cell))
        })

        if (cells.length) {
rows.push(cells)
}
      })

      if (rows.length) {
out.push(createBlock('table', { props: { table: normalizeTableData({ hasHeader, rows }) } }))
}

      break
    }
    case 'div':
    case 'section':
    case 'article': {
      const children = Array.from(el.children)

      if (children.length === 0) {
        const spans = normalizeSpans(parseInlineNodes(el.childNodes))

        if (spans.length) {
out.push(createBlock('paragraph', { content: spans }))
}
      } else {
        // Mixed content: walk child nodes, wrapping loose inline runs in paragraphs
        let inlineBuffer: Node[] = []
        const flush = () => {
          if (inlineBuffer.length === 0) {
return
}

          const spans = normalizeSpans(parseInlineNodes(inlineBuffer))

          if (spans.some(s => s.text.trim())) {
out.push(createBlock('paragraph', { content: spans }))
}

          inlineBuffer = []
        }
        const blockTags = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'blockquote', 'pre', 'ul', 'ol', 'hr', 'img', 'table', 'div', 'section', 'article'])

        for (const child of Array.from(el.childNodes)) {
          if (child.nodeType === Node.ELEMENT_NODE && blockTags.has((child as Element).tagName.toLowerCase())) {
            flush()
            convertHtmlElement(child as Element, indent, out)
          } else {
            inlineBuffer.push(child)
          }
        }

        flush()
      }

      break
    }
    default: {
      const spans = normalizeSpans(parseInlineNodes([el]))

      if (spans.some(s => s.text.trim())) {
out.push(createBlock('paragraph', { content: spans }))
}
    }
  }
}

export function htmlToBlocks(html: string): Block[] {
  if (typeof DOMParser === 'undefined') {
    const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()

    return text ? [createBlock('paragraph', { content: [{ text }] })] : []
  }

  const doc = new DOMParser().parseFromString(html, 'text/html')
  const out: Block[] = []
  let inlineBuffer: Node[] = []
  const flush = () => {
    if (inlineBuffer.length === 0) {
return
}

    const spans = normalizeSpans(parseInlineNodes(inlineBuffer))

    if (spans.some(s => s.text.trim())) {
out.push(createBlock('paragraph', { content: spans }))
}

    inlineBuffer = []
  }

  for (const node of Array.from(doc.body.childNodes)) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      flush()
      convertHtmlElement(node as Element, 0, out)
    } else {
      inlineBuffer.push(node)
    }
  }

  flush()

  return out
}

// ─── Entry point ──────────────────────────────────────────────────────────────

function sanitizeBlocks(blocks: Block[]): Block[] {
  return blocks.map(b => ({
    id: typeof b.id === 'string' && b.id ? b.id : generateBlockId(),
    type: b.type,
    content: Array.isArray(b.content) ? normalizeSpans(b.content) : [],
    props: b.props && typeof b.props === 'object' ? b.props : {},
  }))
}

/**
 * Convert any stored document content (blocks / legacy TipTap JSON / legacy HTML)
 * into the canonical Block[] model.
 */
export function normalizeContent(content: Record<string, unknown> | null | undefined): Block[] {
  if (!content || typeof content !== 'object') {
return []
}

  if (isBlocksContent(content)) {
return sanitizeBlocks(content.blocks as Block[])
}

  if (content.format === 'html' && typeof content.html === 'string') {
    return htmlToBlocks(content.html)
  }

  if (content.type === 'doc') {
return tiptapToBlocks(content)
}

  return []
}
