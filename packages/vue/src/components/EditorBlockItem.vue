<script setup lang="ts">
import { Copy, GripVertical, Plus, ChevronRight, Trash2 } from 'lucide-vue-next'
import { ref, computed, watch, nextTick } from 'vue'
import { isTextBlock, resolveBlockDirection } from '@xproeditor/core'
import type { Block, InlineSpan, MarkName, TableCellCoord } from '@xproeditor/core'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  IconEmojiPicker,
  IconValueDisplay,
} from '../ui'
import EditorAudioBlock from './EditorAudioBlock.vue'
import EditorCodeBlock from './EditorCodeBlock.vue'
import EditorFileBlock from './EditorFileBlock.vue'
import EditorImageBlock from './EditorImageBlock.vue'
import EditorSelectionHighlight from './EditorSelectionHighlight.vue'
import EditorTableBlock from './EditorTableBlock.vue'
import EditorTextBlock from './EditorTextBlock.vue'
import EditorVideoBlock from './EditorVideoBlock.vue'

const props = defineProps<{
  block: Block
  number?: number
  placeholder?: string
  selected?: boolean
  textHighlight?: { start: number; end: number } | null
  dropPosition?: 'before' | 'after' | null
  upload?: (file: File) => Promise<string>
  pickMedia?: (options: {
    accept: string[]
    title?: string
  }) => Promise<{ url: string; alt?: string; caption?: string } | null>
  /** Shell / language direction fallback when block dir is auto. */
  editorDir?: 'ltr' | 'rtl'
  readonly?: boolean
  /** When set, opens the callout icon picker (slash command / programmatic). */
  iconPickerRequest?: { tab: 'emoji' | 'icon' } | null
}>()

const emit = defineEmits<{
  input: [spans: InlineSpan[], caret: number | null]
  enter: [offsets: { start: number; end: number }]
  backspaceStart: []
  deleteEnd: []
  arrowUp: []
  arrowDown: []
  tab: [shift: boolean]
  format: [mark: MarkName]
  pasted: [payload: { html: string; text: string; files: File[]; offsets: { start: number; end: number } }]
  focus: []
  patch: [patch: Record<string, unknown>]
  select: []
  addBelow: []
  duplicate: []
  remove: []
  dragHandleStart: [e: DragEvent]
  pointerdown: [e: PointerEvent]
  selectionPointerDown: [payload: { shiftKey: boolean; clientX: number; clientY: number }]
  iconPickerOpened: []
  tableCellFocus: [payload: { row: number; col: number; shiftKey: boolean }]
  tableCellInput: [payload: { row: number; col: number; content: InlineSpan[]; caret: number | null }]
  tableCellFormat: [payload: { row: number; col: number; mark: MarkName }]
  tableCellTab: [payload: { row: number; col: number; shift: boolean }]
  tableCellNavigate: [payload: { row: number; col: number; direction: 'up' | 'down' | 'left' | 'right' }]
  tableCellSelectionChange: [cells: TableCellCoord[]]
}>()

const CALLOUT_COLORS = ['#f8fafc', '#fefce8', '#fff7ed', '#fef2f2', '#f0fdf4', '#eff6ff', '#faf5ff']

const inner = ref<InstanceType<typeof EditorTextBlock> | InstanceType<typeof EditorCodeBlock> | InstanceType<typeof EditorTableBlock> | null>(null)
const calloutIconPickerRef = ref<InstanceType<typeof IconEmojiPicker> | null>(null)
const showCalloutColors = ref(false)

const calloutIcon = computed({
  get: () => props.block.props.icon ?? '💡',
  set: (value: string | null) => emit('patch', { icon: value ?? '💡' }),
})

watch(
  () => props.iconPickerRequest,
  (request) => {
    if (!request || props.readonly || props.block.type !== 'callout') {
      return
    }

    nextTick(() => {
      calloutIconPickerRef.value?.open(request.tab)
      emit('iconPickerOpened')
    })
  },
)

const indent = computed(() => props.block.props.indent ?? 0)
const textual = computed(() => isTextBlock(props.block.type))
const blockDir = computed(() => resolveBlockDirection(props.block, props.editorDir ?? 'ltr'))
const isRtl = computed(() => blockDir.value === 'rtl')

const textEditableEl = computed((): HTMLElement | null => {
  const comp = inner.value as { el?: HTMLElement | null } | null

  return comp?.el ?? null
})

function focusAt(pos: number | 'start' | 'end') {
  const comp = inner.value as { focusAt?: (p: number | 'start' | 'end') => void } | null
  comp?.focusAt?.(pos)
}

function getSelection(): { start: number; end: number } | null {
  const comp = inner.value as { getSelection?: () => { start: number; end: number } | null } | null

  return comp?.getSelection?.() ?? null
}

function setSelection(start: number, end?: number) {
  const comp = inner.value as { setSelection?: (s: number, e?: number) => void } | null
  comp?.setSelection?.(start, end)
}

function getTableApi() {
  return inner.value as InstanceType<typeof EditorTableBlock> | null
}

defineExpose({
  focusAt,
  getSelection,
  setSelection,
  textual,
  getTableSelectedCells: () => getTableApi()?.getSelectedCells?.() ?? [],
  setTableSelectedCells: (cells: TableCellCoord[]) => getTableApi()?.setSelectedCells?.(cells),
  focusTableCell: (row: number, col: number, pos: number | 'start' | 'end' = 'start') =>
    getTableApi()?.focusCell?.(row, col, pos),
  getTableCellSelection: (row: number, col: number) => getTableApi()?.getCellSelection?.(row, col) ?? null,
  setTableCellSelection: (row: number, col: number, start: number, end?: number) =>
    getTableApi()?.setCellSelection?.(row, col, start, end ?? start),
})
</script>

<template>
  <div
    class="ebi group/block relative"
    :class="{ 'ebi-selected': selected }"
    :data-block-id="block.id"
    :dir="blockDir"
    :style="{ paddingInlineStart: `${indent * 28}px` }"
    @pointerdown="emit('pointerdown', $event)"
  >
    <!-- Drop indicator -->
    <div v-if="dropPosition === 'before'" class="ebi-drop -top-[2px]" />
    <div v-if="dropPosition === 'after'" class="ebi-drop -bottom-[2px]" />

    <div class="flex items-start gap-0.5">
      <!-- Gutter: + and drag handle -->
      <div
        v-if="!readonly"
        class="ebi-gutter flex items-center shrink-0 pt-[5px] opacity-0 group-hover/block:opacity-100 transition-opacity select-none"
        contenteditable="false"
      >
        <button
          class="ebi-gutter-btn"
          title="Add block below"
          @pointerdown.stop
          @click="emit('addBelow')"
        >
          <Plus class="w-3.5 h-3.5" />
        </button>
        <div class="relative">
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <button
                class="ebi-gutter-btn ebi-reorder-handle cursor-grab active:cursor-grabbing"
                title="Drag to move, click for menu"
                draggable="true"
                @pointerdown.stop
                @dragstart="emit('dragHandleStart', $event)"
              >
                <GripVertical class="w-3.5 h-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent :align="isRtl ? 'end' : 'start'" class="w-36">
              <DropdownMenuItem @click="emit('duplicate')">
                <Copy class="w-3.5 h-3.5 text-gray-400" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem class="text-red-500 focus:text-red-500" @click="emit('remove')">
                <Trash2 class="w-3.5 h-3.5" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <!-- Block body -->
      <div class="relative flex-1 min-w-0 py-[3px]">
        <!-- Quote -->
        <div v-if="block.type === 'quote'" class="flex gap-3 border-s-[3px] border-gray-800 ps-3.5">
          <EditorTextBlock
            ref="inner"
            :block="block"
            :readonly="readonly"
            :placeholder="placeholder ?? 'Quote'"
            class="flex-1"
            @input="(s, c) => emit('input', s, c)"
            @enter="o => emit('enter', o)"
            @backspace-start="emit('backspaceStart')"
            @delete-end="emit('deleteEnd')"
            @arrow-up="emit('arrowUp')"
            @arrow-down="emit('arrowDown')"
            @tab="s => emit('tab', s)"
            @format="m => emit('format', m)"
            @pasted="p => emit('pasted', p)"
            @focus="emit('focus')"
            @selection-pointer-down="p => emit('selectionPointerDown', p)"
          />
        </div>

        <!-- Callout -->
        <div
          v-else-if="block.type === 'callout'"
          class="flex items-start gap-2.5 rounded-xl border border-gray-100 px-3.5 py-3"
          :style="{ background: block.props.color ?? '#f8fafc' }"
        >
          <div class="relative shrink-0" contenteditable="false" @click.stop @pointerdown.stop>
            <IconEmojiPicker
              ref="calloutIconPickerRef"
              v-model="calloutIcon"
              :disabled="readonly"
              align="start"
              side="bottom"
            >
              <template #trigger="{ selected, isIconify, toggle }">
                <button
                  type="button"
                  class="mt-0.5 text-lg leading-none transition-transform"
                  :class="{ 'hover:scale-110': !readonly }"
                  :disabled="readonly"
                  @click.stop="toggle"
                  @pointerdown.stop
                >
                  <span v-if="selected && isIconify" class="inline-flex size-6 items-center justify-center">
                    <IconValueDisplay :icon="selected" class="size-5" />
                  </span>
                  <span v-else>{{ selected ?? '💡' }}</span>
                </button>
              </template>
            </IconEmojiPicker>
            <button
              v-if="!readonly"
              type="button"
              class="mt-1 block w-full text-[10px] text-gray-400 hover:text-gray-600"
              @click="showCalloutColors = !showCalloutColors"
            >
              Color
            </button>
            <div
              v-if="showCalloutColors && !readonly"
              class="absolute start-0 top-full z-[60] mt-1 rounded-xl border border-gray-100 bg-white p-2 shadow-xl"
            >
              <div class="flex gap-1">
                <button
                  v-for="c in CALLOUT_COLORS"
                  :key="c"
                  class="h-5 w-5 rounded-md border border-black/10"
                  :style="{ background: c }"
                  @click="emit('patch', { color: c }); showCalloutColors = false"
                />
              </div>
            </div>
          </div>
          <EditorTextBlock
            ref="inner"
            :block="block"
            :readonly="readonly"
            :placeholder="placeholder ?? 'Type something...'"
            class="flex-1"
            @input="(s, c) => emit('input', s, c)"
            @enter="o => emit('enter', o)"
            @backspace-start="emit('backspaceStart')"
            @delete-end="emit('deleteEnd')"
            @arrow-up="emit('arrowUp')"
            @arrow-down="emit('arrowDown')"
            @tab="s => emit('tab', s)"
            @format="m => emit('format', m)"
            @pasted="p => emit('pasted', p)"
            @focus="emit('focus')"
            @selection-pointer-down="p => emit('selectionPointerDown', p)"
          />
        </div>

        <!-- Lists / to-do / toggle -->
        <div v-else-if="['bulleted_list_item', 'numbered_list_item', 'to_do', 'toggle'].includes(block.type)" class="ebi-list-row flex items-start gap-1.5">
          <div class="shrink-0 flex items-center justify-center w-6 pt-[5px] select-none" contenteditable="false">
            <span v-if="block.type === 'bulleted_list_item'" class="text-gray-800 text-base leading-none mt-1">•</span>
            <span v-else-if="block.type === 'numbered_list_item'" class="text-gray-700 text-[14px] leading-snug tabular-nums">{{ number ?? 1 }}.</span>
            <button
              v-else-if="block.type === 'to_do'"
              class="w-[15px] h-[15px] mt-1 rounded-[4px] border flex items-center justify-center transition-colors"
              :class="block.props.checked ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 hover:border-indigo-400 bg-white'"
              :disabled="readonly"
              @click="emit('patch', { checked: !block.props.checked })"
            >
              <svg v-if="block.props.checked" class="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" /></svg>
            </button>
            <button
              v-else
              class="w-5 h-5 mt-0.5 rounded flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-transform"
              :disabled="readonly"
              @click="emit('patch', { collapsed: !block.props.collapsed })"
            >
              <ChevronRight
                class="h-3.5 w-3.5 transition-transform"
                :class="{
                  'rotate-90': !block.props.collapsed,
                  'ebi-chevron-rtl': isRtl,
                }"
              />
            </button>
          </div>
          <EditorTextBlock
            ref="inner"
            :block="block"
            :readonly="readonly"
            :placeholder="placeholder ?? (block.type === 'to_do' ? 'To-do' : block.type === 'toggle' ? 'Toggle' : 'List item')"
            class="flex-1"
            :class="{ 'line-through !text-gray-400': block.type === 'to_do' && block.props.checked }"
            @input="(s, c) => emit('input', s, c)"
            @enter="o => emit('enter', o)"
            @backspace-start="emit('backspaceStart')"
            @delete-end="emit('deleteEnd')"
            @arrow-up="emit('arrowUp')"
            @arrow-down="emit('arrowDown')"
            @tab="s => emit('tab', s)"
            @format="m => emit('format', m)"
            @pasted="p => emit('pasted', p)"
            @focus="emit('focus')"
            @selection-pointer-down="p => emit('selectionPointerDown', p)"
          />
        </div>

        <!-- Code -->
        <EditorCodeBlock
          v-else-if="block.type === 'code'"
          ref="inner"
          :block="block"
          :readonly="readonly"
          @patch="p => emit('patch', p)"
          @arrow-up="emit('arrowUp')"
          @arrow-down="emit('arrowDown')"
          @remove-self="emit('remove')"
          @exit-below="emit('addBelow')"
        />

        <!-- Image -->
        <EditorImageBlock
          v-else-if="block.type === 'image'"
          :block="block"
          :selected="selected"
          :readonly="readonly"
          :upload="upload"
          :pick-media="pickMedia"
          @patch="p => emit('patch', p)"
          @select="emit('select')"
        />

        <EditorVideoBlock
          v-else-if="block.type === 'video'"
          :block="block"
          :selected="selected"
          :readonly="readonly"
          :upload="upload"
          :pick-media="pickMedia"
          @patch="p => emit('patch', p)"
          @select="emit('select')"
        />

        <EditorAudioBlock
          v-else-if="block.type === 'audio'"
          :block="block"
          :selected="selected"
          :readonly="readonly"
          :upload="upload"
          :pick-media="pickMedia"
          @patch="p => emit('patch', p)"
          @select="emit('select')"
        />

        <EditorFileBlock
          v-else-if="block.type === 'file'"
          :block="block"
          :selected="selected"
          :readonly="readonly"
          :upload="upload"
          :pick-media="pickMedia"
          @patch="p => emit('patch', p)"
          @select="emit('select')"
        />

        <!-- Table -->
        <EditorTableBlock
          v-else-if="block.type === 'table'"
          ref="inner"
          :block="block"
          :readonly="readonly"
          @patch="p => emit('patch', p)"
          @cell-focus="emit('tableCellFocus', $event)"
          @cell-input="emit('tableCellInput', $event)"
          @cell-format="emit('tableCellFormat', $event)"
          @cell-tab="emit('tableCellTab', $event)"
          @cell-navigate="emit('tableCellNavigate', $event)"
          @cell-selection-change="emit('tableCellSelectionChange', $event)"
        />

        <!-- Divider -->
        <div
          v-else-if="block.type === 'divider'"
          class="py-2.5 cursor-pointer"
          @click="emit('select')"
        >
          <hr class="border-gray-200 rounded" :class="{ '!border-indigo-400': selected }" />
        </div>

        <!-- Plain text blocks -->
        <EditorTextBlock
          v-else
          ref="inner"
          :block="block"
          :readonly="readonly"
          :placeholder="placeholder"
          @input="(s, c) => emit('input', s, c)"
          @enter="o => emit('enter', o)"
          @backspace-start="emit('backspaceStart')"
          @delete-end="emit('deleteEnd')"
          @arrow-up="emit('arrowUp')"
          @arrow-down="emit('arrowDown')"
          @tab="s => emit('tab', s)"
          @format="m => emit('format', m)"
          @pasted="p => emit('pasted', p)"
          @focus="emit('focus')"
          @selection-pointer-down="p => emit('selectionPointerDown', p)"
        />

        <EditorSelectionHighlight
          v-if="textHighlight"
          :target="textEditableEl"
          :start="textHighlight.start"
          :end="textHighlight.end"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.ebi-selected {
  background: rgb(99 102 241 / 0.06);
  border-radius: 6px;
}
.ebi-drop {
  position: absolute;
  inset-inline-start: 28px;
  inset-inline-end: 0;
  height: 3px;
  background: #818cf8;
  border-radius: 2px;
  z-index: 10;
  pointer-events: none;
}
.ebi-gutter-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: #c0c4cc;
  cursor: pointer;
  transition: background 0.1s, color 0.1s;
  padding: 0;
}
.ebi-gutter-btn:hover { background: #f3f4f6; color: #6b7280; }
.ebi-chevron-rtl {
  transform: scaleX(-1);
}
.ebi-chevron-rtl.rotate-90 {
  transform: scaleX(-1) rotate(90deg);
}
.ebi-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 12px;
  font-size: 13px;
  color: #374151;
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
}
.ebi-menu-item:hover { background: #f9fafb; }
</style>
