<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import {
  parseBlocksFromClipboardData,
  writeBlocksToClipboardData,
  caretPointFromClient,
  getCaretClientRect,
  getSelectionClientRect,
  htmlToBlocks,
  createBlock, cloneBlock, spansToText, splitSpansAt, normalizeSpans,
  deleteRangeInSpans, applyMarkToRange, rangeHasMark, rangeMarkValue, sliceSpans,
  applyMarkToTextRange,
  deleteTextRange,
  extractTextRangeAsBlocks,
  fullBlockTextRange,
  getTextRangeSegments,
  isBlockFullySelected,
  isCrossBlockTextRange,
  isTextRangeCollapsed,
  rangeHasMarkAcrossSegments,
  rangeMarkValueAcrossSegments,
  computeListNumbering,
  normalizeTableData,
  nextVisibleCellCoord,
  patchTableCell,
  patchTableCellsBackground,
  patchTableStyle,
  isTextBlock,
  blockTypeForFile,
  fileToObjectUrl,
  mediaPropsFromFile,
} from '@xproeditor/core'
import type { TextPoint, TextRangeSelection, Block, BlockType, InlineSpan, MarkName, TableCellCoord, TableCellAlign, TableStyle } from '@xproeditor/core'
import EditorBlockItem from './EditorBlockItem.vue'
import EditorBubbleToolbar from './EditorBubbleToolbar.vue'
import EditorEmojiTriggerMenu from './EditorEmojiTriggerMenu.vue'
import type { FormatToolbarAlign, FormatToolbarState } from './EditorFormatToolbar.vue'
import EditorSlashMenu from './EditorSlashMenu.vue'
import type {SlashItem} from './EditorSlashMenu.vue';
import { EmojiPicker } from '../ui'
import { ALL_EMOJIS } from '../ui/emojiData'

const props = defineProps<{
  /** Live block array — the editor mutates it in place. */
  modelValue: Block[]
  upload?: (file: File) => Promise<string>
  pickMedia?: (options: {
    accept: string[]
    title?: string
  }) => Promise<{ url: string; alt?: string; caption?: string } | null>
  /** Default text direction for new blocks (from active content language). */
  editorDir?: 'ltr' | 'rtl'
  readonly?: boolean
  /** Floating bubble toolbar on text selection (disabled when using sticky format toolbar). */
  showBubbleToolbar?: boolean
}>()

const emit = defineEmits<{
  change: []
  'format-state': [state: FormatToolbarState | null]
}>()

const blocks = computed(() => props.modelValue)

function blockDirOptions(): { defaultDir?: 'ltr' | 'rtl' } | undefined {
  return props.editorDir === 'rtl' ? { defaultDir: 'rtl' } : undefined
}

function makeBlock(type: BlockType, partial: Partial<Block> = {}): Block {
  return createBlock(type, partial, blockDirOptions())
}

const rootEl = ref<HTMLElement | null>(null)
const focusedBlockId = ref<string | null>(null)
const selectedBlockId = ref<string | null>(null)
const focusedTableCell = ref<{ blockId: string; row: number; col: number } | null>(null)
const tableSelectedCells = ref<TableCellCoord[]>([])

const textRangeSelection = ref<TextRangeSelection | null>(null)
const managedTextSelection = ref(false)
/** Bumped after span mutations so format toolbar active-state stays in sync. */
const contentRevision = ref(0)
let dragSelectAnchor: TextPoint | null = null
let isDragSelecting = false

// ─── Item refs ────────────────────────────────────────────────────────────────

interface ItemApi {
  focusAt: (pos: number | 'start' | 'end') => void
  getSelection: () => { start: number; end: number } | null
  setSelection: (start: number, end?: number) => void
  textual: { value: boolean } | boolean
  getTableSelectedCells?: () => TableCellCoord[]
  setTableSelectedCells?: (cells: TableCellCoord[]) => void
  focusTableCell?: (row: number, col: number, pos?: number | 'start' | 'end') => void
  getTableCellSelection?: (row: number, col: number) => { start: number; end: number } | null
  setTableCellSelection?: (row: number, col: number, start: number, end?: number) => void
}

const itemRefs = new Map<string, ItemApi>()

function setItemRef(id: string, el: unknown) {
  if (el) {
itemRefs.set(id, el as ItemApi)
} else {
itemRefs.delete(id)
}
}

function byId(id: string): Block | undefined {
  return blocks.value.find(b => b.id === id)
}

function focusBlock(id: string, pos: number | 'start' | 'end') {
  const block = byId(id)

  if (!block) {
return
}

  if (!isTextBlock(block.type) && block.type !== 'code') {
    selectBlock(id)

    return
  }

  selectedBlockId.value = null
  nextTick(() => itemRefs.get(id)?.focusAt(pos))
}

function blockLength(block: Block): number {
  return isTextBlock(block.type) ? spansToText(block.content).length : 0
}

function hasActiveManagedSelection(): boolean {
  return managedTextSelection.value
    && textRangeSelection.value !== null
    && !isTextRangeCollapsed(textRangeSelection.value, visibleBlocks.value)
}

function textHighlightForBlock(id: string): { start: number; end: number } | null {
  if (!hasActiveManagedSelection() || !textRangeSelection.value) {
    return null
  }

  const segments = getTextRangeSegments(
    textRangeSelection.value,
    blocks.value,
    visibleBlocks.value,
  )
  const segment = segments.find(s => s.blockId === id)

  if (!segment) {
    return null
  }

  return { start: segment.start, end: segment.end }
}

function clearTextRangeSelection(): void {
  textRangeSelection.value = null
  managedTextSelection.value = false
}

function setManagedTextRange(anchor: TextPoint, focus: TextPoint) {
  textRangeSelection.value = { anchor, focus }
  managedTextSelection.value = true
  selectedBlockId.value = null
  focusedBlockId.value = null
  closeSlash()
  bubble.value = null
  window.getSelection()?.removeAllRanges()
}

function selectAllBlocks() {
  const range = fullBlockTextRange(visibleBlocks.value)

  if (!range) {
    return
  }

  setManagedTextRange(range.anchor, range.focus)
  nextTick(() => rootEl.value?.focus())
}

function deleteManagedTextRange() {
  if (!textRangeSelection.value) {
    return
  }

  const result = deleteTextRange(blocks.value, textRangeSelection.value, visibleBlocks.value)

  clearTextRangeSelection()
  ensureNotEmpty()
  pushHistory(true)

  if (result) {
    focusBlock(result.focusBlockId, result.focusOffset)
  } else {
    const first = visibleBlocks.value[0]

    if (first) {
      focusBlock(first.id, 'start')
    }
  }
}

function isAllTextBlocksSelected(): boolean {
  const textBlocks = visibleBlocks.value.filter(b => isTextBlock(b.type))

  if (textBlocks.length === 0 || !hasActiveManagedSelection() || !textRangeSelection.value) {
    return false
  }

  return textBlocks.every(b =>
    isBlockFullySelected(b.id, textRangeSelection.value!, blocks.value, visibleBlocks.value),
  )
}

function resolveSelectionAnchor(): TextPoint | null {
  if (textRangeSelection.value) {
    return textRangeSelection.value.anchor
  }

  if (focusedBlockId.value) {
    const sel = itemRefs.get(focusedBlockId.value)?.getSelection()

    return { blockId: focusedBlockId.value, offset: sel?.start ?? 0 }
  }

  if (selectedBlockId.value) {
    return { blockId: selectedBlockId.value, offset: 0 }
  }

  return null
}

function finalizeTextRangeSelection() {
  if (!textRangeSelection.value) {
    return
  }

  if (isCrossBlockTextRange(textRangeSelection.value, visibleBlocks.value)) {
    managedTextSelection.value = true
    window.getSelection()?.removeAllRanges()
    focusedBlockId.value = null

    return
  }

  const { anchor, focus } = textRangeSelection.value
  const start = Math.min(anchor.offset, focus.offset)
  const end = Math.max(anchor.offset, focus.offset)
  const blockId = anchor.blockId

  textRangeSelection.value = null
  managedTextSelection.value = false

  if (start !== end) {
    itemRefs.get(blockId)?.setSelection(start, end)
    focusedBlockId.value = blockId
  }
}

function onSelectionPointerDown(
  block: Block,
  payload: { shiftKey: boolean; clientX: number; clientY: number },
) {
  if (props.readonly || !isTextBlock(block.type) || !rootEl.value) {
    return
  }

  const point = caretPointFromClient(rootEl.value, payload.clientX, payload.clientY)

  if (!point) {
    return
  }

  if (payload.shiftKey) {
    const anchor = resolveSelectionAnchor() ?? point

    if (point.blockId === anchor.blockId) {
      const start = Math.min(anchor.offset, point.offset)
      const end = Math.max(anchor.offset, point.offset)
      clearTextRangeSelection()
      itemRefs.get(point.blockId)?.setSelection(start, end)
      focusedBlockId.value = point.blockId

      return
    }

    setManagedTextRange(anchor, point)

    return
  }

  if (hasActiveManagedSelection()) {
    clearTextRangeSelection()
  }

  isDragSelecting = true
  dragSelectAnchor = point
  textRangeSelection.value = { anchor: point, focus: point }
  managedTextSelection.value = false
}

function isEditorOverlayTarget(target: HTMLElement): boolean {
  return !!target.closest(
    '[data-slot="popover-content"], [data-slot="popover-anchor"], [data-slot="dropdown-menu-content"], [data-slot="dialog-content"]',
  )
}

function isFormatToolbarTarget(target: HTMLElement): boolean {
  return !!target.closest('[data-pro-editor-toolbar]')
}

function isNativeInputTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return !!target.closest('input, textarea, select, [contenteditable="true"]')
}

function shouldKeepNativeFocus(): boolean {
  const active = document.activeElement

  if (!(active instanceof HTMLElement)) {
    return false
  }

  if (isEditorOverlayTarget(active)) {
    return true
  }

  return !!active.closest('input, textarea, select, [role="combobox"], [role="listbox"]')
}

function selectBlock(id: string) {
  clearTextRangeSelection()
  selectedBlockId.value = id
  focusedBlockId.value = null
  closeSlash()
  bubble.value = null
  window.getSelection()?.removeAllRanges()
  nextTick(() => {
    if (shouldKeepNativeFocus()) {
      return
    }

    rootEl.value?.focus()
  })
}

// ─── Visibility (collapsed toggles) & numbering ──────────────────────────────

const visibleBlocks = computed<Block[]>(() => {
  const out: Block[] = []
  let hideDeeperThan: number | null = null

  for (const b of blocks.value) {
    const ind = b.props.indent ?? 0

    if (hideDeeperThan !== null) {
      if (ind > hideDeeperThan) {
continue
}

      hideDeeperThan = null
    }

    out.push(b)

    if (b.type === 'toggle' && b.props.collapsed) {
hideDeeperThan = ind
}
  }

  return out
})

const numbering = computed<Map<string, number>>(() => computeListNumbering(visibleBlocks.value))

function visibleIndex(id: string): number {
  return visibleBlocks.value.findIndex(b => b.id === id)
}

function neighborBlock(id: string, dir: 1 | -1): Block | null {
  const idx = visibleIndex(id)

  if (idx === -1) {
return null
}

  return visibleBlocks.value[idx + dir] ?? null
}

// ─── History (undo / redo) ────────────────────────────────────────────────────

const history = ref<string[]>([])
const historyIndex = ref(0)
let historyTimer: ReturnType<typeof setTimeout> | null = null

const canUndo = computed(() => historyIndex.value > 0 || historyTimer !== null)
const canRedo = computed(() => historyIndex.value < history.value.length - 1)

function snapshot(): string {
  return JSON.stringify(blocks.value)
}

function commitSnapshot() {
  if (historyTimer) {
 clearTimeout(historyTimer); historyTimer = null 
}

  const snap = snapshot()

  if (history.value[historyIndex.value] === snap) {
return
}

  history.value = history.value.slice(0, historyIndex.value + 1)
  history.value.push(snap)

  if (history.value.length > 200) {
history.value.shift()
}

  historyIndex.value = history.value.length - 1
}

function pushHistory(immediate = false) {
  if (props.readonly) {
return
}

  emit('change')

  if (immediate) {
    commitSnapshot()
  } else {
    if (historyTimer) {
clearTimeout(historyTimer)
}

    historyTimer = setTimeout(commitSnapshot, 400)
  }
}

function restoreSnapshot(json: string) {
  const arr = JSON.parse(json) as Block[]
  blocks.value.splice(0, blocks.value.length, ...arr)
  ensureNotEmpty()
  emit('change')
}

function undo() {
  if (historyTimer) {
commitSnapshot()
}

  if (historyIndex.value <= 0) {
return
}

  historyIndex.value -= 1
  restoreSnapshot(history.value[historyIndex.value])
}

function redo() {
  if (historyIndex.value >= history.value.length - 1) {
return
}

  historyIndex.value += 1
  restoreSnapshot(history.value[historyIndex.value])
}

function resetHistory() {
  if (historyTimer) {
 clearTimeout(historyTimer); historyTimer = null 
}

  history.value = [snapshot()]
  historyIndex.value = 0
}

function ensureNotEmpty() {
  if (blocks.value.length === 0) {
    blocks.value.push(makeBlock('paragraph'))
  }
}

watch(() => props.modelValue, () => {
  ensureNotEmpty()
  resetHistory()
})

watch(() => props.readonly, (value) => {
  if (value) {
    closeSlash()
    bubble.value = null
    selectedBlockId.value = null
    clearTextRangeSelection()
  }
})

onMounted(() => {
  ensureNotEmpty()
  resetHistory()
  document.addEventListener('selectionchange', onSelectionChange)
  document.addEventListener('mousedown', onDocMouseDown)
  document.addEventListener('pointermove', onDocPointerMove)
  document.addEventListener('pointerup', onDocPointerUp)
})

onBeforeUnmount(() => {
  document.removeEventListener('selectionchange', onSelectionChange)
  document.removeEventListener('mousedown', onDocMouseDown)
  document.removeEventListener('pointermove', onDocPointerMove)
  document.removeEventListener('pointerup', onDocPointerUp)

  if (historyTimer) {
clearTimeout(historyTimer)
}
})

// ─── Slash menu ───────────────────────────────────────────────────────────────

interface SlashState {
  blockId: string
  index: number
  query: string
  position: { x: number; y: number; top?: number }
}

const slashState = ref<SlashState | null>(null)
const slashMenuRef = ref<InstanceType<typeof EditorSlashMenu> | null>(null)
const iconPickerRequest = ref<{ blockId: string; tab: 'emoji' | 'icon' } | null>(null)

function closeSlash() {
  slashState.value = null
}

function slashPosition(): { x: number; y: number; top?: number } {
  // Raw caret anchor; the menu measures itself and flips/clamps to the viewport.
  const rect = getCaretClientRect()

  return { x: rect?.left ?? 100, y: rect?.bottom ?? 100, top: rect?.top ?? 100 }
}

function updateSlash(block: Block, spans: InlineSpan[], caret: number | null) {
  const text = spansToText(spans)
  const state = slashState.value

  if (state && state.blockId === block.id) {
    if (caret === null || caret <= state.index || text[state.index] !== '/') {
      closeSlash()

      return
    }

    const query = text.slice(state.index + 1, caret)

    if (/\s/.test(query) || query.length > 24) {
      closeSlash()

      return
    }

    state.query = query

    return
  }

  if (caret !== null && caret > 0 && text[caret - 1] === '/') {
    const before = caret >= 2 ? text[caret - 2] : ''

    if (before === '' || /\s/.test(before)) {
      slashState.value = { blockId: block.id, index: caret - 1, query: '', position: slashPosition() }
    }
  }
}

function onSlashSelect(item: SlashItem) {
  const state = slashState.value

  if (!state) {
return
}

  const block = byId(state.blockId)
  closeSlash()

  if (!block) {
return
}

  const removeEnd = state.index + 1 + state.query.length
  const spans = deleteRangeInSpans(block.content, state.index, removeEnd)
  const isInsertType = ['divider', 'image', 'video', 'audio', 'file', 'table', 'code'].includes(item.type)

  if (!isInsertType) {
    const defaults = makeBlock(item.type)
    block.type = item.type
    block.content = spans
    block.props = { ...defaults.props, indent: block.props.indent, dir: block.props.dir }
    pushHistory(true)
    focusBlock(block.id, Math.min(state.index, spansToText(spans).length))

    if (item.pickIcon) {
      iconPickerRequest.value = { blockId: block.id, tab: item.pickIcon }
    }

    return
  }

  const newBlock = makeBlock(item.type)

  if (spansToText(spans).trim() === '') {
    const idx = blocks.value.indexOf(block)
    blocks.value.splice(idx, 1, newBlock)
  } else {
    block.content = spans
    const idx = blocks.value.indexOf(block)
    blocks.value.splice(idx + 1, 0, newBlock)
  }

  pushHistory(true)

  if (item.type === 'code') {
focusBlock(newBlock.id, 'start')
} else {
selectBlock(newBlock.id)
}
}

// ─── Inline emoji trigger (":" — Slack/Discord-style) ──────────────────────────

interface EmojiTriggerState {
  blockId: string
  index: number
  query: string
  position: { x: number; y: number; top?: number }
}

const emojiTriggerState = ref<EmojiTriggerState | null>(null)

function closeEmojiTrigger() {
  emojiTriggerState.value = null
}

function updateEmojiTrigger(block: Block, spans: InlineSpan[], caret: number | null) {
  const text = spansToText(spans)
  const state = emojiTriggerState.value

  if (state && state.blockId === block.id) {
    if (caret === null || caret <= state.index || text[state.index] !== ':') {
      closeEmojiTrigger()

      return
    }

    const query = text.slice(state.index + 1, caret)

    if (/\s/.test(query) || query.length > 20) {
      closeEmojiTrigger()

      return
    }

    state.query = query

    return
  }

  if (caret !== null && caret > 0 && text[caret - 1] === ':') {
    const before = caret >= 2 ? text[caret - 2] : ''

    if (before === '' || /\s/.test(before)) {
      emojiTriggerState.value = { blockId: block.id, index: caret - 1, query: '', position: slashPosition() }
    }
  }
}

function onEmojiTriggerSelect(emoji: string) {
  const state = emojiTriggerState.value

  if (!state) {
return
}

  const block = byId(state.blockId)
  closeEmojiTrigger()

  if (!block) {
return
}

  const removeEnd = state.index + 1 + state.query.length
  const withoutTrigger = deleteRangeInSpans(block.content, state.index, removeEnd)
  block.content = insertSpansAt(withoutTrigger, state.index, [{ text: emoji }])
  pushHistory(true)
  focusBlock(block.id, state.index + emoji.length)
}

// ─── Markdown shortcuts ───────────────────────────────────────────────────────

const MD_PATTERNS: Array<{ prefix: string; type: BlockType }> = [
  { prefix: '### ', type: 'heading_3' },
  { prefix: '## ', type: 'heading_2' },
  { prefix: '# ', type: 'heading_1' },
  { prefix: '- ', type: 'bulleted_list_item' },
  { prefix: '* ', type: 'bulleted_list_item' },
  { prefix: '1. ', type: 'numbered_list_item' },
  { prefix: '[] ', type: 'to_do' },
  { prefix: '[ ] ', type: 'to_do' },
  { prefix: '> ', type: 'quote' },
]

function tryMarkdownShortcut(block: Block, spans: InlineSpan[], caret: number | null): boolean {
  if (block.type !== 'paragraph' || caret === null) {
return false
}

  const text = spansToText(spans)

  if (text === '```' && caret === 3) {
    const defaults = makeBlock('code')
    block.type = 'code'
    block.content = []
    block.props = { ...defaults.props, indent: block.props.indent }
    pushHistory(true)
    focusBlock(block.id, 'start')

    return true
  }

  if (text === '---' && caret === 3) {
    block.type = 'divider'
    block.content = []
    const idx = blocks.value.indexOf(block)
    const nb = makeBlock('paragraph')
    blocks.value.splice(idx + 1, 0, nb)
    pushHistory(true)
    focusBlock(nb.id, 'start')

    return true
  }

  for (const { prefix, type } of MD_PATTERNS) {
    if (caret === prefix.length && text.startsWith(prefix)) {
      const defaults = makeBlock(type)
      block.type = type
      block.content = deleteRangeInSpans(spans, 0, prefix.length)
      block.props = { ...defaults.props, indent: block.props.indent, dir: block.props.dir }
      pushHistory(true)
      focusBlock(block.id, 'start')

      return true
    }
  }

  return false
}

// ─── Text events ──────────────────────────────────────────────────────────────

function handleInput(block: Block, spans: InlineSpan[], caret: number | null) {
  if (props.readonly) {
return
}

  block.content = spans

  // Direction stays 'auto' unless the user sets it explicitly — rendering
  // resolves it live from content (resolveBlockDirection), so a block flips
  // between RTL and LTR as its text changes instead of locking on first input.

  if (tryMarkdownShortcut(block, spans, caret)) {
    closeSlash()
    closeEmojiTrigger()

    return
  }

  updateSlash(block, spans, caret)

  if (slashState.value) {
    closeEmojiTrigger()
  } else {
    updateEmojiTrigger(block, spans, caret)
  }

  pushHistory()
}

function handleEnter(block: Block, offsets: { start: number; end: number }) {
  const idx = blocks.value.indexOf(block)

  if (idx === -1) {
return
}

  const text = spansToText(block.content)
  const listLike = ['bulleted_list_item', 'numbered_list_item', 'to_do', 'toggle', 'quote', 'callout']

  // Enter on an empty list-like block: outdent or exit to paragraph
  if (listLike.includes(block.type) && text === '') {
    const ind = block.props.indent ?? 0

    if (ind > 0) {
block.props.indent = ind - 1
} else {
block.type = 'paragraph'
}

    pushHistory(true)
    focusBlock(block.id, 'start')

    return
  }

  const [before, rest] = splitSpansAt(block.content, offsets.start)
  const [, after] = splitSpansAt(rest, offsets.end - offsets.start)
  block.content = before

  const keepType = ['bulleted_list_item', 'numbered_list_item', 'to_do', 'quote']
  let newType: BlockType = 'paragraph'

  if (keepType.includes(block.type)) {
newType = block.type
} else if (block.type.startsWith('heading') && spansToText(after).length > 0) {
newType = block.type
}

  const newProps: Block['props'] = {}

  if (block.props.indent) {
newProps.indent = block.props.indent
}

  if (block.props.dir && block.props.dir !== 'auto') {
newProps.dir = block.props.dir
}

  if (block.type === 'toggle') {
    newProps.indent = (block.props.indent ?? 0) + 1
    block.props.collapsed = false
  }

  const nb = makeBlock(newType, { content: after, props: newProps })
  blocks.value.splice(idx + 1, 0, nb)
  pushHistory(true)
  focusBlock(nb.id, 'start')
}

function handleBackspaceStart(block: Block) {
  const idx = blocks.value.indexOf(block)

  if (idx === -1) {
return
}

  if (isTextBlock(block.type) && block.type !== 'paragraph') {
    block.type = 'paragraph'
    pushHistory(true)
    focusBlock(block.id, 'start')

    return
  }

  if ((block.props.indent ?? 0) > 0) {
    block.props.indent = (block.props.indent ?? 0) - 1
    pushHistory(true)
    focusBlock(block.id, 'start')

    return
  }

  const prev = neighborBlock(block.id, -1)

  if (!prev) {
return
}

  if (isTextBlock(prev.type)) {
    const prevLen = spansToText(prev.content).length
    prev.content = normalizeSpans([...prev.content, ...block.content])
    blocks.value.splice(idx, 1)
    pushHistory(true)
    focusBlock(prev.id, prevLen)
  } else if (prev.type === 'divider') {
    blocks.value.splice(blocks.value.indexOf(prev), 1)
    pushHistory(true)
    focusBlock(block.id, 'start')
  } else if (spansToText(block.content) === '') {
    blocks.value.splice(idx, 1)
    pushHistory(true)

    if (prev.type === 'code') {
focusBlock(prev.id, 'end')
} else {
selectBlock(prev.id)
}
  } else {
    if (prev.type === 'code') {
focusBlock(prev.id, 'end')
} else {
selectBlock(prev.id)
}
  }
}

function handleDeleteEnd(block: Block) {
  const next = neighborBlock(block.id, 1)

  if (!next) {
return
}

  if (isTextBlock(next.type)) {
    const len = spansToText(block.content).length
    block.content = normalizeSpans([...block.content, ...next.content])
    blocks.value.splice(blocks.value.indexOf(next), 1)
    pushHistory(true)
    focusBlock(block.id, len)
  } else if (next.type === 'divider') {
    blocks.value.splice(blocks.value.indexOf(next), 1)
    pushHistory(true)
  }
}

function handleTab(block: Block, shift: boolean) {
  const current = block.props.indent ?? 0
  const next = Math.max(0, Math.min(6, current + (shift ? -1 : 1)))

  if (next === current) {
return
}

  if (next === 0) {
delete block.props.indent
} else {
block.props.indent = next
}

  pushHistory(true)
}

function handleArrow(block: Block, dir: 1 | -1) {
  const neighbor = neighborBlock(block.id, dir)

  if (!neighbor) {
return
}

  if (isTextBlock(neighbor.type)) {
focusBlock(neighbor.id, dir === 1 ? 'start' : 'end')
} else if (neighbor.type === 'code') {
focusBlock(neighbor.id, dir === 1 ? 'start' : 'end')
} else {
selectBlock(neighbor.id)
}
}

function handleFormat(block: Block, mark: MarkName) {
  if (hasActiveManagedSelection() && textRangeSelection.value) {
    const has = rangeHasMarkAcrossSegments(
      textRangeSelection.value,
      blocks.value,
      visibleBlocks.value,
      mark,
    )
    applyMarkToTextRange(
      blocks.value,
      textRangeSelection.value,
      visibleBlocks.value,
      mark,
      has ? null : true,
    )
    pushHistory(true)
    contentRevision.value++

    return
  }

  const sel = itemRefs.get(block.id)?.getSelection()

  if (!sel || sel.start === sel.end) {
return
}

  const has = rangeHasMark(block.content, sel.start, sel.end, mark)
  block.content = applyMarkToRange(block.content, sel.start, sel.end, mark, has ? null : true)
  pushHistory(true)
  nextTick(() => itemRefs.get(block.id)?.setSelection(sel.start, sel.end))
}

// ─── Paste ────────────────────────────────────────────────────────────────────

function insertSpansAt(content: InlineSpan[], offset: number, inserted: InlineSpan[]): InlineSpan[] {
  const [before, after] = splitSpansAt(content, offset)

  return normalizeSpans([...before, ...inserted, ...after])
}

/** Insert dropped/pasted files as media blocks (image/video/audio/file by MIME). */
async function insertFileBlocks(files: File[], at: number) {
  const doUpload = props.upload ?? fileToObjectUrl

  for (const [i, file] of files.entries()) {
    const type = blockTypeForFile(file)
    const url = await doUpload(file)
    const media = mediaPropsFromFile(file, url)
    const extra = type === 'video' ? { provider: 'file' as const } : {}
    blocks.value.splice(at + i, 0, makeBlock(type, { props: { ...media, ...extra } }))
  }

  pushHistory(true)
}

async function handlePasted(
  block: Block,
  payload: { html: string; text: string; files: File[]; offsets: { start: number; end: number } },
) {
  const idx = blocks.value.indexOf(block)

  if (idx === -1) {
return
}

  // Files (image / video / audio / anything else) become media blocks
  if (payload.files.length > 0) {
    await insertFileBlocks(payload.files, idx + 1)

    return
  }

  let content = block.content

  if (payload.offsets.end > payload.offsets.start) {
    content = deleteRangeInSpans(content, payload.offsets.start, payload.offsets.end)
  }

  const at = payload.offsets.start

  const pastedBlocks = payload.html && payload.html.includes('<') ? htmlToBlocks(payload.html) : []

  if (pastedBlocks.length === 0) {
    const text = payload.text

    if (!text) {
return
}

    const lines = text.split(/\r?\n/)

    if (lines.length === 1 || !isTextBlock(block.type)) {
      block.content = insertSpansAt(content, at, [{ text }])
      pushHistory(true)
      focusBlock(block.id, at + text.length)
    } else {
      block.content = insertSpansAt(content, at, [{ text: lines[0] }])
      const newOnes = lines.slice(1).map(line => makeBlock('paragraph', { content: line ? [{ text: line }] : [] }))
      blocks.value.splice(idx + 1, 0, ...newOnes)
      pushHistory(true)
      const last = newOnes[newOnes.length - 1]
      focusBlock(last.id, 'end')
    }

    return
  }

  const [first, ...others] = pastedBlocks

  if (first.type === 'paragraph' || spansToText(block.content).length > 0) {
    if (isTextBlock(first.type)) {
      block.content = insertSpansAt(content, at, first.content)
    } else {
      others.unshift(first)
      block.content = content
    }
  } else {
    others.unshift(first)
    block.content = content
  }

  if (others.length > 0) {
    blocks.value.splice(idx + 1, 0, ...others)
    pushHistory(true)
    const last = others[others.length - 1]

    if (isTextBlock(last.type)) {
focusBlock(last.id, 'end')
}
  } else {
    pushHistory(true)
    focusBlock(block.id, at + spansToText(first.content).length)
  }
}

// ─── Clipboard (multi-block copy / cut / paste) ─────────────────────────────

function getBlocksForClipboard(): Block[] | null {
  if (hasActiveManagedSelection() && textRangeSelection.value) {
    const extracted = extractTextRangeAsBlocks(
      textRangeSelection.value,
      blocks.value,
      visibleBlocks.value,
    )

    return extracted.length > 0 ? extracted : null
  }

  if (selectedBlockId.value) {
    const block = byId(selectedBlockId.value)

    return block ? [block] : null
  }

  return null
}

function focusAfterPaste(pasted: Block[]) {
  const last = pasted[pasted.length - 1]

  if (!last) {
return
}

  if (isTextBlock(last.type) || last.type === 'code') {
focusBlock(last.id, 'end')
} else {
selectBlock(last.id)
}
}

function insertPastedInTextBlock(block: Block, pasted: Block[], offset: number) {
  const idx = blocks.value.indexOf(block)

  if (idx === -1) {
    return
  }

  const [before, afterParts] = splitSpansAt(block.content, offset)
  const first = pasted[0]
  const rest = pasted.slice(1)

  if (!first) {
    return
  }

  if (isTextBlock(first.type)) {
    block.content = normalizeSpans([...before, ...first.content])
    const toInsert = [...rest]

    if (spansToText(afterParts).length > 0) {
      if (rest.length > 0) {
        const last = rest[rest.length - 1]

        if (isTextBlock(last.type)) {
          last.content = normalizeSpans([...last.content, ...afterParts])
        } else {
          toInsert.push(makeBlock('paragraph', { content: afterParts }))
        }
      } else {
        block.content = normalizeSpans([...block.content, ...afterParts])
      }
    }

    if (toInsert.length > 0) {
      blocks.value.splice(idx + 1, 0, ...toInsert)
    }
  } else {
    block.content = before
    const trailing = spansToText(afterParts).length > 0
      ? [makeBlock('paragraph', { content: afterParts })]
      : []
    blocks.value.splice(idx + 1, 0, ...pasted, ...trailing)
  }
}

function insertBlocksFromClipboard(pasted: Block[]) {
  if (pasted.length === 0) {
return
}

  if (hasActiveManagedSelection() && textRangeSelection.value) {
    const deleteResult = deleteTextRange(blocks.value, textRangeSelection.value, visibleBlocks.value)

    clearTextRangeSelection()
    ensureNotEmpty()

    if (deleteResult) {
      const block = byId(deleteResult.focusBlockId)

      if (block && isTextBlock(block.type)) {
        insertPastedInTextBlock(block, pasted, deleteResult.focusOffset)
        pushHistory(true)
        focusAfterPaste(pasted)

        return
      }
    }
  }

  if (focusedBlockId.value) {
    const block = byId(focusedBlockId.value)

    if (block && isTextBlock(block.type)) {
      const offsets = itemRefs.get(block.id)?.getSelection() ?? { start: 0, end: 0 }
      let offset = offsets.start

      if (offsets.end > offsets.start) {
        block.content = deleteRangeInSpans(block.content, offsets.start, offsets.end)
      } else {
        offset = offsets.start
      }

      insertPastedInTextBlock(block, pasted, offset)
      pushHistory(true)
      focusAfterPaste(pasted)

      return
    }

    if (block) {
      const idx = blocks.value.indexOf(block)
      blocks.value.splice(idx + 1, 0, ...pasted)
      pushHistory(true)
      focusAfterPaste(pasted)

      return
    }
  }

  if (selectedBlockId.value) {
    const idx = blocks.value.findIndex(b => b.id === selectedBlockId.value)

    if (idx !== -1) {
      blocks.value.splice(idx + 1, 0, ...pasted)
      selectedBlockId.value = null
      pushHistory(true)
      focusAfterPaste(pasted)

      return
    }
  }

  blocks.value.push(...pasted)
  ensureNotEmpty()
  pushHistory(true)
  focusAfterPaste(pasted)
}

function removeBlocksForCut() {
  if (hasActiveManagedSelection()) {
    deleteManagedTextRange()

    return
  }

  if (selectedBlockId.value) {
    const block = byId(selectedBlockId.value)

    if (block) {
removeBlock(block)
}
  }
}

function onCopy(e: ClipboardEvent) {
  if (props.readonly || isNativeInputTarget(e.target)) {
return
}

  const toCopy = getBlocksForClipboard()

  if (!toCopy?.length || !e.clipboardData) {
return
}

  e.preventDefault()
  writeBlocksToClipboardData(e.clipboardData, toCopy)
}

function onCut(e: ClipboardEvent) {
  if (props.readonly || isNativeInputTarget(e.target)) {
return
}

  const toCopy = getBlocksForClipboard()

  if (!toCopy?.length || !e.clipboardData) {
return
}

  e.preventDefault()
  writeBlocksToClipboardData(e.clipboardData, toCopy)
  removeBlocksForCut()
}

function onPaste(e: ClipboardEvent) {
  if (props.readonly || !e.clipboardData || isNativeInputTarget(e.target)) {
return
}

  const nativeBlocks = parseBlocksFromClipboardData(e.clipboardData)

  if (nativeBlocks?.length) {
    e.preventDefault()
    e.stopPropagation()
    insertBlocksFromClipboard(nativeBlocks)

    return
  }

  if (hasActiveManagedSelection() || selectedBlockId.value) {
    const html = e.clipboardData.getData('text/html')
    const text = e.clipboardData.getData('text/plain')
    const external = html && html.includes('<') ? htmlToBlocks(html) : []

    if (external.length > 0) {
      e.preventDefault()
      e.stopPropagation()
      insertBlocksFromClipboard(external)

      return
    }

    if (text) {
      const lines = text.split(/\r?\n/)
      const lineBlocks = lines.map(line => makeBlock('paragraph', { content: line ? [{ text: line }] : [] }))
      e.preventDefault()
      e.stopPropagation()
      insertBlocksFromClipboard(lineBlocks)
    }
  }
}

// ─── Block utilities (gutter / menu actions) ─────────────────────────────────

function addBelow(block: Block) {
  if (props.readonly) {
return
}

  const idx = blocks.value.indexOf(block)
  const nb = makeBlock('paragraph', { props: block.props.indent ? { indent: block.props.indent } : {} })
  blocks.value.splice(idx + 1, 0, nb)
  pushHistory(true)
  focusBlock(nb.id, 'start')
}

function duplicateBlock(block: Block) {
  if (props.readonly) {
return
}

  const idx = blocks.value.indexOf(block)
  blocks.value.splice(idx + 1, 0, cloneBlock(block))
  pushHistory(true)
}

function removeBlock(block: Block) {
  if (props.readonly) {
return
}

  const idx = blocks.value.indexOf(block)

  if (idx === -1) {
return
}

  const prev = neighborBlock(block.id, -1)
  const next = neighborBlock(block.id, 1)
  blocks.value.splice(idx, 1)
  ensureNotEmpty()
  pushHistory(true)
  const target = prev ?? next ?? blocks.value[0]

  if (target) {
    if (isTextBlock(target.type) || target.type === 'code') {
focusBlock(target.id, 'end')
} else {
selectBlock(target.id)
}
  }

  if (selectedBlockId.value === block.id) {
selectedBlockId.value = null
}
}

function patchProps(block: Block, patch: Record<string, unknown>) {
  Object.assign(block.props, patch)
  pushHistory(true)
  contentRevision.value++
  emit('change')
}

function getTableCellContext(blockId: string) {
  const block = byId(blockId)

  if (!block || block.type !== 'table') {
    return null
  }

  const table = normalizeTableData(block.props.table)
  const focus = focusedTableCell.value?.blockId === blockId
    ? focusedTableCell.value
    : tableSelectedCells.value[0]
      ? { blockId, row: tableSelectedCells.value[0].row, col: tableSelectedCells.value[0].col }
      : null

  if (!focus) {
    return null
  }

  const cell = table.rows[focus.row]?.[focus.col]

  if (!cell || cell.hidden) {
    return null
  }

  return { block, table, row: focus.row, col: focus.col, cell }
}


function onTableCellFocus(block: Block, payload: { row: number; col: number; shiftKey: boolean }) {
  focusedBlockId.value = block.id
  focusedTableCell.value = { blockId: block.id, row: payload.row, col: payload.col }
  selectedBlockId.value = null
}

function onTableCellSelectionChange(_block: Block, cells: TableCellCoord[]) {
  tableSelectedCells.value = cells

  if (cells[0]) {
    focusedTableCell.value = { blockId: _block.id, row: cells[0].row, col: cells[0].col }
  }
}

function onTableCellInput(
  block: Block,
  payload: { row: number; col: number; content: InlineSpan[]; caret: number | null },
) {
  const table = normalizeTableData(block.props.table)
  const cell = table.rows[payload.row]?.[payload.col]

  if (!cell || cell.hidden) {
    return
  }

  cell.content = payload.content
  block.props.table = table
  contentRevision.value++
  emit('change')
}

function handleTableFormat(
  block: Block,
  payload: { row: number; col: number; mark: MarkName },
) {
  const sel = itemRefs.get(block.id)?.getTableCellSelection?.(payload.row, payload.col)

  if (!sel || sel.start === sel.end) {
    return
  }

  const table = normalizeTableData(block.props.table)
  const cell = table.rows[payload.row]?.[payload.col]

  if (!cell || cell.hidden) {
    return
  }

  const has = rangeHasMark(cell.content, sel.start, sel.end, payload.mark)
  cell.content = applyMarkToRange(cell.content, sel.start, sel.end, payload.mark, has ? null : true)
  block.props.table = table
  pushHistory(true)
  contentRevision.value++
  nextTick(() => itemRefs.get(block.id)?.setTableCellSelection?.(payload.row, payload.col, sel.start, sel.end))
}

function handleTableTab(
  block: Block,
  payload: { row: number; col: number; shift: boolean },
) {
  const table = normalizeTableData(block.props.table)
  const next = nextVisibleCellCoord(table, payload.row, payload.col, payload.shift ? -1 : 1)

  if (!next) {
    return
  }

  focusedTableCell.value = { blockId: block.id, row: next.row, col: next.col }
  tableSelectedCells.value = [{ row: next.row, col: next.col }]
  nextTick(() => itemRefs.get(block.id)?.focusTableCell?.(next.row, next.col, 'start'))
}

function handleTableNavigate(
  block: Block,
  payload: { row: number; col: number; direction: 'up' | 'down' | 'left' | 'right' },
) {
  const table = normalizeTableData(block.props.table)

  if (payload.direction === 'up' || payload.direction === 'down') {
    const delta = payload.direction === 'up' ? -1 : 1
    const targetRow = payload.row + delta
    const targetCell = table.rows[targetRow]?.[payload.col]

    if (targetCell && !targetCell.hidden) {
      focusedTableCell.value = { blockId: block.id, row: targetRow, col: payload.col }
      tableSelectedCells.value = [{ row: targetRow, col: payload.col }]
      nextTick(() => itemRefs.get(block.id)?.focusTableCell?.(targetRow, payload.col, payload.direction === 'up' ? 'end' : 'start'))

      return
    }

    handleArrow(block, payload.direction === 'up' ? -1 : 1)

    return
  }

  const delta = payload.direction === 'left' ? -1 : 1
  const next = nextVisibleCellCoord(table, payload.row, payload.col, delta as 1 | -1)

  if (next) {
    focusedTableCell.value = { blockId: block.id, row: next.row, col: next.col }
    tableSelectedCells.value = [{ row: next.row, col: next.col }]
    nextTick(() => itemRefs.get(block.id)?.focusTableCell?.(next.row, next.col, payload.direction === 'left' ? 'end' : 'start'))
  }
}

function patchTableStyleForFocused(partial: Partial<TableStyle>) {
  const blockId = focusedTableCell.value?.blockId ?? focusedBlockId.value

  if (!blockId) {
    return
  }

  const block = byId(blockId)

  if (!block || block.type !== 'table') {
    return
  }

  block.props.table = patchTableStyle(normalizeTableData(block.props.table), partial)
  pushHistory(true)
  contentRevision.value++
  emit('change')
}

function patchTableCellBackgroundForFocused(color: string | null) {
  const blockId = focusedTableCell.value?.blockId ?? focusedBlockId.value

  if (!blockId) {
    return
  }

  const block = byId(blockId)

  if (!block || block.type !== 'table') {
    return
  }

  const cells = tableSelectedCells.value.length > 0
    ? tableSelectedCells.value
    : focusedTableCell.value
      ? [{ row: focusedTableCell.value.row, col: focusedTableCell.value.col }]
      : []

  if (cells.length === 0) {
    return
  }

  block.props.table = patchTableCellsBackground(normalizeTableData(block.props.table), cells, color)
  pushHistory(true)
  contentRevision.value++
  emit('change')
}

function applyMarkToFocusedTableCell(mark: MarkName, value: boolean | string | null) {
  const context = focusedTableCell.value
    ? getTableCellContext(focusedTableCell.value.blockId)
    : null

  if (!context) {
    return
  }

  const sel = itemRefs.get(context.block.id)?.getTableCellSelection?.(context.row, context.col)

  if (!sel || sel.start === sel.end) {
    return
  }

  const booleanMarks = ['bold', 'italic', 'underline', 'strikethrough', 'code'] as MarkName[]
  let markValue: boolean | string | null = value === false ? null : value

  if (booleanMarks.includes(mark) && typeof value === 'boolean') {
    markValue = rangeHasMark(context.cell.content, sel.start, sel.end, mark) ? null : true
  }

  context.cell.content = applyMarkToRange(context.cell.content, sel.start, sel.end, mark, markValue)
  context.block.props.table = context.table
  pushHistory(true)
  contentRevision.value++

  const preserveEditorFocus = mark === 'color' || mark === 'highlight' || mark === 'link'

  if (!preserveEditorFocus) {
    nextTick(() => itemRefs.get(context.block.id)?.setTableCellSelection?.(context.row, context.col, sel.start, sel.end))
  }
}

// ─── Bubble toolbar ───────────────────────────────────────────────────────────

interface BubbleState {
  blockId: string
  range: { start: number; end: number }
  position: { x: number; y: number }
  activeMarks: Partial<Record<MarkName, boolean>>
  currentLink: string | null
  currentColor: string | null
  currentHighlight: string | null
  blockType: BlockType
}

const bubble = ref<BubbleState | null>(null)

function computeBubble(block: Block, range: { start: number; end: number }, rect: DOMRect): BubbleState {
  const marks: Partial<Record<MarkName, boolean>> = {}

  for (const m of ['bold', 'italic', 'underline', 'strikethrough', 'code'] as MarkName[]) {
    marks[m] = rangeHasMark(block.content, range.start, range.end, m)
  }

  const slice = sliceSpans(block.content, range.start, range.end)
  const allLinked = slice.length > 0 && slice.every(s => s.marks?.link)
  const currentLink = allLinked ? (slice[0].marks?.link ?? null) : null
  const currentColor = rangeMarkValue(block.content, range.start, range.end, 'color')
  const currentHighlight = rangeMarkValue(block.content, range.start, range.end, 'highlight')
  const x = Math.max(160, Math.min(rect.left + rect.width / 2, window.innerWidth - 180))
  const y = Math.max(60, rect.top)

  return {
    blockId: block.id,
    range,
    position: { x, y },
    activeMarks: marks,
    currentLink,
    currentColor,
    currentHighlight,
    blockType: block.type,
  }
}

function onSelectionChange() {
  if (props.readonly || hasActiveManagedSelection()) {
    bubble.value = null

    return
  }

  const sel = window.getSelection()

  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
    bubble.value = null

    return
  }

  const node = sel.anchorNode
  const el = node?.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node?.parentElement
  const blockEl = el?.closest('[data-block-id]')

  if (!blockEl || !rootEl.value?.contains(blockEl)) {
    bubble.value = null

    return
  }

  const id = blockEl.getAttribute('data-block-id')
  const block = id ? byId(id) : undefined

  if (!block || !isTextBlock(block.type)) {
    bubble.value = null

    return
  }

  const range = itemRefs.get(block.id)?.getSelection()
  const rect = getSelectionClientRect()

  if (!range || range.start === range.end || !rect) {
    bubble.value = null

    return
  }

  bubble.value = computeBubble(block, range, rect)
}

function onBubbleMark(mark: MarkName, value: boolean | string | null) {
  const state = bubble.value

  if (!state) {
return
}

  const block = byId(state.blockId)

  if (!block) {
return
}

  block.content = applyMarkToRange(block.content, state.range.start, state.range.end, mark, value === false ? null : value)
  pushHistory(true)
  nextTick(() => {
    itemRefs.get(block.id)?.setSelection(state.range.start, state.range.end)
  })
}

function onBubbleTurnInto(type: BlockType) {
  turnIntoBlock(type)
}

function turnIntoBlock(type: BlockType) {
  const state = bubble.value
  const blockId = state?.blockId ?? focusedBlockId.value

  if (!blockId) {
return
}

  const block = byId(blockId)

  if (!block || !isTextBlock(block.type)) {
return
}

  const range = state?.range ?? itemRefs.get(block.id)?.getSelection() ?? { start: 0, end: 0 }
  const defaults = makeBlock(type)
  block.type = type
  block.props = { ...defaults.props, indent: block.props.indent, dir: block.props.dir }
  pushHistory(true)
  nextTick(() => itemRefs.get(block.id)?.setSelection(range.start, range.end))
}

function applyToolbarMark(mark: MarkName, value: boolean | string | null) {
  if (bubble.value) {
    onBubbleMark(mark, value)

    return
  }

  if (focusedTableCell.value || (focusedBlockId.value && byId(focusedBlockId.value)?.type === 'table')) {
    applyMarkToFocusedTableCell(mark, value)

    return
  }

  if (hasActiveManagedSelection() && textRangeSelection.value) {
    const booleanMarks = ['bold', 'italic', 'underline', 'strikethrough', 'code'] as MarkName[]
    let markValue: boolean | string | null = value === false ? null : value

    if (booleanMarks.includes(mark) && typeof value === 'boolean') {
      const applied = rangeHasMarkAcrossSegments(
        textRangeSelection.value,
        blocks.value,
        visibleBlocks.value,
        mark,
      )
      markValue = applied ? null : true
    }

    applyMarkToTextRange(
      blocks.value,
      textRangeSelection.value,
      visibleBlocks.value,
      mark,
      markValue,
    )
    pushHistory(true)
    contentRevision.value++

    return
  }

  const blockId = focusedBlockId.value

  if (!blockId) {
return
}

  const block = byId(blockId)

  if (!block || !isTextBlock(block.type)) {
return
}

  const sel = itemRefs.get(block.id)?.getSelection()

  if (!sel || sel.start === sel.end) {
return
}

  block.content = applyMarkToRange(block.content, sel.start, sel.end, mark, value === false ? null : value)
  pushHistory(true)
  contentRevision.value++

  const preserveEditorFocus = mark === 'color' || mark === 'highlight' || mark === 'link'

  if (!preserveEditorFocus) {
    nextTick(() => itemRefs.get(block.id)?.setSelection(sel.start, sel.end))
  }
}

function indentFocusedBlock() {
  const blockId = bubble.value?.blockId ?? focusedBlockId.value

  if (!blockId) {
return
}

  const block = byId(blockId)

  if (!block) {
return
}

  handleTab(block, false)
}

function outdentFocusedBlock() {
  const blockId = bubble.value?.blockId ?? focusedBlockId.value

  if (!blockId) {
return
}

  const block = byId(blockId)

  if (!block) {
return
}

  handleTab(block, true)
}

function setFocusedAlign(align: FormatToolbarAlign) {
  const blockId = bubble.value?.blockId ?? focusedBlockId.value

  if (!blockId) {
return
}

  const block = byId(blockId)

  if (!block) {
return
}

  if (block.type === 'table') {
    const context = getTableCellContext(blockId)

    if (!context) {
      return
    }

    const nextTable = patchTableCell(context.table, context.row, context.col, {
      align: align === 'left' ? undefined : align as TableCellAlign,
    })
    block.props.table = nextTable
    pushHistory(true)
    contentRevision.value++
    emit('change')

    return
  }

  if (!isTextBlock(block.type)) {
return
}

  if (align === 'left') {
delete block.props.align
} else if (align === 'justify') {
  return
} else {
block.props.align = align
}

  pushHistory(true)
}

function setFocusedDir(dir: 'auto' | 'ltr' | 'rtl') {
  const blockId = bubble.value?.blockId ?? focusedBlockId.value

  if (!blockId) {
return
}

  const block = byId(blockId)

  if (!block || !isTextBlock(block.type)) {
return
}

  if (dir === 'auto') {
delete block.props.dir
} else {
block.props.dir = dir
}

  pushHistory(true)
}

function setFocusedCalloutIcon(icon: string | null) {
  const blockId = bubble.value?.blockId ?? focusedBlockId.value

  if (!blockId) {
    return
  }

  const block = byId(blockId)

  if (!block || block.type !== 'callout') {
    return
  }

  patchProps(block, { icon: icon ?? '💡' })
}

const formatToolbarState = computed(() => {
  const _revision = contentRevision.value
  void _revision

  if (bubble.value) {
    const block = byId(bubble.value.blockId)

      return {
        blockId: bubble.value.blockId,
        blockType: bubble.value.blockType,
        activeMarks: bubble.value.activeMarks,
        currentLink: bubble.value.currentLink,
        currentColor: bubble.value.currentColor,
        currentHighlight: bubble.value.currentHighlight,
        hasSelection: true,
        multiBlock: false,
        align: block?.props.align ?? 'left',
        indent: block?.props.indent ?? 0,
        dir: block?.props.dir ?? 'auto',
        calloutIcon: block?.type === 'callout' ? (block.props.icon ?? '💡') : null,
      }
  }

  if (hasActiveManagedSelection() && textRangeSelection.value) {
    const segments = getTextRangeSegments(
      textRangeSelection.value,
      blocks.value,
      visibleBlocks.value,
    )
    const first = segments[0]

    if (!first) {
      return null
    }

    const block = first.block
    const marks: Partial<Record<MarkName, boolean>> = {}
    const multiBlock = segments.length > 1 || isCrossBlockTextRange(textRangeSelection.value, visibleBlocks.value)

    for (const m of ['bold', 'italic', 'underline', 'strikethrough', 'code'] as MarkName[]) {
      marks[m] = rangeHasMarkAcrossSegments(
        textRangeSelection.value,
        blocks.value,
        visibleBlocks.value,
        m,
      )
    }

    const currentColor = multiBlock
      ? null
      : rangeMarkValueAcrossSegments(
          textRangeSelection.value,
          blocks.value,
          visibleBlocks.value,
          'color',
        )
    const currentHighlight = multiBlock
      ? null
      : rangeMarkValueAcrossSegments(
          textRangeSelection.value,
          blocks.value,
          visibleBlocks.value,
          'highlight',
        )

    return {
      blockId: first.blockId,
      blockType: block.type,
      activeMarks: marks,
      currentLink: null,
      currentColor,
      currentHighlight,
      hasSelection: true,
      multiBlock,
      align: block.props.align ?? 'left',
      indent: block.props.indent ?? 0,
      dir: block.props.dir ?? 'auto',
      calloutIcon: block.type === 'callout' ? (block.props.icon ?? '💡') : null,
    }
  }

  if (focusedBlockId.value) {
    const block = byId(focusedBlockId.value)

    if (block?.type === 'table') {
      const context = getTableCellContext(block.id)

      if (context) {
        const sel = itemRefs.get(block.id)?.getTableCellSelection?.(context.row, context.col)
        const hasSelection = !!sel && sel.start !== sel.end
        const marks: Partial<Record<MarkName, boolean>> = {}

        if (hasSelection && sel) {
          for (const m of ['bold', 'italic', 'underline', 'strikethrough', 'code'] as MarkName[]) {
            marks[m] = rangeHasMark(context.cell.content, sel.start, sel.end, m)
          }
        }

        const currentColor = hasSelection && sel
          ? rangeMarkValue(context.cell.content, sel.start, sel.end, 'color')
          : null
        const currentHighlight = hasSelection && sel
          ? rangeMarkValue(context.cell.content, sel.start, sel.end, 'highlight')
          : null

        return {
          blockId: block.id,
          blockType: 'table' as BlockType,
          activeMarks: marks,
          currentLink: hasSelection && sel
            ? rangeMarkValue(context.cell.content, sel.start, sel.end, 'link')
            : null,
          currentColor,
          currentHighlight,
          hasSelection: hasSelection || true,
          multiBlock: false,
          align: (context.cell.align ?? 'left') as FormatToolbarAlign,
          indent: 0,
          dir: 'auto' as const,
          calloutIcon: null,
          tableStyle: context.table.style,
          cellBackground: context.cell.background ?? null,
        }
      }
    }

    if (block && isTextBlock(block.type)) {
      const sel = itemRefs.get(block.id)?.getSelection()
      const hasSelection = !!sel && sel.start !== sel.end
      const marks: Partial<Record<MarkName, boolean>> = {}

      if (hasSelection && sel) {
        for (const m of ['bold', 'italic', 'underline', 'strikethrough', 'code'] as MarkName[]) {
          marks[m] = rangeHasMark(block.content, sel.start, sel.end, m)
        }
      }

      const currentColor = hasSelection && sel
        ? rangeMarkValue(block.content, sel.start, sel.end, 'color')
        : null
      const currentHighlight = hasSelection && sel
        ? rangeMarkValue(block.content, sel.start, sel.end, 'highlight')
        : null

      return {
        blockId: block.id,
        blockType: block.type,
        activeMarks: marks,
        currentLink: null,
        currentColor,
        currentHighlight,
        hasSelection,
        multiBlock: false,
        align: block.props.align ?? 'left',
        indent: block.props.indent ?? 0,
        dir: block.props.dir ?? 'auto',
        calloutIcon: block.type === 'callout' ? (block.props.icon ?? '💡') : null,
      }
    }
  }

  return null
})

watch(formatToolbarState, (state) => {
  emit('format-state', state)
}, { flush: 'post' })

// ─── Drag & drop ──────────────────────────────────────────────────────────────

const draggingId = ref<string | null>(null)
const dropTarget = ref<{ id: string; position: 'before' | 'after' } | null>(null)

function onDragHandleStart(block: Block, e: DragEvent) {
  if (props.readonly) {
    e.preventDefault()

    return
  }

  isDragSelecting = false
  dragSelectAnchor = null
  clearTextRangeSelection()
  draggingId.value = block.id

  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', block.id)
    const blockEl = rootEl.value?.querySelector(`[data-block-id="${block.id}"]`)

    if (blockEl) {
e.dataTransfer.setDragImage(blockEl as HTMLElement, 0, 12)
}
  }
}

function isExternalFileDrag(e: DragEvent): boolean {
  return !draggingId.value && Array.from(e.dataTransfer?.types ?? []).includes('Files')
}

function onDragOver(e: DragEvent) {
  if (props.readonly) {
return
}

  if (isExternalFileDrag(e)) {
    e.preventDefault()

    if (e.dataTransfer) {
e.dataTransfer.dropEffect = 'copy'
}

    const target = (e.target as HTMLElement).closest('[data-block-id]')
    const id = target?.getAttribute('data-block-id')

    if (id) {
      const rect = target!.getBoundingClientRect()
      dropTarget.value = { id, position: e.clientY < rect.top + rect.height / 2 ? 'before' : 'after' }
    } else {
      dropTarget.value = null
    }

    return
  }

  if (!draggingId.value) {
return
}

  e.preventDefault()

  if (e.dataTransfer) {
e.dataTransfer.dropEffect = 'move'
}

  const target = (e.target as HTMLElement).closest('[data-block-id]')

  if (!target) {
 dropTarget.value = null;

 return 
}

  const id = target.getAttribute('data-block-id')

  if (!id || id === draggingId.value) {
 dropTarget.value = null;

 return 
}

  const rect = target.getBoundingClientRect()
  const position = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
  dropTarget.value = { id, position }
}

function onDrop(e: DragEvent) {
  if (props.readonly) {
return
}

  e.preventDefault()

  // External OS files dropped onto the editor become media blocks
  const externalFiles = !draggingId.value ? Array.from(e.dataTransfer?.files ?? []) : []

  if (externalFiles.length > 0) {
    const target = dropTarget.value
    dropTarget.value = null
    let at = blocks.value.length

    if (target) {
      const idx = blocks.value.findIndex(b => b.id === target.id)

      if (idx !== -1) {
at = target.position === 'before' ? idx : idx + 1
}
    }

    void insertFileBlocks(externalFiles, at)

    return
  }

  const from = draggingId.value
  const target = dropTarget.value
  draggingId.value = null
  dropTarget.value = null

  if (!from || !target || from === target.id) {
return
}

  const fromIdx = blocks.value.findIndex(b => b.id === from)

  if (fromIdx === -1) {
return
}

  const [moved] = blocks.value.splice(fromIdx, 1)
  let toIdx = blocks.value.findIndex(b => b.id === target.id)

  if (toIdx === -1) {
 blocks.value.splice(fromIdx, 0, moved);

 return 
}

  if (target.position === 'after') {
toIdx += 1
}

  blocks.value.splice(toIdx, 0, moved)
  pushHistory(true)
}

function onDragEnd() {
  draggingId.value = null
  dropTarget.value = null
  isDragSelecting = false
  dragSelectAnchor = null
}

// ─── Root keyboard handling ───────────────────────────────────────────────────

function resolveActiveBlock(target: HTMLElement): Block | undefined {
  const blockEl = target.closest('[data-block-id]')
  const blockId = blockEl?.getAttribute('data-block-id')

  if (blockId) {
return byId(blockId)
}

  if (selectedBlockId.value) {
return byId(selectedBlockId.value)
}

  if (focusedBlockId.value) {
return byId(focusedBlockId.value)
}

  return undefined
}

function isFullTextBlockContentSelected(block: Block): boolean {
  if (!isTextBlock(block.type)) {
return false
}

  const len = spansToText(block.content).length

  if (len === 0) {
return true
}

  const sel = itemRefs.get(block.id)?.getSelection()

  return !!sel && sel.start === 0 && sel.end >= len
}

function isFullCodeBlockSelected(blockEl: HTMLElement | null): boolean {
  const textarea = blockEl?.querySelector('textarea')

  if (!textarea) {
return false
}

  const len = textarea.value.length

  if (len === 0) {
return true
}

  return textarea.selectionStart === 0 && textarea.selectionEnd >= len
}

function selectAllTextInBlock(block: Block) {
  if (isTextBlock(block.type)) {
    const len = spansToText(block.content).length
    itemRefs.get(block.id)?.setSelection(0, len)
    focusedBlockId.value = block.id

    return
  }

  if (block.type === 'code') {
    const blockEl = rootEl.value?.querySelector(`[data-block-id="${block.id}"]`)
    const textarea = blockEl?.querySelector('textarea') as HTMLTextAreaElement | null

    if (textarea) {
      textarea.focus()
      textarea.setSelectionRange(0, textarea.value.length)
      focusedBlockId.value = block.id
    }
  }
}

function handleSelectAllShortcut(target: HTMLElement) {
  const block = resolveActiveBlock(target)
  const blockEl = target.closest('[data-block-id]') ?? (block
    ? rootEl.value?.querySelector(`[data-block-id="${block.id}"]`)
    : null)

  if (isAllTextBlocksSelected()) {
    return
  }

  const partialRange = hasActiveManagedSelection() && !isAllTextBlocksSelected()
  const singleNonTextSelected = block && !isTextBlock(block.type) && block.type !== 'code'
    && selectedBlockId.value === block.id

  if (partialRange || singleNonTextSelected) {
    selectAllBlocks()

    return
  }

  if (block && isTextBlock(block.type)) {
    if (isFullTextBlockContentSelected(block)) {
      selectAllBlocks()

      return
    }

    selectAllTextInBlock(block)

    return
  }

  if (block?.type === 'code') {
    if (isFullCodeBlockSelected(blockEl as HTMLElement | null)) {
      selectAllBlocks()

      return
    }

    selectAllTextInBlock(block)

    return
  }

  selectAllBlocks()
}

function onKeydownCapture(e: KeyboardEvent) {
  if (props.readonly) {
return
}

  // Slash menu lives inside the contenteditable block being typed into, so
  // this must run before the isNativeInputTarget bail-out below (which
  // exists to let text blocks handle their own keys normally).
  if (slashState.value) {
    if (e.key === 'ArrowDown') {
 e.preventDefault(); e.stopPropagation(); slashMenuRef.value?.move(1);

 return
}

    if (e.key === 'ArrowUp') {
 e.preventDefault(); e.stopPropagation(); slashMenuRef.value?.move(-1);

 return
}

    if (e.key === 'Enter' || e.key === 'Tab') {
 e.preventDefault(); e.stopPropagation(); slashMenuRef.value?.confirm();

 return
}

    if (e.key === 'Escape') {
 e.preventDefault(); e.stopPropagation(); closeSlash();

 return
}
  }

  if (emojiTriggerState.value) {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault(); e.stopPropagation()
      const q = emojiTriggerState.value.query.toLowerCase()
      const match = q ? ALL_EMOJIS.find(en => en.name.includes(q) || en.keywords.some(k => k.includes(q))) : null

      if (match) {
onEmojiTriggerSelect(match.char)
} else {
closeEmojiTrigger()
}

      return
    }

    if (e.key === 'Escape') {
 e.preventDefault(); e.stopPropagation(); closeEmojiTrigger();

 return
}
  }

  if (isNativeInputTarget(e.target)) {
return
}

  const mod = e.ctrlKey || e.metaKey

  if (hasActiveManagedSelection()) {
    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault()
      e.stopPropagation()
      deleteManagedTextRange()

      return
    }

    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      clearTextRangeSelection()

      return
    }
  }

  if (mod && e.key.toLowerCase() === 'a') {
    const target = e.target as HTMLElement

    if (rootEl.value?.contains(target)) {
      e.preventDefault()
      e.stopPropagation()
      handleSelectAllShortcut(target)

      return
    }
  }

  if (e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
    const baseBlockId = focusedBlockId.value
      ?? textRangeSelection.value?.focus.blockId
      ?? selectedBlockId.value

    if (!baseBlockId) {
      return
    }

    const neighbor = neighborBlock(baseBlockId, e.key === 'ArrowDown' ? 1 : -1)

    if (neighbor && isTextBlock(neighbor.type)) {
      e.preventDefault()
      e.stopPropagation()

      const anchor = resolveSelectionAnchor() ?? { blockId: baseBlockId, offset: 0 }
      const focusOffset = textRangeSelection.value?.focus.offset
        ?? itemRefs.get(baseBlockId)?.getSelection()?.end
        ?? 0
      const clampedOffset = Math.min(focusOffset, blockLength(neighbor))

      setManagedTextRange(anchor, { blockId: neighbor.id, offset: clampedOffset })
      nextTick(() => rootEl.value?.focus())

      return
    }
  }

  if (mod && e.key.toLowerCase() === 'z') {
    e.preventDefault()
    e.stopPropagation()

    if (e.shiftKey) {
redo()
} else {
undo()
}

    return
  }

  if (mod && e.key.toLowerCase() === 'y') {
    e.preventDefault()
    e.stopPropagation()
    redo()

    return
  }

  if (e.key === 'Escape' && bubble.value) {
    bubble.value = null
  }
}

function onBlockPointerDown(block: Block, e: PointerEvent) {
  if (props.readonly) {
return
}

  const target = e.target as HTMLElement

  if (target.closest('.ebi-reorder-handle, .ebi-gutter')) {
return
}

  if (e.shiftKey && !isTextBlock(block.type)) {
    const anchor = resolveSelectionAnchor() ?? { blockId: block.id, offset: 0 }

    setManagedTextRange(anchor, { blockId: block.id, offset: blockLength(block) })
    e.preventDefault()
    nextTick(() => rootEl.value?.focus())

    return
  }

  if (!e.shiftKey && hasActiveManagedSelection() && !isTextBlock(block.type)) {
    clearTextRangeSelection()
  }
}

function onDocPointerMove(e: PointerEvent) {
  if (draggingId.value || !isDragSelecting || !dragSelectAnchor || e.buttons === 0 || !rootEl.value) {
return
}

  const point = caretPointFromClient(rootEl.value, e.clientX, e.clientY)

  if (!point) {
    return
  }

  textRangeSelection.value = { anchor: dragSelectAnchor, focus: point }

  if (point.blockId !== dragSelectAnchor.blockId || hasActiveManagedSelection()) {
    managedTextSelection.value = true
    window.getSelection()?.removeAllRanges()
    focusedBlockId.value = null
  }
}

function onDocPointerUp() {
  if (isDragSelecting) {
    finalizeTextRangeSelection()
  }

  isDragSelecting = false
  dragSelectAnchor = null
}

function onRootKeydown(e: KeyboardEvent) {
  const target = e.target as HTMLElement

  if (isNativeInputTarget(target)) {
    return
  }

  if (hasActiveManagedSelection()) {
return
}

  const id = selectedBlockId.value

  if (!id) {
return
}

  const block = byId(id)

  if (!block) {
 selectedBlockId.value = null;

 return 
}

  if (e.key === 'Backspace' || e.key === 'Delete') {
    e.preventDefault()
    removeBlock(block)

    return
  }

  if (e.key === 'Enter') {
    e.preventDefault()
    addBelow(block)

    return
  }

  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    e.preventDefault()
    handleArrow(block, e.key === 'ArrowDown' ? 1 : -1)

    return
  }

  if (e.key === 'Escape') {
    selectedBlockId.value = null
  }
}

function onDocMouseDown(e: MouseEvent) {
  const target = e.target as HTMLElement

  if (isEditorOverlayTarget(target)) {
    return
  }

  if (slashState.value && !target.closest('.fixed')) {
closeSlash()
}

  if (emojiTriggerState.value && !target.closest('.fixed')) {
closeEmojiTrigger()
}

  if (selectedBlockId.value && !target.closest(`[data-block-id="${selectedBlockId.value}"]`)) {
    selectedBlockId.value = null
  }

  if (
    hasActiveManagedSelection()
    && !rootEl.value?.contains(target)
    && !isFormatToolbarTarget(target)
  ) {
    clearTextRangeSelection()
  }
}

// Click in the empty tail area appends/focuses a trailing paragraph
function onTailClick() {
  if (props.readonly) {
return
}

  const last = blocks.value[blocks.value.length - 1]

  if (last && last.type === 'paragraph' && spansToText(last.content) === '') {
    focusBlock(last.id, 'start')

    return
  }

  const nb = makeBlock('paragraph')
  blocks.value.push(nb)
  pushHistory(true)
  focusBlock(nb.id, 'start')
}

function placeholderFor(block: Block): string | undefined {
  if (block.type !== 'paragraph') {
return undefined
}

  if (focusedBlockId.value === block.id) {
return "Type '/' for commands..."
}

  if (blocks.value.length === 1 && spansToText(block.content) === '') {
    return '+ Start writing or type / for plugins'
  }

  return undefined
}

function onBlockFocus(block: Block) {
  focusedBlockId.value = block.id

  if (block.type !== 'table') {
    focusedTableCell.value = null
    tableSelectedCells.value = []
  }

  if (!hasActiveManagedSelection()) {
selectedBlockId.value = null
}
}

defineExpose({
  undo,
  redo,
  canUndo,
  canRedo,
  formatToolbarState,
  applyToolbarMark,
  turnIntoBlock,
  indentFocusedBlock,
  outdentFocusedBlock,
  setFocusedAlign,
  setFocusedDir,
  setFocusedCalloutIcon,
  patchTableStyle: patchTableStyleForFocused,
  patchTableCellBackground: patchTableCellBackgroundForFocused,
  focusFirst: () => {
    const first = visibleBlocks.value[0]

    if (first) {
focusBlock(first.id, 'start')
}
  },
  focusEnd: () => {
    const last = visibleBlocks.value[visibleBlocks.value.length - 1]

    if (last) {
focusBlock(last.id, 'end')
}
  },
})
</script>

<template>
  <div
    ref="rootEl"
    class="block-editor outline-none"
    :dir="editorDir ?? 'ltr'"
    tabindex="-1"
    @keydown.capture="onKeydownCapture"
    @keydown="onRootKeydown"
    @copy.capture="onCopy"
    @cut.capture="onCut"
    @paste.capture="onPaste"
    @dragover="onDragOver"
    @drop="onDrop"
    @dragend="onDragEnd"
  >
    <EditorBlockItem
      v-for="block in visibleBlocks"
      :key="block.id"
      :ref="(el) => setItemRef(block.id, el)"
      :block="block"
      :number="numbering.get(block.id)"
      :placeholder="placeholderFor(block)"
      :selected="selectedBlockId === block.id"
      :text-highlight="textHighlightForBlock(block.id)"
      :drop-position="dropTarget && dropTarget.id === block.id ? dropTarget.position : null"
      :upload="upload"
      :pick-media="pickMedia"
      :editor-dir="editorDir"
      :readonly="readonly"
      :theme-source="rootEl"
      :class="{ 'opacity-40': draggingId === block.id }"
      :icon-picker-request="iconPickerRequest && iconPickerRequest.blockId === block.id ? { tab: iconPickerRequest.tab } : null"
      @input="(s, c) => handleInput(block, s, c)"
      @enter="o => handleEnter(block, o)"
      @backspace-start="handleBackspaceStart(block)"
      @delete-end="handleDeleteEnd(block)"
      @arrow-up="handleArrow(block, -1)"
      @arrow-down="handleArrow(block, 1)"
      @tab="s => handleTab(block, s)"
      @format="m => handleFormat(block, m)"
      @pasted="p => handlePasted(block, p)"
      @focus="onBlockFocus(block)"
      @patch="p => patchProps(block, p)"
      @icon-picker-opened="iconPickerRequest = null"
      @select="selectBlock(block.id)"
      @add-below="addBelow(block)"
      @duplicate="duplicateBlock(block)"
      @remove="removeBlock(block)"
      @drag-handle-start="e => onDragHandleStart(block, e)"
      @pointerdown="e => onBlockPointerDown(block, e)"
      @selection-pointer-down="p => onSelectionPointerDown(block, p)"
      @table-cell-focus="p => onTableCellFocus(block, p)"
      @table-cell-input="p => onTableCellInput(block, p)"
      @table-cell-format="p => handleTableFormat(block, p)"
      @table-cell-tab="p => handleTableTab(block, p)"
      @table-cell-navigate="p => handleTableNavigate(block, p)"
      @table-cell-selection-change="cells => onTableCellSelectionChange(block, cells)"
    />

    <!-- Tail click area -->
    <div v-if="!readonly" class="h-28 cursor-text" @click="onTailClick" />

    <EditorSlashMenu
      v-if="slashState && !readonly"
      ref="slashMenuRef"
      :query="slashState.query"
      :position="slashState.position"
      :dir="editorDir ?? 'ltr'"
      :theme-source="rootEl"
      @select="onSlashSelect"
      @close="closeSlash"
    />

    <EditorEmojiTriggerMenu
      v-if="emojiTriggerState && !readonly"
      :query="emojiTriggerState.query"
      :position="emojiTriggerState.position"
      :dir="editorDir ?? 'ltr'"
      :theme-source="rootEl"
      @select="onEmojiTriggerSelect"
    />

    <EditorBubbleToolbar
      v-if="showBubbleToolbar && bubble && !readonly"
      :position="bubble.position"
      :active-marks="bubble.activeMarks"
      :current-link="bubble.currentLink"
      :current-color="bubble.currentColor"
      :current-highlight="bubble.currentHighlight"
      :block-type="bubble.blockType"
      :theme-source="rootEl"
      @mark="onBubbleMark"
      @turn-into="onBubbleTurnInto"
    />
  </div>
</template>

<style scoped>
.block-editor {
  background: var(--xpe-background, #fff);
  color: var(--xpe-foreground, #1f2937);
}
</style>
