import type {
  InlineSpan,
  TableBorderStyle,
  TableCell,
  TableCellCoord,
  TableData,
  TableStyle,
  TableWidth,
} from './types'

export const DEFAULT_TABLE_BORDER = {
  color: '#eceef1',
  width: 1 as const,
  style: 'solid' as const,
}

export const DEFAULT_TABLE_WIDTH: TableWidth = { mode: 'percent', value: 100 }

function isPlainStringCell(cell: unknown): cell is string {
  return typeof cell === 'string'
}

function isLegacyTableCell(cell: unknown): cell is { text?: string } {
  return !!cell && typeof cell === 'object' && 'text' in (cell as Record<string, unknown>) && !('content' in (cell as Record<string, unknown>))
}

export function emptyTableCell(): TableCell {
  return { content: [] }
}

export function tableCellFromText(text: string): TableCell {
  return text ? { content: [{ text }] } : { content: [] }
}

export function normalizeTableCell(cell: unknown): TableCell {
  if (isPlainStringCell(cell)) {
    return tableCellFromText(cell)
  }

  if (!cell || typeof cell !== 'object') {
    return emptyTableCell()
  }

  const raw = cell as Record<string, unknown>

  if (isLegacyTableCell(cell)) {
    return tableCellFromText(typeof raw.text === 'string' ? raw.text : '')
  }

  const content = Array.isArray(raw.content)
    ? (raw.content as InlineSpan[])
        .map((span) => ({
          text: span?.text ?? '',
          marks: span?.marks,
        }))
        .filter((span) => span.text.length > 0)
    : []

  return {
    content,
    colspan: typeof raw.colspan === 'number' ? raw.colspan : undefined,
    rowspan: typeof raw.rowspan === 'number' ? raw.rowspan : undefined,
    align: raw.align === 'left' || raw.align === 'center' || raw.align === 'right' || raw.align === 'justify'
      ? raw.align
      : undefined,
    background: typeof raw.background === 'string' ? raw.background : undefined,
    hidden: raw.hidden === true ? true : undefined,
  }
}

export function normalizeTableData(raw: unknown): TableData {
  const data = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const hasHeader = data.hasHeader !== false
  const rawRows = Array.isArray(data.rows) ? data.rows : [[emptyTableCell()]]

  const rows = rawRows.map((row) => {
    if (!Array.isArray(row)) {
      return [emptyTableCell()]
    }

    return row.map(normalizeTableCell)
  })

  const width = normalizeTableWidth(data.width)
  const style = normalizeTableStyle(data.style)

  return { hasHeader, rows, width, style }
}

function normalizeTableWidth(raw: unknown): TableWidth {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_TABLE_WIDTH }
  }

  const value = raw as Record<string, unknown>
  const mode = value.mode === 'pixel' ? 'pixel' : 'percent'
  const num = typeof value.value === 'number' ? value.value : DEFAULT_TABLE_WIDTH.value

  return {
    mode,
    value: mode === 'percent' ? Math.min(100, Math.max(10, num)) : Math.min(2000, Math.max(200, num)),
  }
}

function normalizeTableStyle(raw: unknown): TableStyle | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined
  }

  const value = raw as Record<string, unknown>
  const style: TableStyle = {}

  if (typeof value.background === 'string') {
    style.background = value.background
  }

  if (typeof value.headerBackground === 'string') {
    style.headerBackground = value.headerBackground
  }

  if (value.border && typeof value.border === 'object') {
    style.border = normalizeTableBorder(value.border)
  }

  return Object.keys(style).length > 0 ? style : undefined
}

function normalizeTableBorder(raw: unknown): TableBorderStyle {
  const border = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const width = border.width

  return {
    color: typeof border.color === 'string' ? border.color : DEFAULT_TABLE_BORDER.color,
    width: width === 0 || width === 1 || width === 2 || width === 3 || width === 4 ? width : DEFAULT_TABLE_BORDER.width,
    style: border.style === 'solid' || border.style === 'dashed' || border.style === 'dotted' || border.style === 'none'
      ? border.style
      : DEFAULT_TABLE_BORDER.style,
  }
}

export function getResolvedTableBorder(style?: TableStyle): Required<TableBorderStyle> {
  return {
    color: style?.border?.color ?? DEFAULT_TABLE_BORDER.color,
    width: style?.border?.width ?? DEFAULT_TABLE_BORDER.width,
    style: style?.border?.style ?? DEFAULT_TABLE_BORDER.style,
  }
}

export function getResolvedTableWidth(width?: TableWidth): TableWidth {
  return width ?? { ...DEFAULT_TABLE_WIDTH }
}

export function tableWidthStyle(width?: TableWidth): Record<string, string> {
  const resolved = getResolvedTableWidth(width)

  if (resolved.mode === 'pixel') {
    return { width: `${resolved.value}px`, maxWidth: '100%' }
  }

  return { width: `${resolved.value}%` }
}

export function tableWrapperStyle(style?: TableStyle, width?: TableWidth): Record<string, string> {
  const result: Record<string, string> = { ...tableWidthStyle(width) }

  if (style?.background) {
    result.background = style.background
  }

  return result
}

export function tableCellBorderStyle(style?: TableStyle): Record<string, string> {
  const border = getResolvedTableBorder(style)

  if (border.style === 'none' || border.width === 0) {
    return { border: 'none' }
  }

  return { border: `${border.width}px ${border.style} ${border.color}` }
}

export function tableCellBackgroundStyle(
  cell: TableCell,
  rowIdx: number,
  hasHeader: boolean,
  style?: TableStyle,
): Record<string, string> {
  if (cell.background) {
    return { background: cell.background }
  }

  if (hasHeader && rowIdx === 0 && style?.headerBackground) {
    return { background: style.headerBackground }
  }

  return {}
}

export function tableCellStyle(
  cell: TableCell,
  rowIdx: number,
  hasHeader: boolean,
  tableStyle?: TableStyle,
): Record<string, string> {
  return {
    ...tableCellBorderStyle(tableStyle),
    ...tableCellBackgroundStyle(cell, rowIdx, hasHeader, tableStyle),
    ...(cell.align ? { textAlign: cell.align } : {}),
  }
}

export function cellText(cell: TableCell): string {
  return cell.content.map((span) => span.text).join('')
}

export function cloneTableData(table: TableData): TableData {
  return JSON.parse(JSON.stringify(table)) as TableData
}

export function createDefaultTableData(): TableData {
  return normalizeTableData({
    hasHeader: true,
    rows: [
      [emptyTableCell(), emptyTableCell(), emptyTableCell()],
      [emptyTableCell(), emptyTableCell(), emptyTableCell()],
    ],
    width: { ...DEFAULT_TABLE_WIDTH },
  })
}

function coordKey(row: number, col: number): string {
  return `${row}:${col}`
}

export function visibleCellCoords(table: TableData): TableCellCoord[] {
  const coords: TableCellCoord[] = []

  table.rows.forEach((row, rowIdx) => {
    row.forEach((cell, colIdx) => {
      if (!cell.hidden) {
        coords.push({ row: rowIdx, col: colIdx })
      }
    })
  })

  return coords
}

export function getVisibleCell(table: TableData, row: number, col: number): TableCell | null {
  const cell = table.rows[row]?.[col]

  if (!cell || cell.hidden) {
    return null
  }

  return cell
}

export function isRectangularSelection(cells: TableCellCoord[]): boolean {
  if (cells.length <= 1) {
    return cells.length === 1
  }

  const rows = cells.map((c) => c.row)
  const cols = cells.map((c) => c.col)
  const minRow = Math.min(...rows)
  const maxRow = Math.max(...rows)
  const minCol = Math.min(...cols)
  const maxCol = Math.max(...cols)
  const expected = (maxRow - minRow + 1) * (maxCol - minCol + 1)

  if (expected !== cells.length) {
    return false
  }

  for (let row = minRow; row <= maxRow; row += 1) {
    for (let col = minCol; col <= maxCol; col += 1) {
      if (!cells.some((c) => c.row === row && c.col === col)) {
        return false
      }
    }
  }

  return true
}

export function canMergeCells(table: TableData, cells: TableCellCoord[]): boolean {
  if (cells.length < 2 || !isRectangularSelection(cells)) {
    return false
  }

  const rows = cells.map((c) => c.row)
  const cols = cells.map((c) => c.col)
  const minRow = Math.min(...rows)
  const maxRow = Math.max(...rows)
  const minCol = Math.min(...cols)
  const maxCol = Math.max(...cols)

  for (let row = minRow; row <= maxRow; row += 1) {
    for (let col = minCol; col <= maxCol; col += 1) {
      const cell = getVisibleCell(table, row, col)

      if (!cell) {
        return false
      }

      if ((cell.colspan ?? 1) > 1 || (cell.rowspan ?? 1) > 1) {
        return false
      }
    }
  }

  return true
}

export function canUnmergeCell(table: TableData, row: number, col: number): boolean {
  const cell = getVisibleCell(table, row, col)

  if (!cell) {
    return false
  }

  return (cell.colspan ?? 1) > 1 || (cell.rowspan ?? 1) > 1
}

export function mergeCells(table: TableData, cells: TableCellCoord[]): TableData {
  if (!canMergeCells(table, cells)) {
    return table
  }

  const next = cloneTableData(table)
  const rows = cells.map((c) => c.row)
  const cols = cells.map((c) => c.col)
  const minRow = Math.min(...rows)
  const maxRow = Math.max(...rows)
  const minCol = Math.min(...cols)
  const maxCol = Math.max(...cols)
  const colspan = maxCol - minCol + 1
  const rowspan = maxRow - minRow + 1

  const mergedContent: InlineSpan[] = []

  for (let row = minRow; row <= maxRow; row += 1) {
    for (let col = minCol; col <= maxCol; col += 1) {
      const cell = next.rows[row]?.[col]

      if (!cell || cell.hidden) {
        continue
      }

      if (mergedContent.length > 0 && cell.content.length > 0) {
        mergedContent.push({ text: ' ' })
      }

      mergedContent.push(...cell.content)
    }
  }

  const anchor = next.rows[minRow][minCol]
  anchor.content = mergedContent
  anchor.colspan = colspan
  anchor.rowspan = rowspan
  anchor.hidden = undefined

  for (let row = minRow; row <= maxRow; row += 1) {
    for (let col = minCol; col <= maxCol; col += 1) {
      if (row === minRow && col === minCol) {
        continue
      }

      const cell = next.rows[row][col]
      cell.content = []
      cell.colspan = undefined
      cell.rowspan = undefined
      cell.hidden = true
    }
  }

  return next
}

export function unmergeCell(table: TableData, row: number, col: number): TableData {
  const cell = getVisibleCell(table, row, col)

  if (!cell || !canUnmergeCell(table, row, col)) {
    return table
  }

  const next = cloneTableData(table)
  const anchor = next.rows[row][col]
  const colspan = anchor.colspan ?? 1
  const rowspan = anchor.rowspan ?? 1
  const content = [...anchor.content]

  anchor.colspan = undefined
  anchor.rowspan = undefined
  anchor.content = content

  for (let r = row; r < row + rowspan; r += 1) {
    for (let c = col; c < col + colspan; c += 1) {
      if (r === row && c === col) {
        continue
      }

      next.rows[r][c] = {
        ...emptyTableCell(),
        background: anchor.background,
        align: anchor.align,
      }
    }
  }

  return next
}

export function addTableRow(table: TableData): TableData {
  const next = cloneTableData(table)
  const cols = next.rows[0]?.length ?? 1
  next.rows.push(Array.from({ length: cols }, () => emptyTableCell()))

  return next
}

export function addTableColumn(table: TableData): TableData {
  const next = cloneTableData(table)
  next.rows = next.rows.map((row) => [...row, emptyTableCell()])

  return next
}

export function removeTableRow(table: TableData, rowIdx: number): TableData {
  if (table.rows.length <= 1) {
    return table
  }

  const next = cloneTableData(table)
  next.rows.splice(rowIdx, 1)

  return normalizeMergedTable(next)
}

export function removeTableColumn(table: TableData, colIdx: number): TableData {
  if ((table.rows[0]?.length ?? 0) <= 1) {
    return table
  }

  const next = cloneTableData(table)
  next.rows = next.rows.map((row) => row.filter((_, i) => i !== colIdx))

  return normalizeMergedTable(next)
}

function normalizeMergedTable(table: TableData): TableData {
  const next = cloneTableData(table)

  for (let rowIdx = 0; rowIdx < next.rows.length; rowIdx += 1) {
    const row = next.rows[rowIdx]

    for (let colIdx = 0; colIdx < row.length; colIdx += 1) {
      const cell = row[colIdx]

      if (cell.hidden) {
        continue
      }

      const colspan = cell.colspan ?? 1
      const rowspan = cell.rowspan ?? 1

      if (colIdx + colspan > row.length || rowIdx + rowspan > next.rows.length) {
        cell.colspan = undefined
        cell.rowspan = undefined
      }
    }
  }

  return next
}

export function patchTableCell(
  table: TableData,
  row: number,
  col: number,
  patch: Partial<TableCell>,
): TableData {
  const next = cloneTableData(table)
  const cell = next.rows[row]?.[col]

  if (!cell || cell.hidden) {
    return table
  }

  Object.assign(cell, patch)

  return next
}

export function patchTableCellsBackground(
  table: TableData,
  cells: TableCellCoord[],
  background: string | null,
): TableData {
  const next = cloneTableData(table)

  for (const { row, col } of cells) {
    const cell = next.rows[row]?.[col]

    if (!cell || cell.hidden) {
      continue
    }

    if (background) {
      cell.background = background
    } else {
      delete cell.background
    }
  }

  return next
}

export function patchTableStyle(table: TableData, patch: Partial<TableStyle>): TableData {
  const next = cloneTableData(table)
  next.style = { ...(next.style ?? {}), ...patch }

  if (patch.border) {
    next.style.border = { ...(next.style.border ?? {}), ...patch.border }
  }

  return next
}

export function nextVisibleCellCoord(
  table: TableData,
  row: number,
  col: number,
  direction: 1 | -1,
): TableCellCoord | null {
  const coords = visibleCellCoords(table)
  const index = coords.findIndex((c) => c.row === row && c.col === col)

  if (index === -1) {
    return null
  }

  const nextIndex = index + direction

  if (nextIndex < 0 || nextIndex >= coords.length) {
    return null
  }

  return coords[nextIndex]
}

export function selectionBounds(cells: TableCellCoord[]): {
  minRow: number
  maxRow: number
  minCol: number
  maxCol: number
} | null {
  if (cells.length === 0) {
    return null
  }

  return {
    minRow: Math.min(...cells.map((c) => c.row)),
    maxRow: Math.max(...cells.map((c) => c.row)),
    minCol: Math.min(...cells.map((c) => c.col)),
    maxCol: Math.max(...cells.map((c) => c.col)),
  }
}

export function selectionKey(cells: TableCellCoord[]): string {
  return cells.map((c) => coordKey(c.row, c.col)).sort().join('|')
}
