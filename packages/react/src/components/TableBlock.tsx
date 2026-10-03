import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Columns2, Merge, Plus, Rows3, SplitSquareHorizontal, Trash2 } from 'lucide-react'
import {
  addTableColumn,
  addTableRow,
  canMergeCells,
  canUnmergeCell,
  cellsInBounds,
  getResolvedTableWidth,
  mergeCells,
  normalizeTableData,
  normalizeTableWidth,
  patchTableStyle,
  removeTableColumn,
  removeTableRow,
  switchTableWidthMode,
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
import { useEditorDictionary } from '../i18n'

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
const DRAG_THRESHOLD_PX = 4

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
  const t = useEditorDictionary().table
  const cellRefs = useRef(new Map<string, TableCellHandle>())
  const rootRef = useRef<HTMLDivElement | null>(null)
  const tableRef = useRef<TableData>(normalizeTableData(block.props.table))
  const onSelectionChangeRef = useRef(onCellSelectionChange)
  const onCellFocusRef = useRef(onCellFocus)
  const [selectedCells, setSelectedCellsState] = useState<TableCellCoord[]>([])
  const [dragging, setDragging] = useState(false)
  const dragRef = useRef<{
    anchor: TableCellCoord
    active: boolean
    pointerId: number
    startX: number
    startY: number
  } | null>(null)

  const table = normalizeTableData(block.props.table)
  tableRef.current = table
  onSelectionChangeRef.current = onCellSelectionChange
  onCellFocusRef.current = onCellFocus
  const wrapperStyle = tableWrapperStyle(table.style, table.width)
  const width = getResolvedTableWidth(table.width)
  const focusCell = selectedCells[0] ?? null
  const chromeActive = selectedCells.length > 0 || dragging

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

  function commitSelection(next: TableCellCoord[], focusPayload?: { row: number; col: number; shiftKey: boolean }) {
    setSelectedCellsState(next)
    onCellSelectionChange([...next])
    if (focusPayload) onCellFocus(focusPayload)
  }

  function toggleHeader() {
    updateTable({ ...table, hasHeader: !table.hasHeader })
  }

  function setWidthMode(mode: TableWidth['mode']) {
    updateTable({ ...table, width: switchTableWidthMode(table.width, mode) })
  }

  function setWidthValue(value: number) {
    updateTable({
      ...table,
      width: normalizeTableWidth({ mode: width.mode, value }),
    })
  }

  function onCellClick(payload: { row: number; col: number; shiftKey: boolean }) {
    if (dragRef.current?.active) return

    let next: TableCellCoord[]
    if (payload.shiftKey && selectedCells.length > 0) {
      next = cellsInBounds(table, selectedCells[0], payload)
    } else {
      next = [{ row: payload.row, col: payload.col }]
    }

    commitSelection(next, payload)
  }

  function coordFromPoint(clientX: number, clientY: number): TableCellCoord | null {
    const el = document.elementFromPoint(clientX, clientY)
    const cellEl = el?.closest?.('[data-etable-row][data-etable-col]') as HTMLElement | null
    if (!cellEl || !rootRef.current?.contains(cellEl)) return null

    const row = Number(cellEl.dataset.etableRow)
    const col = Number(cellEl.dataset.etableCol)
    if (!Number.isFinite(row) || !Number.isFinite(col)) return null

    return { row, col }
  }

  function onCellPointerDown(payload: {
    row: number
    col: number
    shiftKey: boolean
    pointerId: number
    clientX: number
    clientY: number
  }) {
    if (readonly || payload.shiftKey) return

    dragRef.current = {
      anchor: { row: payload.row, col: payload.col },
      active: false,
      pointerId: payload.pointerId,
      startX: payload.clientX,
      startY: payload.clientY,
    }
  }

  useEffect(() => {
    function onMove(e: PointerEvent) {
      const drag = dragRef.current
      if (!drag || e.pointerId !== drag.pointerId) return

      const dx = e.clientX - drag.startX
      const dy = e.clientY - drag.startY
      const over = coordFromPoint(e.clientX, e.clientY)

      if (!drag.active) {
        const movedFar = Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX
        const crossedCell = !!over && (over.row !== drag.anchor.row || over.col !== drag.anchor.col)
        if (!movedFar && !crossedCell) return

        drag.active = true
        setDragging(true)
        window.getSelection()?.removeAllRanges()
      }

      e.preventDefault()
      const target = over ?? drag.anchor
      const next = cellsInBounds(tableRef.current, drag.anchor, target)
      setSelectedCellsState(next)
      onSelectionChangeRef.current([...next])
    }

    function onUp(e: PointerEvent) {
      const drag = dragRef.current
      if (!drag || e.pointerId !== drag.pointerId) return

      if (drag.active) {
        e.preventDefault()
        const target = coordFromPoint(e.clientX, e.clientY) ?? drag.anchor
        const next = cellsInBounds(tableRef.current, drag.anchor, target)
        setSelectedCellsState(next)
        onSelectionChangeRef.current([...next])
        onCellFocusRef.current({ row: drag.anchor.row, col: drag.anchor.col, shiftKey: false })
      }

      dragRef.current = null
      setDragging(false)
    }

    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [])

  function isCellSelected(row: number, col: number): boolean {
    return selectedCells.some((cell) => cell.row === row && cell.col === col)
  }

  function handleMerge() {
    if (!canMergeCells(table, selectedCells)) return

    updateTable(mergeCells(table, selectedCells))
    const next = [selectedCells[0]]
    commitSelection(next)
  }

  function handleUnmerge() {
    const focus = selectedCells[0]
    if (!focus || !canUnmergeCell(table, focus.row, focus.col)) return

    updateTable(unmergeCell(table, focus.row, focus.col))
  }

  function handleAddRow() {
    const at = focusCell ? focusCell.row + (table.rows[focusCell.row]?.[focusCell.col]?.rowspan ?? 1) : undefined
    updateTable(addTableRow(table, at))
  }

  function handleAddColumn() {
    const at = focusCell
      ? focusCell.col + (table.rows[focusCell.row]?.[focusCell.col]?.colspan ?? 1)
      : undefined
    updateTable(addTableColumn(table, at))
  }

  function handleRemoveColumn() {
    const colIdx = focusCell?.col ?? (table.rows[0]?.length ?? 1) - 1
    updateTable(removeTableColumn(table, colIdx))
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
    <div
      ref={rootRef}
      className={`etable group/table my-1${chromeActive ? ' etable--active' : ''}${dragging ? ' etable--dragging' : ''}`}
    >
      {!readonly && (
        <div className="etable-toolbar">
          <button type="button" className="etable-btn" onClick={toggleHeader}>
            {table.hasHeader ? t.headerOn : t.headerOff}
          </button>
          <button
            type="button"
            className="etable-btn"
            disabled={!mergeEnabled}
            title={mergeEnabled ? t.mergeSelected : t.selectHint}
            onClick={handleMerge}
          >
            <Merge className="inline h-3 w-3" /> {t.merge}
          </button>
          <button type="button" className="etable-btn" disabled={!unmergeEnabled} onClick={handleUnmerge}>
            <SplitSquareHorizontal className="inline h-3 w-3" /> {t.unmerge}
          </button>
          <div className="etable-width">
            <button
              type="button"
              className={`etable-btn${width.mode === 'percent' ? ' etable-btn-active' : ''}`}
              onClick={() => setWidthMode('percent')}
            >
              %
            </button>
            <button
              type="button"
              className={`etable-btn${width.mode === 'pixel' ? ' etable-btn-active' : ''}`}
              onClick={() => setWidthMode('pixel')}
            >
              px
            </button>
            {width.mode === 'percent' ? (
              WIDTH_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={`etable-btn${width.value === preset ? ' etable-btn-active' : ''}`}
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
                className="etable-width-input"
                value={width.value}
                onChange={(e) => setWidthValue(Number(e.target.value))}
              />
            )}
          </div>
        </div>
      )}

      <div className="etable-frame">
        <div className="etable-wrap xpe-scroll" style={wrapperStyle}>
          <table className="etable-table">
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
                        onCellPointerDown={onCellPointerDown}
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
                  <td className="etable-row-gutter">
                    {!readonly && (
                      <button
                        type="button"
                        className="etable-icon-btn etable-icon-btn--danger"
                        title={t.removeRow}
                        aria-label={t.removeRow}
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
            <button type="button" className="etable-add-row" title={t.addRowBelow} onClick={handleAddRow}>
              <Rows3 className="h-3.5 w-3.5" />
              <span>{t.addRow}</span>
            </button>
          )}
        </div>
        {!readonly && (
          <div className="etable-col-gutter">
            <button type="button" className="etable-add-col" title={t.addColumn} onClick={handleAddColumn}>
              <Columns2 className="h-3.5 w-3.5" />
              <span>{t.addColumn}</span>
            </button>
            {table.rows[0]?.length ? (
              <button
                type="button"
                className="etable-icon-btn etable-icon-btn--danger"
                title={focusCell ? t.removeColumn : t.removeLastColumn}
                aria-label={focusCell ? t.removeColumn : t.removeLastColumn}
                onClick={handleRemoveColumn}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            ) : null}
            <button
              type="button"
              className="etable-icon-btn"
              title={t.addRow}
              aria-label={t.addRow}
              onClick={handleAddRow}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
})
