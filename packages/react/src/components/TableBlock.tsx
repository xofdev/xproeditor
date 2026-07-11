import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { Columns2, Merge, Plus, SplitSquareHorizontal, Trash2 } from 'lucide-react'
import {
  addTableColumn,
  addTableRow,
  canMergeCells,
  canUnmergeCell,
  getResolvedTableWidth,
  mergeCells,
  normalizeTableData,
  patchTableStyle,
  removeTableColumn,
  removeTableRow,
  tableCellStyle,
  tableWrapperStyle,
  unmergeCell,
} from '@xproeditor/core'
import type {
  Block,
  InlineSpan,
  MarkName,
  TableCellCoord,
  TableData,
  TableStyle,
  TableWidth,
} from '@xproeditor/core'
import { TableCell, type TableCellHandle } from './TableCell'

export interface TableBlockHandle {
  getSelectedCells: () => TableCellCoord[]
  setSelectedCells: (cells: TableCellCoord[]) => void
  focusCell: (row: number, col: number, pos?: number | 'start' | 'end') => void
  getCellSelection: (row: number, col: number) => { start: number; end: number } | null
  setCellSelection: (row: number, col: number, start: number, end?: number) => void
  patchTableStyle: (patch: Partial<TableStyle>) => void
  focusAt: () => void
  getSelection: () => null
  setSelection: () => void
}

export interface TableBlockProps {
  block: Block
  readonly?: boolean
  onPatch: (patch: Record<string, unknown>) => void
  onCellFocus: (payload: { row: number; col: number; shiftKey: boolean }) => void
  onCellInput: (payload: {
    row: number
    col: number
    content: InlineSpan[]
    caret: number | null
  }) => void
  onCellFormat: (payload: { row: number; col: number; mark: MarkName }) => void
  onCellTab: (payload: { row: number; col: number; shift: boolean }) => void
  onCellNavigate: (payload: {
    row: number
    col: number
    direction: 'up' | 'down' | 'left' | 'right'
  }) => void
  onCellSelectionChange: (cells: TableCellCoord[]) => void
}

const WIDTH_PRESETS = [40, 60, 80, 100]

export const TableBlock = forwardRef<TableBlockHandle, TableBlockProps>(function TableBlock(
  {
    block,
    readonly,
    onPatch,
    onCellFocus,
    onCellInput,
    onCellFormat,
    onCellTab,
    onCellNavigate,
    onCellSelectionChange,
  },
  ref,
) {
  const cellRefs = useRef(new Map<string, TableCellHandle>())
  const [selectedCells, setSelectedCellsState] = useState<TableCellCoord[]>([])

  const table = normalizeTableData(block.props.table)
  const wrapperStyle = tableWrapperStyle(table.style, table.width)

  function cellKey(row: number, col: number) {
    return `${row}:${col}`
  }

  function setCellRef(row: number, col: number, instance: TableCellHandle | null) {
    const key = cellKey(row, col)
    if (instance) cellRefs.current.set(key, instance)
    else cellRefs.current.delete(key)
  }

  function updateTable(next: TableData) {
    onPatch({ table: next })
  }

  function toggleHeader() {
    updateTable({ ...table, hasHeader: !table.hasHeader })
  }

  function setWidthMode(mode: TableWidth['mode']) {
    const current = getResolvedTableWidth(table.width)
    updateTable({ ...table, width: { mode, value: current.value } })
  }

  function setWidthValue(value: number) {
    const current = getResolvedTableWidth(table.width)
    updateTable({ ...table, width: { ...current, value } })
  }

  function onCellClick(payload: { row: number; col: number; shiftKey: boolean }) {
    let next: TableCellCoord[]

    if (payload.shiftKey && selectedCells.length > 0) {
      const anchor = selectedCells[0]
      const minRow = Math.min(anchor.row, payload.row)
      const maxRow = Math.max(anchor.row, payload.row)
      const minCol = Math.min(anchor.col, payload.col)
      const maxCol = Math.max(anchor.col, payload.col)
      next = []

      for (let row = minRow; row <= maxRow; row += 1) {
        for (let col = minCol; col <= maxCol; col += 1) {
          const cell = table.rows[row]?.[col]
          if (cell && !cell.hidden) next.push({ row, col })
        }
      }
    } else {
      next = [{ row: payload.row, col: payload.col }]
    }

    setSelectedCellsState(next)
    onCellSelectionChange([...next])
    onCellFocus(payload)
  }

  function isCellSelected(row: number, col: number): boolean {
    return selectedCells.some((cell) => cell.row === row && cell.col === col)
  }

  function handleMerge() {
    if (!canMergeCells(table, selectedCells)) return

    updateTable(mergeCells(table, selectedCells))
    const next = [selectedCells[0]]
    setSelectedCellsState(next)
    onCellSelectionChange([...next])
  }

  function handleUnmerge() {
    const focus = selectedCells[0]
    if (!focus || !canUnmergeCell(table, focus.row, focus.col)) return

    updateTable(unmergeCell(table, focus.row, focus.col))
  }

  const mergeEnabled = canMergeCells(table, selectedCells)
  const unmergeEnabled = (() => {
    const focus = selectedCells[0]
    return !!focus && canUnmergeCell(table, focus.row, focus.col)
  })()

  useImperativeHandle(ref, () => ({
    getSelectedCells: () => [...selectedCells],
    setSelectedCells: (cells) => {
      setSelectedCellsState([...cells])
      onCellSelectionChange([...cells])
    },
    focusCell: (row, col, pos = 'start') => cellRefs.current.get(cellKey(row, col))?.focusAt(pos),
    getCellSelection: (row, col) => cellRefs.current.get(cellKey(row, col))?.getSelection() ?? null,
    setCellSelection: (row, col, start, end = start) =>
      cellRefs.current.get(cellKey(row, col))?.setSelection(start, end),
    patchTableStyle: (patch) => updateTable(patchTableStyle(table, patch)),
    focusAt: () => {},
    getSelection: () => null,
    setSelection: () => {},
  }))

  return (
    <div className="group/table my-1">
      {!readonly && (
        <div className="mb-1 flex flex-wrap items-center gap-2 opacity-0 transition-opacity group-hover/table:opacity-100">
          <button className="etable-btn" onClick={toggleHeader}>
            {table.hasHeader ? 'Header: on' : 'Header: off'}
          </button>
          <button className="etable-btn" disabled={!mergeEnabled} onClick={handleMerge}>
            <Merge className="inline h-3 w-3" /> Merge
          </button>
          <button className="etable-btn" disabled={!unmergeEnabled} onClick={handleUnmerge}>
            <SplitSquareHorizontal className="inline h-3 w-3" /> Unmerge
          </button>
          <div className="flex items-center gap-1 rounded-md border border-[var(--xpe-border)] bg-[var(--xpe-muted)] px-1 py-0.5">
            <button
              className={`etable-btn${getResolvedTableWidth(table.width).mode === 'percent' ? ' etable-btn-active' : ''}`}
              onClick={() => setWidthMode('percent')}
            >
              %
            </button>
            <button
              className={`etable-btn${getResolvedTableWidth(table.width).mode === 'pixel' ? ' etable-btn-active' : ''}`}
              onClick={() => setWidthMode('pixel')}
            >
              px
            </button>
            {getResolvedTableWidth(table.width).mode === 'percent' ? (
              WIDTH_PRESETS.map((preset) => (
                <button
                  key={preset}
                  className={`etable-btn${getResolvedTableWidth(table.width).value === preset ? ' etable-btn-active' : ''}`}
                  onClick={() => setWidthValue(preset)}
                >
                  {preset}%
                </button>
              ))
            ) : (
              <input
                type="number"
                min={200}
                max={2000}
                className="w-16 rounded border border-[var(--xpe-border)] px-1 py-0.5 text-[11px]"
                value={getResolvedTableWidth(table.width).value}
                onChange={(e) => setWidthValue(Number(e.target.value))}
              />
            )}
          </div>
        </div>
      )}

      <div className="flex items-start">
        <div
          className="flex-1 overflow-x-auto rounded-lg border border-[var(--xpe-border)]"
          style={wrapperStyle}
        >
          <table className="w-full border-collapse">
            <tbody>
              {table.rows.map((row, rowIdx) => (
                <tr key={rowIdx} className="group/row">
                  {row.map((cell, colIdx) =>
                    cell.hidden ? null : (
                      <TableCell
                        key={colIdx}
                        ref={(instance) => setCellRef(rowIdx, colIdx, instance)}
                        cell={cell}
                        rowIdx={rowIdx}
                        colIdx={colIdx}
                        isHeader={rowIdx === 0 && table.hasHeader}
                        selected={isCellSelected(rowIdx, colIdx)}
                        readonly={readonly}
                        cellStyle={tableCellStyle(cell, rowIdx, table.hasHeader, table.style)}
                        onCellClick={onCellClick}
                        onCellFocus={onCellFocus}
                        onInput={(content, caret) =>
                          onCellInput({ row: rowIdx, col: colIdx, content, caret })
                        }
                        onFormat={(mark) => onCellFormat({ row: rowIdx, col: colIdx, mark })}
                        onTab={(shift) => onCellTab({ row: rowIdx, col: colIdx, shift })}
                        onArrowUp={() =>
                          onCellNavigate({ row: rowIdx, col: colIdx, direction: 'up' })
                        }
                        onArrowDown={() =>
                          onCellNavigate({ row: rowIdx, col: colIdx, direction: 'down' })
                        }
                        onArrowLeft={() =>
                          onCellNavigate({ row: rowIdx, col: colIdx, direction: 'left' })
                        }
                        onArrowRight={() =>
                          onCellNavigate({ row: rowIdx, col: colIdx, direction: 'right' })
                        }
                      />
                    ),
                  )}
                  <td className="w-6 border-0 align-middle">
                    {!readonly && (
                      <button
                        className="hidden h-5 w-5 items-center justify-center rounded text-gray-300 hover:text-[var(--xpe-danger)] group-hover/row:flex"
                        title="Remove row"
                        onClick={() => updateTable(removeTableRow(table, rowIdx))}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!readonly && (
            <button
              className="flex w-full items-center justify-center py-1 text-gray-300 transition-colors hover:bg-[var(--xpe-primary-muted)]/40 hover:text-[var(--xpe-primary)]"
              title="Add row"
              onClick={() => updateTable(addTableRow(table))}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {!readonly && (
          <div className="ms-1 flex flex-col gap-1 self-stretch">
            <button
              className="flex items-center rounded px-1 text-gray-300 transition-colors hover:bg-[var(--xpe-primary-muted)]/40 hover:text-[var(--xpe-primary)]"
              title="Add column"
              onClick={() => updateTable(addTableColumn(table))}
            >
              <Columns2 className="h-3.5 w-3.5" />
            </button>
            {table.rows[0]?.length ? (
              <button
                className="flex items-center rounded px-1 text-gray-300 transition-colors hover:bg-red-50/40 hover:text-[var(--xpe-danger)]"
                title="Remove last column"
                onClick={() =>
                  updateTable(removeTableColumn(table, (table.rows[0]?.length ?? 1) - 1))
                }
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
})
