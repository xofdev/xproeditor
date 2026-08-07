import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TABLE_BORDER,
  addTableColumn,
  addTableRow,
  canMergeCells,
  canUnmergeCell,
  cellText,
  createDefaultTableData,
  getResolvedTableBorder,
  getResolvedTableWidth,
  isRectangularSelection,
  mergeCells,
  normalizeTableData,
  patchTableCell,
  patchTableStyle,
  removeTableColumn,
  removeTableRow,
  cellsInBounds,
  selectionBounds,
  selectionKey,
  switchTableWidthMode,
  tableCellFromText,
  unmergeCell,
  visibleCellCoords,
} from './table'
import type { TableCellCoord, TableData } from './types'

/** 3x3 grid whose cells are labelled a1..c3, so merges are easy to assert on. */
function grid(rows = 3, cols = 3): TableData {
  return normalizeTableData({
    hasHeader: true,
    rows: Array.from({ length: rows }, (_, r) =>
      Array.from({ length: cols }, (_, c) => tableCellFromText(`${'abc'[c] ?? c}${r + 1}`)),
    ),
  })
}

function textAt(table: TableData, row: number, col: number): string {
  return cellText(table.rows[row][col])
}

function coords(...pairs: Array<[number, number]>): TableCellCoord[] {
  return pairs.map(([row, col]) => ({ row, col }))
}

describe('normalizeTableData', () => {
  it('accepts legacy string cells and legacy {text} cells', () => {
    const table = normalizeTableData({
      hasHeader: true,
      rows: [['plain'], [{ text: 'legacy' }]],
    })

    expect(textAt(table, 0, 0)).toBe('plain')
    expect(textAt(table, 1, 0)).toBe('legacy')
  })

  it('defaults hasHeader to true but respects an explicit false', () => {
    expect(normalizeTableData({ rows: [['a']] }).hasHeader).toBe(true)
    expect(normalizeTableData({ hasHeader: false, rows: [['a']] }).hasHeader).toBe(false)
  })

  it('replaces a non-array row with a single empty cell', () => {
    const table = normalizeTableData({ rows: [['a', 'b'], 'not-a-row'] })

    expect(table.rows[1]).toHaveLength(1)
    expect(textAt(table, 1, 0)).toBe('')
  })

  it('falls back to a single empty cell when rows is missing', () => {
    const table = normalizeTableData({})

    expect(table.rows).toHaveLength(1)
    expect(table.rows[0]).toHaveLength(1)
  })

  it('drops empty spans from cell content', () => {
    const table = normalizeTableData({
      rows: [[{ content: [{ text: 'keep' }, { text: '' }] }]],
    })

    expect(table.rows[0][0].content).toEqual([{ text: 'keep', marks: undefined }])
  })

  it('clamps percent width to 10-100 and pixel width to 200-2000', () => {
    expect(normalizeTableData({ width: { mode: 'percent', value: 5 } }).width).toEqual({ mode: 'percent', value: 10 })
    expect(normalizeTableData({ width: { mode: 'percent', value: 500 } }).width).toEqual({ mode: 'percent', value: 100 })
    expect(normalizeTableData({ width: { mode: 'pixel', value: 10 } }).width).toEqual({ mode: 'pixel', value: 200 })
    expect(normalizeTableData({ width: { mode: 'pixel', value: 9999 } }).width).toEqual({ mode: 'pixel', value: 2000 })
  })

  it('switches width mode with defaults instead of carrying a raw value across units', () => {
    expect(switchTableWidthMode({ mode: 'percent', value: 100 }, 'pixel')).toEqual({
      mode: 'pixel',
      value: 640,
    })
    expect(switchTableWidthMode({ mode: 'pixel', value: 800 }, 'percent')).toEqual({
      mode: 'percent',
      value: 100,
    })
  })

  it('lists visible cells inside a rectangular bounds', () => {
    expect(cellsInBounds(grid(2, 2), { row: 0, col: 0 }, { row: 1, col: 1 })).toEqual(
      coords([0, 0], [0, 1], [1, 0], [1, 1]),
    )
  })

  it('ignores an unknown border style and width, keeping the defaults', () => {
    const table = normalizeTableData({
      rows: [['a']],
      style: { border: { color: '#123456', width: 9, style: 'groovy' } },
    })

    expect(table.style?.border).toEqual({
      color: '#123456',
      width: DEFAULT_TABLE_BORDER.width,
      style: DEFAULT_TABLE_BORDER.style,
    })
  })

  it('returns undefined style when nothing recognisable is supplied', () => {
    expect(normalizeTableData({ rows: [['a']], style: { nonsense: true } }).style).toBeUndefined()
  })
})

describe('createDefaultTableData', () => {
  it('creates a 2x3 table with a header and full width', () => {
    const table = createDefaultTableData()

    expect(table.rows).toHaveLength(2)
    expect(table.rows[0]).toHaveLength(3)
    expect(table.hasHeader).toBe(true)
    expect(table.width).toEqual({ mode: 'percent', value: 100 })
  })
})

describe('row and column operations', () => {
  it('adds a row matching the existing column count', () => {
    const table = addTableRow(grid(2, 3))

    expect(table.rows).toHaveLength(3)
    expect(table.rows[2]).toHaveLength(3)
    expect(textAt(table, 2, 0)).toBe('')
  })

  it('adds a column to every row', () => {
    const table = addTableColumn(grid(3, 2))

    expect(table.rows.every((row) => row.length === 3)).toBe(true)
  })

  it('inserts a row at an index and extends crossing rowspans', () => {
    let table = grid(2, 2)
    table = mergeCells(table, coords([0, 0], [1, 0]))
    table = addTableRow(table, 1)

    expect(table.rows).toHaveLength(3)
    expect(table.rows[0][0].rowspan).toBe(3)
    expect(table.rows[1][0].hidden).toBe(true)
    expect(table.rows[2][0].hidden).toBe(true)
  })

  it('appends a row without extending a rowspan that ends at the previous last row', () => {
    let table = grid(2, 2)
    table = mergeCells(table, coords([0, 0], [1, 0]))
    table = addTableRow(table)

    expect(table.rows).toHaveLength(3)
    expect(table.rows[0][0].rowspan).toBe(2)
    expect(table.rows[2][0].hidden).toBeFalsy()
  })

  it('inserts a column at an index and extends crossing colspans', () => {
    let table = grid(2, 2)
    table = mergeCells(table, coords([0, 0], [0, 1]))
    table = addTableColumn(table, 1)

    expect(table.rows[0]).toHaveLength(3)
    expect(table.rows[0][0].colspan).toBe(3)
    expect(table.rows[0][1].hidden).toBe(true)
  })

  it('removes the requested row and leaves the others in order', () => {
    const table = removeTableRow(grid(), 1)

    expect(table.rows).toHaveLength(2)
    expect(textAt(table, 0, 0)).toBe('a1')
    expect(textAt(table, 1, 0)).toBe('a3')
  })

  it('removes the requested column and leaves the others in order', () => {
    const table = removeTableColumn(grid(), 1)

    expect(table.rows[0]).toHaveLength(2)
    expect(textAt(table, 0, 0)).toBe('a1')
    expect(textAt(table, 0, 1)).toBe('c1')
  })

  it('refuses to remove the last remaining row or column', () => {
    const single = grid(1, 1)

    expect(removeTableRow(single, 0)).toBe(single)
    expect(removeTableColumn(single, 0)).toBe(single)
  })

  it('does not mutate the input table', () => {
    const table = grid()
    const before = JSON.stringify(table)
    addTableRow(table)
    addTableColumn(table)
    removeTableRow(table, 0)

    expect(JSON.stringify(table)).toBe(before)
  })
})

describe('isRectangularSelection', () => {
  it('treats a single cell as rectangular and an empty selection as not', () => {
    expect(isRectangularSelection(coords([0, 0]))).toBe(true)
    expect(isRectangularSelection([])).toBe(false)
  })

  it('accepts a filled rectangle and rejects one with a hole', () => {
    expect(isRectangularSelection(coords([0, 0], [0, 1], [1, 0], [1, 1]))).toBe(true)
    expect(isRectangularSelection(coords([0, 0], [0, 1], [1, 1]))).toBe(false)
  })

  it('rejects a diagonal selection', () => {
    expect(isRectangularSelection(coords([0, 0], [1, 1]))).toBe(false)
  })
})

describe('merge and unmerge', () => {
  it('refuses to merge fewer than two cells or a non-rectangle', () => {
    const table = grid()

    expect(canMergeCells(table, coords([0, 0]))).toBe(false)
    expect(canMergeCells(table, coords([0, 0], [1, 1]))).toBe(false)
  })

  it('merges a 2x2 block, spanning the anchor and hiding the rest', () => {
    const table = mergeCells(grid(), coords([0, 0], [0, 1], [1, 0], [1, 1]))
    const anchor = table.rows[0][0]

    expect(anchor.colspan).toBe(2)
    expect(anchor.rowspan).toBe(2)
    expect(table.rows[0][1].hidden).toBe(true)
    expect(table.rows[1][0].hidden).toBe(true)
    expect(table.rows[1][1].hidden).toBe(true)
  })

  it('concatenates the merged cells’ text separated by spaces', () => {
    const table = mergeCells(grid(), coords([0, 0], [0, 1]))

    expect(cellText(table.rows[0][0])).toBe('a1 b1')
  })

  it('refuses to merge a selection that already contains a merged cell', () => {
    const merged = mergeCells(grid(), coords([0, 0], [0, 1]))

    expect(canMergeCells(merged, coords([0, 0], [0, 1], [1, 0], [1, 1]))).toBe(false)
  })

  it('reports unmergeable for a plain cell and unmergeable for a hidden one', () => {
    const merged = mergeCells(grid(), coords([0, 0], [0, 1]))

    expect(canUnmergeCell(merged, 0, 0)).toBe(true)
    expect(canUnmergeCell(merged, 2, 2)).toBe(false)
    expect(canUnmergeCell(merged, 0, 1)).toBe(false)
  })

  it('unmerge restores the covered cells and clears the spans', () => {
    const merged = mergeCells(grid(), coords([0, 0], [0, 1], [1, 0], [1, 1]))
    const table = unmergeCell(merged, 0, 0)

    expect(table.rows[0][0].colspan).toBeUndefined()
    expect(table.rows[0][0].rowspan).toBeUndefined()
    expect(table.rows[0][1].hidden).toBeFalsy()
    expect(table.rows[1][1].hidden).toBeFalsy()
  })

  it('unmerge keeps the merged text on the anchor and empties the restored cells', () => {
    const merged = mergeCells(grid(), coords([0, 0], [0, 1]))
    const table = unmergeCell(merged, 0, 0)

    expect(cellText(table.rows[0][0])).toBe('a1 b1')
    expect(cellText(table.rows[0][1])).toBe('')
  })

  it('visibleCellCoords skips cells hidden by a merge', () => {
    const merged = mergeCells(grid(), coords([0, 0], [0, 1]))

    expect(visibleCellCoords(merged)).toHaveLength(8)
  })

  it('clears a span that would overflow after its row is removed', () => {
    const merged = mergeCells(grid(), coords([0, 0], [0, 1], [1, 0], [1, 1]))
    const table = removeTableRow(merged, 2)

    expect(table.rows).toHaveLength(2)
    expect(table.rows[0][0].rowspan).toBe(2)

    const narrowed = removeTableRow(table, 1)

    expect(narrowed.rows).toHaveLength(1)
    expect(narrowed.rows[0][0].rowspan).toBeUndefined()
  })

  it('clears a span that would overflow after its column is removed', () => {
    const merged = mergeCells(grid(), coords([0, 0], [0, 1]))
    const table = removeTableColumn(merged, 2)

    expect(table.rows[0][0].colspan).toBe(2)

    const narrowed = removeTableColumn(table, 1)

    expect(narrowed.rows[0][0].colspan).toBeUndefined()
  })
})

describe('cell and style patches', () => {
  it('patchTableCell replaces content at the given coordinate only', () => {
    const table = patchTableCell(grid(), 1, 1, { content: [{ text: 'patched' }] })

    expect(textAt(table, 1, 1)).toBe('patched')
    expect(textAt(table, 0, 0)).toBe('a1')
  })

  it('patchTableStyle merges into the existing style', () => {
    const table = patchTableStyle(grid(), { background: '#fff' })
    const next = patchTableStyle(table, { headerBackground: '#eee' })

    expect(next.style?.background).toBe('#fff')
    expect(next.style?.headerBackground).toBe('#eee')
  })
})

describe('resolved defaults', () => {
  it('resolves the border against the theme token so tables follow dark mode', () => {
    expect(getResolvedTableBorder()).toEqual({
      color: 'var(--xpe-border, #eceef1)',
      width: 1,
      style: 'solid',
    })
  })

  it('lets an explicit border colour win over the token default', () => {
    expect(getResolvedTableBorder({ border: { color: '#ff0000' } }).color).toBe('#ff0000')
  })

  it('resolves a missing width to full percent', () => {
    expect(getResolvedTableWidth()).toEqual({ mode: 'percent', value: 100 })
  })
})

describe('selection helpers', () => {
  it('selectionBounds spans the min and max row and column', () => {
    expect(selectionBounds(coords([1, 2], [0, 1], [2, 0]))).toEqual({
      minRow: 0,
      maxRow: 2,
      minCol: 0,
      maxCol: 2,
    })
  })

  it('selectionKey is order-independent so it can gate re-renders', () => {
    expect(selectionKey(coords([0, 0], [1, 1]))).toBe(selectionKey(coords([1, 1], [0, 0])))
  })
})
