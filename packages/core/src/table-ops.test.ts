import { describe, expect, it } from 'vitest'
import { blocksToHtmlContent } from './clipboard'
import { createBlock } from './ops'
import { addTableColumn, cellText, mergeCells, normalizeTableData, removeTableColumn } from './table'
import {
  duplicateTableColumn,
  moveTableColumn,
  moveTableRow,
  parseClipboardGrid,
  pasteGridIntoTable,
  setTableColumnAlign,
  setTableColumnWidth,
  sortTableByColumn,
  tableToTsv,
} from './table-ops'
import type { TableData } from './types'

function grid(table: TableData): string[][] {
  return table.rows.map(r => r.map(cellText))
}

function make(rows: string[][], hasHeader = true): TableData {
  return normalizeTableData({ hasHeader, rows })
}

describe('table ops', () => {
  it('moves rows and columns (and their widths)', () => {
    const t = setTableColumnWidth(make([['a', 'b'], ['1', '2'], ['3', '4']]), 0, 120)
    expect(grid(moveTableRow(t, 2, 1) as TableData)).toEqual([['a', 'b'], ['3', '4'], ['1', '2']])
    const moved = moveTableColumn(t, 0, 1) as TableData
    expect(grid(moved)).toEqual([['b', 'a'], ['2', '1'], ['4', '3']])
    expect(moved.colWidths).toEqual([null, 120])
  })

  it('refuses to move through merged cells', () => {
    const t = mergeCells(make([['a', 'b'], ['1', '2']]), [{ row: 1, col: 0 }, { row: 1, col: 1 }])
    expect(moveTableRow(t, 0, 1)).toBeNull()
    expect(moveTableColumn(t, 0, 1)).toBeNull()
  })

  it('sorts body rows naturally, keeping the header and empties last', () => {
    const t = make([['n'], ['10'], [''], ['9'], ['b'], ['A']])
    expect(grid(sortTableByColumn(t, 0, 'asc') as TableData).flat()).toEqual(['n', '9', '10', 'A', 'b', ''])
    expect(grid(sortTableByColumn(t, 0, 'desc') as TableData).flat()).toEqual(['n', 'b', 'A', '10', '9', ''])
  })

  it('duplicates columns, aligns them and keeps widths in sync on insert/remove', () => {
    let t = setTableColumnWidth(make([['a', 'b']]), 1, 200)
    t = duplicateTableColumn(t, 0) as TableData
    expect(grid(t)).toEqual([['a', 'a', 'b']])
    expect(t.colWidths).toEqual([null, null, 200])
    expect(addTableColumn(t, 0).colWidths).toEqual([null, null, null, 200])
    expect(removeTableColumn(t, 2).colWidths).toBeUndefined()
    expect(setTableColumnAlign(t, 1, 'right').rows[0][1].align).toBe('right')
  })

  it('clamps widths and drops them when all are automatic', () => {
    expect(setTableColumnWidth(make([['a']]), 0, 5).colWidths).toEqual([48])
    expect(setTableColumnWidth(setTableColumnWidth(make([['a']]), 0, 90), 0, null).colWidths).toBeUndefined()
    expect(normalizeTableData({ rows: [['a', 'b']], colWidths: ['x', 300, 9] }).colWidths).toEqual([null, 300])
  })
})

describe('spreadsheet paste', () => {
  it('parses TSV with quoted cells, and HTML tables', () => {
    expect(parseClipboardGrid('a\tb\n"multi\nline"\t"q""uote"\n')).toEqual([['a', 'b'], ['multi\nline', 'q"uote']])
    expect(parseClipboardGrid('', '<table><tr><td>x</td><td> y </td></tr></table>')).toEqual([['x', 'y']])
    expect(parseClipboardGrid('just text')).toBeNull()
    expect(parseClipboardGrid('one\ttwo')).toEqual([['one', 'two']])
  })

  it('pastes a grid at a cell, growing the table', () => {
    const t = pasteGridIntoTable(make([['h1', 'h2'], ['', '']]), { row: 1, col: 1 }, [['a', 'b'], ['c', 'd']])
    expect(grid(t)).toEqual([['h1', 'h2', ''], ['', 'a', 'b'], ['', 'c', 'd']])
    expect(tableToTsv(t).split('\n')[1]).toBe('\ta\tb')
  })
})

describe('table export', () => {
  it('writes column widths and header-column cells to HTML', () => {
    const table = { ...setTableColumnWidth(make([['h', 'x'], ['r', '1']]), 0, 150), hasHeaderColumn: true }
    const html = blocksToHtmlContent([createBlock('table', { props: { table } })])
    expect(html).toContain('<colgroup><col style="width:150px"><col></colgroup>')
    expect(html).toMatch(/<th[^>]*>r<\/th>/)
  })
})
