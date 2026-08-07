<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import {
  blocksToClipboardPayload,
  parseBlocksFromClipboardData,
  writeBlocksToClipboardData,
  caretPointFromClient,
  getCaretClientRect,
  getRangeClientRects,
  getSelectionClientRect,
  htmlToBlocks,
  normalizeTextRange,
  createBlock, cloneBlock, cloneToggleSubtree, spansToText, splitSpansAt, normalizeSpans,
  deleteRangeInSpans, applyMarkToRange, rangeHasMark, rangeMarkValue,
  applyMarkToTextRange,
  deleteTextRange,
  extractTextRangeAsBlocks,
  fullBlockTextRange,
  getTextRangeSegments,
  getToggleSubtreeLength,
  isBlockCoveredByTextRange,
  isCrossBlockTextRange,
  isFullDocumentRange,
  isManagedMultiBlockRange,
  isTextRangeCollapsed,
  isToggleBlock,
  resolveHistoryShortcut,
  resolveSelectAllShortcut,
  selectionEndOffset,
  rangeHasMarkAcrossSegments,
  rangeMarkValueAcrossSegments,
  computeListNumbering,
  normalizeTableData,
  nextVisibleCellCoord,
  patchTableCell,
  patchTableCellsBackground,
  patchTableStyle,
  plainHeadingFromToggle,
  removeToggleSubtree,
  isTextBlock,
  blockTypeForFile,
  fileToObjectUrl,
  mediaPropsFromFile,
  tryParseMarkdownToBlocks,
} from '@xproeditor/core'
import type { TextPoint, TextRangeSelection, Block, BlockType, InlineSpan, MarkName, SelectAllStage, TableCellCoord, TableCellAlign, TableStyle, AICommand, AITransport } from '@xproeditor/core'
import EditorBlockItem from './EditorBlockItem.vue'
import EditorBubbleToolbar from './EditorBubbleToolbar.vue'
import EditorEmojiTriggerMenu from './EditorEmojiTriggerMenu.vue'
import type { FormatToolbarAlign, FormatToolbarState } from './EditorFormatToolbar.vue'
import EditorSlashMenu from './EditorSlashMenu.vue'
import type {SlashItem} from './EditorSlashMenu.vue';
import EditorAIMenu from './EditorAIMenu.vue'
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
  fetchBookmarkMeta?: (url: string) => Promise<{
    title?: string
    description?: string
    favicon?: string
    image?: string
  } | null | undefined>
  /** Default text direction for new blocks (from active content language). */
  editorDir?: 'ltr' | 'rtl'
  readonly?: boolean
  /** Floating bubble toolbar on text selection (disabled when using sticky format toolbar). */
  showBubbleToolbar?: boolean
  /** Pluggable AI agent — host supplies transport (OpenAI/Anthropic/custom). */
  ai?: {
    transport: AITransport
    commands?: AICommand[]
  }
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
/** Ignore the click that follows a multi-block drag (media blocks emit select on click). */
let suppressNextBlockSelect = false
/** Ctrl/Cmd+A stage: none → current block → whole document. */
let selectAllStage: SelectAllStage = 'none'
/**
 * Keep the bubble (and its range snapshot) while the user focuses toolbar
 * inputs such as the link URL field — focusing those collapses the native
 * selection and would otherwise dismiss the bubble before Set/Enter applies.
 */
let suppressBubbleClear = false
/** Last non-collapsed inline selection — fallback when native selection was stolen by a toolbar input. */
let savedInlineSelection: { blockId: string; start: number; end: number } | null = null

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

function isBlockChromeSelected(id: string): boolean {
  if (selectedBlockId.value === id) return true
  if (!hasActiveManagedSelection() || !textRangeSelection.value) return false
  const block = byId(id)
  if (!block || isTextBlock(block.type)) return false
  return isBlockCoveredByTextRange(id, textRangeSelection.value, blocks.value, visibleBlocks.value)
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
  window.getSelection()?.removeAllRanges()
  nextTick(() => rootEl.value?.focus())
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
  if (!hasActiveManagedSelection() || !textRangeSelection.value) {
    return false
  }

  return isFullDocumentRange(textRangeSelection.value, visibleBlocks.value)
}

function resetSelectAllStage() {
  selectAllStage = 'none'
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

  if (isManagedMultiBlockRange(textRangeSelection.value, visibleBlocks.value)) {
    managedTextSelection.value = true
    selectedBlockId.value = null
    focusedBlockId.value = null
    window.getSelection()?.removeAllRanges()
    nextTick(() => rootEl.value?.focus())

    return
  }

  const { anchor, focus } = textRangeSelection.value
  const block = byId(anchor.blockId)
  const start = Math.min(anchor.offset, focus.offset)
  const end = Math.max(anchor.offset, focus.offset)
  const blockId = anchor.blockId

  textRangeSelection.value = null
  managedTextSelection.value = false

  if (start !== end && block && isTextBlock(block.type)) {
    itemRefs.get(blockId)?.setSelection(start, end)
    focusedBlockId.value = blockId
  }
}

function onSelectionPointerDown(
  block: Block,
  payload: { shiftKey: boolean; clientX: number; clientY: number },
) {
  if (props.readonly || !rootEl.value) {
    return
  }

  const point = caretPointFromClient(rootEl.value, payload.clientX, payload.clientY)
    ?? { blockId: block.id, offset: 0 }

  if (payload.shiftKey) {
    const anchor = resolveSelectionAnchor() ?? point

    if (point.blockId === anchor.blockId && isTextBlock(block.type)) {
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

function isToolbarOrOverlayTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return isFormatToolbarTarget(target) || isEditorOverlayTarget(target)
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
  if (suppressNextBlockSelect) {
    suppressNextBlockSelect = false

    return
  }

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

    if (isToggleBlock(b.type) && b.props.collapsed) {
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
  document.addEventListener('mousedown', onDocMouseDownCapture, true)
  document.addEventListener('mousedown', onDocMouseDown)
  document.addEventListener('pointermove', onDocPointerMove)
  document.addEventListener('pointerup', onDocPointerUp)
})

onBeforeUnmount(() => {
  document.removeEventListener('selectionchange', onSelectionChange)
  document.removeEventListener('mousedown', onDocMouseDownCapture, true)
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
const aiMenu = ref<{ position: { x: number; y: number } } | null>(null)
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

function openAIMenu(position?: { x: number; y: number }) {
  if (!props.ai?.transport || props.readonly) return
  closeSlash()
  bubble.value = null
  const pos = position ?? slashPosition()
  aiMenu.value = { position: { x: pos.x, y: pos.y } }
}

function closeAIMenu() {
  aiMenu.value = null
  // Restore multi-select popover if the range is still active.
  refreshManagedBubble()
}

function getAISelectionBlocks(): Block[] {
  if (hasActiveManagedSelection() && textRangeSelection.value) {
    return extractTextRangeAsBlocks(textRangeSelection.value, blocks.value, visibleBlocks.value)
  }
  if (focusedBlockId.value) {
    const b = byId(focusedBlockId.value)
    return b ? [b] : []
  }
  if (selectedBlockId.value) {
    const b = byId(selectedBlockId.value)
    return b ? [b] : []
  }
  return []
}

function replaceDocumentBlocks(next: Block[], focusId: string | null) {
  blocks.value.splice(0, blocks.value.length, ...next)
  ensureNotEmpty()
  pushHistory(true)
  clearTextRangeSelection()
  if (focusId) {
    const b = byId(focusId)
    if (b && isTextBlock(b.type)) focusBlock(focusId, 'end')
    else if (b) selectBlock(focusId)
  }
}

function onSlashSelect(item: SlashItem) {
  const state = slashState.value

  if (!state) {
return
}

  if (item.action === 'ai') {
    const pos = state.position
    closeSlash()
    openAIMenu({ x: pos.x, y: pos.y })
    return
  }

  if (item.action === 'emoji') {
    const block = byId(state.blockId)
    const pos = state.position
    const index = state.index
    const removeEnd = state.index + 1 + state.query.length
    closeSlash()

    if (!block) {
return
}

    block.content = deleteRangeInSpans(block.content, index, removeEnd)
    pushHistory(true)
    focusBlock(block.id, index)
    emojiTriggerState.value = {
      blockId: block.id,
      index,
      query: '',
      position: pos,
      prefixLen: 0,
    }
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
  /** Chars before the query to strip on select (`:` = 1; slash-opened = 0). */
  prefixLen: number
}

const emojiTriggerState = ref<EmojiTriggerState | null>(null)

function closeEmojiTrigger() {
  emojiTriggerState.value = null
}

function updateEmojiTrigger(block: Block, spans: InlineSpan[], caret: number | null) {
  const text = spansToText(spans)
  const state = emojiTriggerState.value

  if (state && state.blockId === block.id) {
    const { prefixLen } = state

    if (caret === null || caret < state.index + prefixLen) {
      closeEmojiTrigger()

      return
    }

    if (prefixLen > 0 && text[state.index] !== ':') {
      closeEmojiTrigger()

      return
    }

    const query = text.slice(state.index + prefixLen, caret)

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
      emojiTriggerState.value = {
        blockId: block.id,
        index: caret - 1,
        query: '',
        position: slashPosition(),
        prefixLen: 1,
      }
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

  const removeEnd = state.index + state.prefixLen + state.query.length
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
  const listLike = [
    'bulleted_list_item',
    'numbered_list_item',
    'to_do',
    'toggle',
    'toggle_heading_1',
    'toggle_heading_2',
    'toggle_heading_3',
    'quote',
    'callout',
  ]

  // Enter on an empty list-like block: outdent or exit to paragraph / plain heading
  if (listLike.includes(block.type) && text === '') {
    const ind = block.props.indent ?? 0

    if (ind > 0) {
block.props.indent = ind - 1
} else {
      const plainHeading = plainHeadingFromToggle(block.type)
      block.type = plainHeading ?? 'paragraph'
      delete block.props.collapsed
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
} else if (
    (block.type.startsWith('heading') || block.type.startsWith('toggle_heading')) &&
    spansToText(after).length > 0
  ) {
    newType = block.type.startsWith('toggle_heading')
      ? (plainHeadingFromToggle(block.type) ?? 'paragraph')
      : block.type
}

  const newProps: Block['props'] = {}

  if (block.props.indent) {
newProps.indent = block.props.indent
}

  if (block.props.dir && block.props.dir !== 'auto') {
newProps.dir = block.props.dir
}

  if (isToggleBlock(block.type)) {
    newProps.indent = (block.props.indent ?? 0) + 1
    block.props.collapsed = false
    // Notion/BlockNote: Enter in a toggle creates a child paragraph inside it.
    newType = 'paragraph'
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

  let pastedBlocks = payload.html && payload.html.includes('<') ? htmlToBlocks(payload.html) : []

  if (pastedBlocks.length === 0) {
    const fromMd = tryParseMarkdownToBlocks(payload.text)
    if (fromMd?.length) pastedBlocks = fromMd
  }

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
    if (!block) return null
    if (isToggleBlock(block.type)) {
      const idx = blocks.value.indexOf(block)
      if (idx === -1) return [block]
      const len = getToggleSubtreeLength(blocks.value, idx)
      return blocks.value.slice(idx, idx + len).map((b) => cloneBlock(b, true))
    }
    return [block]
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

      const idx = blocks.value.findIndex(b => b.id === deleteResult.focusBlockId)

      if (idx !== -1) {
        blocks.value.splice(idx, 0, ...pasted)
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
  if (props.readonly) {
    return
  }

  const managed = hasActiveManagedSelection() || !!selectedBlockId.value

  if (!managed && isNativeInputTarget(e.target)) {
    return
  }

  const toCopy = getBlocksForClipboard()

  if (!toCopy?.length || !e.clipboardData) {
    return
  }

  e.preventDefault()
  e.stopPropagation()
  writeBlocksToClipboardData(e.clipboardData, toCopy)
}

function onCut(e: ClipboardEvent) {
  if (props.readonly) {
    return
  }

  const managed = hasActiveManagedSelection() || !!selectedBlockId.value

  if (!managed && isNativeInputTarget(e.target)) {
    return
  }

  const toCopy = getBlocksForClipboard()

  if (!toCopy?.length || !e.clipboardData) {
    return
  }

  e.preventDefault()
  e.stopPropagation()
  writeBlocksToClipboardData(e.clipboardData, toCopy)
  removeBlocksForCut()
}

function onPaste(e: ClipboardEvent) {
  if (props.readonly || !e.clipboardData) {
    return
  }

  const managed = hasActiveManagedSelection() || !!selectedBlockId.value

  if (!managed && isNativeInputTarget(e.target)) {
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
    const mdMime = e.clipboardData.getData('text/markdown')
    const fromMd = tryParseMarkdownToBlocks(mdMime || text)
    const prioritizeMd = !html || !html.includes('<') || !!mdMime

    if (fromMd && prioritizeMd) {
      e.preventDefault()
      e.stopPropagation()
      insertBlocksFromClipboard(fromMd)
      return
    }

    const external = html && html.includes('<') ? htmlToBlocks(html) : []

    if (external.length > 0) {
      e.preventDefault()
      e.stopPropagation()
      insertBlocksFromClipboard(external)
      return
    }

    if (fromMd) {
      e.preventDefault()
      e.stopPropagation()
      insertBlocksFromClipboard(fromMd)
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

function blocksForToggleAction(block: Block): Block[] {
  if (!isToggleBlock(block.type)) return [block]
  const idx = blocks.value.indexOf(block)
  if (idx === -1) return [block]
  return cloneToggleSubtree(blocks.value, idx)
}

function duplicateBlock(block: Block) {
  if (props.readonly) {
return
}

  const idx = blocks.value.indexOf(block)
  if (idx === -1) return
  const copies = blocksForToggleAction(block)
  blocks.value.splice(idx + getToggleSubtreeLength(blocks.value, idx), 0, ...copies)
  pushHistory(true)
}

async function copyBlock(block: Block) {
  if (props.readonly) return
  selectBlock(block.id)
  const { plain, html } = blocksToClipboardPayload(blocksForToggleAction(block))
  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/plain': new Blob([plain], { type: 'text/plain' }),
        'text/html': new Blob([html], { type: 'text/html' }),
      }),
    ])
  } catch {
    try {
      await navigator.clipboard.writeText(plain)
    } catch {
      /* clipboard unavailable */
    }
  }
}

async function cutBlock(block: Block) {
  if (props.readonly) return
  await copyBlock(block)
  removeBlock(block)
}

function turnBlockInto(block: Block, type: BlockType) {
  if (props.readonly || !isTextBlock(block.type)) return
  const defaults = makeBlock(type)
  block.type = type
  block.props = { ...defaults.props, indent: block.props.indent, dir: block.props.dir }
  pushHistory(true)
  selectBlock(block.id)
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
  const subtreeLen = isToggleBlock(block.type)
    ? getToggleSubtreeLength(blocks.value, idx)
    : 1
  const afterIdx = idx + subtreeLen
  const next = afterIdx < blocks.value.length ? blocks.value[afterIdx] : null

  if (isToggleBlock(block.type)) removeToggleSubtree(blocks.value, idx)
  else blocks.value.splice(idx, 1)

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
  placement: 'above' | 'beside'
  activeMarks: Partial<Record<MarkName, boolean>>
  currentLink: string | null
  currentColor: string | null
  currentHighlight: string | null
  blockType: BlockType
  multiBlock: boolean
  mixedTypes: boolean
  /** Snapshot of the managed multi-block range (survives toolbar mousedown races). */
  textRange?: TextRangeSelection
}

const CLEARABLE_MARKS: MarkName[] = [
  'bold',
  'italic',
  'underline',
  'strikethrough',
  'code',
  'link',
  'color',
  'highlight',
]

const bubble = ref<BubbleState | null>(null)

function getManagedSelectionBounds(range: TextRangeSelection): DOMRect | null {
  const root = rootEl.value
  if (!root) return null

  const normalized = normalizeTextRange(range, visibleBlocks.value)
  if (!normalized) return null

  const startIdx = visibleBlocks.value.findIndex(b => b.id === normalized.startBlockId)
  const endIdx = visibleBlocks.value.findIndex(b => b.id === normalized.endBlockId)
  if (startIdx === -1 || endIdx === -1) return null

  const segments = getTextRangeSegments(range, blocks.value, visibleBlocks.value)
  let minL = Infinity
  let minT = Infinity
  let maxR = -Infinity
  let maxB = -Infinity
  let found = false

  const expand = (r: DOMRect) => {
    if (!r.width && !r.height) return
    found = true
    minL = Math.min(minL, r.left)
    minT = Math.min(minT, r.top)
    maxR = Math.max(maxR, r.right)
    maxB = Math.max(maxB, r.bottom)
  }

  for (let i = startIdx; i <= endIdx; i++) {
    const block = visibleBlocks.value[i]
    const blockEl = root.querySelector(`[data-block-id="${block.id}"]`) as HTMLElement | null
    if (!blockEl) continue

    if (isTextBlock(block.type)) {
      const segment = segments.find(s => s.blockId === block.id)
      if (!segment) continue

      const editable = blockEl.querySelector('.etb') as HTMLElement | null
      if (editable && !segment.fullBlock) {
        for (const r of getRangeClientRects(editable, segment.start, segment.end)) expand(r)
        continue
      }
    } else if (!isBlockCoveredByTextRange(block.id, range, blocks.value, visibleBlocks.value)) {
      continue
    }

    const body = blockEl.querySelector('.ebi-body') as HTMLElement | null
    expand((body ?? blockEl).getBoundingClientRect())
  }

  if (!found) return null
  return new DOMRect(minL, minT, maxR - minL, maxB - minT)
}

function positionBesideSelection(rect: DOMRect): { x: number; y: number } {
  const panelW = 268
  const pad = 8
  let x = rect.right + pad
  if (x + panelW > window.innerWidth - pad) {
    x = rect.left - panelW - pad
    if (x < pad) x = Math.max(pad, Math.min(rect.left + rect.width / 2, window.innerWidth - pad))
  }
  return { x, y: Math.max(pad, rect.top) }
}

function computeBubble(block: Block, range: { start: number; end: number }, rect: DOMRect): BubbleState {
  const marks: Partial<Record<MarkName, boolean>> = {}

  for (const m of ['bold', 'italic', 'underline', 'strikethrough', 'code'] as MarkName[]) {
    marks[m] = rangeHasMark(block.content, range.start, range.end, m)
  }

  const currentLink = rangeMarkValue(block.content, range.start, range.end, 'link')
  const currentColor = rangeMarkValue(block.content, range.start, range.end, 'color')
  const currentHighlight = rangeMarkValue(block.content, range.start, range.end, 'highlight')
  const x = Math.max(160, Math.min(rect.left + rect.width / 2, window.innerWidth - 180))
  const y = Math.max(60, rect.top)

  return {
    blockId: block.id,
    range,
    position: { x, y },
    placement: 'above',
    activeMarks: marks,
    currentLink,
    currentColor,
    currentHighlight,
    blockType: block.type,
    multiBlock: false,
    mixedTypes: false,
  }
}

function computeManagedBubble(range: TextRangeSelection): BubbleState | null {
  const segments = getTextRangeSegments(range, blocks.value, visibleBlocks.value)
  const bounds = getManagedSelectionBounds(range)
  if (!bounds) return null

  const first = segments[0]
  const fallbackBlock = byId(range.anchor.blockId) ?? visibleBlocks.value[0]
  if (!first && !fallbackBlock) return null

  const marks: Partial<Record<MarkName, boolean>> = {}
  for (const m of ['bold', 'italic', 'underline', 'strikethrough', 'code'] as MarkName[]) {
    marks[m] =
      segments.length > 0 &&
      rangeHasMarkAcrossSegments(range, blocks.value, visibleBlocks.value, m)
  }

  const currentLink =
    segments.length > 0
      ? rangeMarkValueAcrossSegments(range, blocks.value, visibleBlocks.value, 'link')
      : null
  const currentColor =
    segments.length > 0
      ? rangeMarkValueAcrossSegments(range, blocks.value, visibleBlocks.value, 'color')
      : null
  const currentHighlight =
    segments.length > 0
      ? rangeMarkValueAcrossSegments(range, blocks.value, visibleBlocks.value, 'highlight')
      : null

  const types = new Set(segments.map(s => s.block.type))
  const mixedTypes = types.size > 1
  const blockType = first?.block.type ?? fallbackBlock!.type
  const position = positionBesideSelection(bounds)

  return {
    blockId: first?.blockId ?? fallbackBlock!.id,
    range: first ? { start: first.start, end: first.end } : { start: 0, end: 0 },
    position,
    placement: 'beside',
    activeMarks: marks,
    currentLink,
    currentColor,
    currentHighlight,
    blockType,
    multiBlock: true,
    mixedTypes,
    textRange: range,
  }
}

function refreshManagedBubble() {
  if (!props.showBubbleToolbar || props.readonly || !hasActiveManagedSelection()) return
  if (!textRangeSelection.value) return
  bubble.value = computeManagedBubble(textRangeSelection.value)
}

function onSelectionChange() {
  if (props.readonly) {
    bubble.value = null
    savedInlineSelection = null
    return
  }

  // Managed multi-block selection owns the bubble via the watch below.
  if (hasActiveManagedSelection()) return

  const sel = window.getSelection()

  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
    // Link/color inputs steal focus and collapse the native selection; keep
    // the bubble range so Set/Enter/Remove still apply to the snapshot.
    if (suppressBubbleClear || isToolbarOrOverlayTarget(document.activeElement)) {
      return
    }
    bubble.value = null
    savedInlineSelection = null
    return
  }

  const node = sel.anchorNode
  const el = node?.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node?.parentElement
  const blockEl = el?.closest('[data-block-id]')

  if (!blockEl || !rootEl.value?.contains(blockEl)) {
    if (suppressBubbleClear || isToolbarOrOverlayTarget(document.activeElement)) {
      return
    }
    bubble.value = null
    savedInlineSelection = null
    return
  }

  const id = blockEl.getAttribute('data-block-id')
  const block = id ? byId(id) : undefined

  if (!block || !isTextBlock(block.type)) {
    if (suppressBubbleClear || isToolbarOrOverlayTarget(document.activeElement)) {
      return
    }
    bubble.value = null
    savedInlineSelection = null
    return
  }

  const range = itemRefs.get(block.id)?.getSelection()
  const rect = getSelectionClientRect()

  if (!range || range.start === range.end || !rect) {
    if (suppressBubbleClear || isToolbarOrOverlayTarget(document.activeElement)) {
      return
    }
    bubble.value = null
    savedInlineSelection = null
    return
  }

  savedInlineSelection = {
    blockId: block.id,
    start: range.start,
    end: range.end,
  }
  bubble.value = computeBubble(block, range, rect)
}

function resolveBubbleTextRange(state: BubbleState): TextRangeSelection | null {
  if (state.textRange) return state.textRange
  if (state.multiBlock) return textRangeSelection.value
  return null
}

function onBubbleMark(mark: MarkName, value: boolean | string | null) {
  const state = bubble.value
  if (!state) return

  const multiRange = resolveBubbleTextRange(state)
  if (state.multiBlock && multiRange) {
    const booleanMarks = ['bold', 'italic', 'underline', 'strikethrough', 'code'] as MarkName[]
    let markValue: boolean | string | null = value === false ? null : value

    if (booleanMarks.includes(mark) && typeof value === 'boolean') {
      const applied = rangeHasMarkAcrossSegments(
        multiRange,
        blocks.value,
        visibleBlocks.value,
        mark,
      )
      markValue = applied ? null : true
    }

    applyMarkToTextRange(blocks.value, multiRange, visibleBlocks.value, mark, markValue)

    // Restore managed selection if a toolbar mousedown cleared it mid-gesture.
    if (!hasActiveManagedSelection()) {
      setManagedTextRange(multiRange.anchor, multiRange.focus)
    }

    pushHistory(true)
    contentRevision.value++
    refreshManagedBubble()
    return
  }

  const block = byId(state.blockId)
  if (!block) return

  block.content = applyMarkToRange(
    block.content,
    state.range.start,
    state.range.end,
    mark,
    value === false ? null : value,
  )

  // Refresh bubble mark state immediately so link Remove/active UI updates
  // even while focus is still in the URL input.
  const nextMarks: Partial<Record<MarkName, boolean>> = {}
  for (const m of ['bold', 'italic', 'underline', 'strikethrough', 'code'] as MarkName[]) {
    nextMarks[m] = rangeHasMark(block.content, state.range.start, state.range.end, m)
  }
  bubble.value = {
    ...state,
    activeMarks: nextMarks,
    currentLink: rangeMarkValue(block.content, state.range.start, state.range.end, 'link'),
    currentColor: rangeMarkValue(block.content, state.range.start, state.range.end, 'color'),
    currentHighlight: rangeMarkValue(block.content, state.range.start, state.range.end, 'highlight'),
  }
  savedInlineSelection = {
    blockId: block.id,
    start: state.range.start,
    end: state.range.end,
  }

  pushHistory(true)
  contentRevision.value++
  nextTick(() => {
    itemRefs.get(block.id)?.setSelection(state.range.start, state.range.end)
  })
}

function onBubbleClearFormatting() {
  const state = bubble.value
  if (!state) return

  const multiRange = resolveBubbleTextRange(state)
  if (state.multiBlock && multiRange) {
    for (const mark of CLEARABLE_MARKS) {
      applyMarkToTextRange(blocks.value, multiRange, visibleBlocks.value, mark, null)
    }

    if (!hasActiveManagedSelection()) {
      setManagedTextRange(multiRange.anchor, multiRange.focus)
    }

    pushHistory(true)
    contentRevision.value++
    refreshManagedBubble()
    return
  }

  const block = byId(state.blockId)
  if (!block || !isTextBlock(block.type)) return

  let content = block.content
  for (const mark of CLEARABLE_MARKS) {
    content = applyMarkToRange(content, state.range.start, state.range.end, mark, null)
  }
  block.content = content
  pushHistory(true)
  nextTick(() => {
    itemRefs.get(block.id)?.setSelection(state.range.start, state.range.end)
  })
}

async function onBubbleCopy() {
  const toCopy = getBlocksForClipboard()
  if (!toCopy?.length) return

  const { plain, html } = blocksToClipboardPayload(toCopy)
  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/plain': new Blob([plain], { type: 'text/plain' }),
        'text/html': new Blob([html], { type: 'text/html' }),
      }),
    ])
  } catch {
    try {
      await navigator.clipboard.writeText(plain)
    } catch {
      /* clipboard unavailable */
    }
  }
}

function onBubbleDuplicate() {
  if (!hasActiveManagedSelection() || !textRangeSelection.value) return

  const extracted = extractTextRangeAsBlocks(
    textRangeSelection.value,
    blocks.value,
    visibleBlocks.value,
  )
  if (!extracted.length) return

  const normalized = normalizeTextRange(textRangeSelection.value, visibleBlocks.value)
  if (!normalized) return

  const endIdx = blocks.value.findIndex(b => b.id === normalized.endBlockId)
  if (endIdx === -1) return

  blocks.value.splice(endIdx + 1, 0, ...extracted)
  pushHistory(true)
}

function onBubbleDelete() {
  if (hasActiveManagedSelection()) {
    deleteManagedTextRange()
    bubble.value = null
  }
}

function onBubbleAskAI() {
  const pos = bubble.value?.position
  openAIMenu(pos ? { x: pos.x, y: pos.y } : undefined)
}

function onBubbleTurnInto(type: BlockType) {
  turnIntoBlock(type)
}

function turnIntoBlock(type: BlockType) {
  const state = bubble.value
  const multiRange = state ? resolveBubbleTextRange(state) : textRangeSelection.value

  if ((state?.multiBlock || hasActiveManagedSelection()) && multiRange) {
    const segments = getTextRangeSegments(multiRange, blocks.value, visibleBlocks.value)
    let changed = false

    for (const segment of segments) {
      const block = byId(segment.blockId)
      if (!block || !isTextBlock(block.type)) continue
      const defaults = makeBlock(type)
      block.type = type
      block.props = { ...defaults.props, indent: block.props.indent, dir: block.props.dir }
      changed = true
    }

    if (changed) {
      if (!hasActiveManagedSelection()) {
        setManagedTextRange(multiRange.anchor, multiRange.focus)
      }
      pushHistory(true)
      contentRevision.value++
      refreshManagedBubble()
    }
    return
  }

  const blockId = state?.blockId ?? focusedBlockId.value
  if (!blockId) return

  const block = byId(blockId)
  if (!block || !isTextBlock(block.type)) return

  const range = state?.range ?? itemRefs.get(block.id)?.getSelection() ?? { start: 0, end: 0 }
  const defaults = makeBlock(type)
  block.type = type
  block.props = { ...defaults.props, indent: block.props.indent, dir: block.props.dir }
  pushHistory(true)
  nextTick(() => itemRefs.get(block.id)?.setSelection(range.start, range.end))
}

watch(
  [() => props.showBubbleToolbar, () => props.readonly, textRangeSelection, managedTextSelection, contentRevision, visibleBlocks],
  () => {
    if (!props.showBubbleToolbar || props.readonly) {
      if (bubble.value?.multiBlock) bubble.value = null
      return
    }

    if (!hasActiveManagedSelection() || !textRangeSelection.value) {
      if (bubble.value?.multiBlock) bubble.value = null
      return
    }

    bubble.value = computeManagedBubble(textRangeSelection.value)
  },
)

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

  const live = itemRefs.get(block.id)?.getSelection()
  const saved = savedInlineSelection
  const sel =
    live && live.start !== live.end
      ? live
      : saved && saved.blockId === block.id && saved.start !== saved.end
        ? { start: saved.start, end: saved.end }
        : null

  if (!sel) {
    return
  }

  block.content = applyMarkToRange(block.content, sel.start, sel.end, mark, value === false ? null : value)
  savedInlineSelection = {
    blockId: block.id,
    start: sel.start,
    end: sel.end,
  }
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
        multiBlock: bubble.value.multiBlock,
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

    const currentLink = rangeMarkValueAcrossSegments(
      textRangeSelection.value,
      blocks.value,
      visibleBlocks.value,
      'link',
    )
    const currentColor = rangeMarkValueAcrossSegments(
      textRangeSelection.value,
      blocks.value,
      visibleBlocks.value,
      'color',
    )
    const currentHighlight = rangeMarkValueAcrossSegments(
      textRangeSelection.value,
      blocks.value,
      visibleBlocks.value,
      'highlight',
    )

    return {
      blockId: first.blockId,
      blockType: block.type,
      activeMarks: marks,
      currentLink,
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
      const live = itemRefs.get(block.id)?.getSelection()
      const saved = savedInlineSelection
      const sel =
        live && live.start !== live.end
          ? live
          : saved && saved.blockId === block.id && saved.start !== saved.end
            ? { start: saved.start, end: saved.end }
            : null
      const hasSelection = !!sel && sel.start !== sel.end
      const marks: Partial<Record<MarkName, boolean>> = {}

      if (hasSelection && sel) {
        for (const m of ['bold', 'italic', 'underline', 'strikethrough', 'code'] as MarkName[]) {
          marks[m] = rangeHasMark(block.content, sel.start, sel.end, m)
        }
      }

      const currentLink = hasSelection && sel
        ? rangeMarkValue(block.content, sel.start, sel.end, 'link')
        : null
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
        currentLink,
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

  const fromBlock = blocks.value[fromIdx]
  const moveLen = isToggleBlock(fromBlock.type)
    ? getToggleSubtreeLength(blocks.value, fromIdx)
    : 1

  // Don't drop a toggle onto one of its own children.
  const targetIdxBefore = blocks.value.findIndex(b => b.id === target.id)
  if (
    targetIdxBefore !== -1 &&
    targetIdxBefore >= fromIdx &&
    targetIdxBefore < fromIdx + moveLen
  ) {
    return
  }

  const moved = blocks.value.splice(fromIdx, moveLen)
  let toIdx = blocks.value.findIndex(b => b.id === target.id)

  if (toIdx === -1) {
    blocks.value.splice(fromIdx, 0, ...moved)
    return
  }

  if (target.position === 'after') {
    const targetBlock = blocks.value[toIdx]
    const targetSpan = isToggleBlock(targetBlock.type)
      ? getToggleSubtreeLength(blocks.value, toIdx)
      : 1
    toIdx += targetSpan
  }

  blocks.value.splice(toIdx, 0, ...moved)
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

  // Empty blocks have nowhere to "select"; treat as not fully selected so the
  // first Ctrl+A advances the stage without jumping to the whole document.
  if (len === 0) {
    return false
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
    return false
  }

  return textarea.selectionStart === 0 && textarea.selectionEnd >= len
}

function selectAllTextInBlock(block: Block) {
  if (isTextBlock(block.type)) {
    const len = spansToText(block.content).length
    itemRefs.get(block.id)?.setSelection(0, len)
    focusedBlockId.value = block.id
    selectedBlockId.value = null

    return
  }

  if (block.type === 'code') {
    const blockEl = rootEl.value?.querySelector(`[data-block-id="${block.id}"]`)
    const textarea = blockEl?.querySelector('textarea') as HTMLTextAreaElement | null

    if (textarea) {
      textarea.focus()
      textarea.setSelectionRange(0, textarea.value.length)
      focusedBlockId.value = block.id
      selectedBlockId.value = null
    }
  }
}

function isActiveBlockFullySelected(block: Block, blockEl: Element | null): boolean {
  if (isTextBlock(block.type)) {
    return isFullTextBlockContentSelected(block)
  }

  if (block.type === 'code') {
    return isFullCodeBlockSelected(blockEl as HTMLElement | null)
  }

  return selectedBlockId.value === block.id
}

function selectActiveBlockForSelectAll(block: Block) {
  if (isTextBlock(block.type) || block.type === 'code') {
    selectAllTextInBlock(block)

    return
  }

  // Media / button / divider / table: select block chrome first.
  selectBlock(block.id)
}

function handleSelectAllShortcut(target: HTMLElement) {
  const block = resolveActiveBlock(target)
  const foundBlockEl =
    target.closest('[data-block-id]')
    ?? (block ? rootEl.value?.querySelector(`[data-block-id="${block.id}"]`) : null)
  const blockEl: Element | null = foundBlockEl ?? null

  const documentAlreadySelected = isAllTextBlocksSelected()
  // Partial managed ranges (shift-drag etc.) escalate straight to the document.
  const blockAlreadySelected =
    (!!block && isActiveBlockFullySelected(block, blockEl))
    || (hasActiveManagedSelection() && !documentAlreadySelected)
  const decision = resolveSelectAllShortcut({
    stage: selectAllStage,
    documentAlreadySelected,
    blockAlreadySelected,
    hasActiveBlock: !!block,
  })

  selectAllStage = decision.stage

  if (decision.action === 'noop') {
    return
  }

  if (decision.action === 'select-document') {
    selectAllBlocks()

    return
  }

  if (block) {
    selectActiveBlockForSelectAll(block)
  }
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

      // Empty query shows the full grid — keep it open; user clicks an emoji.
      if (!q) {
return
}

      const match = ALL_EMOJIS.find(en => en.name.includes(q) || en.keywords.some(k => k.includes(q)))

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

  const mod = e.ctrlKey || e.metaKey
  const isSelectAllShortcut = mod && e.key.toLowerCase() === 'a'

  // Select-all must run even when focus is inside contenteditable/textarea —
  // otherwise the browser handles the first Ctrl+A and the second never escalates.
  if (isSelectAllShortcut) {
    const target = e.target as HTMLElement

    if (rootEl.value?.contains(target)) {
      e.preventDefault()
      e.stopPropagation()
      handleSelectAllShortcut(target)

      return
    }
  }

  // Modifier-only keydowns (Cmd/Ctrl before 'A') must not clear the stage.
  const isModifierOnly =
    e.key === 'Meta' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Shift'
  if (!isModifierOnly) {
    resetSelectAllStage()
  }

  // Undo/redo must run even when focus is inside contenteditable/textarea —
  // otherwise the browser's field-local undo steals the shortcut and document
  // history never runs (same class of bug as select-all).
  const historyAction = resolveHistoryShortcut({
    key: e.key,
    ctrlKey: e.ctrlKey,
    metaKey: e.metaKey,
    shiftKey: e.shiftKey,
  })

  if (historyAction) {
    const target = e.target as HTMLElement

    if (rootEl.value?.contains(target)) {
      e.preventDefault()
      e.stopPropagation()

      if (historyAction === 'redo') {
        redo()
      } else {
        undo()
      }

      return
    }
  }

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

    // Keep focus on the editor root for clipboard shortcuts while a
    // multi-block range is active (even if a contenteditable still has focus).
    if (mod && (e.key.toLowerCase() === 'c' || e.key.toLowerCase() === 'x' || e.key.toLowerCase() === 'v')) {
      nextTick(() => rootEl.value?.focus())
    }
  }

  if (isNativeInputTarget(e.target) && !hasActiveManagedSelection()) {
    return
  }

  if (e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
    const baseBlockId = focusedBlockId.value
      ?? textRangeSelection.value?.focus.blockId
      ?? selectedBlockId.value

    if (!baseBlockId) {
      return
    }

    const neighbor = neighborBlock(baseBlockId, e.key === 'ArrowDown' ? 1 : -1)

    if (neighbor) {
      e.preventDefault()
      e.stopPropagation()

      const anchor = resolveSelectionAnchor() ?? { blockId: baseBlockId, offset: 0 }
      const focusOffset = e.key === 'ArrowDown'
        ? selectionEndOffset(neighbor)
        : 0

      setManagedTextRange(anchor, { blockId: neighbor.id, offset: focusOffset })

      return
    }
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

  resetSelectAllStage()

  // Text blocks handle shift-extend via selection-pointer-down on `.etb`.
  if (e.shiftKey && !target.closest('.etb')) {
    const point = rootEl.value
      ? caretPointFromClient(rootEl.value, e.clientX, e.clientY)
      : null
    const focus = point ?? { blockId: block.id, offset: selectionEndOffset(block) }
    const anchor = resolveSelectionAnchor() ?? { blockId: block.id, offset: 0 }

    setManagedTextRange(anchor, focus)
    e.preventDefault()

    return
  }

  if (!isTextBlock(block.type) && e.button === 0) {
    if (hasActiveManagedSelection()) {
      clearTextRangeSelection()
    }

    const point = rootEl.value
      ? caretPointFromClient(rootEl.value, e.clientX, e.clientY)
      : null
    const start = point ?? { blockId: block.id, offset: 0 }

    isDragSelecting = true
    dragSelectAnchor = start
    textRangeSelection.value = { anchor: start, focus: start }
    managedTextSelection.value = false
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

  if (
    point.blockId !== dragSelectAnchor.blockId
    || isManagedMultiBlockRange({ anchor: dragSelectAnchor, focus: point }, visibleBlocks.value)
  ) {
    managedTextSelection.value = true
    selectedBlockId.value = null
    focusedBlockId.value = null
    window.getSelection()?.removeAllRanges()
  }
}

function onDocPointerUp() {
  if (isDragSelecting) {
    finalizeTextRangeSelection()

    if (hasActiveManagedSelection()) {
      suppressNextBlockSelect = true
    }
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

function onDocMouseDownCapture(e: MouseEvent) {
  const target = e.target as HTMLElement
  // Capture phase so toolbar stopPropagation still lets us see the gesture.
  suppressBubbleClear = isToolbarOrOverlayTarget(target)
}

function onDocMouseDown(e: MouseEvent) {
  const target = e.target as HTMLElement

  if (isToolbarOrOverlayTarget(target)) {
    return
  }

  // Clicking away with a collapsed selection dismisses a single-block bubble
  // that was kept alive for the link/color inputs.
  if (bubble.value && !bubble.value.multiBlock && !hasActiveManagedSelection()) {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed) {
      bubble.value = null
      savedInlineSelection = null
    }
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
  openAIMenu,
  closeAIMenu,
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
      :selected="isBlockChromeSelected(block.id)"
      :text-highlight="textHighlightForBlock(block.id)"
      :drop-position="dropTarget && dropTarget.id === block.id ? dropTarget.position : null"
      :upload="upload"
      :pick-media="pickMedia"
      :fetch-bookmark-meta="fetchBookmarkMeta"
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
      :ai-enabled="typeof props.ai?.transport === 'function'"
      @add-below="addBelow(block)"
      @duplicate="duplicateBlock(block)"
      @copy="() => void copyBlock(block)"
      @cut="() => void cutBlock(block)"
      @remove="removeBlock(block)"
      @turn-into="t => turnBlockInto(block, t)"
      @ask-ai="openAIMenu()"
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
      :ai-enabled="typeof props.ai?.transport === 'function'"
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
      :placement="bubble.placement"
      :active-marks="bubble.activeMarks"
      :current-link="bubble.currentLink"
      :current-color="bubble.currentColor"
      :current-highlight="bubble.currentHighlight"
      :block-type="bubble.blockType"
      :multi-block="bubble.multiBlock"
      :mixed-types="bubble.mixedTypes"
      :ai-enabled="typeof props.ai?.transport === 'function'"
      :theme-source="rootEl"
      @mark="onBubbleMark"
      @turn-into="onBubbleTurnInto"
      @clear-formatting="onBubbleClearFormatting"
      @ask-ai="onBubbleAskAI"
      @copy="onBubbleCopy"
      @duplicate="onBubbleDuplicate"
      @delete="onBubbleDelete"
    />

    <EditorAIMenu
      v-if="aiMenu && props.ai?.transport && !readonly"
      :open="true"
      :position="aiMenu.position"
      :transport="props.ai.transport"
      :commands="props.ai.commands"
      :blocks="blocks"
      :selection-blocks="getAISelectionBlocks()"
      :focus-block-id="focusedBlockId ?? selectedBlockId"
      :theme-source="rootEl"
      @apply="replaceDocumentBlocks"
      @close="closeAIMenu"
    />
  </div>
</template>

<style scoped>
.block-editor {
  background: var(--xpe-background, #fff);
  color: var(--xpe-foreground, #1f2937);
}
</style>
