<script setup lang="ts">
import { GripVertical, Plus, ChevronRight } from 'lucide-vue-next'
import { ref, computed, watch, nextTick } from 'vue'
import { BUTTON_COLOR_PRESETS, isTextBlock, resolveBlockDirection } from '@xproeditor/core'
import type { Block, BlockType, InlineSpan, MarkName, TableCellCoord } from '@xproeditor/core'
import {
  IconEmojiPicker,
  IconValueDisplay,
} from '../ui'
import EditorAudioBlock from './EditorAudioBlock.vue'
import EditorBlockContextMenu from './EditorBlockContextMenu.vue'
import EditorBookmarkBlock from './EditorBookmarkBlock.vue'
import EditorButtonBlock from './EditorButtonBlock.vue'
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
  fetchBookmarkMeta?: (url: string) => Promise<{
    title?: string
    description?: string
    favicon?: string
    image?: string
  } | null | undefined>
  /** Shell / language direction fallback when block dir is auto. */
  editorDir?: 'ltr' | 'rtl'
  readonly?: boolean
  themeSource?: HTMLElement | null
  /** When set, opens the callout icon picker (slash command / programmatic). */
  iconPickerRequest?: { tab: 'emoji' | 'icon' } | null
  aiEnabled?: boolean
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
  copy: []
  cut: []
  remove: []
  turnInto: [type: BlockType]
  askAI: []
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

const inner = ref<InstanceType<typeof EditorTextBlock> | InstanceType<typeof EditorCodeBlock> | InstanceType<typeof EditorTableBlock> | InstanceType<typeof EditorButtonBlock> | null>(null)
const calloutIconPickerRef = ref<InstanceType<typeof IconEmojiPicker> | null>(null)
const showCalloutColors = ref(false)
const contextMenuPos = ref<{ x: number; y: number } | null>(null)

function openContextMenuAt(x: number, y: number) {
  emit('select')
  contextMenuPos.value = { x, y }
}

function onContextMenu(e: MouseEvent) {
  if (props.readonly) return
  e.preventDefault()
  openContextMenuAt(e.clientX, e.clientY)
}

function onHandleClick(e: MouseEvent) {
  e.preventDefault()
  e.stopPropagation()
  const target = e.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  openContextMenuAt(rect.right + 4, rect.top)
}

const colorPresets = computed(() => {
  if (props.block.type === 'callout') return CALLOUT_COLORS
  if (props.block.type === 'button') return [...BUTTON_COLOR_PRESETS]
  return undefined
})

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
    class="ebi group/block"
    :class="{ 'ebi-selected': selected }"
    :data-block-id="block.id"
    :dir="blockDir"
    :style="{ '--xpe-block-indent': indent }"
    @pointerdown="emit('pointerdown', $event)"
    @contextmenu="onContextMenu"
  >
    <!-- Drop indicator -->
    <div v-if="dropPosition === 'before'" class="ebi-drop -top-[2px]" />
    <div v-if="dropPosition === 'after'" class="ebi-drop -bottom-[2px]" />

    <div class="ebi-row">
      <!-- Gutter: + and drag handle -->
      <div
        v-if="!readonly"
        class="ebi-gutter"
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
        <button
          type="button"
          class="ebi-gutter-btn ebi-reorder-handle cursor-grab active:cursor-grabbing"
          title="Drag to move, click for menu"
          draggable="true"
          @pointerdown.stop
          @dragstart="emit('dragHandleStart', $event)"
          @click="onHandleClick"
        >
          <GripVertical class="w-3.5 h-3.5" />
        </button>
      </div>

      <!-- Block body -->
      <div class="ebi-body">
        <!-- Quote -->
        <div v-if="block.type === 'quote'" class="flex gap-3 border-s-[3px] border-[var(--xpe-foreground)] ps-3.5">
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
          class="flex items-start gap-2.5 rounded-[var(--xpe-radius)] border border-[var(--xpe-border)] px-3.5 py-3"
          :style="{ background: block.props.color ?? 'var(--xpe-muted)' }"
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
                  aria-label="Change callout icon"
                  title="Change callout icon"
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
              title="Change callout color"
              class="mt-1 block w-full text-[10px] text-[var(--xpe-muted-foreground)] transition-opacity hover:text-[var(--xpe-foreground)] focus-visible:opacity-100"
              :class="showCalloutColors ? 'opacity-100' : 'opacity-0 group-hover/block:opacity-100'"
              @click="showCalloutColors = !showCalloutColors"
            >
              Color
            </button>
            <div
              v-if="showCalloutColors && !readonly"
              class="absolute start-0 top-full z-[60] mt-1 rounded-[var(--xpe-radius)] border border-[var(--xpe-border)] bg-[var(--xpe-surface)] p-2 shadow-xl"
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

        <!-- Lists / to-do / toggle / toggle headings -->
        <div
          v-else-if="['bulleted_list_item', 'numbered_list_item', 'to_do', 'toggle', 'toggle_heading_1', 'toggle_heading_2', 'toggle_heading_3'].includes(block.type)"
          class="ebi-list-row"
        >
          <div
            class="ebi-list-marker"
            :class="{
              'ebi-list-marker--h1': block.type === 'toggle_heading_1',
              'ebi-list-marker--h2': block.type === 'toggle_heading_2',
              'ebi-list-marker--h3': block.type === 'toggle_heading_3',
            }"
            contenteditable="false"
          >
            <span v-if="block.type === 'bulleted_list_item'" class="ebi-list-bullet">•</span>
            <span v-else-if="block.type === 'numbered_list_item'" class="ebi-list-number">{{ number ?? 1 }}.</span>
            <button
              v-else-if="block.type === 'to_do'"
              type="button"
              role="checkbox"
              aria-label="Toggle to-do"
              :aria-checked="!!block.props.checked"
              class="ebi-todo"
              :class="{ 'ebi-todo--checked': block.props.checked }"
              :disabled="readonly"
              @click="emit('patch', { checked: !block.props.checked })"
            >
              <svg v-if="block.props.checked" width="10" height="10" class="shrink-0 text-[var(--xpe-primary-foreground)]" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" /></svg>
            </button>
            <button
              v-else
              type="button"
              :aria-label="block.props.collapsed ? 'Expand toggle' : 'Collapse toggle'"
              :aria-expanded="!block.props.collapsed"
              class="ebi-toggle-btn"
              :disabled="readonly"
              @click="emit('patch', { collapsed: !block.props.collapsed })"
            >
              <ChevronRight
                :size="14"
                class="shrink-0 transition-transform"
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
            :placeholder="placeholder ?? (
              block.type === 'to_do' ? 'To-do'
              : block.type === 'toggle' ? 'Toggle'
              : block.type === 'toggle_heading_1' ? 'Heading 1'
              : block.type === 'toggle_heading_2' ? 'Heading 2'
              : block.type === 'toggle_heading_3' ? 'Heading 3'
              : 'List item'
            )"
            class="flex-1 min-w-0"
            :class="{ 'line-through !text-[var(--xpe-muted-foreground)]': block.type === 'to_do' && block.props.checked }"
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
          <hr class="border-[var(--xpe-border)] rounded" :class="{ '!border-[var(--xpe-ring)]': selected }" />
        </div>

        <!-- Button -->
        <EditorButtonBlock
          v-else-if="block.type === 'button'"
          ref="inner"
          :block="block"
          :readonly="readonly"
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
          @patch="p => emit('patch', p)"
          @select="emit('select')"
        />

        <EditorBookmarkBlock
          v-else-if="block.type === 'bookmark'"
          :block="block"
          :selected="selected"
          :readonly="readonly"
          :fetch-bookmark-meta="fetchBookmarkMeta"
          @patch="p => emit('patch', p)"
          @select="emit('select')"
        />

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

    <EditorBlockContextMenu
      v-if="contextMenuPos"
      :position="contextMenuPos"
      :block-type="block.type"
      :theme-source="themeSource"
      :color-presets="colorPresets"
      :current-color="block.props.color"
      :can-turn-into="textual"
      :ai-enabled="aiEnabled"
      @color="c => emit('patch', { color: c })"
      @turn-into="t => emit('turnInto', t)"
      @duplicate="emit('duplicate')"
      @copy="emit('copy')"
      @cut="emit('cut')"
      @delete="emit('remove')"
      @insert-below="emit('addBelow')"
      @ask-ai="emit('askAI')"
      @close="contextMenuPos = null"
    />
  </div>
</template>

