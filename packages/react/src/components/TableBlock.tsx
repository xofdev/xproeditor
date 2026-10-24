import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowDownAZ,
  ArrowDownZA,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Copy,
  Eraser,
  GripHorizontal,
  GripVertical,
  Merge,
  PanelLeft,
  PanelTop,
  Plus,
  SplitSquareHorizontal,
  Trash2,
  type LucideIcon,
} from 'lucide-react'
import {
  addTableColumn,
  addTableRow,
  canMergeCells,
  canUnmergeCell,
  cellsInBounds,
  clearTableColumn,
  clearTableRow,
  duplicateTableColumn,
  duplicateTableRow,
  getResolvedTableWidth,
  mergeCells,
  moveTableColumn,
  moveTableRow,
  normalizeTableData,
  normalizeTableWidth,
  pasteGridIntoTable,
  patchTableStyle,
  removeTableColumn,
  removeTableRow,
  setTableColumnAlign,
  setTableColumnWidth,
  sortTableByColumn,
  switchTableWidthMode,
  tableCellStyle,
  tableWrapperStyle,
  unmergeCell,
  MIN_TABLE_COLUMN_WIDTH,
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

/** Rendered geometry (relative to the block root) used to place handles. */
interface TableLayout {
  table: { left: number; top: number; width: number; height: number }
  rows: { top: number; height: number }[]
  cols: { left: number; width: number }[]
  /** Visible horizontal range of the scroller (handles outside it are hidden). */
  clip: { left: number; right: number }
}

interface MenuItem {
  icon: LucideIcon
  label: string
  run: () => void
  disabled?: boolean
  danger?: boolean
  active?: boolean
}

type OpenMenu = { kind: 'row' | 'col'; index: number } | null

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
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const tableElRef = useRef<HTMLTableElement | null>(null)
  const tableRef = useRef<TableData>(normalizeTableData(block.props.table))
  const onSelectionChangeRef = useRef(onCellSelectionChange)
  const onCellFocusRef = useRef(onCellFocus)
  const [selectedCells, setSelectedCellsState] = useState<TableCellCoord[]>([])
  const [dragging, setDragging] = useState(false)
  const [hover, setHover] = useState<TableCellCoord | null>(null)
  const [menu, setMenu] = useState<OpenMenu>(null)
  const [layout, setLayout] = useState<TableLayout | null>(null)
  const [liveWidths, setLiveWidths] = useState<number[] | null>(null)
  const [resizingCol, setResizingCol] = useState<number | null>(null)
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
  const colCount = table.rows[0]?.length ?? 0
  const width = getResolvedTableWidth(table.width)
  const focusCell = selectedCells[0] ?? null
  const chromeActive = selectedCells.length > 0 || dragging || menu !== null
  const isRtl = rootRef.current ? getComputedStyle(rootRef.current).direction === 'rtl' : false
  const widths = liveWidths ?? table.colWidths ?? null
  const allFixed = !!widths && widths.length === colCount && widths.every((w) => typeof w === 'number')
  const tableStyleProp = allFixed
    ? { width: `${(widths as number[]).reduce((sum, w) => sum + w, 0)}px` }
    : undefined
  const wrapperStyle = tableWrapperStyle(table.style, table.width)

  function cellKey(row: number, col: number) {
    return `${row}:${col}`
  }

  function setCellRef(row: number, col: number, instance: TableCellHandle | null) {
    const key = cellKey(row, col)
    if (instance) cellRefs.current.set(key, instance)
    else cellRefs.current.delete(key)
  }

  function updateTable(next: TableData | null) {
    if (next) onPatch({ table: next })
  }

  function commitSelection(next: TableCellCoord[], focusPayload?: { row: number; col: number; shiftKey: boolean }) {
    setSelectedCellsState(next)
    onCellSelectionChange([...next])
    if (focusPayload) onCellFocus(focusPayload)
  }

  // ─── Geometry ───────────────────────────────────────────────────────────

  const measure = useCallback(() => {
    const root = rootRef.current
    const tableEl = tableElRef.current
    const scroller = scrollRef.current
    if (!root || !tableEl || !scroller) return

    const origin = root.getBoundingClientRect()
    const tr = tableEl.getBoundingClientRect()
    const sr = scroller.getBoundingClientRect()
    const data = tableRef.current
    const cols = data.rows[0]?.length ?? 0

    const rows = Array.from(tableEl.rows).map((row) => {
      const r = row.getBoundingClientRect()
      return { top: r.top - origin.top, height: r.height }
    })

    // A column's edges come from any unmerged cell in it; merged-only
    // columns are interpolated between their neighbours.
    const edges: ({ left: number; right: number } | null)[] = Array.from({ length: cols }, (_, c) => {
      for (let r = 0; r < data.rows.length; r++) {
        const cell = data.rows[r][c]
        if (!cell || cell.hidden || (cell.colspan ?? 1) > 1) continue
        const el = tableEl.querySelector<HTMLElement>(`[data-etable-row="${r}"][data-etable-col="${c}"]`)
        if (!el) continue
        const rect = el.getBoundingClientRect()
        return { left: rect.left - origin.left, right: rect.right - origin.left }
      }
      return null
    })

    const fallback = (tr.width || 1) / Math.max(1, cols)
    const colsOut = edges.map((edge, c) => {
      if (edge) return { left: edge.left, width: edge.right - edge.left }
      return { left: tr.left - origin.left + fallback * c, width: fallback }
    })

    const next: TableLayout = {
      table: { left: tr.left - origin.left, top: tr.top - origin.top, width: tr.width, height: tr.height },
      rows,
      cols: colsOut,
      clip: { left: sr.left - origin.left, right: sr.right - origin.left },
    }
    // Measured after every render — only update when something moved.
    setLayout((prev) => (prev && JSON.stringify(prev) === JSON.stringify(next) ? prev : next))
  }, [])

  const wantsChrome = !readonly && (hover !== null || chromeActive || resizingCol !== null)

  useLayoutEffect(() => {
    if (wantsChrome) measure()
  })

  useEffect(() => {
    if (!wantsChrome) return
    const scroller = scrollRef.current
    const onChange = () => measure()
    scroller?.addEventListener('scroll', onChange, { passive: true })
    window.addEventListener('resize', onChange)
    return () => {
      scroller?.removeEventListener('scroll', onChange)
      window.removeEventListener('resize', onChange)
    }
  }, [wantsChrome, measure])

  // ─── Cell selection (click / shift-click / drag) ────────────────────────

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
        // Inside one cell a drag is a native text selection; it becomes a
        // cell selection only once the pointer crosses into another cell.
        const crossedCell = !!over && (over.row !== drag.anchor.row || over.col !== drag.anchor.col)
        if (!crossedCell || Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return

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

  // ─── Hover tracking for row / column handles ────────────────────────────

  function onTablePointerOver(e: React.PointerEvent) {
    const cellEl = (e.target as HTMLElement).closest?.('[data-etable-row][data-etable-col]') as HTMLElement | null
    if (!cellEl) return
    const row = Number(cellEl.dataset.etableRow)
    const col = Number(cellEl.dataset.etableCol)
    if (hover?.row !== row || hover?.col !== col) setHover({ row, col })
  }

  function onRootPointerLeave() {
    if (!menu && resizingCol === null) setHover(null)
  }

  // ─── Row / column operations ────────────────────────────────────────────

  function selectRow(row: number) {
    commitSelection(cellsInBounds(table, { row, col: 0 }, { row, col: colCount - 1 }))
  }

  function selectColumn(col: number) {
    commitSelection(cellsInBounds(table, { row: 0, col }, { row: table.rows.length - 1, col }))
  }

  function openMenu(kind: 'row' | 'col', index: number) {
    setMenu((current) => (current?.kind === kind && current.index === index ? null : { kind, index }))
    if (kind === 'row') selectRow(index)
    else selectColumn(index)
  }

  function run(next: TableData | null) {
    updateTable(next)
    setMenu(null)
    commitSelection([])
  }

  useEffect(() => {
    if (!menu) return
    function onDown(e: PointerEvent) {
      if (!(e.target as HTMLElement).closest?.('.etable-menu, .etable-grip')) setMenu(null)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenu(null)
    }
    document.addEventListener('pointerdown', onDown, true)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown, true)
      document.removeEventListener('keydown', onKey)
    }
  }, [menu])

  function rowMenu(row: number): MenuItem[] {
    const span = table.rows[row]?.find((cell) => !cell.hidden)?.rowspan ?? 1
    const items: MenuItem[] = []
    if (row === 0) {
      items.push({ icon: PanelTop, label: t.headerRow, active: table.hasHeader, run: () => run({ ...table, hasHeader: !table.hasHeader }) })
    }
    items.push(
      { icon: ArrowUp, label: t.insertAbove, run: () => run(addTableRow(table, row)) },
      { icon: ArrowDown, label: t.insertBelow, run: () => run(addTableRow(table, row + span)) },
      { icon: ArrowUp, label: t.moveUp, disabled: !moveTableRow(table, row, row - 1), run: () => run(moveTableRow(table, row, row - 1)) },
      { icon: ArrowDown, label: t.moveDown, disabled: !moveTableRow(table, row, row + 1), run: () => run(moveTableRow(table, row, row + 1)) },
      { icon: Copy, label: t.duplicate, disabled: !duplicateTableRow(table, row), run: () => run(duplicateTableRow(table, row)) },
      { icon: Eraser, label: t.clearContents, run: () => run(clearTableRow(table, row)) },
      { icon: Trash2, label: t.deleteRow, danger: true, disabled: table.rows.length <= 1, run: () => run(removeTableRow(table, row)) },
    )
    return items
  }

  function colMenu(col: number): MenuItem[] {
    const span = table.rows.find((r) => r[col] && !r[col].hidden)?.[col]?.colspan ?? 1
    // "Left/right" are visual: in RTL the next index is to the left.
    const before = isRtl ? t.insertRight : t.insertLeft
    const after = isRtl ? t.insertLeft : t.insertRight
    const back = isRtl ? { icon: ArrowRight, label: t.moveRight } : { icon: ArrowLeft, label: t.moveLeft }
    const fwd = isRtl ? { icon: ArrowLeft, label: t.moveLeft } : { icon: ArrowRight, label: t.moveRight }
    const align = table.rows.find((r) => r[col] && !r[col].hidden)?.[col]?.align
    const items: MenuItem[] = []
    if (col === 0) {
      items.push({
        icon: PanelLeft,
        label: t.headerColumn,
        active: !!table.hasHeaderColumn,
        run: () => run({ ...table, hasHeaderColumn: !table.hasHeaderColumn || undefined }),
      })
    }
    items.push(
      { icon: isRtl ? ArrowRight : ArrowLeft, label: before, run: () => run(addTableColumn(table, col)) },
      { icon: isRtl ? ArrowLeft : ArrowRight, label: after, run: () => run(addTableColumn(table, col + span)) },
      { ...back, disabled: !moveTableColumn(table, col, col - 1), run: () => run(moveTableColumn(table, col, col - 1)) },
      { ...fwd, disabled: !moveTableColumn(table, col, col + 1), run: () => run(moveTableColumn(table, col, col + 1)) },
      { icon: ArrowDownAZ, label: t.sortAscending, disabled: !sortTableByColumn(table, col, 'asc'), run: () => run(sortTableByColumn(table, col, 'asc')) },
      { icon: ArrowDownZA, label: t.sortDescending, disabled: !sortTableByColumn(table, col, 'desc'), run: () => run(sortTableByColumn(table, col, 'desc')) },
      { icon: AlignLeft, label: t.alignLeft, active: align === 'left', run: () => run(setTableColumnAlign(table, col, 'left')) },
      { icon: AlignCenter, label: t.alignCenter, active: align === 'center', run: () => run(setTableColumnAlign(table, col, 'center')) },
      { icon: AlignRight, label: t.alignRight, active: align === 'right', run: () => run(setTableColumnAlign(table, col, 'right')) },
      { icon: Copy, label: t.duplicate, disabled: !duplicateTableColumn(table, col), run: () => run(duplicateTableColumn(table, col)) },
      { icon: Eraser, label: t.clearContents, run: () => run(clearTableColumn(table, col)) },
      { icon: Trash2, label: t.deleteColumn, danger: true, disabled: colCount <= 1, run: () => run(removeTableColumn(table, col)) },
    )
    return items
  }

  // ─── Column resize ──────────────────────────────────────────────────────

  function onResizeStart(col: number, e: React.PointerEvent) {
    if (readonly || !layout) return
    e.preventDefault()
    e.stopPropagation()

    // Freeze every column at its rendered width so only this one changes.
    const start = layout.cols.map((c) => Math.round(c.width))
    const startX = e.clientX
    const sign = isRtl ? -1 : 1
    let current = start
    setResizingCol(col)
    setLiveWidths(start)

    function onMove(ev: PointerEvent) {
      const next = [...start]
      next[col] = Math.max(MIN_TABLE_COLUMN_WIDTH, Math.round(start[col] + (ev.clientX - startX) * sign))
      current = next
      setLiveWidths(next)
    }

    function onUp() {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      setResizingCol(null)
      setLiveWidths(null)
      updateTable({ ...tableRef.current, colWidths: current })
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  // ─── Toolbar actions ────────────────────────────────────────────────────

  function setWidthMode(mode: TableWidth['mode']) {
    updateTable({ ...table, width: switchTableWidthMode(table.width, mode) })
  }

  function setWidthValue(value: number) {
    // A width preset re-flows the columns, so manual column widths go.
    updateTable({ ...table, colWidths: undefined, width: normalizeTableWidth({ mode: width.mode, value }) })
  }

  function handleMerge() {
    if (!canMergeCells(table, selectedCells)) return

    updateTable(mergeCells(table, selectedCells))
    commitSelection([selectedCells[0]])
  }

  function handleUnmerge() {
    const focus = selectedCells[0]
    if (!focus || !canUnmergeCell(table, focus.row, focus.col)) return

    updateTable(unmergeCell(table, focus.row, focus.col))
  }

  function onPasteGrid(row: number, col: number, grid: string[][]) {
    updateTable(pasteGridIntoTable(table, { row, col }, grid))
    commitSelection(
      cellsInBounds(
        pasteGridIntoTable(table, { row, col }, grid),
        { row, col },
        { row: row + grid.length - 1, col: col + (grid[0]?.length ?? 1) - 1 },
      ),
    )
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

  // Handles follow the hovered cell, or the focused one while editing.
  const anchor = hover ?? (menu ? null : focusCell)
  const gripRow = menu?.kind === 'row' ? menu.index : anchor?.row ?? null
  const gripCol = menu?.kind === 'col' ? menu.index : anchor?.col ?? null
  const inClip = (x: number) => !!layout && x >= layout.clip.left - 1 && x <= layout.clip.right + 1

  function renderMenu() {
    if (!menu || !layout) return null
    const items = menu.kind === 'row' ? rowMenu(menu.index) : colMenu(menu.index)
    const style: React.CSSProperties =
      menu.kind === 'row'
        ? {
            top: layout.rows[menu.index]?.top ?? 0,
            ...(isRtl
              ? { right: `calc(100% - ${layout.table.left + layout.table.width}px + 14px)` }
              : { left: layout.table.left + 14 }),
          }
        : {
            top: layout.table.top + 14,
            left: Math.max(0, (layout.cols[menu.index]?.left ?? 0) + (isRtl ? -120 : 0)),
          }

    return (
      <div className="etable-menu xpe-float" role="menu" style={style}>
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            className={`xpe-menu-item${item.danger ? ' xpe-menu-item--danger' : ''}${item.active ? ' xpe-menu-item--selected' : ''}`}
            disabled={item.disabled}
            title={item.disabled && !item.danger ? t.mergedHint : undefined}
            onMouseDown={(e) => e.preventDefault()}
            onClick={item.run}
          >
            <span className="xpe-menu-item__icon">
              <item.icon />
            </span>
            <span className="xpe-menu-item__label">{item.label}</span>
          </button>
        ))}
      </div>
    )
  }

  return (
    <div
      ref={rootRef}
      className={`etable${chromeActive ? ' etable--active' : ''}${dragging ? ' etable--dragging' : ''}${resizingCol !== null ? ' etable--resizing' : ''}`}
      onPointerLeave={onRootPointerLeave}
    >
      {!readonly && (
        <div className="etable-toolbar" role="toolbar" aria-label={t.table}>
          <button
            type="button"
            className={`etable-btn${table.hasHeader ? ' etable-btn-active' : ''}`}
            aria-pressed={table.hasHeader}
            onClick={() => updateTable({ ...table, hasHeader: !table.hasHeader })}
          >
            <PanelTop /> {t.headerRow}
          </button>
          <button
            type="button"
            className={`etable-btn${table.hasHeaderColumn ? ' etable-btn-active' : ''}`}
            aria-pressed={!!table.hasHeaderColumn}
            onClick={() => updateTable({ ...table, hasHeaderColumn: !table.hasHeaderColumn || undefined })}
          >
            <PanelLeft /> {t.headerColumn}
          </button>
          <span className="etable-sep" />
          <button
            type="button"
            className="etable-btn"
            disabled={!mergeEnabled}
            title={mergeEnabled ? t.mergeSelected : t.selectHint}
            onClick={handleMerge}
          >
            <Merge /> {t.merge}
          </button>
          <button type="button" className="etable-btn" disabled={!unmergeEnabled} onClick={handleUnmerge}>
            <SplitSquareHorizontal /> {t.unmerge}
          </button>
          <span className="etable-sep" />
          <div className="etable-width" aria-label={t.width}>
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
                  className={`etable-btn${!table.colWidths && width.value === preset ? ' etable-btn-active' : ''}`}
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

      <div ref={scrollRef} className="etable-scroll xpe-scroll">
        <div className={`etable-grid${allFixed || width.mode === 'pixel' ? ' etable-grid--fit' : ''}`}>
          <div className="etable-wrap" style={wrapperStyle}>
            <table
              ref={tableElRef}
              className={`etable-table${allFixed ? ' etable-table--sized' : ''}`}
              style={tableStyleProp}
              onPointerOver={readonly ? undefined : onTablePointerOver}
            >
              {widths && widths.length === colCount && (
                <colgroup>
                  {widths.map((w, i) => (
                    <col key={i} style={w ? { width: `${w}px` } : undefined} />
                  ))}
                </colgroup>
              )}
              <tbody>
                {table.rows.map((row, rowIdx) => (
                  <tr key={rowIdx}>
                    {row.map((cell, colIdx) =>
                      cell.hidden ? null : (
                        <TableCell
                          key={colIdx}
                          ref={(instance) => setCellRef(rowIdx, colIdx, instance)}
                          cell={cell}
                          rowIdx={rowIdx}
                          colIdx={colIdx}
                          isHeader={(rowIdx === 0 && table.hasHeader) || (colIdx === 0 && !!table.hasHeaderColumn)}
                          selected={isCellSelected(rowIdx, colIdx)}
                          readonly={readonly}
                          cellStyle={tableCellStyle(cell, rowIdx, table.hasHeader, table.style)}
                          onCellClick={onCellClick}
                          onCellPointerDown={onCellPointerDown}
                          onCellFocus={onCellFocus}
                          onInput={(content, caret) => onCellInput({ row: rowIdx, col: colIdx, content, caret })}
                          onFormat={(mark) => onCellFormat({ row: rowIdx, col: colIdx, mark })}
                          onTab={(shift) => onCellTab({ row: rowIdx, col: colIdx, shift })}
                          onArrowUp={() => onCellNavigate({ row: rowIdx, col: colIdx, direction: 'up' })}
                          onArrowDown={() => onCellNavigate({ row: rowIdx, col: colIdx, direction: 'down' })}
                          onArrowLeft={() => onCellNavigate({ row: rowIdx, col: colIdx, direction: 'left' })}
                          onArrowRight={() => onCellNavigate({ row: rowIdx, col: colIdx, direction: 'right' })}
                          onPasteGrid={(grid) => onPasteGrid(rowIdx, colIdx, grid)}
                        />
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!readonly && (
            <>
              <button
                type="button"
                className="etable-add etable-add--col"
                title={t.addColumn}
                aria-label={t.addColumn}
                onClick={() => updateTable(addTableColumn(table))}
              >
                <Plus />
              </button>
              <button
                type="button"
                className="etable-add etable-add--row"
                title={t.addRow}
                aria-label={t.addRow}
                onClick={() => updateTable(addTableRow(table))}
              >
                <Plus />
              </button>
            </>
          )}
        </div>
      </div>

      {!readonly && layout && (
        <div className="etable-overlay">
          {gripRow !== null && layout.rows[gripRow] && (
            <button
              type="button"
              className={`etable-grip etable-grip--row${menu?.kind === 'row' ? ' is-open' : ''}`}
              style={{
                top: layout.rows[gripRow].top + layout.rows[gripRow].height / 2 - 12,
                left: isRtl ? layout.table.left + layout.table.width - 6 : layout.table.left - 6,
              }}
              title={t.rowActions}
              aria-label={t.rowActions}
              aria-haspopup="menu"
              aria-expanded={menu?.kind === 'row'}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => openMenu('row', gripRow)}
            >
              <GripVertical />
            </button>
          )}
          {gripCol !== null && layout.cols[gripCol] && inClip(layout.cols[gripCol].left + layout.cols[gripCol].width / 2) && (
            <button
              type="button"
              className={`etable-grip etable-grip--col${menu?.kind === 'col' ? ' is-open' : ''}`}
              style={{
                top: layout.table.top - 6,
                left: layout.cols[gripCol].left + layout.cols[gripCol].width / 2 - 12,
              }}
              title={t.columnActions}
              aria-label={t.columnActions}
              aria-haspopup="menu"
              aria-expanded={menu?.kind === 'col'}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => openMenu('col', gripCol)}
            >
              <GripHorizontal />
            </button>
          )}
          {layout.cols.map((c, i) => {
            const edge = isRtl ? c.left : c.left + c.width
            if (!inClip(edge)) return null
            return (
              <div
                key={i}
                className={`etable-resize${resizingCol === i ? ' is-active' : ''}`}
                style={{ left: edge - 4, top: layout.table.top, height: layout.table.height }}
                title={t.resizeColumn}
                role="separator"
                aria-orientation="vertical"
                onPointerDown={(e) => onResizeStart(i, e)}
                onDoubleClick={() => updateTable(setTableColumnWidth(table, i, null))}
              />
            )
          })}
          {renderMenu()}
        </div>
      )}
    </div>
  )
})
