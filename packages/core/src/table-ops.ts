import {
  MIN_TABLE_COLUMN_WIDTH,
  addTableColumn,
  addTableRow,
  cellText,
  cloneTableData,
  tableCellFromText,
} from './table'
import type { TableCellAlign, TableData } from './types'

/**
 * Row/column operations behind the table's row and column handles (move,
 * duplicate, sort, align, clear, resize) plus spreadsheet paste. All are
 * pure: they return a new `TableData`, or `null` when the operation is not
 * safe for this table (e.g. moving rows through merged cells).
 */

function colCount(table: TableData): number {
  return table.rows[0]?.length ?? 0
}

function isMergedCell(cell: { colspan?: number; rowspan?: number; hidden?: boolean }): boolean {
  return !!cell.hidden || (cell.colspan ?? 1) > 1 || (cell.rowspan ?? 1) > 1
}

/** Whether a row (or any row when omitted) takes part in a merge. */
export function tableRowHasMerges(table: TableData, row?: number): boolean {
  const rows = row === undefined ? table.rows : [table.rows[row] ?? []]
  return rows.some(r => r.some(isMergedCell))
}

/** Whether a column (or any column when omitted) takes part in a merge. */
export function tableColumnHasMerges(table: TableData, col?: number): boolean {
  return table.rows.some(r => (col === undefined ? r : [r[col]]).some(cell => !!cell && isMergedCell(cell)))
}

function moveItem<T>(list: T[], from: number, to: number): void {
  const [item] = list.splice(from, 1)
  list.splice(to, 0, item)
}

/** Move a row to `to` (final index). `null` when merges make it ambiguous. */
export function moveTableRow(table: TableData, from: number, to: number): TableData | null {
  const last = table.rows.length - 1

  if (from < 0 || from > last || to < 0 || to > last || from === to || tableRowHasMerges(table)) {
    return null
  }

  const next = cloneTableData(table)
  moveItem(next.rows, from, to)

  return next
}

/** Move a column to `to` (final index). `null` when merges make it ambiguous. */
export function moveTableColumn(table: TableData, from: number, to: number): TableData | null {
  const last = colCount(table) - 1

  if (from < 0 || from > last || to < 0 || to > last || from === to || tableColumnHasMerges(table)) {
    return null
  }

  const next = cloneTableData(table)
  next.rows.forEach(row => moveItem(row, from, to))

  if (next.colWidths) {
    moveItem(next.colWidths, from, to)
  }

  return next
}

/** Copy a row below itself. */
export function duplicateTableRow(table: TableData, row: number): TableData | null {
  if (!table.rows[row] || tableRowHasMerges(table, row)) {
    return null
  }

  const next = cloneTableData(table)
  next.rows.splice(row + 1, 0, JSON.parse(JSON.stringify(table.rows[row])))

  return next
}

/** Copy a column to its right. */
export function duplicateTableColumn(table: TableData, col: number): TableData | null {
  if (col < 0 || col >= colCount(table) || tableColumnHasMerges(table, col)) {
    return null
  }

  const next = cloneTableData(table)
  next.rows.forEach(row => row.splice(col + 1, 0, JSON.parse(JSON.stringify(row[col]))))

  if (next.colWidths) {
    next.colWidths.splice(col + 1, 0, next.colWidths[col] ?? null)
  }

  return next
}

/** Empty every cell of a row (formatting like background/alignment is kept). */
export function clearTableRow(table: TableData, row: number): TableData {
  const next = cloneTableData(table)
  next.rows[row]?.forEach((cell) => {
    cell.content = []
  })

  return next
}

/** Empty every cell of a column. */
export function clearTableColumn(table: TableData, col: number): TableData {
  const next = cloneTableData(table)
  next.rows.forEach((row) => {
    if (row[col]) {
      row[col].content = []
    }
  })

  return next
}

/** Align every cell of a column. */
export function setTableColumnAlign(table: TableData, col: number, align: TableCellAlign | null): TableData {
  const next = cloneTableData(table)
  next.rows.forEach((row) => {
    if (row[col]) {
      row[col].align = align ?? undefined
    }
  })

  return next
}

/** Set (or clear with `null`) one column's width in px. */
export function setTableColumnWidth(table: TableData, col: number, width: number | null): TableData {
  const cols = colCount(table)

  if (col < 0 || col >= cols) {
    return table
  }

  const next = cloneTableData(table)
  const widths = next.colWidths ?? Array.from({ length: cols }, () => null)
  widths[col] = width === null ? null : Math.round(Math.min(2000, Math.max(MIN_TABLE_COLUMN_WIDTH, width)))
  next.colWidths = widths.some(w => w !== null) ? widths : undefined

  return next
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

/**
 * Sort body rows by a column (the header row stays on top). Empty cells sort
 * last; numbers compare numerically. `null` when the table has merges.
 */
export function sortTableByColumn(table: TableData, col: number, direction: 'asc' | 'desc'): TableData | null {
  if (col < 0 || col >= colCount(table) || tableRowHasMerges(table)) {
    return null
  }

  const next = cloneTableData(table)
  const head = next.hasHeader ? next.rows.slice(0, 1) : []
  const body = next.hasHeader ? next.rows.slice(1) : next.rows.slice()
  const sign = direction === 'asc' ? 1 : -1

  body.sort((a, b) => {
    const x = cellText(a[col]).trim()
    const y = cellText(b[col]).trim()

    if (!x || !y) {
      return x ? -1 : y ? 1 : 0
    }

    return collator.compare(x, y) * sign
  })

  next.rows = [...head, ...body]

  return next
}

// ─── Spreadsheet paste ──────────────────────────────────────────────────────

/** Parse tab-separated text as Excel / Google Sheets put it on the clipboard (quoted cells may hold tabs/newlines). */
function parseTsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  let i = 0
  const src = text.replace(/\r\n?/g, '\n').replace(/\n$/, '')

  while (i < src.length) {
    const ch = src[i]

    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"'
        i += 2
        continue
      }

      if (ch === '"') {
        quoted = false
        i += 1
        continue
      }

      cell += ch
      i += 1
      continue
    }

    if (ch === '"' && cell === '') {
      quoted = true
    } else if (ch === '\t') {
      row.push(cell)
      cell = ''
    } else if (ch === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else {
      cell += ch
    }

    i += 1
  }

  row.push(cell)
  rows.push(row)

  return rows
}

function gridFromHtml(html: string): string[][] | null {
  if (typeof DOMParser === 'undefined' || !/<table[\s>]/i.test(html)) {
    return null
  }

  const doc = new DOMParser().parseFromString(html, 'text/html')
  const table = doc.querySelector('table')

  if (!table) {
    return null
  }

  const grid = [...table.querySelectorAll('tr')].map(tr =>
    [...tr.querySelectorAll('th, td')].map(td => (td.textContent ?? '').replace(/\s+/g, ' ').trim()),
  )

  return grid.length ? grid : null
}

/**
 * A rectangular grid from spreadsheet clipboard data (HTML `<table>` or
 * TSV), or `null` when the clipboard is a single value / plain prose.
 */
export function parseClipboardGrid(text: string, html = ''): string[][] | null {
  const fromHtml = html ? gridFromHtml(html) : null
  let grid = fromHtml

  if (!grid) {
    if (!text.includes('\t')) {
      return null
    }

    grid = parseTsv(text)
  }

  const width = Math.max(...grid.map(r => r.length))

  if (grid.length * width < 2 || grid.length > 1000 || width > 100) {
    return null
  }

  return grid.map(r => Array.from({ length: width }, (_, i) => r[i] ?? ''))
}

/**
 * Write `grid` into the table with its top-left at `at`, adding rows and
 * columns as needed. Cells covered by a merge are skipped.
 */
export function pasteGridIntoTable(table: TableData, at: { row: number; col: number }, grid: string[][]): TableData {
  let next = cloneTableData(table)
  const needRows = at.row + grid.length - next.rows.length
  const needCols = at.col + (grid[0]?.length ?? 0) - colCount(next)

  for (let i = 0; i < needRows; i++) {
    next = addTableRow(next)
  }

  for (let i = 0; i < needCols; i++) {
    next = addTableColumn(next)
  }

  grid.forEach((cells, r) => {
    cells.forEach((value, c) => {
      const cell = next.rows[at.row + r]?.[at.col + c]

      if (cell && !cell.hidden) {
        cell.content = tableCellFromText(value).content
      }
    })
  })

  return next
}

/** Grid of plain text for copying a table (or selection) as TSV. */
export function tableToTsv(table: TableData): string {
  return table.rows
    .map(row => row.map(cell => (cell.hidden ? '' : cellText(cell).replace(/[\t\n]/g, ' '))).join('\t'))
    .join('\n')
}


// ─── Rendering helpers ──────────────────────────────────────────────────────

/** Whether a cell renders as a header (`<th>`): header row and/or header column. */
export function isTableHeaderCell(table: TableData, row: number, col: number): boolean {
  return (row === 0 && table.hasHeader) || (col === 0 && !!table.hasHeaderColumn)
}

/** Total width in px when every column has a width (the table is then laid out at exactly that size). */
export function tableFixedWidth(table: TableData): number | null {
  const widths = table.colWidths
  const cols = table.rows[0]?.length ?? 0

  if (!widths || widths.length !== cols || widths.some(w => typeof w !== 'number')) {
    return null
  }

  return (widths as number[]).reduce((sum, w) => sum + w, 0)
}
