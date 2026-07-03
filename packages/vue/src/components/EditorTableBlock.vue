<script setup lang="ts">
import { Columns2, Merge, Plus, SplitSquareHorizontal, Trash2 } from 'lucide-vue-next'
import { computed, ref } from 'vue'
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

const cellRefs = ref<Map<string, InstanceType<typeof EditorTableCell>>>(new Map())
const selectedCells = ref<TableCellCoord[]>([])

const table = computed<TableData>(() => normalizeTableData(props.block.props.table))
const wrapperStyle = computed(() => tableWrapperStyle(table.value.style, table.value.width))
const widthPresets = [40, 60, 80, 100]

function cellKey(row: number, col: number): string {
  return `${row}:${col}`
}

function setCellRef(row: number, col: number, instance: InstanceType<typeof EditorTableCell> | null) {
  const key = cellKey(row, col)

  if (instance) {
    cellRefs.value.set(key, instance)
  } else {
    cellRefs.value.delete(key)
  }
}

function updateTable(next: TableData) {
  emit('patch', { table: next })
}

function patchTable(nextTable: TableData) {
  updateTable(nextTable)
}

function toggleHeader() {
  updateTable({ ...table.value, hasHeader: !table.value.hasHeader })
}

function setWidthMode(mode: TableWidth['mode']) {
  const current = getResolvedTableWidth(table.value.width)
  updateTable({
    ...table.value,
    width: { mode, value: current.value },
  })
}

function setWidthValue(value: number) {
  const current = getResolvedTableWidth(table.value.width)
  updateTable({
    ...table.value,
    width: { ...current, value },
  })
}

function onCellClick(payload: { row: number; col: number; shiftKey: boolean }) {
  if (payload.shiftKey && selectedCells.value.length > 0) {
    const anchor = selectedCells.value[0]
    const minRow = Math.min(anchor.row, payload.row)
    const maxRow = Math.max(anchor.row, payload.row)
    const minCol = Math.min(anchor.col, payload.col)
    const maxCol = Math.max(anchor.col, payload.col)
    const next: TableCellCoord[] = []

    for (let row = minRow; row <= maxRow; row += 1) {
      for (let col = minCol; col <= maxCol; col += 1) {
        const cell = table.value.rows[row]?.[col]

        if (cell && !cell.hidden) {
          next.push({ row, col })
        }
      }
    }

    selectedCells.value = next
  } else {
    selectedCells.value = [{ row: payload.row, col: payload.col }]
  }

  emit('cellSelectionChange', [...selectedCells.value])
  emit('cellFocus', payload)
}

function isCellSelected(row: number, col: number): boolean {
  return selectedCells.value.some((cell) => cell.row === row && cell.col === col)
}

function handleMerge() {
  if (!canMergeCells(table.value, selectedCells.value)) {
    return
  }

  patchTable(mergeCells(table.value, selectedCells.value))
  selectedCells.value = [selectedCells.value[0]]
  emit('cellSelectionChange', [...selectedCells.value])
}

function handleUnmerge() {
  const focus = selectedCells.value[0]

  if (!focus || !canUnmergeCell(table.value, focus.row, focus.col)) {
    return
  }

  patchTable(unmergeCell(table.value, focus.row, focus.col))
}

const mergeEnabled = computed(() => canMergeCells(table.value, selectedCells.value))
const unmergeEnabled = computed(() => {
  const focus = selectedCells.value[0]

  return !!focus && canUnmergeCell(table.value, focus.row, focus.col)
})

function patchStyle(patch: Partial<TableStyle>) {
  patchTable(patchTableStyle(table.value, patch))
}

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
  <div class="group/table my-1">
    <div
      v-if="!readonly"
      class="mb-1 flex flex-wrap items-center gap-2 opacity-0 transition-opacity group-hover/table:opacity-100"
    >
      <button class="etable-btn" @click="toggleHeader">
        {{ table.hasHeader ? 'Header: on' : 'Header: off' }}
      </button>
      <button class="etable-btn" :disabled="!mergeEnabled" @click="handleMerge">
        <Merge class="inline h-3 w-3" /> Merge
      </button>
      <button class="etable-btn" :disabled="!unmergeEnabled" @click="handleUnmerge">
        <SplitSquareHorizontal class="inline h-3 w-3" /> Unmerge
      </button>
      <div class="flex items-center gap-1 rounded-md border border-gray-100 bg-gray-50 px-1 py-0.5">
        <button
          class="etable-btn"
          :class="getResolvedTableWidth(table.width).mode === 'percent' ? 'etable-btn-active' : ''"
          @click="setWidthMode('percent')"
        >
          %
        </button>
        <button
          class="etable-btn"
          :class="getResolvedTableWidth(table.width).mode === 'pixel' ? 'etable-btn-active' : ''"
          @click="setWidthMode('pixel')"
        >
          px
        </button>
        <template v-if="getResolvedTableWidth(table.width).mode === 'percent'">
          <button
            v-for="preset in widthPresets"
            :key="preset"
            class="etable-btn"
            :class="getResolvedTableWidth(table.width).value === preset ? 'etable-btn-active' : ''"
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
          class="w-16 rounded border border-gray-200 px-1 py-0.5 text-[11px]"
          :value="getResolvedTableWidth(table.width).value"
          @change="setWidthValue(Number(($event.target as HTMLInputElement).value))"
        />
      </div>
    </div>

    <div class="flex items-start">
      <div class="flex-1 overflow-x-auto rounded-lg border border-gray-200" :style="wrapperStyle">
        <table class="w-full border-collapse">
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
              <td class="w-6 border-0 align-middle">
                <button
                  v-if="!readonly"
                  class="hidden h-5 w-5 items-center justify-center rounded text-gray-300 hover:text-red-500 group-hover/row:flex"
                  title="Remove row"
                  @click="patchTable(removeTableRow(table, rowIdx))"
                >
                  <Trash2 class="h-3 w-3" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <button
          v-if="!readonly"
          class="flex w-full items-center justify-center py-1 text-gray-300 transition-colors hover:bg-indigo-50/40 hover:text-indigo-500"
          title="Add row"
          @click="patchTable(addTableRow(table))"
        >
          <Plus class="h-3.5 w-3.5" />
        </button>
      </div>
      <div v-if="!readonly" class="ms-1 flex flex-col gap-1 self-stretch">
        <button
          class="flex items-center rounded px-1 text-gray-300 transition-colors hover:bg-indigo-50/40 hover:text-indigo-500"
          title="Add column"
          @click="patchTable(addTableColumn(table))"
        >
          <Columns2 class="h-3.5 w-3.5" />
        </button>
        <button
          v-if="table.rows[0]?.length"
          class="flex items-center rounded px-1 text-gray-300 transition-colors hover:bg-red-50/40 hover:text-red-500"
          title="Remove last column"
          @click="patchTable(removeTableColumn(table, (table.rows[0]?.length ?? 1) - 1))"
        >
          <Trash2 class="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.etable-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #9ca3af;
  background: #f9fafb;
  border: 1px solid #f3f4f6;
  border-radius: 6px;
  padding: 2px 8px;
  cursor: pointer;
}
.etable-btn:hover:not(:disabled) {
  color: #4f46e5;
  border-color: #e0e7ff;
}
.etable-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.etable-btn-active {
  color: #4f46e5;
  border-color: #c7d2fe;
  background: #eef2ff;
}
</style>
