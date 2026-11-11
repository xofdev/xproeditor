import { createBlock } from './ops'
import type { Block, BlockProps } from './types'

/**
 * Columns in the flat block model.
 *
 * A `columns` block opens a group and holds its layout (count, widths, gap,
 * vertical alignment, stacking order on narrow screens). The blocks that follow
 * it and carry a numeric `props.column` (0-based) are its children, in reading
 * order: every block of column 0, then column 1, then column 2. The group ends at
 * the first block without `column`. Any block type can sit in a column, and a
 * column keeps its own indent nesting (lists, toggles).
 *
 * This mirrors how `indent` expresses nesting: no tree, so history, collaboration,
 * clipboard and storage stay a flat list. `normalizeColumns` keeps a group valid
 * after any edit; adapters call it after structural changes.
 */

export type ColumnCount = 2 | 3
export type ColumnAlign = 'top' | 'center' | 'bottom'
export type ColumnStack = 'normal' | 'reverse' | 'none'

export const MIN_COLUMNS = 2
export const MAX_COLUMNS = 3

/** Width presets (percent, summing to 100) offered by the column toolbar. */
export const COLUMN_LAYOUTS: Record<ColumnCount, number[][]> = {
  2: [
    [50, 50],
    [40, 60],
    [60, 40],
    [33, 67],
    [67, 33],
  ],
  3: [
    [33.33, 33.33, 33.34],
    [25, 50, 25],
    [50, 25, 25],
    [25, 25, 50],
  ],
}

/** Gap presets in px offered by the column toolbar. */
export const COLUMN_GAPS = [16, 32, 48, 72] as const
export const DEFAULT_COLUMN_GAP = 32

export function isColumnsBlock(block: Block | undefined | null): boolean {
  return !!block && block.type === 'columns'
}

/** The 0-based column of a block inside a group, or null for a top-level block. */
export function blockColumn(block: Block | undefined | null): number | null {
  const value = block?.props.column

  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null
}

export function columnCount(block: Block): ColumnCount {
  const count = Math.round(Number(block.props.columnCount ?? MIN_COLUMNS))

  return (count >= MAX_COLUMNS ? MAX_COLUMNS : MIN_COLUMNS) as ColumnCount
}

/** Column widths in percent, one per column, summing to 100. */
export function columnWidths(block: Block): number[] {
  const count = columnCount(block)
  const raw = Array.isArray(block.props.columnWidths) ? block.props.columnWidths.map(Number) : []

  if (raw.length === count && raw.every((w) => Number.isFinite(w) && w >= 10)) {
    const total = raw.reduce((sum, w) => sum + w, 0)

    return raw.map((w) => Math.round((w / total) * 10000) / 100)
  }

  return COLUMN_LAYOUTS[count][0]
}

/** `grid-template-columns` for a group: fr units from the widths. */
export function columnTemplate(block: Block): string {
  return columnWidths(block)
    .map((w) => `minmax(0, ${Math.round(w * 100) / 100}fr)`)
    .join(' ')
}

export function columnGap(block: Block): number {
  const gap = Number(block.props.columnGap ?? DEFAULT_COLUMN_GAP)

  return Number.isFinite(gap) ? Math.min(160, Math.max(0, Math.round(gap))) : DEFAULT_COLUMN_GAP
}

export function columnAlign(block: Block): ColumnAlign {
  const align = block.props.columnAlign

  return align === 'center' || align === 'bottom' ? align : 'top'
}

export function columnStack(block: Block): ColumnStack {
  const stack = block.props.columnStack

  return stack === 'reverse' || stack === 'none' ? stack : 'normal'
}

/** Inclusive length of a columns group: the `columns` block and its children. */
export function getColumnsGroupLength(blocks: Block[], index: number): number {
  if (!isColumnsBlock(blocks[index])) {
    return 1
  }

  let len = 1

  for (let i = index + 1; i < blocks.length; i++) {
    if (blockColumn(blocks[i]) === null || isColumnsBlock(blocks[i])) break
    len++
  }

  return len
}

/** Index of the `columns` block that owns the block at `index`, or -1. */
export function columnsOwnerIndex(blocks: Block[], index: number): number {
  if (blockColumn(blocks[index]) === null) {
    return -1
  }

  for (let i = index - 1; i >= 0; i--) {
    if (isColumnsBlock(blocks[i])) return i
    if (blockColumn(blocks[i]) === null) return -1
  }

  return -1
}

export type ColumnsSegment<T = Block> =
  | { kind: 'block'; block: T; index: number }
  | { kind: 'columns'; block: T; index: number; columns: Array<Array<{ block: T; index: number }>> }

/**
 * Group a flat list for rendering: top-level blocks, and columns groups with
 * their children per column. `items` may be a filtered view (collapsed toggles
 * hidden) as long as each entry keeps its block.
 */
export function groupColumns<T extends { block: Block; index: number }>(items: T[]): Array<
  { kind: 'block'; item: T } | { kind: 'columns'; item: T; columns: T[][] }
> {
  const out: Array<{ kind: 'block'; item: T } | { kind: 'columns'; item: T; columns: T[][] }> = []
  let group: { kind: 'columns'; item: T; columns: T[][] } | null = null

  for (const item of items) {
    if (isColumnsBlock(item.block)) {
      group = {
        kind: 'columns',
        item,
        columns: Array.from({ length: columnCount(item.block) }, () => [] as T[]),
      }
      out.push(group)
      continue
    }

    const column = blockColumn(item.block)

    if (group && column !== null) {
      group.columns[Math.min(column, group.columns.length - 1)].push(item)
      continue
    }

    group = null
    out.push({ kind: 'block', item })
  }

  return out
}

/** `groupColumns` over a plain block array. */
export function groupColumnBlocks(blocks: Block[]): Array<{ kind: 'block'; block: Block } | { kind: 'columns'; block: Block; columns: Block[][] }> {
  return groupColumns(blocks.map((block, index) => ({ block, index }))).map((segment) =>
    segment.kind === 'block'
      ? { kind: 'block' as const, block: segment.item.block }
      : { kind: 'columns' as const, block: segment.item.block, columns: segment.columns.map((col) => col.map((c) => c.block)) },
  )
}

function emptyParagraph(column: number, dir?: BlockProps['dir']): Block {
  const block = createBlock('paragraph')
  block.props = { column, ...(dir ? { dir } : {}) }

  return block
}

/**
 * Keep every columns group valid after any edit. Mutates `blocks`; returns true
 * when something changed.
 *
 * - a `columns` block is top-level (no `column`) with a clamped count;
 * - a block between two children of a group (pasted or inserted there) joins the
 *   column of the block before it;
 * - children are clamped to the group's columns and kept in reading order;
 * - every column holds at least one block (an empty paragraph);
 * - a `column` prop outside any group is dropped.
 */
export function normalizeColumns(blocks: Block[]): boolean {
  let changed = false

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]

    if (!isColumnsBlock(block)) {
      // A stray child: no group above it.
      if (blockColumn(block) !== null && columnsOwnerIndex(blocks, i) === -1) {
        delete block.props.column
        changed = true
      } else if (block.props.column !== undefined && blockColumn(block) === null) {
        delete block.props.column
        changed = true
      }
      continue
    }

    if (block.props.column !== undefined) {
      delete block.props.column
      changed = true
    }

    if (block.props.indent) {
      delete block.props.indent
      changed = true
    }

    const count = columnCount(block)

    if (block.props.columnCount !== count) {
      block.props.columnCount = count
      changed = true
    }

    // Adopt blocks sandwiched between two children of this group (a paste or an
    // insert in the middle of a column): they join the column of the block above.
    let end = i + 1

    while (end < blocks.length && !isColumnsBlock(blocks[end])) {
      if (blockColumn(blocks[end]) === null) {
        let k = end
        while (k < blocks.length && blockColumn(blocks[k]) === null && !isColumnsBlock(blocks[k])) k++
        const sandwiched = end > i + 1 && k < blocks.length && !isColumnsBlock(blocks[k])
        if (!sandwiched) break
        const column = blockColumn(blocks[end - 1]) ?? 0
        for (let m = end; m < k; m++) blocks[m].props.column = column
        changed = true
        end = k
        continue
      }
      end++
    }

    const children = blocks.slice(i + 1, end)

    for (const child of children) {
      const column = blockColumn(child) ?? 0
      const clamped = Math.min(count - 1, column)
      if (clamped !== child.props.column) {
        child.props.column = clamped
        changed = true
      }
    }

    // Reading order: column 0, then 1, then 2 (stable within a column).
    const ordered = [...children].sort((a, b) => (a.props.column as number) - (b.props.column as number))
    if (ordered.some((b, k) => b !== children[k])) changed = true

    // Every column needs a block to click into.
    const filled: Block[] = []
    for (let column = 0; column < count; column++) {
      const own = ordered.filter((b) => b.props.column === column)
      if (own.length === 0) {
        own.push(emptyParagraph(column, block.props.dir))
        changed = true
      }
      filled.push(...own)
    }

    blocks.splice(i + 1, children.length, ...filled)
    i += filled.length
  }

  return changed
}

/**
 * Fit blocks about to be inserted at `index` (paste, drop, API insert) to the
 * place they land: inside a column they take that column, and a copied group is
 * unwrapped into it (groups do not nest); at the top level a stale `column` is
 * dropped, except on the children of a group being inserted whole. Returns the
 * blocks to insert (a nested `columns` block is removed from the list).
 */
export function fitInsertedBlocks(
  blocks: Block[],
  index: number,
  inserted: Block[],
  /**
   * 'after' (default): the blocks follow the block above (Enter, paste, a drop on
   * its lower half) and take its column. 'before': they precede the block at
   * `index` (a drop on its upper half, or "after this whole group") and take its
   * column; a top-level block there, or the end of the document, means top level.
   */
  anchor: 'after' | 'before' = 'after',
): Block[] {
  const before = blocks[index - 1]
  const at = blocks[index]
  const target =
    anchor === 'before'
      ? blockColumn(at)
      : isColumnsBlock(before)
        ? 0
        : blockColumn(before)
  const out: Block[] = []
  let inGroup = false

  for (const block of inserted) {
    if (isColumnsBlock(block)) {
      if (target !== null) continue
      inGroup = true
      out.push(block)
      continue
    }

    if (target !== null) {
      block.props.column = target
    } else if (inGroup && blockColumn(block) !== null) {
      // a child of a group inserted whole
    } else {
      inGroup = false
      delete block.props.column
    }

    out.push(block)
  }

  return out
}

/**
 * A new columns group: the `columns` block and an empty paragraph per column.
 * `widths` defaults to the first preset of the count.
 */
export function createColumnsGroup(
  count: ColumnCount = 2,
  options: { widths?: number[]; gap?: number; dir?: BlockProps['dir'] } = {},
): Block[] {
  const head = createBlock('columns')
  head.props = {
    columnCount: count,
    columnWidths: options.widths ?? COLUMN_LAYOUTS[count][0],
    ...(options.gap !== undefined ? { columnGap: options.gap } : {}),
    ...(options.dir ? { dir: options.dir } : {}),
  }

  return [head, ...Array.from({ length: count }, (_, column) => emptyParagraph(column, options.dir))]
}

/**
 * Change a group's column count. Children of removed columns move to the end of
 * the last remaining column; new columns get an empty paragraph. Mutates.
 */
export function setColumnCount(blocks: Block[], columnsId: string, count: ColumnCount): boolean {
  const index = blocks.findIndex((b) => b.id === columnsId)
  const head = blocks[index]

  if (!isColumnsBlock(head)) return false

  const len = getColumnsGroupLength(blocks, index)
  for (const child of blocks.slice(index + 1, index + len)) {
    if ((blockColumn(child) ?? 0) >= count) child.props.column = count - 1
  }

  head.props.columnCount = count
  head.props.columnWidths = COLUMN_LAYOUTS[count][0]
  normalizeColumns(blocks)

  return true
}

/** Move one block (with its indent subtree) into another column of its group. Mutates. */
export function moveBlockToColumn(blocks: Block[], blockId: string, column: number): boolean {
  const index = blocks.findIndex((b) => b.id === blockId)
  const owner = columnsOwnerIndex(blocks, index)

  if (owner === -1) return false

  const count = columnCount(blocks[owner])
  const target = Math.min(count - 1, Math.max(0, Math.round(column)))
  const from = blockColumn(blocks[index])
  const base = blocks[index].props.indent ?? 0

  // The block and its deeper-indented followers in the same column move together.
  let end = index + 1
  while (end < blocks.length && blockColumn(blocks[end]) === from && (blocks[end].props.indent ?? 0) > base) end++
  const moving = blocks.splice(index, end - index)
  for (const block of moving) block.props.column = target

  // Insert at the end of the target column.
  const groupEnd = owner + getColumnsGroupLength(blocks, owner)
  let at = groupEnd
  for (let i = owner + 1; i < groupEnd; i++) {
    if ((blockColumn(blocks[i]) ?? 0) > target) {
      at = i
      break
    }
  }
  blocks.splice(at, 0, ...moving)
  normalizeColumns(blocks)

  return true
}

/** Remove a group's `columns` block and keep its children as top-level blocks, in reading order. Mutates. */
export function unwrapColumns(blocks: Block[], columnsId: string): boolean {
  const index = blocks.findIndex((b) => b.id === columnsId)

  if (!isColumnsBlock(blocks[index])) return false

  const len = getColumnsGroupLength(blocks, index)
  const children = blocks.slice(index + 1, index + len)
  for (const child of children) delete child.props.column

  // Drop the empty paragraphs that only kept a column open; keep one if all are empty.
  const isEmpty = (b: Block) => b.type === 'paragraph' && !b.props.indent && b.content.every((s) => s.text === '')
  const kept = children.filter((b) => !isEmpty(b))
  blocks.splice(index, len, ...(kept.length ? kept : children.slice(0, 1)))

  return true
}

/**
 * Wrap existing blocks in a new group: `ids` (in document order, contiguous or
 * not) go to the given columns, in order. Mutates; returns the new `columns` id.
 */
export function wrapInColumns(
  blocks: Block[],
  assignment: Array<{ id: string; column: number }>,
  options: { count?: ColumnCount; widths?: number[]; gap?: number } = {},
): string | null {
  const ids = new Set(assignment.map((a) => a.id))
  const first = blocks.findIndex((b) => ids.has(b.id))

  if (first === -1) return null

  const count = options.count ?? (Math.max(...assignment.map((a) => a.column)) >= 2 ? 3 : 2)
  const moved = blocks.filter((b) => ids.has(b.id))
  for (const block of moved) {
    block.props.column = Math.min(count - 1, assignment.find((a) => a.id === block.id)?.column ?? 0)
  }
  for (let i = blocks.length - 1; i >= 0; i--) {
    if (ids.has(blocks[i].id)) blocks.splice(i, 1)
  }

  const [head] = createColumnsGroup(count, { widths: options.widths, gap: options.gap })
  blocks.splice(first, 0, head, ...moved)
  normalizeColumns(blocks)

  return head.id
}
