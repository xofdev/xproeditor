import { embedFrameHeight, resolveEmbed } from './embed'
import { escapeHtml, spansToHtml } from './html'
import { cloneBlock } from './ops'
import { sanitizeBlocks, sanitizeCssColor, sanitizeLinkUrl, sanitizeMediaUrl } from './sanitize'
import { blockToPlainText, extractHeadings, headingAnchorIds } from './serialize'
import type { DocHeading } from './serialize'
import { isAllowedEmbedUrl, parseVideoEmbed } from './video-embed'
import {
  getResolvedTableWidth,
  normalizeTableData,
  tableCellStyle,
  tableWrapperStyle,
} from './table'
import { getToggleSubtreeLength } from './toggle'
import type { Block, TableCell } from './types'
import { isBlocksContent, isTextBlock, isToggleBlock, toggleHeadingLevel } from './types'

/** Custom MIME for lossless round-trip paste inside xlog. */
export const BLOCKS_CLIPBOARD_MIME = 'application/x-xlog-blocks+json'

export function cloneBlocksForClipboard(blocks: Block[]): Block[] {
  return blocks.map(b => cloneBlock(b, true))
}

export function blocksToPlainTextExport(blocks: Block[]): string {
  return blocks.map(blockToPlainText).join('\n')
}

function dirAttr(block: Block): string {
  const dir = block.props.dir

  return dir && dir !== 'auto' ? ` dir="${dir}"` : ''
}

function renderTableCellHtml(
  cell: TableCell,
  rowIdx: number,
  _colIdx: number,
  hasHeader: boolean,
  style: ReturnType<typeof normalizeTableData>['style'],
): string {
  if (cell.hidden) {
    return ''
  }

  const cellTag = hasHeader && rowIdx === 0 ? 'th' : 'td'
  const attrs: string[] = []
  const inlineStyle = Object.entries(tableCellStyle(cell, rowIdx, hasHeader, style))
    .map(([key, value]) => `${key.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`)}:${value}`)
    .join(';')

  if (cell.colspan && cell.colspan > 1) {
    attrs.push(`colspan="${cell.colspan}"`)
  }

  if (cell.rowspan && cell.rowspan > 1) {
    attrs.push(`rowspan="${cell.rowspan}"`)
  }

  if (inlineStyle) {
    attrs.push(`style="${escapeHtml(inlineStyle)}"`)
  }

  const attrStr = attrs.length ? ` ${attrs.join(' ')}` : ''

  return `<${cellTag}${attrStr}>${spansToHtml(cell.content)}</${cellTag}>`
}

interface HtmlExportContext {
  /** Heading block id → anchor id (shared with the table of contents). */
  anchors: Map<string, string>
  headings: DocHeading[]
}

function styleAttr(block: Block, extra: string[] = []): string {
  const styles = [...extra]
  const indent = block.props.indent ?? 0

  if (indent) {
    styles.push(`margin-inline-start:${indent * 24}px`)
  }

  if (block.props.align && block.props.align !== 'left') {
    styles.push(`text-align:${block.props.align}`)
  }

  return styles.length ? ` style="${escapeHtml(styles.join(';'))}"` : ''
}

function headingTag(level: number, block: Block, ctx: HtmlExportContext): string {
  const anchor = ctx.anchors.get(block.id)
  const id = anchor ? ` id="${escapeHtml(anchor)}"` : ''

  return `<h${level}${id}${dirAttr(block)}${styleAttr(block)}>${spansToHtml(block.content)}</h${level}>`
}

function iframeHtml(src: string, height: number, title: string): string {
  return `<iframe src="${escapeHtml(src)}" height="${height}" style="width:100%;border:0" title="${escapeHtml(title)}" loading="lazy" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-popups allow-presentation allow-forms"></iframe>`
}

function blockToHtmlFragment(block: Block, ctx: HtmlExportContext): string {
  const direction = dirAttr(block)

  switch (block.type) {
    case 'heading_1':
      return headingTag(1, block, ctx)
    case 'heading_2':
      return headingTag(2, block, ctx)
    case 'heading_3':
      return headingTag(3, block, ctx)
    case 'quote':
      return `<blockquote${direction}${styleAttr(block)}><p>${spansToHtml(block.content)}</p></blockquote>`
    case 'callout': {
      const icon = block.props.icon ?? ''
      const color = sanitizeCssColor(block.props.color)
      const attrs = [
        'data-xpe-type="callout"',
        icon ? `data-xpe-icon="${escapeHtml(icon)}"` : '',
        color ? `data-xpe-color="${escapeHtml(color)}"` : '',
      ].filter(Boolean).join(' ')
      const iconHtml = icon ? `<span data-xpe-callout-icon>${escapeHtml(icon)}</span> ` : ''

      return `<aside ${attrs}${direction}${styleAttr(block, color ? [`background:${color}`] : [])}>${iconHtml}<p>${spansToHtml(block.content)}</p></aside>`
    }
    case 'code': {
      const lang = block.props.language && block.props.language !== 'plaintext'
        ? ` class="language-${escapeHtml(block.props.language)}"`
        : ''

      return `<pre><code${lang}>${escapeHtml(block.props.code ?? '')}</code></pre>`
    }
    case 'divider':
      return '<hr>'
    case 'image': {
      const url = sanitizeMediaUrl(block.props.url)

      if (!url) {
return ''
}

      const caption = block.props.caption ?? ''
      const width = typeof block.props.width === 'number' && block.props.width > 0 && block.props.width < 100
        ? ` style="width:${Math.round(block.props.width)}%"`
        : ''
      const img = `<img src="${escapeHtml(url)}" alt="${escapeHtml(caption)}"${width}>`

      return caption
        ? `<figure>${img}<figcaption>${escapeHtml(caption)}</figcaption></figure>`
        : img
    }
    case 'video': {
      const raw = block.props.url ?? ''

      if (!raw) {
return ''
}

      const caption = block.props.caption
        ? `<figcaption>${escapeHtml(block.props.caption)}</figcaption>`
        : ''
      const embed = isAllowedEmbedUrl(raw) ? raw : parseVideoEmbed(raw)?.embedUrl

      if (embed) {
        return `<figure data-xpe-type="video" data-xpe-url="${escapeHtml(embed)}">${iframeHtml(embed, 400, block.props.caption || 'Video')}${caption}</figure>`
      }

      const url = sanitizeMediaUrl(raw)

      return url ? `<figure data-xpe-type="video"><video controls src="${escapeHtml(url)}"></video>${caption}</figure>` : ''
    }
    case 'audio': {
      const url = sanitizeMediaUrl(block.props.url)

      if (!url) {
return ''
}

      return `<audio controls src="${escapeHtml(url)}"></audio>`
    }
    case 'file': {
      const url = sanitizeLinkUrl(block.props.url)

      if (!url) {
return ''
}

      const name = escapeHtml(block.props.name ?? block.props.caption ?? 'Download file')

      return `<a href="${escapeHtml(url)}" download>${name}</a>`
    }
    case 'embed': {
      const resolved = resolveEmbed(block.props.url)

      if (!resolved) {
        const url = sanitizeLinkUrl(block.props.url)

        return url ? `<p><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></p>` : ''
      }

      const height = embedFrameHeight(block.props.height, resolved.height)
      const caption = block.props.caption
        ? `<figcaption>${escapeHtml(block.props.caption)}</figcaption>`
        : ''

      return `<figure data-xpe-type="embed" data-xpe-url="${escapeHtml(block.props.url ?? '')}" data-xpe-provider="${escapeHtml(resolved.provider.id)}">${iframeHtml(resolved.embedUrl, height, block.props.caption || resolved.provider.name)}${caption}</figure>`
    }
    case 'table_of_contents': {
      if (!ctx.headings.length) {
        return '<nav data-xpe-type="table_of_contents"></nav>'
      }

      const items = ctx.headings
        .map(h => `<li data-level="${h.level}" style="margin-inline-start:${(h.level - 1) * 16}px"><a href="#${escapeHtml(h.id)}">${escapeHtml(h.text)}</a></li>`)
        .join('')

      return `<nav data-xpe-type="table_of_contents"><ul>${items}</ul></nav>`
    }
    case 'button': {
      const url = sanitizeLinkUrl(block.props.url)
      const label = spansToHtml(block.content) || 'Button'
      const style = block.props.buttonStyle === 'outline' || block.props.buttonStyle === 'ghost' ? block.props.buttonStyle : 'primary'
      const align = block.props.align === 'center' || block.props.align === 'right' ? block.props.align : 'left'
      const color = sanitizeCssColor(block.props.color)
      const newTab = block.props.openInNewTab ? 'true' : 'false'
      const attrs = [
        'data-xpe-type="button"',
        `data-xpe-style="${style}"`,
        `data-xpe-align="${align}"`,
        `data-xpe-newtab="${newTab}"`,
        url ? `data-xpe-url="${escapeHtml(url)}"` : '',
        color ? `data-xpe-color="${escapeHtml(color)}"` : '',
      ].filter(Boolean).join(' ')
      const alignStyle = `text-align:${align};`
      const colorStyle = color ? `--xpe-btn-accent:${escapeHtml(color)};` : ''
      const target = block.props.openInNewTab ? ' target="_blank" rel="noopener noreferrer"' : ''

      if (url) {
        return `<div ${attrs} style="${alignStyle}${colorStyle}"><a href="${escapeHtml(url)}"${target} class="xpe-btn xpe-btn--${style}">${label}</a></div>`
      }

      return `<div ${attrs} style="${alignStyle}${colorStyle}"><span class="xpe-btn xpe-btn--${style}">${label}</span></div>`
    }
    case 'bookmark': {
      const url = sanitizeLinkUrl(block.props.url)
      if (!url) return ''

      const title = escapeHtml(block.props.title || blockToPlainText(block) || url)
      const description = block.props.description
        ? `<p data-xpe-bookmark-desc>${escapeHtml(block.props.description)}</p>`
        : ''
      const faviconUrl = sanitizeMediaUrl(block.props.favicon)
      const imageUrl = sanitizeMediaUrl(block.props.image)
      const favicon = faviconUrl ? ` data-xpe-favicon="${escapeHtml(faviconUrl)}"` : ''
      const image = imageUrl ? ` data-xpe-image="${escapeHtml(imageUrl)}"` : ''
      const titleAttr = block.props.title
        ? ` data-xpe-title="${escapeHtml(block.props.title)}"`
        : ''
      const descAttr = block.props.description
        ? ` data-xpe-description="${escapeHtml(block.props.description)}"`
        : ''

      return `<div data-xpe-type="bookmark" data-xpe-url="${escapeHtml(url)}"${titleAttr}${descAttr}${favicon}${image}><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer"><strong>${title}</strong>${description}<span>${escapeHtml(url)}</span></a></div>`
    }
    case 'table': {
      const table = normalizeTableData(block.props.table)

      if (!table.rows.length) {
return ''
}

      const width = getResolvedTableWidth(table.width)
      const tableStyle = [
        ...Object.entries(tableWrapperStyle(table.style, width)).map(([k, v]) => `${k}:${v}`),
        'border-collapse:collapse',
      ].join(';')

      const rows = table.rows.map((row, i) => {
        const cells = row
          .map((cell, cIdx) => renderTableCellHtml(cell, i, cIdx, table.hasHeader, table.style))
          .filter(Boolean)
          .join('')

        return `<tr>${cells}</tr>`
      }).join('')

      return `<table style="${escapeHtml(tableStyle)}">${rows}</table>`
    }
    case 'toggle':
    case 'toggle_heading_1':
    case 'toggle_heading_2':
    case 'toggle_heading_3':
      return toggleToHtmlFragment(block, '', ctx)
    default:
      if (isTextBlock(block.type)) {
        return `<p${direction}${styleAttr(block)}>${spansToHtml(block.content)}</p>`
      }

      return ''
  }
}

function toggleToHtmlFragment(block: Block, childrenHtml: string, ctx: HtmlExportContext): string {
  const direction = dirAttr(block)
  const open = block.props.collapsed ? '' : ' open'
  const level = toggleHeadingLevel(block.type)
  const anchor = level ? ctx.anchors.get(block.id) : undefined
  const id = anchor ? ` id="${escapeHtml(anchor)}"` : ''
  const summaryInner = level
    ? `<h${level}${id}${direction}>${spansToHtml(block.content)}</h${level}>`
    : `<p${direction}>${spansToHtml(block.content)}</p>`

  return `<details data-xpe-type="${block.type}"${open}><summary>${summaryInner}</summary>${childrenHtml}</details>`
}

/** Relative-indent clone of toggle children for nested HTML serialization. */
function relativeIndentChildren(blocks: Block[], parentIndent: number): Block[] {
  return blocks.map((b) => {
    const copy = cloneBlock(b, false)
    const rel = (copy.props.indent ?? 0) - parentIndent - 1
    if (rel <= 0) delete copy.props.indent
    else copy.props.indent = rel
    return copy
  })
}

const LIST_BLOCK_TYPES = new Set(['bulleted_list_item', 'numbered_list_item', 'to_do'])

function isListBlock(block: Block | undefined): boolean {
  return !!block && LIST_BLOCK_TYPES.has(block.type)
}

function listItemHtml(block: Block): string {
  const direction = dirAttr(block)

  if (block.type === 'to_do') {
    const checked = block.props.checked ? ' checked' : ''

    return `<li data-checked="${block.props.checked ? 'true' : 'false'}"${direction}><input type="checkbox" disabled${checked}> ${spansToHtml(block.content)}`
  }

  return `<li${direction}>${spansToHtml(block.content)}`
}

/**
 * Render a run of list items starting at `start` whose indent is ≥ `indent`.
 * Deeper items nest inside the preceding `<li>`, so the flat block model
 * exports as properly nested `<ul>/<ol>` markup.
 */
function renderListGroup(blocks: Block[], start: number, indent: number): { html: string; next: number } {
  const type = blocks[start].type
  const items: string[] = []
  let i = start

  while (i < blocks.length) {
    const block = blocks[i]

    if (!isListBlock(block)) {
      break
    }

    const level = block.props.indent ?? 0

    if (level < indent) {
      break
    }

    if (level > indent) {
      const nested = renderListGroup(blocks, i, level)

      if (items.length === 0) {
        items.push('<li>')
      }

      items[items.length - 1] += nested.html
      i = nested.next
      continue
    }

    if (block.type !== type) {
      break
    }

    items.push(listItemHtml(block))
    i++
  }

  const html = items.map(item => `${item}</li>`).join('')

  if (type === 'numbered_list_item') {
    return { html: `<ol>${html}</ol>`, next: i }
  }

  if (type === 'to_do') {
    return { html: `<ul data-type="taskList">${html}</ul>`, next: i }
  }

  return { html: `<ul>${html}</ul>`, next: i }
}

function blocksToHtmlWithContext(blocks: Block[], ctx: HtmlExportContext): string {
  const parts: string[] = []
  let i = 0

  while (i < blocks.length) {
    const b = blocks[i]

    if (isListBlock(b)) {
      const group = renderListGroup(blocks, i, b.props.indent ?? 0)
      parts.push(group.html)
      i = group.next
      continue
    }

    if (isToggleBlock(b.type)) {
      const len = getToggleSubtreeLength(blocks, i)
      const parentIndent = b.props.indent ?? 0
      const childBlocks = relativeIndentChildren(blocks.slice(i + 1, i + len), parentIndent)
      const childrenHtml = childBlocks.length ? blocksToHtmlWithContext(childBlocks, ctx) : ''
      parts.push(toggleToHtmlFragment(b, childrenHtml, ctx))
      i += len
      continue
    }

    const frag = blockToHtmlFragment(b, ctx)

    if (frag) {
parts.push(frag)
}

    i++
  }

  return parts.join('')
}

/**
 * HTML body for external apps (CMS, email, static sites). Lists nest by
 * indent, toggles use `<details>`, headings get anchor ids that the table of
 * contents links to, and every URL/colour is sanitized.
 */
export function blocksToHtmlContent(blocks: Block[]): string {
  return blocksToHtmlWithContext(blocks, {
    anchors: headingAnchorIds(blocks),
    headings: extractHeadings(blocks),
  })
}

export function blocksToClipboardJson(blocks: Block[]): string {
  return JSON.stringify({
    format: 'blocks',
    version: 1,
    blocks: cloneBlocksForClipboard(blocks),
  })
}

export function blocksToClipboardPayload(blocks: Block[]): { json: string; plain: string; html: string } {
  const json = blocksToClipboardJson(blocks)
  const plain = blocksToPlainTextExport(blocks)
  const body = blocksToHtmlContent(blocks)
  const html = `<meta charset="utf-8"><div data-xlog-blocks="${encodeURIComponent(json)}">${body}</div>`

  return { json, plain, html }
}

function parseBlocksJson(json: string): Block[] | null {
  try {
    const parsed = JSON.parse(json) as unknown

    if (!parsed || typeof parsed !== 'object') {
return null
}

    // Clipboard data can come from any page — validate before trusting it.
    const raw = isBlocksContent(parsed) ? parsed.blocks : (parsed as { blocks?: unknown }).blocks
    const blocks = sanitizeBlocks(raw)

    if (blocks.length > 0) {
      return cloneBlocksForClipboard(blocks)
    }
  } catch {
    /* ignore malformed clipboard */
  }

  return null
}

function parseBlocksFromHtml(html: string): Block[] | null {
  const match = html.match(/data-xlog-blocks="([^"]+)"/)

  if (!match?.[1]) {
return null
}

  try {
    return parseBlocksJson(decodeURIComponent(match[1]))
  } catch {
    return null
  }
}

/** Read xlog-native blocks from clipboard (null = use default text/html paste). */
export function parseBlocksFromClipboardData(data: DataTransfer): Block[] | null {
  const custom = data.getData(BLOCKS_CLIPBOARD_MIME)

  if (custom) {
    const blocks = parseBlocksJson(custom)

    if (blocks) {
return blocks
}
  }

  const html = data.getData('text/html')

  if (html) {
    const fromAttr = parseBlocksFromHtml(html)

    if (fromAttr) {
return fromAttr
}
  }

  const plain = data.getData('text/plain')

  if (plain.startsWith('{') && plain.includes('"format"') && plain.includes('"blocks"')) {
    const blocks = parseBlocksJson(plain)

    if (blocks) {
return blocks
}
  }

  return null
}

/** Write blocks to a DataTransfer (copy/cut events). */
export function writeBlocksToClipboardData(data: DataTransfer, blocks: Block[]): void {
  const { json, plain, html } = blocksToClipboardPayload(blocks)
  data.clearData()
  data.setData('text/plain', plain)
  data.setData('text/html', html)

  try {
    data.setData(BLOCKS_CLIPBOARD_MIME, json)
  } catch {
    /* some browsers restrict custom MIME on DataTransfer */
  }
}
