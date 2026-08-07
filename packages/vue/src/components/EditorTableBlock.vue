<script setup lang="ts">
import { Columns2, Merge, Plus, Rows3, SplitSquareHorizontal, Trash2 } from 'lucide-vue-next'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
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
import type { Block, InlineSpan, MarkName, TableCellCoord, TableData, TableStyle, TableWidth } from '@xproeditor/core'
import EditorTableCell from './EditorTableCell.vue'

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

const cellRefs = ref<Map<string, InstanceType<typeof EditorTableCell>>>(new Map())
const rootEl = ref<HTMLElement | null>(null)
const selectedCells = ref<TableCellCoord[]>([])
const dragging = ref(false)

const dragState = ref<{
  anchor: TableCellCoord
  active: boolean
  pointerId: number
  startX: number
  startY: number
} | null>(null)

const table = computed<TableData>(() => normalizeTableData(props.block.props.table))
const wrapperStyle = computed(() => tableWrapperStyle(table.value.style, table.value.width))
const width = computed(() => getResolvedTableWidth(table.value.width))
const widthPresets = [40, 60, 80, 100]
const focusCell = computed(() => selectedCells.value[0] ?? null)
const chromeActive = computed(() => selectedCells.value.length > 0 || dragging.value)

const mergeEnabled = computed(() => canMergeCells(table.value, selectedCells.value))
const unmergeEnabled = computed(() => {
  const focus = selectedCells.value[0]
  return !!focus && canUnmergeCell(table.value, focus.row, focus.col)
})

function cellKey(row: number, col: number): string {
  return `${row}:${col}`
}

function setCellRef(row: number, col: number, instance: InstanceType<typeof EditorTableCell> | null) {
  const key = cellKey(row, col)
  if (instance) cellRefs.value.set(key, instance)
  else cellRefs.value.delete(key)
}

function updateTable(next: TableData) {
  emit('patch', { table: next })
}

function commitSelection(
  next: TableCellCoord[],
  focusPayload?: { row: number; col: number; shiftKey: boolean },
) {
  selectedCells.value = next
  emit('cellSelectionChange', [...next])
  if (focusPayload) emit('cellFocus', focusPayload)
}

function toggleHeader() {
  updateTable({ ...table.value, hasHeader: !table.value.hasHeader })
}

function setWidthMode(mode: TableWidth['mode']) {
  updateTable({ ...table.value, width: switchTableWidthMode(table.value.width, mode) })
}

function setWidthValue(value: number) {
  updateTable({
    ...table.value,
    width: normalizeTableWidth({ mode: width.value.mode, value }),
  })
}

function onCellClick(payload: { row: number; col: number; shiftKey: boolean }) {
  if (dragState.value?.active) return

  const next = payload.shiftKey && selectedCells.value.length > 0
    ? cellsInBounds(table.value, selectedCells.value[0], payload)
    : [{ row: payload.row, col: payload.col }]

  commitSelection(next, payload)
}

function onCellPointerDown(payload: {
  row: number
  col: number
  shiftKey: boolean
  pointerId: number
  clientX: number
  clientY: number
}) {
  if (props.readonly || payload.shiftKey) return

  dragState.value = {
    anchor: { row: payload.row, col: payload.col },
    active: false,
    pointerId: payload.pointerId,
    startX: payload.clientX,
    startY: payload.clientY,
  }
}

function coordFromPoint(clientX: number, clientY: number): TableCellCoord | null {
  const el = document.elementFromPoint(clientX, clientY)
  const cellEl = el?.closest?.('[data-etable-row][data-etable-col]') as HTMLElement | null
  if (!cellEl || !rootEl.value?.contains(cellEl)) return null

  const row = Number(cellEl.dataset.etableRow)
  const col = Number(cellEl.dataset.etableCol)
  if (!Number.isFinite(row) || !Number.isFinite(col)) return null

  return { row, col }
}

function onPointerMove(e: PointerEvent) {
  const drag = dragState.value
  if (!drag || e.pointerId !== drag.pointerId) return

  const dx = e.clientX - drag.startX
  const dy = e.clientY - drag.startY
  const over = coordFromPoint(e.clientX, e.clientY)

  if (!drag.active) {
    const movedFar = Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX
    const crossedCell = !!over && (over.row !== drag.anchor.row || over.col !== drag.anchor.col)
    if (!movedFar && !crossedCell) return

    drag.active = true
    dragging.value = true
    window.getSelection()?.removeAllRanges()
  }

  e.preventDefault()
  const target = over ?? drag.anchor
  const next = cellsInBounds(table.value, drag.anchor, target)
  selectedCells.value = next
  emit('cellSelectionChange', [...next])
}

function onPointerUp(e: PointerEvent) {
  const drag = dragState.value
  if (!drag || e.pointerId !== drag.pointerId) return

  if (drag.active) {
    e.preventDefault()
    const target = coordFromPoint(e.clientX, e.clientY) ?? drag.anchor
    const next = cellsInBounds(table.value, drag.anchor, target)
    commitSelection(next, { row: drag.anchor.row, col: drag.anchor.col, shiftKey: false })
  }

  dragState.value = null
  dragging.value = false
}

function isCellSelected(row: number, col: number): boolean {
  return selectedCells.value.some((cell) => cell.row === row && cell.col === col)
}

function handleMerge() {
  if (!canMergeCells(table.value, selectedCells.value)) return

  updateTable(mergeCells(table.value, selectedCells.value))
  commitSelection([selectedCells.value[0]])
}

function handleUnmerge() {
  const focus = selectedCells.value[0]
  if (!focus || !canUnmergeCell(table.value, focus.row, focus.col)) return

  updateTable(unmergeCell(table.value, focus.row, focus.col))
}

function handleAddRow() {
  const focus = focusCell.value
  const at = focus
    ? focus.row + (table.value.rows[focus.row]?.[focus.col]?.rowspan ?? 1)
    : undefined
  updateTable(addTableRow(table.value, at))
}

function handleAddColumn() {
  const focus = focusCell.value
  const at = focus
    ? focus.col + (table.value.rows[focus.row]?.[focus.col]?.colspan ?? 1)
    : undefined
  updateTable(addTableColumn(table.value, at))
}

function handleRemoveColumn() {
  const colIdx = focusCell.value?.col ?? (table.value.rows[0]?.length ?? 1) - 1
  updateTable(removeTableColumn(table.value, colIdx))
}

function patchStyle(patch: Partial<TableStyle>) {
  updateTable(patchTableStyle(table.value, patch))
}

onMounted(() => {
  window.addEventListener('pointermove', onPointerMove, { passive: false })
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerUp)
})

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerUp)
})

watch(
  () => props.block.id,
  () => {
    selectedCells.value = []
    emit('cellSelectionChange', [])
  },
)

defineExpose({
  getSelectedCells: () => [...selectedCells.value],
  setSelectedCells: (cells: TableCellCoord[]) => {
    selectedCells.value = [...cells]
    emit('cellSelectionChange', [...selectedCells.value])
  },
  focusCell: (row: number, col: number, pos: number | 'start' | 'end' = 'start') => {
    cellRefs.value.get(cellKey(row, col))?.focusAt(pos)
  },
  getCellSelection: (row: number, col: number) => cellRefs.value.get(cellKey(row, col))?.getSelection() ?? null,
  setCellSelection: (row: number, col: number, start: number, end = start) => {
    cellRefs.value.get(cellKey(row, col))?.setSelection(start, end)
  },
  patchTableStyle: patchStyle,
})
</script>

<template>
  <div
    ref="rootEl"
    class="etable group/table my-1"
    :class="{ 'etable--active': chromeActive, 'etable--dragging': dragging }"
  >
    <div v-if="!readonly" class="etable-toolbar">
      <button type="button" class="etable-btn" @click="toggleHeader">
        {{ table.hasHeader ? 'Header: on' : 'Header: off' }}
      </button>
      <button
        type="button"
        class="etable-btn"
        :disabled="!mergeEnabled"
        :title="mergeEnabled ? 'Merge selected cells' : 'Drag or Shift+click to select 2+ cells'"
        @click="handleMerge"
      >
        <Merge class="inline h-3 w-3" /> Merge
      </button>
      <button type="button" class="etable-btn" :disabled="!unmergeEnabled" @click="handleUnmerge">
        <SplitSquareHorizontal class="inline h-3 w-3" /> Unmerge
      </button>
      <div class="etable-width">
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
            :class="{ 'etable-btn-active': width.value === preset }"
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
        />
      </div>
    </div>

    <div class="etable-frame">
      <div class="etable-wrap xpe-scroll" :style="wrapperStyle">
        <table class="etable-table">
          <tbody>
            <tr v-for="(row, rowIdx) in table.rows" :key="rowIdx" class="group/row">
              <template v-for="(cell, colIdx) in row" :key="colIdx">
                <EditorTableCell
                  v-if="!cell.hidden"
                  :ref="(instance) => setCellRef(rowIdx, colIdx, instance as InstanceType<typeof EditorTableCell> | null)"
                  :cell="cell"
                  :row-idx="rowIdx"
                  :col-idx="colIdx"
                  :is-header="rowIdx === 0 && table.hasHeader"
                  :selected="isCellSelected(rowIdx, colIdx)"
                  :readonly="readonly"
                  :cell-style="tableCellStyle(cell, rowIdx, table.hasHeader, table.style)"
                  @cell-click="onCellClick"
                  @cell-pointer-down="onCellPointerDown"
                  @focus="emit('cellFocus', $event)"
                  @input="(content, caret) => emit('cellInput', { row: rowIdx, col: colIdx, content, caret })"
                  @format="(mark) => emit('cellFormat', { row: rowIdx, col: colIdx, mark })"
                  @tab="(shift) => emit('cellTab', { row: rowIdx, col: colIdx, shift })"
                  @arrow-up="emit('cellNavigate', { row: rowIdx, col: colIdx, direction: 'up' })"
                  @arrow-down="emit('cellNavigate', { row: rowIdx, col: colIdx, direction: 'down' })"
                  @arrow-left="emit('cellNavigate', { row: rowIdx, col: colIdx, direction: 'left' })"
                  @arrow-right="emit('cellNavigate', { row: rowIdx, col: colIdx, direction: 'right' })"
                />
              </template>
              <td class="etable-row-gutter">
                <button
                  v-if="!readonly"
                  type="button"
                  class="etable-icon-btn etable-icon-btn--danger"
                  title="Remove row"
                  @click="updateTable(removeTableRow(table, rowIdx))"
                >
                  <Trash2 class="h-3 w-3" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <button
          v-if="!readonly"
          type="button"
          class="etable-add-row"
          title="Add row below"
          @click="handleAddRow"
        >
          <Rows3 class="h-3.5 w-3.5" />
          <span>Add row</span>
        </button>
      </div>
      <div v-if="!readonly" class="etable-col-gutter">
        <button type="button" class="etable-add-col" title="Add column" @click="handleAddColumn">
          <Columns2 class="h-3.5 w-3.5" />
          <span>Col</span>
        </button>
        <button
          v-if="table.rows[0]?.length"
          type="button"
          class="etable-icon-btn etable-icon-btn--danger"
          :title="focusCell ? 'Remove selected column' : 'Remove last column'"
          @click="handleRemoveColumn"
        >
          <Trash2 class="h-3.5 w-3.5" />
        </button>
        <button type="button" class="etable-icon-btn" title="Add row" @click="handleAddRow">
          <Plus class="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  </div>
</template>
