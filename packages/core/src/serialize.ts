import { slugifyDocHeadingId } from './doc-heading-id'
import { spansToText } from './ops'
import { cellText, normalizeTableData } from './table'
import type { Block, BlocksContent } from './types'

export function blockToPlainText(block: Block): string {
  if (block.type === 'code') {
return block.props.code ?? ''
}

  if (block.type === 'image' || block.type === 'video' || block.type === 'audio') {
return block.props.caption ?? ''
}

  if (block.type === 'file') {
return block.props.name ?? block.props.caption ?? ''
}

  if (block.type === 'table') {
    const table = normalizeTableData(block.props.table)

    return table.rows
      .flatMap((row) => row.filter((cell) => !cell.hidden).map((cell) => cellText(cell)))
      .join('\n')
  }

  if (block.type === 'divider') {
return ''
}

  return spansToText(block.content)
}

export function blocksToPlainText(blocks: Block[]): string {
  return blocks.map(blockToPlainText).filter(Boolean).join('\n')
}

export interface DocHeading {
  id: string
  text: string
  level: number
}

/** Extract headings with stable anchor ids (deduplicated with numeric suffixes). */
export function extractHeadings(blocks: Block[]): DocHeading[] {
  const seen = new Map<string, number>()
  const headings: DocHeading[] = []

  for (const block of blocks) {
    const match = /^heading_([1-3])$/.exec(block.type)

    if (!match) {
continue
}

    const text = spansToText(block.content).trim()

    if (!text) {
continue
}

    let id = slugifyDocHeadingId(text) || 'heading'
    const count = seen.get(id) ?? 0
    seen.set(id, count + 1)

    if (count > 0) {
id = `${id}-${count}`
}

    headings.push({ id, text, level: Number(match[1]) })
  }

  return headings
}

/** Anchor id for a specific heading block (consistent with extractHeadings). */
export function headingAnchorIds(blocks: Block[]): Map<string, string> {
  const map = new Map<string, string>()
  const seen = new Map<string, number>()

  for (const block of blocks) {
    if (!/^heading_[1-3]$/.test(block.type)) {
continue
}

    const text = spansToText(block.content).trim()

    if (!text) {
continue
}

    let id = slugifyDocHeadingId(text) || 'heading'
    const count = seen.get(id) ?? 0
    seen.set(id, count + 1)

    if (count > 0) {
id = `${id}-${count}`
}

    map.set(block.id, id)
  }

  return map
}

/**
 * Numbering for numbered_list_item blocks in a flat list with indents.
 * Nested children do not break the parent counter; other block types at the
 * same (or shallower) indent reset it.
 */
export function computeListNumbering(blocks: Block[]): Map<string, number> {
  const map = new Map<string, number>()
  const counters: Record<number, number> = {}

  for (const b of blocks) {
    const ind = b.props.indent ?? 0

    if (b.type === 'numbered_list_item') {
      counters[ind] = (counters[ind] ?? 0) + 1

      for (const k of Object.keys(counters)) {
        if (Number(k) > ind) {
delete counters[Number(k)]
}
      }

      map.set(b.id, counters[ind])
    } else {
      for (const k of Object.keys(counters)) {
        if (Number(k) >= ind) {
delete counters[Number(k)]
}
      }
    }
  }

  return map
}

export function countWords(blocks: Block[]): number {
  const text = blocksToPlainText(blocks)

  if (!text.trim()) {
return 0
}

  return text.split(/\s+/).filter(Boolean).length
}

/** Build the canonical stored payload. */
export function buildBlocksContent(blocks: Block[]): BlocksContent {
  return {
    format: 'blocks',
    version: 1,
    blocks,
    text: blocksToPlainText(blocks),
  }
}
