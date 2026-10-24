<script setup lang="ts">
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
} from 'lucide-vue-next'
import type { Component } from 'vue'
import { computed, onBeforeUnmount, onMounted, onUpdated, ref, shallowRef, watch } from 'vue'
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
import type { Block, InlineSpan, MarkName, TableCellCoord, TableData, TableStyle, TableWidth } from '@xproeditor/core'
import EditorTableCell from './EditorTableCell.vue'
import { useEditorDictionary } from '../i18n'

const dictionary = useEditorDictionary()
const t = computed(() => dictionary.value.table)

const props = defineProps<{ block: Block; readonly?: boolean }>()

const emit = defineEmits<{
  patch: [patch: Record<string, unknown>]
  cellFocus: [payload: { row: number; col: number; shiftKey: boolean }]
  cellInput: [payload: { row: number; col: number; content: InlineSpan[]; caret: number | null }]
  cellFormat: [payload: { row: number; col: number; mark: MarkName }]
  cellTab: [payload: { row: number; col: number; shift: boolean }]
  cellNavigate: [payload: { row: number; col: number; direction: 'up' | 'down' | 'left' | 'right' }]
  cellSelectionChange: [cells: TableCellCoord[]]
}>()

const DRAG_THRESHOLD_PX = 4
const widthPresets = [40, 60, 80, 100]

/** Rendered geometry (relative to the block root) used to place handles. */
interface TableLayout {
  table: { left: number; top: number; width: number; height: number }
  rows: { top: number; height: number }[]
  cols: { left: number; width: number }[]
  /** Visible horizontal range of the scroller (handles outside it are hidden). */
  clip: { left: number; right: number }
}

interface MenuItem {
  icon: Component
  label: string
  run: () => void
  disabled?: boolean
  danger?: boolean
  active?: boolean
}

const cellRefs = new Map<string, InstanceType<typeof EditorTableCell>>()
const rootEl = ref<HTMLElement | null>(null)
const scrollEl = ref<HTMLElement | null>(null)
const tableEl = ref<HTMLTableElement | null>(null)
const selectedCells = ref<TableCellCoord[]>([])
const dragging = ref(false)
const hover = ref<TableCellCoord | null>(null)
const menu = ref<{ kind: 'row' | 'col'; index: number } | null>(null)
const layout = shallowRef<TableLayout | null>(null)
const liveWidths = ref<number[] | null>(null)
const resizingCol = ref<number | null>(null)
const isRtl = ref(false)

let dragState: {
  anchor: TableCellCoord
  active: boolean
  pointerId: number
  startX: number
  startY: number
} | null = null

const table = computed<TableData>(() => normalizeTableData(props.block.props.table))
const colCount = computed(() => table.value.rows[0]?.length ?? 0)
const wrapperStyle = computed(() => tableWrapperStyle(table.value.style, table.value.width))
const width = computed(() => getResolvedTableWidth(table.value.width))
const focusCell = computed(() => selectedCells.value[0] ?? null)
const chromeActive = computed(() => selectedCells.value.length > 0 || dragging.value || menu.value !== null)
const widths = computed(() => liveWidths.value ?? table.value.colWidths ?? null)
const allFixed = computed(() => {
  const w = widths.value
  return !!w && w.length === colCount.value && w.every(v => typeof v === 'number')
})
const tableStyleProp = computed(() =>
  allFixed.value ? { width: `${(widths.value as number[]).reduce((sum, w) => sum + w, 0)}px` } : undefined,
)

const mergeEnabled = computed(() => canMergeCells(table.value, selectedCells.value))
const unmergeEnabled = computed(() => {
  const focus = selectedCells.value[0]
  return !!focus && canUnmergeCell(table.value, focus.row, focus.col)
})

function cellKey(row: number, col: number): string {
  return `${row}:${col}`
}

function setCellRef(row: number, col: number, instance: unknown) {
  const key = cellKey(row, col)

  if (instance) {
    cellRefs.set(key, instance as InstanceType<typeof EditorTableCell>)
  } else {
    cellRefs.delete(key)
  }
}

function updateTable(next: TableData | null) {
  if (next) {
    emit('patch', { table: next })
  }
}

function commitSelection(next: TableCellCoord[], focusPayload?: { row: number; col: number; shiftKey: boolean }) {
  selectedCells.value = next
  emit('cellSelectionChange', [...next])

  if (focusPayload) {
    emit('cellFocus', focusPayload)
  }
}

// ─── Geometry ─────────────────────────────────────────────────────────────

function measure() {
  const root = rootEl.value
  const tbl = tableEl.value
  const scroller = scrollEl.value

  if (!root || !tbl || !scroller) {
    return
  }

  isRtl.value = getComputedStyle(root).direction === 'rtl'
  const origin = root.getBoundingClientRect()
  const tr = tbl.getBoundingClientRect()
  const sr = scroller.getBoundingClientRect()
  const data = table.value
  const cols = data.rows[0]?.length ?? 0

  const rows = Array.from(tbl.rows).map((row) => {
    const r = row.getBoundingClientRect()
    return { top: r.top - origin.top, height: r.height }
  })

  // A column's edges come from any unmerged cell in it; merged-only columns
  // are spread evenly.
  const fallback = (tr.width || 1) / Math.max(1, cols)
  const colsOut = Array.from({ length: cols }, (_, c) => {
    for (let r = 0; r < data.rows.length; r++) {
      const cell = data.rows[r][c]

      if (!cell || cell.hidden || (cell.colspan ?? 1) > 1) {
        continue
      }

      const el = tbl.querySelector<HTMLElement>(`[data-etable-row="${r}"][data-etable-col="${c}"]`)

      if (el) {
        const rect = el.getBoundingClientRect()
        return { left: rect.left - origin.left, width: rect.width }
      }
    }

    return { left: tr.left - origin.left + fallback * c, width: fallback }
  })

  const next: TableLayout = {
    table: { left: tr.left - origin.left, top: tr.top - origin.top, width: tr.width, height: tr.height },
    rows,
    cols: colsOut,
    clip: { left: sr.left - origin.left, right: sr.right - origin.left },
  }

  // Measured after every update — only replace when something moved.
  if (!layout.value || JSON.stringify(layout.value) !== JSON.stringify(next)) {
    layout.value = next
  }
}

const wantsChrome = computed(() => !props.readonly && (hover.value !== null || chromeActive.value || resizingCol.value !== null))

onUpdated(() => {
  if (wantsChrome.value) {
    measure()
  }
})

watch(wantsChrome, (on) => {
  if (on) {
    measure()
  }
}, { flush: 'post' })

function onViewportChange() {
  if (wantsChrome.value) {
    measure()
  }
}

// ─── Cell selection (click / shift-click / drag) ──────────────────────────

function onCellClick(payload: { row: number; col: number; shiftKey: boolean }) {
  if (dragState?.active) {
    return
  }

  const next = payload.shiftKey && selectedCells.value.length > 0
    ? cellsInBounds(table.value, selectedCells.value[0], payload)
    : [{ row: payload.row, col: payload.col }]

  commitSelection(next, payload)
}

function coordFromPoint(clientX: number, clientY: number): TableCellCoord | null {
  const el = document.elementFromPoint(clientX, clientY)
  const cellEl = el?.closest?.('[data-etable-row][data-etable-col]') as HTMLElement | null

  if (!cellEl || !rootEl.value?.contains(cellEl)) {
    return null
  }

  const row = Number(cellEl.dataset.etableRow)
  const col = Number(cellEl.dataset.etableCol)

  return Number.isFinite(row) && Number.isFinite(col) ? { row, col } : null
}

function onCellPointerDown(payload: {
  row: number
  col: number
  shiftKey: boolean
  pointerId: number
  clientX: number
  clientY: number
}) {
  if (props.readonly || payload.shiftKey) {
    return
  }

  dragState = {
    anchor: { row: payload.row, col: payload.col },
    active: false,
    pointerId: payload.pointerId,
    startX: payload.clientX,
    startY: payload.clientY,
  }
}

function onWindowPointerMove(e: PointerEvent) {
  const drag = dragState

  if (!drag || e.pointerId !== drag.pointerId) {
    return
  }

  const over = coordFromPoint(e.clientX, e.clientY)

  if (!drag.active) {
    // Inside one cell a drag is a native text selection; it becomes a cell
    // selection only once the pointer crosses into another cell.
    const crossedCell = !!over && (over.row !== drag.anchor.row || over.col !== drag.anchor.col)

    if (!crossedCell || Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < DRAG_THRESHOLD_PX) {
      return
    }

    drag.active = true
    dragging.value = true
    window.getSelection()?.removeAllRanges()
  }

  e.preventDefault()
  const next = cellsInBounds(table.value, drag.anchor, over ?? drag.anchor)
  selectedCells.value = next
  emit('cellSelectionChange', [...next])
}

function onWindowPointerUp(e: PointerEvent) {
  const drag = dragState

  if (!drag || e.pointerId !== drag.pointerId) {
    return
  }

  if (drag.active) {
    e.preventDefault()
    const next = cellsInBounds(table.value, drag.anchor, coordFromPoint(e.clientX, e.clientY) ?? drag.anchor)
    selectedCells.value = next
    emit('cellSelectionChange', [...next])
    emit('cellFocus', { row: drag.anchor.row, col: drag.anchor.col, shiftKey: false })
  }

  dragState = null
  dragging.value = false
}

function onDocPointerDown(e: PointerEvent) {
  if (menu.value && !(e.target as HTMLElement).closest?.('.etable-menu, .etable-grip')) {
    menu.value = null
  }
}

function onDocKeydown(e: KeyboardEvent) {
  if (menu.value && e.key === 'Escape') {
    menu.value = null
  }
}

onMounted(() => {
  window.addEventListener('pointermove', onWindowPointerMove, { passive: false })
  window.addEventListener('pointerup', onWindowPointerUp)
  window.addEventListener('pointercancel', onWindowPointerUp)
  window.addEventListener('resize', onViewportChange)
  document.addEventListener('pointerdown', onDocPointerDown, true)
  document.addEventListener('keydown', onDocKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onWindowPointerMove)
  window.removeEventListener('pointerup', onWindowPointerUp)
  window.removeEventListener('pointercancel', onWindowPointerUp)
  window.removeEventListener('resize', onViewportChange)
  document.removeEventListener('pointerdown', onDocPointerDown, true)
  document.removeEventListener('keydown', onDocKeydown)
})

function isCellSelected(row: number, col: number): boolean {
  return selectedCells.value.some(cell => cell.row === row && cell.col === col)
}

// ─── Hover tracking for row / column handles ──────────────────────────────

function onTablePointerOver(e: PointerEvent) {
  if (props.readonly) {
    return
  }

  const cellEl = (e.target as HTMLElement).closest?.('[data-etable-row][data-etable-col]') as HTMLElement | null

  if (!cellEl) {
    return
  }

  const row = Number(cellEl.dataset.etableRow)
  const col = Number(cellEl.dataset.etableCol)

  if (hover.value?.row !== row || hover.value?.col !== col) {
    hover.value = { row, col }
  }
}

function onRootPointerLeave() {
  if (!menu.value && resizingCol.value === null) {
    hover.value = null
  }
}

// ─── Row / column operations ──────────────────────────────────────────────

function openMenu(kind: 'row' | 'col', index: number) {
  const same = menu.value?.kind === kind && menu.value.index === index
  menu.value = same ? null : { kind, index }
  const last = kind === 'row' ? colCount.value - 1 : table.value.rows.length - 1
  commitSelection(kind === 'row'
    ? cellsInBounds(table.value, { row: index, col: 0 }, { row: index, col: last })
    : cellsInBounds(table.value, { row: 0, col: index }, { row: last, col: index }))
}

function run(next: TableData | null) {
  updateTable(next)
  menu.value = null
  commitSelection([])
}

function rowMenu(row: number): MenuItem[] {
  const tbl = table.value
  const span = tbl.rows[row]?.find(cell => !cell.hidden)?.rowspan ?? 1
  const items: MenuItem[] = []

  if (row === 0) {
    items.push({ icon: PanelTop, label: t.value.headerRow, active: tbl.hasHeader, run: () => run({ ...tbl, hasHeader: !tbl.hasHeader }) })
  }

  items.push(
    { icon: ArrowUp, label: t.value.insertAbove, run: () => run(addTableRow(tbl, row)) },
    { icon: ArrowDown, label: t.value.insertBelow, run: () => run(addTableRow(tbl, row + span)) },
    { icon: ArrowUp, label: t.value.moveUp, disabled: !moveTableRow(tbl, row, row - 1), run: () => run(moveTableRow(tbl, row, row - 1)) },
    { icon: ArrowDown, label: t.value.moveDown, disabled: !moveTableRow(tbl, row, row + 1), run: () => run(moveTableRow(tbl, row, row + 1)) },
    { icon: Copy, label: t.value.duplicate, disabled: !duplicateTableRow(tbl, row), run: () => run(duplicateTableRow(tbl, row)) },
    { icon: Eraser, label: t.value.clearContents, run: () => run(clearTableRow(tbl, row)) },
    { icon: Trash2, label: t.value.deleteRow, danger: true, disabled: tbl.rows.length <= 1, run: () => run(removeTableRow(tbl, row)) },
  )

  return items
}

function colMenu(col: number): MenuItem[] {
  const tbl = table.value
  const first = tbl.rows.find(r => r[col] && !r[col].hidden)?.[col]
  const span = first?.colspan ?? 1
  // "Left/right" are visual: in RTL the next index is to the left.
  const rtl = isRtl.value
  const items: MenuItem[] = []

  if (col === 0) {
    items.push({
      icon: PanelLeft,
      label: t.value.headerColumn,
      active: !!tbl.hasHeaderColumn,
      run: () => run({ ...tbl, hasHeaderColumn: !tbl.hasHeaderColumn || undefined }),
    })
  }

  items.push(
    { icon: rtl ? ArrowRight : ArrowLeft, label: rtl ? t.value.insertRight : t.value.insertLeft, run: () => run(addTableColumn(tbl, col)) },
    { icon: rtl ? ArrowLeft : ArrowRight, label: rtl ? t.value.insertLeft : t.value.insertRight, run: () => run(addTableColumn(tbl, col + span)) },
    {
      icon: rtl ? ArrowRight : ArrowLeft,
      label: rtl ? t.value.moveRight : t.value.moveLeft,
      disabled: !moveTableColumn(tbl, col, col - 1),
      run: () => run(moveTableColumn(tbl, col, col - 1)),
    },
    {
      icon: rtl ? ArrowLeft : ArrowRight,
      label: rtl ? t.value.moveLeft : t.value.moveRight,
      disabled: !moveTableColumn(tbl, col, col + 1),
      run: () => run(moveTableColumn(tbl, col, col + 1)),
    },
    { icon: ArrowDownAZ, label: t.value.sortAscending, disabled: !sortTableByColumn(tbl, col, 'asc'), run: () => run(sortTableByColumn(tbl, col, 'asc')) },
    { icon: ArrowDownZA, label: t.value.sortDescending, disabled: !sortTableByColumn(tbl, col, 'desc'), run: () => run(sortTableByColumn(tbl, col, 'desc')) },
    { icon: AlignLeft, label: t.value.alignLeft, active: first?.align === 'left', run: () => run(setTableColumnAlign(tbl, col, 'left')) },
    { icon: AlignCenter, label: t.value.alignCenter, active: first?.align === 'center', run: () => run(setTableColumnAlign(tbl, col, 'center')) },
    { icon: AlignRight, label: t.value.alignRight, active: first?.align === 'right', run: () => run(setTableColumnAlign(tbl, col, 'right')) },
    { icon: Copy, label: t.value.duplicate, disabled: !duplicateTableColumn(tbl, col), run: () => run(duplicateTableColumn(tbl, col)) },
    { icon: Eraser, label: t.value.clearContents, run: () => run(clearTableColumn(tbl, col)) },
    { icon: Trash2, label: t.value.deleteColumn, danger: true, disabled: colCount.value <= 1, run: () => run(removeTableColumn(tbl, col)) },
  )

  return items
}

const menuItems = computed(() => {
  if (!menu.value) {
    return []
  }

  return menu.value.kind === 'row' ? rowMenu(menu.value.index) : colMenu(menu.value.index)
})

const menuStyle = computed((): Record<string, string> => {
  const l = layout.value
  const m = menu.value

  if (!l || !m) {
    return {}
  }

  if (m.kind === 'row') {
    const top = `${l.rows[m.index]?.top ?? 0}px`

    return isRtl.value
      ? { top, right: `calc(100% - ${l.table.left + l.table.width}px + 14px)` }
      : { top, left: `${l.table.left + 14}px` }
  }

  return {
    top: `${l.table.top + 14}px`,
    left: `${Math.max(0, (l.cols[m.index]?.left ?? 0) + (isRtl.value ? -120 : 0))}px`,
  }
})

// Handles follow the hovered cell, or the focused one while editing.
const gripRow = computed(() => (menu.value?.kind === 'row' ? menu.value.index : (hover.value ?? (menu.value ? null : focusCell.value))?.row ?? null))
const gripCol = computed(() => (menu.value?.kind === 'col' ? menu.value.index : (hover.value ?? (menu.value ? null : focusCell.value))?.col ?? null))

function inClip(x: number): boolean {
  const l = layout.value
  return !!l && x >= l.clip.left - 1 && x <= l.clip.right + 1
}

const rowGripStyle = computed(() => {
  const l = layout.value
  const r = gripRow.value

  if (!l || r === null || !l.rows[r]) {
    return null
  }

  return {
    top: `${l.rows[r].top + l.rows[r].height / 2 - 12}px`,
    left: `${isRtl.value ? l.table.left + l.table.width - 6 : l.table.left - 6}px`,
  }
})

const colGripStyle = computed(() => {
  const l = layout.value
  const c = gripCol.value

  if (!l || c === null || !l.cols[c] || !inClip(l.cols[c].left + l.cols[c].width / 2)) {
    return null
  }

  return { top: `${l.table.top - 6}px`, left: `${l.cols[c].left + l.cols[c].width / 2 - 12}px` }
})

const resizeHandles = computed(() => {
  const l = layout.value

  if (!l) {
    return []
  }

  return l.cols
    .map((c, i) => ({ i, edge: isRtl.value ? c.left : c.left + c.width }))
    .filter(h => inClip(h.edge))
    .map(h => ({ i: h.i, style: { left: `${h.edge - 4}px`, top: `${l.table.top}px`, height: `${l.table.height}px` } }))
})

// ─── Column resize ────────────────────────────────────────────────────────

function onResizeStart(col: number, e: PointerEvent) {
  const l = layout.value

  if (props.readonly || !l) {
    return
  }

  e.preventDefault()
  e.stopPropagation()

  // Freeze every column at its rendered width so only this one changes.
  const start = l.cols.map(c => Math.round(c.width))
  const startX = e.clientX
  const sign = isRtl.value ? -1 : 1
  let current = start
  resizingCol.value = col
  liveWidths.value = start

  function onMove(ev: PointerEvent) {
    const next = [...start]
    next[col] = Math.max(MIN_TABLE_COLUMN_WIDTH, Math.round(start[col] + (ev.clientX - startX) * sign))
    current = next
    liveWidths.value = next
  }

  function onUp() {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onUp)
    resizingCol.value = null
    liveWidths.value = null
    updateTable({ ...table.value, colWidths: current })
  }

  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onUp)
}

// ─── Toolbar actions ──────────────────────────────────────────────────────

function setWidthMode(mode: TableWidth['mode']) {
  updateTable({ ...table.value, width: switchTableWidthMode(table.value.width, mode) })
}

function setWidthValue(value: number) {
  // A width preset re-flows the columns, so manual column widths go.
  updateTable({ ...table.value, colWidths: undefined, width: normalizeTableWidth({ mode: width.value.mode, value }) })
}

function handleMerge() {
  if (!mergeEnabled.value) {
    return
  }

  updateTable(mergeCells(table.value, selectedCells.value))
  commitSelection([selectedCells.value[0]])
}

function handleUnmerge() {
  const focus = selectedCells.value[0]

  if (focus && canUnmergeCell(table.value, focus.row, focus.col)) {
    updateTable(unmergeCell(table.value, focus.row, focus.col))
  }
}

function onPasteGrid(row: number, col: number, grid: string[][]) {
  const next = pasteGridIntoTable(table.value, { row, col }, grid)
  updateTable(next)
  commitSelection(cellsInBounds(next, { row, col }, { row: row + grid.length - 1, col: col + (grid[0]?.length ?? 1) - 1 }))
}

function patchStyle(patch: Partial<TableStyle>) {
  updateTable(patchTableStyle(table.value, patch))
}

defineExpose({
  getSelectedCells: () => [...selectedCells.value],
  setSelectedCells: (cells: TableCellCoord[]) => {
    selectedCells.value = [...cells]
    emit('cellSelectionChange', [...selectedCells.value])
  },
  focusCell: (row: number, col: number, pos: number | 'start' | 'end' = 'start') => {
    cellRefs.get(cellKey(row, col))?.focusAt(pos)
  },
  getCellSelection: (row: number, col: number) => cellRefs.get(cellKey(row, col))?.getSelection() ?? null,
  setCellSelection: (row: number, col: number, start: number, end = start) => {
    cellRefs.get(cellKey(row, col))?.setSelection(start, end)
  },
  patchTableStyle: patchStyle,
})
</script>

<template>
  <div
    ref="rootEl"
    class="etable"
    :class="{ 'etable--active': chromeActive, 'etable--dragging': dragging, 'etable--resizing': resizingCol !== null }"
    @pointerleave="onRootPointerLeave"
  >
    <div
      v-if="!readonly"
      class="etable-toolbar"
      role="toolbar"
      :aria-label="t.table"
    >
      <button
        type="button"
        class="etable-btn"
        :class="{ 'etable-btn-active': table.hasHeader }"
        :aria-pressed="table.hasHeader"
        @click="updateTable({ ...table, hasHeader: !table.hasHeader })"
      >
        <PanelTop /> {{ t.headerRow }}
      </button>
      <button
        type="button"
        class="etable-btn"
        :class="{ 'etable-btn-active': table.hasHeaderColumn }"
        :aria-pressed="!!table.hasHeaderColumn"
        @click="updateTable({ ...table, hasHeaderColumn: !table.hasHeaderColumn || undefined })"
      >
        <PanelLeft /> {{ t.headerColumn }}
      </button>
      <span class="etable-sep" />
      <button
        type="button"
        class="etable-btn"
        :disabled="!mergeEnabled"
        :title="mergeEnabled ? t.mergeSelected : t.selectHint"
        @click="handleMerge"
      >
        <Merge /> {{ t.merge }}
      </button>
      <button
        type="button"
        class="etable-btn"
        :disabled="!unmergeEnabled"
        @click="handleUnmerge"
      >
        <SplitSquareHorizontal /> {{ t.unmerge }}
      </button>
      <span class="etable-sep" />
      <div
        class="etable-width"
        :aria-label="t.width"
      >
        <button
          type="button"
          class="etable-btn"
          :class="{ 'etable-btn-active': width.mode === 'percent' }"
          @click="setWidthMode('percent')"
        >
          %
        </button>
        <button
          type="button"
          class="etable-btn"
          :class="{ 'etable-btn-active': width.mode === 'pixel' }"
          @click="setWidthMode('pixel')"
        >
          px
        </button>
        <template v-if="width.mode === 'percent'">
          <button
            v-for="preset in widthPresets"
            :key="preset"
            type="button"
            class="etable-btn"
            :class="{ 'etable-btn-active': !table.colWidths && width.value === preset }"
            @click="setWidthValue(preset)"
          >
            {{ preset }}%
          </button>
        </template>
        <input
          v-else
          type="number"
          min="200"
          max="2000"
          class="etable-width-input"
          :value="width.value"
          @change="setWidthValue(Number(($event.target as HTMLInputElement).value))"
        >
      </div>
    </div>

    <div
      ref="scrollEl"
      class="etable-scroll xpe-scroll"
      @scroll.passive="onViewportChange"
    >
      <div
        class="etable-grid"
        :class="{ 'etable-grid--fit': allFixed || width.mode === 'pixel' }"
      >
        <div
          class="etable-wrap"
          :style="wrapperStyle"
        >
          <table
            ref="tableEl"
            class="etable-table"
            :class="{ 'etable-table--sized': allFixed }"
            :style="tableStyleProp"
            @pointerover="onTablePointerOver"
          >
            <colgroup v-if="widths && widths.length === colCount">
              <col
                v-for="(w, i) in widths"
                :key="i"
                :style="w ? { width: `${w}px` } : undefined"
              >
            </colgroup>
            <tbody>
              <tr
                v-for="(row, rowIdx) in table.rows"
                :key="rowIdx"
              >
                <template
                  v-for="(cell, colIdx) in row"
                  :key="colIdx"
                >
                  <EditorTableCell
                    v-if="!cell.hidden"
                    :ref="(instance) => setCellRef(rowIdx, colIdx, instance)"
                    :cell="cell"
                    :row-idx="rowIdx"
                    :col-idx="colIdx"
                    :is-header="(rowIdx === 0 && table.hasHeader) || (colIdx === 0 && !!table.hasHeaderColumn)"
                    :selected="isCellSelected(rowIdx, colIdx)"
                    :readonly="readonly"
                    :cell-style="tableCellStyle(cell, rowIdx, table.hasHeader, table.style)"
                    @cell-click="onCellClick"
                    @cell-pointer-down="onCellPointerDown"
                    @focus="emit('cellFocus', $event)"
                    @input="(content, caret) => emit('cellInput', { row: rowIdx, col: colIdx, content, caret })"
                    @format="mark => emit('cellFormat', { row: rowIdx, col: colIdx, mark })"
                    @tab="shift => emit('cellTab', { row: rowIdx, col: colIdx, shift })"
                    @arrow-up="emit('cellNavigate', { row: rowIdx, col: colIdx, direction: 'up' })"
                    @arrow-down="emit('cellNavigate', { row: rowIdx, col: colIdx, direction: 'down' })"
                    @arrow-left="emit('cellNavigate', { row: rowIdx, col: colIdx, direction: 'left' })"
                    @arrow-right="emit('cellNavigate', { row: rowIdx, col: colIdx, direction: 'right' })"
                    @paste-grid="grid => onPasteGrid(rowIdx, colIdx, grid)"
                  />
                </template>
              </tr>
            </tbody>
          </table>
        </div>
        <template v-if="!readonly">
          <button
            type="button"
            class="etable-add etable-add--col"
            :title="t.addColumn"
            :aria-label="t.addColumn"
            @click="updateTable(addTableColumn(table))"
          >
            <Plus />
          </button>
          <button
            type="button"
            class="etable-add etable-add--row"
            :title="t.addRow"
            :aria-label="t.addRow"
            @click="updateTable(addTableRow(table))"
          >
            <Plus />
          </button>
        </template>
      </div>
    </div>

    <div
      v-if="!readonly && layout"
      class="etable-overlay"
    >
      <button
        v-if="rowGripStyle && gripRow !== null"
        type="button"
        class="etable-grip etable-grip--row"
        :class="{ 'is-open': menu?.kind === 'row' }"
        :style="rowGripStyle"
        :title="t.rowActions"
        :aria-label="t.rowActions"
        aria-haspopup="menu"
        :aria-expanded="menu?.kind === 'row'"
        @mousedown.prevent
        @click="openMenu('row', gripRow)"
      >
        <GripVertical />
      </button>
      <button
        v-if="colGripStyle && gripCol !== null"
        type="button"
        class="etable-grip etable-grip--col"
        :class="{ 'is-open': menu?.kind === 'col' }"
        :style="colGripStyle"
        :title="t.columnActions"
        :aria-label="t.columnActions"
        aria-haspopup="menu"
        :aria-expanded="menu?.kind === 'col'"
        @mousedown.prevent
        @click="openMenu('col', gripCol)"
      >
        <GripHorizontal />
      </button>
      <div
        v-for="h in resizeHandles"
        :key="h.i"
        class="etable-resize"
        :class="{ 'is-active': resizingCol === h.i }"
        :style="h.style"
        :title="t.resizeColumn"
        role="separator"
        aria-orientation="vertical"
        @pointerdown="onResizeStart(h.i, $event)"
        @dblclick="updateTable(setTableColumnWidth(table, h.i, null))"
      />
      <div
        v-if="menu"
        class="etable-menu xpe-float"
        role="menu"
        :style="menuStyle"
      >
        <button
          v-for="item in menuItems"
          :key="item.label"
          type="button"
          role="menuitem"
          class="xpe-menu-item"
          :class="{ 'xpe-menu-item--danger': item.danger, 'xpe-menu-item--selected': item.active }"
          :disabled="item.disabled"
          :title="item.disabled && !item.danger ? t.mergedHint : undefined"
          @mousedown.prevent
          @click="item.run"
        >
          <span class="xpe-menu-item__icon"><component :is="item.icon" /></span>
          <span class="xpe-menu-item__label">{{ item.label }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
