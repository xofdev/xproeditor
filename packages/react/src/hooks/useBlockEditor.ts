import { useEffect, useMemo, useRef, useState } from 'react'
import { ALL_EMOJIS } from '../ui/emojiData'
import {
  applyMarkToRange,
  applyMarkToTextRange,
  blocksToClipboardPayload,
  blockTypeForFile,
  caretPointFromClient,
  cloneBlock,
  cloneToggleSubtree,
  computeListNumbering,
  createBlock,
  deleteRangeInSpans,
  deleteTextRange,
  extractTextRangeAsBlocks,
  fileToObjectUrl,
  fullBlockTextRange,
  getCaretClientRect,
  getRangeClientRects,
  getSelectionClientRect,
  getTextRangeSegments,
  normalizeTextRange,
  getToggleSubtreeLength,
  htmlToBlocks,
  isBlockCoveredByTextRange,
  isCrossBlockTextRange,
  isFullDocumentRange,
  isManagedMultiBlockRange,
  isTextBlock,
  isTextRangeCollapsed,
  isToggleBlock,
  resolveHistoryShortcut,
  resolveSelectAllShortcut,
  mediaPropsFromFile,
  selectionEndOffset,
  normalizeSpans,
  normalizeTableData,
  nextVisibleCellCoord,
  parseBlocksFromClipboardData,
  patchTableCell,
  patchTableCellsBackground,
  patchTableStyle,
  plainHeadingFromToggle,
  rangeHasMark,
  rangeHasMarkAcrossSegments,
  rangeMarkValue,
  rangeMarkValueAcrossSegments,
  removeToggleSubtree,
  spansToText,
  splitSpansAt,
  tryParseMarkdownToBlocks,
  writeBlocksToClipboardData,
} from '@xproeditor/core'
import type {
  AICommand,
  AITransport,
  Block,
  BlockType,
  FetchBookmarkMetaFn,
  InlineSpan,
  MarkName,
  TableCellAlign,
  TableCellCoord,
  TableStyle,
  SelectAllStage,
  TextPoint,
  TextRangeSelection,
} from '@xproeditor/core'
import type {
  BlockItemHandle,
  FormatToolbarAlign,
  FormatToolbarState,
  PickMediaFn,
  SlashItem,
  UploadFn,
} from '../types'

export interface UseBlockEditorOptions {
  /** Seed content. The hook owns the blocks afterwards (uncontrolled, like `<input defaultValue>`). */
  defaultValue: Block[]
  upload?: UploadFn
  pickMedia?: PickMediaFn
  /** Optional link-preview metadata fetcher for bookmark blocks. */
  fetchBookmarkMeta?: FetchBookmarkMetaFn
  /** Default text direction for new blocks. */
  editorDir?: 'ltr' | 'rtl'
  readonly?: boolean
  /** Floating bubble toolbar on text selection (Notion-like). */
  showBubbleToolbar?: boolean
  /** Optional pluggable AI agent (slash `/ai` + toolbar). */
  ai?: {
    transport: AITransport
    commands?: AICommand[]
  }
  onChange?: (blocks: Block[]) => void
  onFormatState?: (state: FormatToolbarState | null) => void
}

interface SlashState {
  blockId: string
  index: number
  query: string
  position: { x: number; y: number; top?: number }
}

interface EmojiTriggerState {
  blockId: string
  index: number
  query: string
  position: { x: number; y: number; top?: number }
  /** Chars before the query to strip on select (`:` = 1; slash-opened = 0). */
  prefixLen: number
}

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

const TEXT_BLOCK_TYPES_FOR_ENTER = [
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
const KEEP_TYPE_ON_ENTER = ['bulleted_list_item', 'numbered_list_item', 'to_do', 'quote']
const BOOLEAN_MARKS: MarkName[] = ['bold', 'italic', 'underline', 'strikethrough', 'code']

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

/**
 * Framework-level state machine for the block editor: history, cross-block
 * selection, slash menu, bubble toolbar, clipboard, drag & drop, and
 * keyboard shortcuts. Mirrors `@xproeditor/vue`'s `BlockEditor.vue` 1:1.
 *
 * The block array is owned internally (uncontrolled) — mutated directly for
 * performance, with `onChange` firing whenever a change should be persisted.
 * A `version` counter forces re-render after in-place mutations.
 */
export function useBlockEditor(options: UseBlockEditorOptions) {
  const {
    readonly = false,
    editorDir,
    showBubbleToolbar = false,
    upload,
    pickMedia,
    fetchBookmarkMeta,
    ai,
  } = options
  const onChangeRef = useRef(options.onChange)
  onChangeRef.current = options.onChange
  const onFormatStateRef = useRef(options.onFormatState)
  onFormatStateRef.current = options.onFormatState

  const blocksRef = useRef<Block[]>(
    options.defaultValue.length ? options.defaultValue : [makeBlock('paragraph')],
  )
  const [version, setVersion] = useState(0)
  const rerender = () => setVersion((v) => v + 1)

  const rootRef = useRef<HTMLDivElement | null>(null)
  const itemRefs = useRef(new Map<string, BlockItemHandle>())
  const slashMenuApiRef = useRef<{ move: (dir: 1 | -1) => void; confirm: () => void } | null>(null)

  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null)
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [focusedTableCell, setFocusedTableCell] = useState<{
    blockId: string
    row: number
    col: number
  } | null>(null)
  const [tableSelectedCells, setTableSelectedCells] = useState<TableCellCoord[]>([])
  const [textRangeSelection, setTextRangeSelection] = useState<TextRangeSelection | null>(null)
  const [managedTextSelection, setManagedTextSelectionFlag] = useState(false)
  const [slashState, setSlashState] = useState<SlashState | null>(null)
  const [emojiTriggerState, setEmojiTriggerState] = useState<EmojiTriggerState | null>(null)
  const [iconPickerRequest, setIconPickerRequest] = useState<{
    blockId: string
    tab: 'emoji' | 'icon'
  } | null>(null)
  const [bubble, setBubble] = useState<BubbleState | null>(null)
  const [aiMenu, setAiMenu] = useState<{ position: { x: number; y: number } } | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<{ id: string; position: 'before' | 'after' } | null>(
    null,
  )

  const dragSelectAnchorRef = useRef<TextPoint | null>(null)
  const isDragSelectingRef = useRef(false)
  const textRangeSelectionRef = useRef<TextRangeSelection | null>(null)
  const managedTextSelectionRef = useRef(false)
  const draggingIdRef = useRef<string | null>(null)
  /** Ignore the click that follows a multi-block drag (media blocks emit select on click). */
  const suppressNextBlockSelectRef = useRef(false)
  /** Ctrl/Cmd+A stage: none → current block → whole document. */
  const selectAllStageRef = useRef<SelectAllStage>('none')
  /**
   * Keep the bubble (and its range snapshot) while the user focuses toolbar
   * inputs such as the link URL field — focusing those collapses the native
   * selection and would otherwise dismiss the bubble before Set/Enter applies.
   */
  const suppressBubbleClearRef = useRef(false)
  /** Last non-collapsed inline selection — fallback when native selection was stolen by a toolbar input. */
  const savedInlineSelectionRef = useRef<{
    blockId: string
    start: number
    end: number
  } | null>(null)

  textRangeSelectionRef.current = textRangeSelection
  managedTextSelectionRef.current = managedTextSelection
  draggingIdRef.current = draggingId

  const afterRenderQueue = useRef<Array<() => void>>([])
  function afterRender(fn: () => void) {
    afterRenderQueue.current.push(fn)
    rerender()
  }
  useEffect(() => {
    if (afterRenderQueue.current.length === 0) return
    const queue = afterRenderQueue.current
    afterRenderQueue.current = []
    queue.forEach((fn) => fn())
  })

  function blockDirOptions(): { defaultDir?: 'ltr' | 'rtl' } | undefined {
    return editorDir === 'rtl' ? { defaultDir: 'rtl' } : undefined
  }

  function makeBlockLocal(type: BlockType, partial: Partial<Block> = {}): Block {
    return createBlock(type, partial, blockDirOptions())
  }

  function byId(id: string): Block | undefined {
    return blocksRef.current.find((b) => b.id === id)
  }

  function setItemRef(id: string, handle: BlockItemHandle | null) {
    if (handle) itemRefs.current.set(id, handle)
    else itemRefs.current.delete(id)
  }

  // ─── History (undo / redo) ────────────────────────────────────────────────
  const historyRef = useRef<string[]>([])
  const historyIndexRef = useRef(0)
  const historyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [, setHistoryTick] = useState(0)

  function snapshot(): string {
    return JSON.stringify(blocksRef.current)
  }

  function commitSnapshot() {
    if (historyTimerRef.current) {
      clearTimeout(historyTimerRef.current)
      historyTimerRef.current = null
    }

    const snap = snapshot()
    if (historyRef.current[historyIndexRef.current] === snap) return

    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1)
    historyRef.current.push(snap)

    if (historyRef.current.length > 200) historyRef.current.shift()

    historyIndexRef.current = historyRef.current.length - 1
    setHistoryTick((t) => t + 1)
  }

  function pushHistory(immediate = false) {
    if (readonly) return

    onChangeRef.current?.(blocksRef.current)

    if (immediate) {
      commitSnapshot()
    } else {
      if (historyTimerRef.current) clearTimeout(historyTimerRef.current)
      historyTimerRef.current = setTimeout(commitSnapshot, 400)
    }

    rerender()
  }

  /** Bumps a re-render + notifies `onChange` without committing an undo step (mirrors bare `contentRevision++`). */
  function bumpRevision() {
    onChangeRef.current?.(blocksRef.current)
    rerender()
  }

  function restoreSnapshot(json: string) {
    const arr = JSON.parse(json) as Block[]
    blocksRef.current = arr
    ensureNotEmpty()
    onChangeRef.current?.(blocksRef.current)
    rerender()
  }

  function undo() {
    if (historyTimerRef.current) commitSnapshot()
    if (historyIndexRef.current <= 0) return
    historyIndexRef.current -= 1
    restoreSnapshot(historyRef.current[historyIndexRef.current])
  }

  function redo() {
    if (historyIndexRef.current >= historyRef.current.length - 1) return
    historyIndexRef.current += 1
    restoreSnapshot(historyRef.current[historyIndexRef.current])
  }

  function resetHistory() {
    if (historyTimerRef.current) {
      clearTimeout(historyTimerRef.current)
      historyTimerRef.current = null
    }

    historyRef.current = [snapshot()]
    historyIndexRef.current = 0
  }

  function ensureNotEmpty() {
    if (blocksRef.current.length === 0) blocksRef.current.push(makeBlockLocal('paragraph'))
  }

  useEffect(() => {
    ensureNotEmpty()
    resetHistory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!readonly) return
    setSlashState(null)
    setBubble(null)
    setSelectedBlockId(null)
    clearTextRangeSelection()
  }, [readonly])

  useEffect(() => {
    return () => {
      if (historyTimerRef.current) clearTimeout(historyTimerRef.current)
    }
  }, [])

  const canUndo = historyIndexRef.current > 0 || historyTimerRef.current !== null
  const canRedo = historyIndexRef.current < historyRef.current.length - 1

  // ─── Focus / selection helpers ────────────────────────────────────────────

  function focusBlock(id: string, pos: number | 'start' | 'end') {
    const block = byId(id)
    if (!block) return

    if (!isTextBlock(block.type) && block.type !== 'code') {
      selectBlock(id)
      return
    }

    setSelectedBlockId(null)
    afterRender(() => itemRefs.current.get(id)?.focusAt(pos))
  }

  function hasActiveManagedSelection(): boolean {
    const range = textRangeSelectionRef.current
    return (
      managedTextSelectionRef.current &&
      range !== null &&
      !isTextRangeCollapsed(range, visibleBlocks)
    )
  }

  function textHighlightForBlock(id: string): { start: number; end: number } | null {
    if (!hasActiveManagedSelection() || !textRangeSelection) return null

    const segments = getTextRangeSegments(textRangeSelection, blocksRef.current, visibleBlocks)
    const segment = segments.find((s) => s.blockId === id)

    return segment ? { start: segment.start, end: segment.end } : null
  }

  /** Non-text blocks (media/code/divider/table) highlighted inside a multi-block range. */
  function isBlockChromeSelected(id: string): boolean {
    if (selectedBlockId === id) return true
    if (!hasActiveManagedSelection() || !textRangeSelection) return false
    const block = byId(id)
    if (!block || isTextBlock(block.type)) return false
    return isBlockCoveredByTextRange(id, textRangeSelection, blocksRef.current, visibleBlocks)
  }

  function clearTextRangeSelection(): void {
    textRangeSelectionRef.current = null
    managedTextSelectionRef.current = false
    setTextRangeSelection(null)
    setManagedTextSelectionFlag(false)
  }

  function setManagedTextRange(anchor: TextPoint, focus: TextPoint) {
    const next = { anchor, focus }
    textRangeSelectionRef.current = next
    managedTextSelectionRef.current = true
    setTextRangeSelection(next)
    setManagedTextSelectionFlag(true)
    setSelectedBlockId(null)
    setFocusedBlockId(null)
    closeSlash()
    window.getSelection()?.removeAllRanges()
    afterRender(() => rootRef.current?.focus())
  }

  function selectAllBlocks() {
    const range = fullBlockTextRange(visibleBlocks)
    if (!range) return

    setManagedTextRange(range.anchor, range.focus)
    afterRender(() => rootRef.current?.focus())
  }

  function deleteManagedTextRange() {
    const range = textRangeSelectionRef.current
    if (!range) return

    const result = deleteTextRange(blocksRef.current, range, visibleBlocks)
    clearTextRangeSelection()
    ensureNotEmpty()
    pushHistory(true)

    if (result) {
      focusBlock(result.focusBlockId, result.focusOffset)
    } else {
      const first = visibleBlocks[0]
      if (first) focusBlock(first.id, 'start')
    }
  }

  function isAllTextBlocksSelected(): boolean {
    const range = textRangeSelectionRef.current
    if (!hasActiveManagedSelection() || !range) return false
    return isFullDocumentRange(range, visibleBlocks)
  }

  function resetSelectAllStage() {
    selectAllStageRef.current = 'none'
  }

  function resolveSelectionAnchor(): TextPoint | null {
    if (textRangeSelectionRef.current) return textRangeSelectionRef.current.anchor

    if (focusedBlockId) {
      const sel = itemRefs.current.get(focusedBlockId)?.getSelection()
      return { blockId: focusedBlockId, offset: sel?.start ?? 0 }
    }

    if (selectedBlockId) return { blockId: selectedBlockId, offset: 0 }

    return null
  }

  function finalizeTextRangeSelection() {
    const range = textRangeSelectionRef.current
    if (!range) return

    if (isManagedMultiBlockRange(range, visibleBlocks)) {
      managedTextSelectionRef.current = true
      setManagedTextSelectionFlag(true)
      setSelectedBlockId(null)
      setFocusedBlockId(null)
      window.getSelection()?.removeAllRanges()
      afterRender(() => rootRef.current?.focus())
      return
    }

    const { anchor, focus } = range
    const block = byId(anchor.blockId)
    const start = Math.min(anchor.offset, focus.offset)
    const end = Math.max(anchor.offset, focus.offset)
    const blockId = anchor.blockId

    clearTextRangeSelection()

    if (start !== end && block && isTextBlock(block.type)) {
      itemRefs.current.get(blockId)?.setSelection(start, end)
      setFocusedBlockId(blockId)
    }
  }

  function onSelectionPointerDown(
    block: Block,
    payload: { shiftKey: boolean; clientX: number; clientY: number },
  ) {
    if (readonly || !rootRef.current) return

    const point =
      caretPointFromClient(rootRef.current, payload.clientX, payload.clientY) ?? {
        blockId: block.id,
        offset: 0,
      }

    if (payload.shiftKey) {
      const anchor = resolveSelectionAnchor() ?? point

      if (point.blockId === anchor.blockId && isTextBlock(block.type)) {
        const start = Math.min(anchor.offset, point.offset)
        const end = Math.max(anchor.offset, point.offset)
        clearTextRangeSelection()
        itemRefs.current.get(point.blockId)?.setSelection(start, end)
        setFocusedBlockId(point.blockId)
        return
      }

      setManagedTextRange(anchor, point)
      return
    }

    if (hasActiveManagedSelection()) clearTextRangeSelection()

    isDragSelectingRef.current = true
    dragSelectAnchorRef.current = point
    textRangeSelectionRef.current = { anchor: point, focus: point }
    managedTextSelectionRef.current = false
    setTextRangeSelection({ anchor: point, focus: point })
    setManagedTextSelectionFlag(false)
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
    if (!(target instanceof HTMLElement)) return false
    return isFormatToolbarTarget(target) || isEditorOverlayTarget(target)
  }

  function isNativeInputTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false
    return !!target.closest('input, textarea, select, [contenteditable="true"]')
  }

  function shouldKeepNativeFocus(): boolean {
    const active = document.activeElement
    if (!(active instanceof HTMLElement)) return false
    if (isEditorOverlayTarget(active)) return true
    return !!active.closest('input, textarea, select, [role="combobox"], [role="listbox"]')
  }

  function selectBlock(id: string) {
    if (suppressNextBlockSelectRef.current) {
      suppressNextBlockSelectRef.current = false
      return
    }

    clearTextRangeSelection()
    setSelectedBlockId(id)
    setFocusedBlockId(null)
    closeSlash()
    setBubble(null)
    window.getSelection()?.removeAllRanges()
    afterRender(() => {
      if (shouldKeepNativeFocus()) return
      rootRef.current?.focus()
    })
  }

  // ─── Visibility (collapsed toggles) & numbering ───────────────────────────

  const visibleBlocks = useMemo<Block[]>(() => {
    const out: Block[] = []
    let hideDeeperThan: number | null = null

    for (const b of blocksRef.current) {
      const ind = b.props.indent ?? 0

      if (hideDeeperThan !== null) {
        if (ind > hideDeeperThan) continue
        hideDeeperThan = null
      }

      out.push(b)

      if (isToggleBlock(b.type) && b.props.collapsed) hideDeeperThan = ind
    }

    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version])

  const numbering = useMemo(() => computeListNumbering(visibleBlocks), [visibleBlocks])

  function visibleIndex(id: string): number {
    return visibleBlocks.findIndex((b) => b.id === id)
  }

  function neighborBlock(id: string, dir: 1 | -1): Block | null {
    const idx = visibleIndex(id)
    if (idx === -1) return null
    return visibleBlocks[idx + dir] ?? null
  }

  // ─── Slash menu ────────────────────────────────────────────────────────────

  function closeSlash() {
    setSlashState(null)
  }

  function slashPosition(): { x: number; y: number; top?: number } {
    // Raw caret anchor; the menu measures itself and flips/clamps to the viewport.
    const rect = getCaretClientRect()
    return { x: rect?.left ?? 100, y: rect?.bottom ?? 100, top: rect?.top ?? 100 }
  }

  function updateSlash(block: Block, spans: InlineSpan[], caret: number | null) {
    const text = spansToText(spans)

    setSlashState((state) => {
      if (state && state.blockId === block.id) {
        if (caret === null || caret <= state.index || text[state.index] !== '/') return null

        const query = text.slice(state.index + 1, caret)
        if (/\s/.test(query) || query.length > 24) return null

        return { ...state, query }
      }

      if (caret !== null && caret > 0 && text[caret - 1] === '/') {
        const before = caret >= 2 ? text[caret - 2] : ''

        if (before === '' || /\s/.test(before)) {
          return { blockId: block.id, index: caret - 1, query: '', position: slashPosition() }
        }
      }

      return state
    })
  }

  function openAIMenu(position?: { x: number; y: number }) {
    if (!ai?.transport || readonly) return
    closeSlash()
    setBubble(null)
    const pos = position ?? slashPosition()
    setAiMenu({ position: { x: pos.x, y: pos.y } })
  }

  function closeAIMenu() {
    setAiMenu(null)
    // Restore multi-select popover if the range is still active.
    if (hasActiveManagedSelection() && textRangeSelectionRef.current && showBubbleToolbar) {
      const next = computeManagedBubble(textRangeSelectionRef.current)
      setBubble(next)
    }
  }

  function getAISelectionBlocks(): Block[] {
    if (hasActiveManagedSelection() && textRangeSelection) {
      return extractTextRangeAsBlocks(textRangeSelection, blocksRef.current, visibleBlocks)
    }
    if (focusedBlockId) {
      const b = byId(focusedBlockId)
      return b ? [b] : []
    }
    if (selectedBlockId) {
      const b = byId(selectedBlockId)
      return b ? [b] : []
    }
    return []
  }

  function replaceDocumentBlocks(next: Block[], focusId: string | null) {
    blocksRef.current.splice(0, blocksRef.current.length, ...next)
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
    const state = slashState
    if (!state) return

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
      if (!block) return

      block.content = deleteRangeInSpans(block.content, index, removeEnd)
      pushHistory(true)
      focusBlock(block.id, index)
      setEmojiTriggerState({
        blockId: block.id,
        index,
        query: '',
        position: pos,
        prefixLen: 0,
      })
      return
    }

    const block = byId(state.blockId)
    closeSlash()
    if (!block) return

    const removeEnd = state.index + 1 + state.query.length
    const spans = deleteRangeInSpans(block.content, state.index, removeEnd)
    const isInsertType = ['divider', 'image', 'video', 'audio', 'file', 'table', 'code'].includes(item.type)

    if (!isInsertType) {
      const defaults = makeBlockLocal(item.type)
      block.type = item.type
      block.content = spans
      block.props = { ...defaults.props, indent: block.props.indent, dir: block.props.dir }
      pushHistory(true)
      focusBlock(block.id, Math.min(state.index, spansToText(spans).length))

      if (item.pickIcon) setIconPickerRequest({ blockId: block.id, tab: item.pickIcon })

      return
    }

    const newBlock = makeBlockLocal(item.type)

    if (spansToText(spans).trim() === '') {
      const idx = blocksRef.current.indexOf(block)
      blocksRef.current.splice(idx, 1, newBlock)
    } else {
      block.content = spans
      const idx = blocksRef.current.indexOf(block)
      blocksRef.current.splice(idx + 1, 0, newBlock)
    }

    pushHistory(true)

    if (item.type === 'code') focusBlock(newBlock.id, 'start')
    else selectBlock(newBlock.id)
  }

  // ─── Inline emoji trigger (":" — Slack/Discord-style) ─────────────────────

  function closeEmojiTrigger() {
    setEmojiTriggerState(null)
  }

  function updateEmojiTrigger(block: Block, spans: InlineSpan[], caret: number | null) {
    const text = spansToText(spans)

    setEmojiTriggerState((state) => {
      if (state && state.blockId === block.id) {
        const { prefixLen } = state

        if (caret === null || caret < state.index + prefixLen) return null
        if (prefixLen > 0 && text[state.index] !== ':') return null

        const query = text.slice(state.index + prefixLen, caret)
        if (/\s/.test(query) || query.length > 20) return null

        return { ...state, query }
      }

      if (caret !== null && caret > 0 && text[caret - 1] === ':') {
        const before = caret >= 2 ? text[caret - 2] : ''

        if (before === '' || /\s/.test(before)) {
          return {
            blockId: block.id,
            index: caret - 1,
            query: '',
            position: slashPosition(),
            prefixLen: 1,
          }
        }
      }

      return state
    })
  }

  function onEmojiTriggerSelect(emoji: string) {
    const state = emojiTriggerState
    if (!state) return

    const block = byId(state.blockId)
    closeEmojiTrigger()
    if (!block) return

    const removeEnd = state.index + state.prefixLen + state.query.length
    const withoutTrigger = deleteRangeInSpans(block.content, state.index, removeEnd)
    block.content = insertSpansAt(withoutTrigger, state.index, [{ text: emoji }])
    pushHistory(true)
    focusBlock(block.id, state.index + emoji.length)
  }

  // ─── Markdown shortcuts ────────────────────────────────────────────────────

  function tryMarkdownShortcut(block: Block, spans: InlineSpan[], caret: number | null): boolean {
    if (block.type !== 'paragraph' || caret === null) return false

    const text = spansToText(spans)

    if (text === '```' && caret === 3) {
      const defaults = makeBlockLocal('code')
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
      const idx = blocksRef.current.indexOf(block)
      const nb = makeBlockLocal('paragraph')
      blocksRef.current.splice(idx + 1, 0, nb)
      pushHistory(true)
      focusBlock(nb.id, 'start')
      return true
    }

    for (const { prefix, type } of MD_PATTERNS) {
      if (caret === prefix.length && text.startsWith(prefix)) {
        const defaults = makeBlockLocal(type)
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

  // ─── Text events ───────────────────────────────────────────────────────────

  function handleInput(block: Block, spans: InlineSpan[], caret: number | null) {
    if (readonly) return

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

    if (slashState) {
      closeEmojiTrigger()
    } else {
      updateEmojiTrigger(block, spans, caret)
    }

    pushHistory()
  }

  function handleEnter(block: Block, offsets: { start: number; end: number }) {
    const idx = blocksRef.current.indexOf(block)
    if (idx === -1) return

    const text = spansToText(block.content)

    if (TEXT_BLOCK_TYPES_FOR_ENTER.includes(block.type) && text === '') {
      const ind = block.props.indent ?? 0
      if (ind > 0) block.props.indent = ind - 1
      else {
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

    let newType: BlockType = 'paragraph'
    if (KEEP_TYPE_ON_ENTER.includes(block.type)) newType = block.type
    else if (
      (block.type.startsWith('heading') || block.type.startsWith('toggle_heading')) &&
      spansToText(after).length > 0
    ) {
      newType = block.type.startsWith('toggle_heading')
        ? (plainHeadingFromToggle(block.type) ?? 'paragraph')
        : block.type
    }

    const newProps: Block['props'] = {}
    if (block.props.indent) newProps.indent = block.props.indent
    if (block.props.dir && block.props.dir !== 'auto') newProps.dir = block.props.dir

    if (isToggleBlock(block.type)) {
      newProps.indent = (block.props.indent ?? 0) + 1
      block.props.collapsed = false
      // Notion/BlockNote: Enter in a toggle creates a child paragraph inside it.
      newType = 'paragraph'
    }

    const nb = makeBlockLocal(newType, { content: after, props: newProps })
    blocksRef.current.splice(idx + 1, 0, nb)
    pushHistory(true)
    focusBlock(nb.id, 'start')
  }

  function handleBackspaceStart(block: Block) {
    const idx = blocksRef.current.indexOf(block)
    if (idx === -1) return

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
    if (!prev) return

    if (isTextBlock(prev.type)) {
      const prevLen = spansToText(prev.content).length
      prev.content = normalizeSpans([...prev.content, ...block.content])
      blocksRef.current.splice(idx, 1)
      pushHistory(true)
      focusBlock(prev.id, prevLen)
    } else if (prev.type === 'divider') {
      blocksRef.current.splice(blocksRef.current.indexOf(prev), 1)
      pushHistory(true)
      focusBlock(block.id, 'start')
    } else if (spansToText(block.content) === '') {
      blocksRef.current.splice(idx, 1)
      pushHistory(true)

      if (prev.type === 'code') focusBlock(prev.id, 'end')
      else selectBlock(prev.id)
    } else if (prev.type === 'code') {
      focusBlock(prev.id, 'end')
    } else {
      selectBlock(prev.id)
    }
  }

  function handleDeleteEnd(block: Block) {
    const next = neighborBlock(block.id, 1)
    if (!next) return

    if (isTextBlock(next.type)) {
      const len = spansToText(block.content).length
      block.content = normalizeSpans([...block.content, ...next.content])
      blocksRef.current.splice(blocksRef.current.indexOf(next), 1)
      pushHistory(true)
      focusBlock(block.id, len)
    } else if (next.type === 'divider') {
      blocksRef.current.splice(blocksRef.current.indexOf(next), 1)
      pushHistory(true)
    }
  }

  function handleTab(block: Block, shift: boolean) {
    const current = block.props.indent ?? 0
    const next = Math.max(0, Math.min(6, current + (shift ? -1 : 1)))
    if (next === current) return

    if (next === 0) delete block.props.indent
    else block.props.indent = next

    pushHistory(true)
  }

  function handleArrow(block: Block, dir: 1 | -1) {
    const neighbor = neighborBlock(block.id, dir)
    if (!neighbor) return

    if (isTextBlock(neighbor.type) || neighbor.type === 'code')
      focusBlock(neighbor.id, dir === 1 ? 'start' : 'end')
    else selectBlock(neighbor.id)
  }

  function handleFormat(block: Block, mark: MarkName) {
    if (hasActiveManagedSelection() && textRangeSelection) {
      const has = rangeHasMarkAcrossSegments(
        textRangeSelection,
        blocksRef.current,
        visibleBlocks,
        mark,
      )
      applyMarkToTextRange(
        blocksRef.current,
        textRangeSelection,
        visibleBlocks,
        mark,
        has ? null : true,
      )
      pushHistory(true)
      return
    }

    const sel = itemRefs.current.get(block.id)?.getSelection()
    if (!sel || sel.start === sel.end) return

    const has = rangeHasMark(block.content, sel.start, sel.end, mark)
    block.content = applyMarkToRange(block.content, sel.start, sel.end, mark, has ? null : true)
    pushHistory(true)
    afterRender(() => itemRefs.current.get(block.id)?.setSelection(sel.start, sel.end))
  }

  // ─── Paste ─────────────────────────────────────────────────────────────────

  function insertSpansAt(
    content: InlineSpan[],
    offset: number,
    inserted: InlineSpan[],
  ): InlineSpan[] {
    const [before, after] = splitSpansAt(content, offset)
    return normalizeSpans([...before, ...inserted, ...after])
  }

  /** Insert dropped/pasted files as media blocks (image/video/audio/file by MIME). */
  async function insertFileBlocks(files: File[], at: number) {
    const doUpload = upload ?? fileToObjectUrl

    for (const [i, file] of files.entries()) {
      const type = blockTypeForFile(file)
      const url = await doUpload(file)
      const media = mediaPropsFromFile(file, url)
      const extra = type === 'video' ? { provider: 'file' as const } : {}
      blocksRef.current.splice(at + i, 0, makeBlockLocal(type, { props: { ...media, ...extra } }))
    }

    pushHistory(true)
  }

  async function handlePasted(
    block: Block,
    payload: { html: string; text: string; files: File[]; offsets: { start: number; end: number } },
  ) {
    const idx = blocksRef.current.indexOf(block)
    if (idx === -1) return

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
    let pastedBlocks =
      payload.html && payload.html.includes('<') ? htmlToBlocks(payload.html) : []

    if (pastedBlocks.length === 0) {
      const fromMd = tryParseMarkdownToBlocks(payload.text)
      if (fromMd?.length) pastedBlocks = fromMd
    }

    if (pastedBlocks.length === 0) {
      const text = payload.text
      if (!text) return

      const lines = text.split(/\r?\n/)

      if (lines.length === 1 || !isTextBlock(block.type)) {
        block.content = insertSpansAt(content, at, [{ text }])
        pushHistory(true)
        focusBlock(block.id, at + text.length)
      } else {
        block.content = insertSpansAt(content, at, [{ text: lines[0] }])
        const newOnes = lines
          .slice(1)
          .map((line) => makeBlockLocal('paragraph', { content: line ? [{ text: line }] : [] }))
        blocksRef.current.splice(idx + 1, 0, ...newOnes)
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
      blocksRef.current.splice(idx + 1, 0, ...others)
      pushHistory(true)
      const last = others[others.length - 1]
      if (isTextBlock(last.type)) focusBlock(last.id, 'end')
    } else {
      pushHistory(true)
      focusBlock(block.id, at + spansToText(first.content).length)
    }
  }

  // ─── Clipboard (multi-block copy / cut / paste) ──────────────────────────

  function getBlocksForClipboard(): Block[] | null {
    const range = textRangeSelectionRef.current
    if (hasActiveManagedSelection() && range) {
      const extracted = extractTextRangeAsBlocks(range, blocksRef.current, visibleBlocks)
      return extracted.length > 0 ? extracted : null
    }

    if (selectedBlockId) {
      const block = byId(selectedBlockId)
      if (!block) return null
      if (isToggleBlock(block.type)) {
        const idx = blocksRef.current.indexOf(block)
        if (idx === -1) return [block]
        const len = getToggleSubtreeLength(blocksRef.current, idx)
        return blocksRef.current.slice(idx, idx + len).map((b) => cloneBlock(b, true))
      }
      return [block]
    }

    return null
  }

  function focusAfterPaste(pasted: Block[]) {
    const last = pasted[pasted.length - 1]
    if (!last) return

    if (isTextBlock(last.type) || last.type === 'code') focusBlock(last.id, 'end')
    else selectBlock(last.id)
  }

  function insertPastedInTextBlock(block: Block, pasted: Block[], offset: number) {
    const idx = blocksRef.current.indexOf(block)
    if (idx === -1) return

    const [before, afterParts] = splitSpansAt(block.content, offset)
    const first = pasted[0]
    const rest = pasted.slice(1)
    if (!first) return

    if (isTextBlock(first.type)) {
      block.content = normalizeSpans([...before, ...first.content])
      const toInsert = [...rest]

      if (spansToText(afterParts).length > 0) {
        if (rest.length > 0) {
          const last = rest[rest.length - 1]
          if (isTextBlock(last.type)) {
            last.content = normalizeSpans([...last.content, ...afterParts])
          } else {
            toInsert.push(makeBlockLocal('paragraph', { content: afterParts }))
          }
        } else {
          block.content = normalizeSpans([...block.content, ...afterParts])
        }
      }

      if (toInsert.length > 0) blocksRef.current.splice(idx + 1, 0, ...toInsert)
    } else {
      block.content = before
      const trailing =
        spansToText(afterParts).length > 0
          ? [makeBlockLocal('paragraph', { content: afterParts })]
          : []
      blocksRef.current.splice(idx + 1, 0, ...pasted, ...trailing)
    }
  }

  function insertBlocksFromClipboard(pasted: Block[]) {
    if (pasted.length === 0) return

    const range = textRangeSelectionRef.current
    if (hasActiveManagedSelection() && range) {
      const deleteResult = deleteTextRange(blocksRef.current, range, visibleBlocks)
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

        const idx = blocksRef.current.findIndex((b) => b.id === deleteResult.focusBlockId)
        if (idx !== -1) {
          blocksRef.current.splice(idx, 0, ...pasted)
          pushHistory(true)
          focusAfterPaste(pasted)
          return
        }
      }
    }

    if (focusedBlockId) {
      const block = byId(focusedBlockId)

      if (block && isTextBlock(block.type)) {
        const offsets = itemRefs.current.get(block.id)?.getSelection() ?? { start: 0, end: 0 }
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
        const idx = blocksRef.current.indexOf(block)
        blocksRef.current.splice(idx + 1, 0, ...pasted)
        pushHistory(true)
        focusAfterPaste(pasted)
        return
      }
    }

    if (selectedBlockId) {
      const idx = blocksRef.current.findIndex((b) => b.id === selectedBlockId)

      if (idx !== -1) {
        blocksRef.current.splice(idx + 1, 0, ...pasted)
        setSelectedBlockId(null)
        pushHistory(true)
        focusAfterPaste(pasted)
        return
      }
    }

    blocksRef.current.push(...pasted)
    ensureNotEmpty()
    pushHistory(true)
    focusAfterPaste(pasted)
  }

  function removeBlocksForCut() {
    if (hasActiveManagedSelection()) {
      deleteManagedTextRange()
      return
    }

    if (selectedBlockId) {
      const block = byId(selectedBlockId)
      if (block) removeBlock(block)
    }
  }

  function onCopy(e: React.ClipboardEvent) {
    if (readonly) return

    const managed = hasActiveManagedSelection() || !!selectedBlockId
    if (!managed && isNativeInputTarget(e.target)) return

    const toCopy = getBlocksForClipboard()
    if (!toCopy?.length || !e.clipboardData) return

    e.preventDefault()
    e.stopPropagation()
    writeBlocksToClipboardData(e.clipboardData, toCopy)
  }

  function onCut(e: React.ClipboardEvent) {
    if (readonly) return

    const managed = hasActiveManagedSelection() || !!selectedBlockId
    if (!managed && isNativeInputTarget(e.target)) return

    const toCopy = getBlocksForClipboard()
    if (!toCopy?.length || !e.clipboardData) return

    e.preventDefault()
    e.stopPropagation()
    writeBlocksToClipboardData(e.clipboardData, toCopy)
    removeBlocksForCut()
  }

  function onPaste(e: React.ClipboardEvent) {
    if (readonly || !e.clipboardData) return

    const managed = hasActiveManagedSelection() || !!selectedBlockId
    if (!managed && isNativeInputTarget(e.target)) return

    const nativeBlocks = parseBlocksFromClipboardData(e.clipboardData)

    if (nativeBlocks?.length) {
      e.preventDefault()
      e.stopPropagation()
      insertBlocksFromClipboard(nativeBlocks)
      return
    }

    if (hasActiveManagedSelection() || selectedBlockId) {
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
        const lineBlocks = lines.map((line) =>
          makeBlockLocal('paragraph', { content: line ? [{ text: line }] : [] }),
        )
        e.preventDefault()
        e.stopPropagation()
        insertBlocksFromClipboard(lineBlocks)
      }
    }
  }

  // ─── Block utilities (gutter / menu actions) ─────────────────────────────

  function addBelow(block: Block) {
    if (readonly) return

    const idx = blocksRef.current.indexOf(block)
    const nb = makeBlockLocal('paragraph', {
      props: block.props.indent ? { indent: block.props.indent } : {},
    })
    blocksRef.current.splice(idx + 1, 0, nb)
    pushHistory(true)
    focusBlock(nb.id, 'start')
  }

  function blocksForToggleAction(block: Block): Block[] {
    if (!isToggleBlock(block.type)) return [block]
    const idx = blocksRef.current.indexOf(block)
    if (idx === -1) return [block]
    return cloneToggleSubtree(blocksRef.current, idx)
  }

  function duplicateBlock(block: Block) {
    if (readonly) return

    const idx = blocksRef.current.indexOf(block)
    if (idx === -1) return
    const copies = blocksForToggleAction(block)
    blocksRef.current.splice(idx + getToggleSubtreeLength(blocksRef.current, idx), 0, ...copies)
    pushHistory(true)
  }

  async function copyBlock(block: Block) {
    if (readonly) return
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
    if (readonly) return
    await copyBlock(block)
    removeBlock(block)
  }

  function turnBlockInto(block: Block, type: BlockType) {
    if (readonly || !isTextBlock(block.type)) return
    const defaults = makeBlockLocal(type)
    block.type = type
    block.props = { ...defaults.props, indent: block.props.indent, dir: block.props.dir }
    pushHistory(true)
    selectBlock(block.id)
  }

  function removeBlock(block: Block) {
    if (readonly) return

    const idx = blocksRef.current.indexOf(block)
    if (idx === -1) return

    const prev = neighborBlock(block.id, -1)
    const subtreeLen = isToggleBlock(block.type)
      ? getToggleSubtreeLength(blocksRef.current, idx)
      : 1
    const afterIdx = idx + subtreeLen
    const next =
      afterIdx < blocksRef.current.length ? blocksRef.current[afterIdx] : null

    if (isToggleBlock(block.type)) removeToggleSubtree(blocksRef.current, idx)
    else blocksRef.current.splice(idx, 1)

    ensureNotEmpty()
    pushHistory(true)
    const target = prev ?? next ?? blocksRef.current[0]

    if (target) {
      if (isTextBlock(target.type) || target.type === 'code') focusBlock(target.id, 'end')
      else selectBlock(target.id)
    }

    if (selectedBlockId === block.id) setSelectedBlockId(null)
  }

  function patchProps(block: Block, patch: Record<string, unknown>) {
    Object.assign(block.props, patch)
    pushHistory(true)
  }

  function getTableCellContext(blockId: string) {
    const block = byId(blockId)
    if (!block || block.type !== 'table') return null

    const table = normalizeTableData(block.props.table)
    const focus =
      focusedTableCell?.blockId === blockId
        ? focusedTableCell
        : tableSelectedCells[0]
          ? { blockId, row: tableSelectedCells[0].row, col: tableSelectedCells[0].col }
          : null

    if (!focus) return null

    const cell = table.rows[focus.row]?.[focus.col]
    if (!cell || cell.hidden) return null

    return { block, table, row: focus.row, col: focus.col, cell }
  }

  function onTableCellFocus(
    block: Block,
    payload: { row: number; col: number; shiftKey: boolean },
  ) {
    setFocusedBlockId(block.id)
    setFocusedTableCell({ blockId: block.id, row: payload.row, col: payload.col })
    setSelectedBlockId(null)
  }

  function onTableCellSelectionChange(block: Block, cells: TableCellCoord[]) {
    setTableSelectedCells(cells)
    if (cells[0]) setFocusedTableCell({ blockId: block.id, row: cells[0].row, col: cells[0].col })
  }

  function onTableCellInput(
    block: Block,
    payload: { row: number; col: number; content: InlineSpan[]; caret: number | null },
  ) {
    const table = normalizeTableData(block.props.table)
    const cell = table.rows[payload.row]?.[payload.col]
    if (!cell || cell.hidden) return

    cell.content = payload.content
    block.props.table = table
    bumpRevision()
  }

  function handleTableFormat(block: Block, payload: { row: number; col: number; mark: MarkName }) {
    const sel = itemRefs.current.get(block.id)?.getTableCellSelection?.(payload.row, payload.col)
    if (!sel || sel.start === sel.end) return

    const table = normalizeTableData(block.props.table)
    const cell = table.rows[payload.row]?.[payload.col]
    if (!cell || cell.hidden) return

    const has = rangeHasMark(cell.content, sel.start, sel.end, payload.mark)
    cell.content = applyMarkToRange(
      cell.content,
      sel.start,
      sel.end,
      payload.mark,
      has ? null : true,
    )
    block.props.table = table
    pushHistory(true)
    afterRender(() =>
      itemRefs.current
        .get(block.id)
        ?.setTableCellSelection?.(payload.row, payload.col, sel.start, sel.end),
    )
  }

  function handleTableTab(block: Block, payload: { row: number; col: number; shift: boolean }) {
    const table = normalizeTableData(block.props.table)
    const next = nextVisibleCellCoord(table, payload.row, payload.col, payload.shift ? -1 : 1)
    if (!next) return

    setFocusedTableCell({ blockId: block.id, row: next.row, col: next.col })
    setTableSelectedCells([{ row: next.row, col: next.col }])
    afterRender(() => itemRefs.current.get(block.id)?.focusTableCell?.(next.row, next.col, 'start'))
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
        setFocusedTableCell({ blockId: block.id, row: targetRow, col: payload.col })
        setTableSelectedCells([{ row: targetRow, col: payload.col }])
        afterRender(() =>
          itemRefs.current
            .get(block.id)
            ?.focusTableCell?.(
              targetRow,
              payload.col,
              payload.direction === 'up' ? 'end' : 'start',
            ),
        )
        return
      }

      handleArrow(block, payload.direction === 'up' ? -1 : 1)
      return
    }

    const delta = payload.direction === 'left' ? -1 : 1
    const next = nextVisibleCellCoord(table, payload.row, payload.col, delta as 1 | -1)

    if (next) {
      setFocusedTableCell({ blockId: block.id, row: next.row, col: next.col })
      setTableSelectedCells([{ row: next.row, col: next.col }])
      afterRender(() =>
        itemRefs.current
          .get(block.id)
          ?.focusTableCell?.(next.row, next.col, payload.direction === 'left' ? 'end' : 'start'),
      )
    }
  }

  function patchTableStyleForFocused(partial: Partial<TableStyle>) {
    const blockId = focusedTableCell?.blockId ?? focusedBlockId
    if (!blockId) return

    const block = byId(blockId)
    if (!block || block.type !== 'table') return

    block.props.table = patchTableStyle(normalizeTableData(block.props.table), partial)
    pushHistory(true)
  }

  function patchTableCellBackgroundForFocused(color: string | null) {
    const blockId = focusedTableCell?.blockId ?? focusedBlockId
    if (!blockId) return

    const block = byId(blockId)
    if (!block || block.type !== 'table') return

    const cells =
      tableSelectedCells.length > 0
        ? tableSelectedCells
        : focusedTableCell
          ? [{ row: focusedTableCell.row, col: focusedTableCell.col }]
          : []
    if (cells.length === 0) return

    block.props.table = patchTableCellsBackground(
      normalizeTableData(block.props.table),
      cells,
      color,
    )
    pushHistory(true)
  }

  function applyMarkToFocusedTableCell(mark: MarkName, value: boolean | string | null) {
    const context = focusedTableCell ? getTableCellContext(focusedTableCell.blockId) : null
    if (!context) return

    const sel = itemRefs.current
      .get(context.block.id)
      ?.getTableCellSelection?.(context.row, context.col)
    if (!sel || sel.start === sel.end) return

    let markValue: boolean | string | null = value === false ? null : value

    if (BOOLEAN_MARKS.includes(mark) && typeof value === 'boolean') {
      markValue = rangeHasMark(context.cell.content, sel.start, sel.end, mark) ? null : true
    }

    context.cell.content = applyMarkToRange(
      context.cell.content,
      sel.start,
      sel.end,
      mark,
      markValue,
    )
    context.block.props.table = context.table
    pushHistory(true)

    const preserveEditorFocus = mark === 'color' || mark === 'highlight' || mark === 'link'
    if (!preserveEditorFocus) {
      afterRender(() =>
        itemRefs.current
          .get(context.block.id)
          ?.setTableCellSelection?.(context.row, context.col, sel.start, sel.end),
      )
    }
  }

  // ─── Bubble toolbar ────────────────────────────────────────────────────────

  function getManagedSelectionBounds(range: TextRangeSelection): DOMRect | null {
    const root = rootRef.current
    if (!root) return null

    const normalized = normalizeTextRange(range, visibleBlocks)
    if (!normalized) return null

    const startIdx = visibleBlocks.findIndex((b) => b.id === normalized.startBlockId)
    const endIdx = visibleBlocks.findIndex((b) => b.id === normalized.endBlockId)
    if (startIdx === -1 || endIdx === -1) return null

    const segments = getTextRangeSegments(range, blocksRef.current, visibleBlocks)
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
      const block = visibleBlocks[i]
      const blockEl = root.querySelector(`[data-block-id="${block.id}"]`) as HTMLElement | null
      if (!blockEl) continue

      if (isTextBlock(block.type)) {
        const segment = segments.find((s) => s.blockId === block.id)
        if (!segment) continue

        const editable = blockEl.querySelector('.etb') as HTMLElement | null
        if (editable && !segment.fullBlock) {
          for (const r of getRangeClientRects(editable, segment.start, segment.end)) expand(r)
          continue
        }
      } else if (!isBlockCoveredByTextRange(block.id, range, blocksRef.current, visibleBlocks)) {
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

  function computeBubble(
    block: Block,
    range: { start: number; end: number },
    rect: DOMRect,
  ): BubbleState {
    const marks: Partial<Record<MarkName, boolean>> = {}
    for (const m of BOOLEAN_MARKS) marks[m] = rangeHasMark(block.content, range.start, range.end, m)

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
    const segments = getTextRangeSegments(range, blocksRef.current, visibleBlocks)
    const bounds = getManagedSelectionBounds(range)
    if (!bounds) return null

    const first = segments[0]
    const fallbackBlock = byId(range.anchor.blockId) ?? visibleBlocks[0]
    if (!first && !fallbackBlock) return null

    const marks: Partial<Record<MarkName, boolean>> = {}
    for (const m of BOOLEAN_MARKS) {
      marks[m] =
        segments.length > 0 &&
        rangeHasMarkAcrossSegments(range, blocksRef.current, visibleBlocks, m)
    }

    const currentLink =
      segments.length > 0
        ? rangeMarkValueAcrossSegments(range, blocksRef.current, visibleBlocks, 'link')
        : null
    const currentColor =
      segments.length > 0
        ? rangeMarkValueAcrossSegments(range, blocksRef.current, visibleBlocks, 'color')
        : null
    const currentHighlight =
      segments.length > 0
        ? rangeMarkValueAcrossSegments(range, blocksRef.current, visibleBlocks, 'highlight')
        : null

    const types = new Set(segments.map((s) => s.block.type))
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
    if (!showBubbleToolbar || readonly || !hasActiveManagedSelection()) return
    const range = textRangeSelectionRef.current
    if (!range) return
    const next = computeManagedBubble(range)
    setBubble(next)
  }

  function onSelectionChange() {
    if (readonly) {
      setBubble(null)
      savedInlineSelectionRef.current = null
      return
    }

    // Managed multi-block selection owns the bubble via the effect below.
    if (hasActiveManagedSelection()) return

    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      // Link/color inputs steal focus and collapse the native selection; keep
      // the bubble range so Set/Enter/Remove still apply to the snapshot.
      if (
        suppressBubbleClearRef.current ||
        isToolbarOrOverlayTarget(document.activeElement)
      ) {
        return
      }
      setBubble(null)
      savedInlineSelectionRef.current = null
      return
    }

    const node = sel.anchorNode
    const el = node?.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node?.parentElement
    const blockEl = el?.closest('[data-block-id]')

    if (!blockEl || !rootRef.current?.contains(blockEl)) {
      if (
        suppressBubbleClearRef.current ||
        isToolbarOrOverlayTarget(document.activeElement)
      ) {
        return
      }
      setBubble(null)
      savedInlineSelectionRef.current = null
      return
    }

    const id = blockEl.getAttribute('data-block-id')
    const block = id ? byId(id) : undefined

    if (!block || !isTextBlock(block.type)) {
      if (
        suppressBubbleClearRef.current ||
        isToolbarOrOverlayTarget(document.activeElement)
      ) {
        return
      }
      setBubble(null)
      savedInlineSelectionRef.current = null
      return
    }

    const range = itemRefs.current.get(block.id)?.getSelection()
    const rect = getSelectionClientRect()

    if (!range || range.start === range.end || !rect) {
      if (
        suppressBubbleClearRef.current ||
        isToolbarOrOverlayTarget(document.activeElement)
      ) {
        return
      }
      setBubble(null)
      savedInlineSelectionRef.current = null
      return
    }

    savedInlineSelectionRef.current = {
      blockId: block.id,
      start: range.start,
      end: range.end,
    }
    setBubble(computeBubble(block, range, rect))
  }

  function resolveBubbleTextRange(state: BubbleState): TextRangeSelection | null {
    if (state.textRange) return state.textRange
    if (state.multiBlock) return textRangeSelectionRef.current
    return null
  }

  function onBubbleMark(mark: MarkName, value: boolean | string | null) {
    const state = bubble
    if (!state) return

    const multiRange = resolveBubbleTextRange(state)
    if (state.multiBlock && multiRange) {
      let markValue: boolean | string | null = value === false ? null : value

      if (BOOLEAN_MARKS.includes(mark) && typeof value === 'boolean') {
        const applied = rangeHasMarkAcrossSegments(
          multiRange,
          blocksRef.current,
          visibleBlocks,
          mark,
        )
        markValue = applied ? null : true
      }

      applyMarkToTextRange(blocksRef.current, multiRange, visibleBlocks, mark, markValue)

      // Restore managed selection if a toolbar mousedown cleared it mid-gesture.
      if (!hasActiveManagedSelection()) {
        setManagedTextRange(multiRange.anchor, multiRange.focus)
      }

      pushHistory(true)
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
    for (const m of BOOLEAN_MARKS) {
      nextMarks[m] = rangeHasMark(block.content, state.range.start, state.range.end, m)
    }
    setBubble({
      ...state,
      activeMarks: nextMarks,
      currentLink: rangeMarkValue(block.content, state.range.start, state.range.end, 'link'),
      currentColor: rangeMarkValue(block.content, state.range.start, state.range.end, 'color'),
      currentHighlight: rangeMarkValue(
        block.content,
        state.range.start,
        state.range.end,
        'highlight',
      ),
    })
    savedInlineSelectionRef.current = {
      blockId: block.id,
      start: state.range.start,
      end: state.range.end,
    }

    pushHistory(true)
    afterRender(() =>
      itemRefs.current.get(block.id)?.setSelection(state.range.start, state.range.end),
    )
  }

  function onBubbleClearFormatting() {
    const state = bubble
    if (!state) return

    const multiRange = resolveBubbleTextRange(state)
    if (state.multiBlock && multiRange) {
      for (const mark of CLEARABLE_MARKS) {
        applyMarkToTextRange(blocksRef.current, multiRange, visibleBlocks, mark, null)
      }

      if (!hasActiveManagedSelection()) {
        setManagedTextRange(multiRange.anchor, multiRange.focus)
      }

      pushHistory(true)
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
    afterRender(() =>
      itemRefs.current.get(block.id)?.setSelection(state.range.start, state.range.end),
    )
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
    const range = textRangeSelectionRef.current
    if (!hasActiveManagedSelection() || !range) return

    const extracted = extractTextRangeAsBlocks(range, blocksRef.current, visibleBlocks)
    if (!extracted.length) return

    const normalized = normalizeTextRange(range, visibleBlocks)
    if (!normalized) return

    const endIdx = blocksRef.current.findIndex((b) => b.id === normalized.endBlockId)
    if (endIdx === -1) return

    blocksRef.current.splice(endIdx + 1, 0, ...extracted)
    pushHistory(true)
  }

  function onBubbleDelete() {
    if (hasActiveManagedSelection()) {
      deleteManagedTextRange()
      setBubble(null)
    }
  }

  function onBubbleAskAI() {
    const pos = bubble?.position
    openAIMenu(pos ? { x: pos.x, y: pos.y } : undefined)
  }

  function onBubbleTurnInto(type: BlockType) {
    turnIntoBlock(type)
  }

  function turnIntoBlock(type: BlockType) {
    const state = bubble
    const multiRange = state ? resolveBubbleTextRange(state) : textRangeSelectionRef.current

    if ((state?.multiBlock || hasActiveManagedSelection()) && multiRange) {
      const segments = getTextRangeSegments(multiRange, blocksRef.current, visibleBlocks)
      let changed = false

      for (const segment of segments) {
        const block = byId(segment.blockId)
        if (!block || !isTextBlock(block.type)) continue
        const defaults = makeBlockLocal(type)
        block.type = type
        block.props = { ...defaults.props, indent: block.props.indent, dir: block.props.dir }
        changed = true
      }

      if (changed) {
        if (!hasActiveManagedSelection()) {
          setManagedTextRange(multiRange.anchor, multiRange.focus)
        }
        pushHistory(true)
        refreshManagedBubble()
      }
      return
    }

    const blockId = state?.blockId ?? focusedBlockId
    if (!blockId) return

    const block = byId(blockId)
    if (!block || !isTextBlock(block.type)) return

    const range = state?.range ??
      itemRefs.current.get(block.id)?.getSelection() ?? { start: 0, end: 0 }
    const defaults = makeBlockLocal(type)
    block.type = type
    block.props = { ...defaults.props, indent: block.props.indent, dir: block.props.dir }
    pushHistory(true)
    afterRender(() => itemRefs.current.get(block.id)?.setSelection(range.start, range.end))
  }

  function applyToolbarMark(mark: MarkName, value: boolean | string | null) {
    if (bubble) {
      onBubbleMark(mark, value)
      return
    }

    if (focusedTableCell || (focusedBlockId && byId(focusedBlockId)?.type === 'table')) {
      applyMarkToFocusedTableCell(mark, value)
      return
    }

    if (hasActiveManagedSelection() && textRangeSelection) {
      let markValue: boolean | string | null = value === false ? null : value

      if (BOOLEAN_MARKS.includes(mark) && typeof value === 'boolean') {
        const applied = rangeHasMarkAcrossSegments(
          textRangeSelection,
          blocksRef.current,
          visibleBlocks,
          mark,
        )
        markValue = applied ? null : true
      }

      applyMarkToTextRange(blocksRef.current, textRangeSelection, visibleBlocks, mark, markValue)
      pushHistory(true)
      return
    }

    const blockId = focusedBlockId
    if (!blockId) return

    const block = byId(blockId)
    if (!block || !isTextBlock(block.type)) return

    const live = itemRefs.current.get(block.id)?.getSelection()
    const saved = savedInlineSelectionRef.current
    const sel =
      live && live.start !== live.end
        ? live
        : saved && saved.blockId === block.id && saved.start !== saved.end
          ? { start: saved.start, end: saved.end }
          : null
    if (!sel) return

    block.content = applyMarkToRange(
      block.content,
      sel.start,
      sel.end,
      mark,
      value === false ? null : value,
    )
    savedInlineSelectionRef.current = {
      blockId: block.id,
      start: sel.start,
      end: sel.end,
    }
    pushHistory(true)

    const preserveEditorFocus = mark === 'color' || mark === 'highlight' || mark === 'link'
    if (!preserveEditorFocus) {
      afterRender(() => itemRefs.current.get(block.id)?.setSelection(sel.start, sel.end))
    }
  }

  function indentFocusedBlock() {
    const blockId = bubble?.blockId ?? focusedBlockId
    if (!blockId) return
    const block = byId(blockId)
    if (!block) return
    handleTab(block, false)
  }

  function outdentFocusedBlock() {
    const blockId = bubble?.blockId ?? focusedBlockId
    if (!blockId) return
    const block = byId(blockId)
    if (!block) return
    handleTab(block, true)
  }

  function setFocusedAlign(align: FormatToolbarAlign) {
    const blockId = bubble?.blockId ?? focusedBlockId
    if (!blockId) return

    const block = byId(blockId)
    if (!block) return

    if (block.type === 'table') {
      const context = getTableCellContext(blockId)
      if (!context) return

      block.props.table = patchTableCell(context.table, context.row, context.col, {
        align: align === 'left' ? undefined : (align as TableCellAlign),
      })
      pushHistory(true)
      return
    }

    if (!isTextBlock(block.type)) return

    if (align === 'left') delete block.props.align
    else if (align === 'justify') return
    else block.props.align = align

    pushHistory(true)
  }

  function setFocusedDir(dir: 'auto' | 'ltr' | 'rtl') {
    const blockId = bubble?.blockId ?? focusedBlockId
    if (!blockId) return

    const block = byId(blockId)
    if (!block || !isTextBlock(block.type)) return

    if (dir === 'auto') delete block.props.dir
    else block.props.dir = dir

    pushHistory(true)
  }

  function setFocusedCalloutIcon(icon: string | null) {
    const blockId = bubble?.blockId ?? focusedBlockId
    if (!blockId) return

    const block = byId(blockId)
    if (!block || block.type !== 'callout') return

    patchProps(block, { icon: icon ?? '💡' })
  }

  const formatToolbarState = useMemo<FormatToolbarState | null>(() => {
    void version

    if (bubble) {
      const block = byId(bubble.blockId)

      return {
        blockId: bubble.blockId,
        blockType: bubble.blockType,
        activeMarks: bubble.activeMarks,
        currentLink: bubble.currentLink,
        currentColor: bubble.currentColor,
        currentHighlight: bubble.currentHighlight,
        hasSelection: true,
        multiBlock: bubble.multiBlock,
        align: block?.props.align ?? 'left',
        indent: block?.props.indent ?? 0,
        dir: block?.props.dir ?? 'auto',
        calloutIcon: block?.type === 'callout' ? (block.props.icon ?? '💡') : null,
      }
    }

    if (hasActiveManagedSelection() && textRangeSelection) {
      const segments = getTextRangeSegments(textRangeSelection, blocksRef.current, visibleBlocks)
      const first = segments[0]
      if (!first) return null

      const block = first.block
      const marks: Partial<Record<MarkName, boolean>> = {}
      const multiBlock =
        segments.length > 1 || isCrossBlockTextRange(textRangeSelection, visibleBlocks)

      for (const m of BOOLEAN_MARKS)
        marks[m] = rangeHasMarkAcrossSegments(
          textRangeSelection,
          blocksRef.current,
          visibleBlocks,
          m,
        )

      const currentLink = rangeMarkValueAcrossSegments(
        textRangeSelection,
        blocksRef.current,
        visibleBlocks,
        'link',
      )
      const currentColor = rangeMarkValueAcrossSegments(
        textRangeSelection,
        blocksRef.current,
        visibleBlocks,
        'color',
      )
      const currentHighlight = rangeMarkValueAcrossSegments(
        textRangeSelection,
        blocksRef.current,
        visibleBlocks,
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

    if (focusedBlockId) {
      const block = byId(focusedBlockId)

      if (block?.type === 'table') {
        const context = getTableCellContext(block.id)

        if (context) {
          const sel = itemRefs.current
            .get(block.id)
            ?.getTableCellSelection?.(context.row, context.col)
          const hasSelection = !!sel && sel.start !== sel.end
          const marks: Partial<Record<MarkName, boolean>> = {}

          if (hasSelection && sel) {
            for (const m of BOOLEAN_MARKS)
              marks[m] = rangeHasMark(context.cell.content, sel.start, sel.end, m)
          }

          const currentColor =
            hasSelection && sel
              ? rangeMarkValue(context.cell.content, sel.start, sel.end, 'color')
              : null
          const currentHighlight =
            hasSelection && sel
              ? rangeMarkValue(context.cell.content, sel.start, sel.end, 'highlight')
              : null

          return {
            blockId: block.id,
            blockType: 'table' as BlockType,
            activeMarks: marks,
            currentLink:
              hasSelection && sel
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
        const live = itemRefs.current.get(block.id)?.getSelection()
        const saved = savedInlineSelectionRef.current
        const sel =
          live && live.start !== live.end
            ? live
            : saved && saved.blockId === block.id && saved.start !== saved.end
              ? { start: saved.start, end: saved.end }
              : null
        const hasSelection = !!sel && sel.start !== sel.end
        const marks: Partial<Record<MarkName, boolean>> = {}

        if (hasSelection && sel) {
          for (const m of BOOLEAN_MARKS)
            marks[m] = rangeHasMark(block.content, sel.start, sel.end, m)
        }

        const currentLink =
          hasSelection && sel ? rangeMarkValue(block.content, sel.start, sel.end, 'link') : null
        const currentColor =
          hasSelection && sel ? rangeMarkValue(block.content, sel.start, sel.end, 'color') : null
        const currentHighlight =
          hasSelection && sel
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, bubble, textRangeSelection, focusedBlockId, managedTextSelection])

  useEffect(() => {
    onFormatStateRef.current?.(formatToolbarState)
  }, [formatToolbarState])

  // ─── Drag & drop ───────────────────────────────────────────────────────────

  function onDragHandleStart(block: Block, e: React.DragEvent) {
    if (readonly) {
      e.preventDefault()
      return
    }

    isDragSelectingRef.current = false
    dragSelectAnchorRef.current = null
    clearTextRangeSelection()
    setDraggingId(block.id)

    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', block.id)
      const blockEl = rootRef.current?.querySelector(`[data-block-id="${block.id}"]`)
      if (blockEl) e.dataTransfer.setDragImage(blockEl as HTMLElement, 0, 12)
    }
  }

  function isExternalFileDrag(e: React.DragEvent): boolean {
    return !draggingId && Array.from(e.dataTransfer?.types ?? []).includes('Files')
  }

  function onDragOver(e: React.DragEvent) {
    if (readonly) return

    if (isExternalFileDrag(e)) {
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'

      const target = (e.target as HTMLElement).closest('[data-block-id]')
      const id = target?.getAttribute('data-block-id')

      if (id) {
        const rect = target!.getBoundingClientRect()
        setDropTarget({ id, position: e.clientY < rect.top + rect.height / 2 ? 'before' : 'after' })
      } else {
        setDropTarget(null)
      }

      return
    }

    if (!draggingId) return

    e.preventDefault()
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'

    const target = (e.target as HTMLElement).closest('[data-block-id]')
    if (!target) {
      setDropTarget(null)
      return
    }

    const id = target.getAttribute('data-block-id')
    if (!id || id === draggingId) {
      setDropTarget(null)
      return
    }

    const rect = target.getBoundingClientRect()
    const position = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
    setDropTarget({ id, position })
  }

  function onDrop(e: React.DragEvent) {
    if (readonly) return

    e.preventDefault()

    // External OS files dropped onto the editor become media blocks
    const externalFiles = !draggingId ? Array.from(e.dataTransfer?.files ?? []) : []

    if (externalFiles.length > 0) {
      const target = dropTarget
      setDropTarget(null)
      let at = blocksRef.current.length

      if (target) {
        const idx = blocksRef.current.findIndex((b) => b.id === target.id)
        if (idx !== -1) at = target.position === 'before' ? idx : idx + 1
      }

      void insertFileBlocks(externalFiles, at)

      return
    }

    const from = draggingId
    const target = dropTarget
    setDraggingId(null)
    setDropTarget(null)

    if (!from || !target || from === target.id) return

    const fromIdx = blocksRef.current.findIndex((b) => b.id === from)
    if (fromIdx === -1) return

    const fromBlock = blocksRef.current[fromIdx]
    const moveLen = isToggleBlock(fromBlock.type)
      ? getToggleSubtreeLength(blocksRef.current, fromIdx)
      : 1

    // Don't drop a toggle onto one of its own children.
    const targetIdxBefore = blocksRef.current.findIndex((b) => b.id === target.id)
    if (
      targetIdxBefore !== -1 &&
      targetIdxBefore >= fromIdx &&
      targetIdxBefore < fromIdx + moveLen
    ) {
      return
    }

    const moved = blocksRef.current.splice(fromIdx, moveLen)
    let toIdx = blocksRef.current.findIndex((b) => b.id === target.id)

    if (toIdx === -1) {
      blocksRef.current.splice(fromIdx, 0, ...moved)
      return
    }

    if (target.position === 'after') {
      const targetBlock = blocksRef.current[toIdx]
      const targetSpan = isToggleBlock(targetBlock.type)
        ? getToggleSubtreeLength(blocksRef.current, toIdx)
        : 1
      toIdx += targetSpan
    }

    blocksRef.current.splice(toIdx, 0, ...moved)
    pushHistory(true)
  }

  function onDragEnd() {
    setDraggingId(null)
    setDropTarget(null)
    isDragSelectingRef.current = false
    dragSelectAnchorRef.current = null
  }

  // ─── Root keyboard handling ─────────────────────────────────────────────────

  function resolveActiveBlock(target: HTMLElement): Block | undefined {
    const blockEl = target.closest('[data-block-id]')
    const blockId = blockEl?.getAttribute('data-block-id')

    if (blockId) return byId(blockId)
    if (selectedBlockId) return byId(selectedBlockId)
    if (focusedBlockId) return byId(focusedBlockId)

    return undefined
  }

  function isFullTextBlockContentSelected(block: Block): boolean {
    if (!isTextBlock(block.type)) return false

    const len = spansToText(block.content).length
    // Empty blocks have nowhere to "select"; treat as not fully selected so the
    // first Ctrl+A advances the stage without jumping to the whole document.
    if (len === 0) return false

    const sel = itemRefs.current.get(block.id)?.getSelection()
    return !!sel && sel.start === 0 && sel.end >= len
  }

  function isFullCodeBlockSelected(blockEl: HTMLElement | null): boolean {
    const textarea = blockEl?.querySelector('textarea')
    if (!textarea) return false

    const len = textarea.value.length
    if (len === 0) return false

    return textarea.selectionStart === 0 && textarea.selectionEnd >= len
  }

  function selectAllTextInBlock(block: Block) {
    if (isTextBlock(block.type)) {
      const len = spansToText(block.content).length
      itemRefs.current.get(block.id)?.setSelection(0, len)
      setFocusedBlockId(block.id)
      setSelectedBlockId(null)
      return
    }

    if (block.type === 'code') {
      const blockEl = rootRef.current?.querySelector(`[data-block-id="${block.id}"]`)
      const textarea = blockEl?.querySelector('textarea') as HTMLTextAreaElement | null

      if (textarea) {
        textarea.focus()
        textarea.setSelectionRange(0, textarea.value.length)
        setFocusedBlockId(block.id)
        setSelectedBlockId(null)
      }
    }
  }

  function isActiveBlockFullySelected(block: Block, blockEl: Element | null): boolean {
    if (isTextBlock(block.type)) return isFullTextBlockContentSelected(block)
    if (block.type === 'code') return isFullCodeBlockSelected(blockEl as HTMLElement | null)
    return selectedBlockId === block.id
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
    const blockEl =
      target.closest('[data-block-id]') ??
      (block ? rootRef.current?.querySelector(`[data-block-id="${block.id}"]`) ?? null : null)

    const documentAlreadySelected = isAllTextBlocksSelected()
    // Partial managed ranges (shift-drag etc.) escalate straight to the document.
    const blockAlreadySelected =
      (!!block && isActiveBlockFullySelected(block, blockEl))
      || (hasActiveManagedSelection() && !documentAlreadySelected)
    const decision = resolveSelectAllShortcut({
      stage: selectAllStageRef.current,
      documentAlreadySelected,
      blockAlreadySelected,
      hasActiveBlock: !!block,
    })

    selectAllStageRef.current = decision.stage

    if (decision.action === 'noop') return

    if (decision.action === 'select-document') {
      selectAllBlocks()
      return
    }

    if (block) selectActiveBlockForSelectAll(block)
  }

  function onKeydownCapture(e: React.KeyboardEvent) {
    if (readonly) return

    // Slash menu lives inside the contenteditable block being typed into, so
    // this must run before the isNativeInputTarget bail-out below (which
    // exists to let text blocks handle their own keys normally).
    if (slashState) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        e.stopPropagation()
        slashMenuApiRef.current?.move(1)
        return
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault()
        e.stopPropagation()
        slashMenuApiRef.current?.move(-1)
        return
      }

      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        e.stopPropagation()
        slashMenuApiRef.current?.confirm()
        return
      }

      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        closeSlash()
        return
      }
    }

    if (emojiTriggerState) {
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        e.stopPropagation()
        const q = emojiTriggerState.query.toLowerCase()

        // Empty query shows the full grid — keep it open; user clicks an emoji.
        if (!q) return

        const match = ALL_EMOJIS.find(
          (en) => en.name.includes(q) || en.keywords.some((k) => k.includes(q)),
        )

        if (match) onEmojiTriggerSelect(match.char)
        else closeEmojiTrigger()

        return
      }

      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        closeEmojiTrigger()
        return
      }
    }

    const mod = e.ctrlKey || e.metaKey
    const isSelectAllShortcut = mod && e.key.toLowerCase() === 'a'

    // Select-all must run even when focus is inside contenteditable/textarea —
    // otherwise the browser handles the first Ctrl+A and the second never escalates.
    if (isSelectAllShortcut) {
      const target = e.target as HTMLElement

      if (rootRef.current?.contains(target)) {
        e.preventDefault()
        e.stopPropagation()
        handleSelectAllShortcut(target)
        return
      }
    }

    // Modifier-only keydowns (Cmd/Ctrl before 'A') must not clear the stage.
    const isModifierOnly =
      e.key === 'Meta' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Shift'
    if (!isModifierOnly) resetSelectAllStage()

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

      if (rootRef.current?.contains(target)) {
        e.preventDefault()
        e.stopPropagation()
        if (historyAction === 'redo') redo()
        else undo()
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

      if (mod && (e.key.toLowerCase() === 'c' || e.key.toLowerCase() === 'x' || e.key.toLowerCase() === 'v')) {
        afterRender(() => rootRef.current?.focus())
      }
    }

    if (isNativeInputTarget(e.target) && !hasActiveManagedSelection()) return

    if (e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      const range = textRangeSelectionRef.current
      const baseBlockId = focusedBlockId ?? range?.focus.blockId ?? selectedBlockId

      if (!baseBlockId) return

      const neighbor = neighborBlock(baseBlockId, e.key === 'ArrowDown' ? 1 : -1)

      if (neighbor) {
        e.preventDefault()
        e.stopPropagation()

        const anchor = resolveSelectionAnchor() ?? { blockId: baseBlockId, offset: 0 }
        const focusOffset = e.key === 'ArrowDown' ? selectionEndOffset(neighbor) : 0

        setManagedTextRange(anchor, { blockId: neighbor.id, offset: focusOffset })
        return
      }
    }

    if (e.key === 'Escape' && bubble) {
      setBubble(null)
    }
  }

  function onBlockPointerDown(block: Block, e: React.PointerEvent) {
    if (readonly) return

    const target = e.target as HTMLElement
    if (target.closest('.ebi-reorder-handle, .ebi-gutter')) return

    resetSelectAllStage()

    // Text blocks handle shift-extend via selection-pointer-down on `.etb`.
    if (e.shiftKey && !target.closest('.etb')) {
      const point = rootRef.current
        ? caretPointFromClient(rootRef.current, e.clientX, e.clientY)
        : null
      const focus = point ?? { blockId: block.id, offset: selectionEndOffset(block) }
      const anchor = resolveSelectionAnchor() ?? { blockId: block.id, offset: 0 }

      setManagedTextRange(anchor, focus)
      e.preventDefault()
      return
    }

    if (!isTextBlock(block.type) && e.button === 0) {
      if (hasActiveManagedSelection()) clearTextRangeSelection()

      const point = rootRef.current
        ? caretPointFromClient(rootRef.current, e.clientX, e.clientY)
        : null
      const start = point ?? { blockId: block.id, offset: 0 }

      isDragSelectingRef.current = true
      dragSelectAnchorRef.current = start
      textRangeSelectionRef.current = { anchor: start, focus: start }
      managedTextSelectionRef.current = false
      setTextRangeSelection({ anchor: start, focus: start })
      setManagedTextSelectionFlag(false)
    }
  }

  function onDocPointerMove(e: PointerEvent) {
    if (
      draggingIdRef.current ||
      !isDragSelectingRef.current ||
      !dragSelectAnchorRef.current ||
      e.buttons === 0 ||
      !rootRef.current
    ) {
      return
    }

    const point = caretPointFromClient(rootRef.current, e.clientX, e.clientY)
    if (!point) return

    const next = { anchor: dragSelectAnchorRef.current, focus: point }
    textRangeSelectionRef.current = next
    setTextRangeSelection(next)

    if (
      point.blockId !== dragSelectAnchorRef.current.blockId ||
      isManagedMultiBlockRange(next, visibleBlocks)
    ) {
      managedTextSelectionRef.current = true
      setManagedTextSelectionFlag(true)
      setSelectedBlockId(null)
      setFocusedBlockId(null)
      window.getSelection()?.removeAllRanges()
    }
  }

  function onDocPointerUp() {
    if (isDragSelectingRef.current) {
      finalizeTextRangeSelection()
      if (hasActiveManagedSelection()) suppressNextBlockSelectRef.current = true
    }

    isDragSelectingRef.current = false
    dragSelectAnchorRef.current = null
  }

  function onRootKeydown(e: React.KeyboardEvent) {
    const target = e.target as HTMLElement
    if (isNativeInputTarget(target)) return
    if (hasActiveManagedSelection()) return

    const id = selectedBlockId
    if (!id) return

    const block = byId(id)

    if (!block) {
      setSelectedBlockId(null)
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

    if (e.key === 'Escape') setSelectedBlockId(null)
  }

  function onDocMouseDownCapture(e: MouseEvent) {
    const target = e.target as HTMLElement
    // Capture phase so toolbar stopPropagation still lets us see the gesture.
    suppressBubbleClearRef.current = isToolbarOrOverlayTarget(target)
  }

  function onDocMouseDown(e: MouseEvent) {
    const target = e.target as HTMLElement

    if (isToolbarOrOverlayTarget(target)) return

    // Clicking away with a collapsed selection dismisses a single-block bubble
    // that was kept alive for the link/color inputs.
    if (bubble && !bubble.multiBlock && !hasActiveManagedSelection()) {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed) {
        setBubble(null)
        savedInlineSelectionRef.current = null
      }
    }

    if (slashState && !target.closest('.fixed')) closeSlash()

    if (emojiTriggerState && !target.closest('.fixed')) closeEmojiTrigger()

    if (selectedBlockId && !target.closest(`[data-block-id="${selectedBlockId}"]`)) {
      setSelectedBlockId(null)
    }

    if (
      hasActiveManagedSelection() &&
      !rootRef.current?.contains(target) &&
      !isFormatToolbarTarget(target)
    ) {
      clearTextRangeSelection()
    }
  }

  function onTailClick() {
    if (readonly) return

    const last = blocksRef.current[blocksRef.current.length - 1]

    if (last && last.type === 'paragraph' && spansToText(last.content) === '') {
      focusBlock(last.id, 'start')
      return
    }

    const nb = makeBlockLocal('paragraph')
    blocksRef.current.push(nb)
    pushHistory(true)
    focusBlock(nb.id, 'start')
  }

  function placeholderFor(block: Block): string | undefined {
    if (block.type !== 'paragraph') return undefined
    if (focusedBlockId === block.id) return "Type '/' for commands..."
    if (blocksRef.current.length === 1 && spansToText(block.content) === '') {
      return '+ Start writing or type / for plugins'
    }
    return undefined
  }

  function onBlockFocus(block: Block) {
    setFocusedBlockId(block.id)

    if (block.type !== 'table') {
      setFocusedTableCell(null)
      setTableSelectedCells([])
    }

    if (!hasActiveManagedSelection()) setSelectedBlockId(null)
  }

  useEffect(() => {
    if (!showBubbleToolbar || readonly) {
      if (bubble?.multiBlock) setBubble(null)
      return
    }

    if (!hasActiveManagedSelection() || !textRangeSelection) {
      if (bubble?.multiBlock) setBubble(null)
      return
    }

    const next = computeManagedBubble(textRangeSelection)
    setBubble(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showBubbleToolbar, readonly, textRangeSelection, managedTextSelection, version, visibleBlocks])

  useEffect(() => {
    document.addEventListener('selectionchange', onSelectionChange)
    document.addEventListener('mousedown', onDocMouseDownCapture, true)
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('pointermove', onDocPointerMove)
    document.addEventListener('pointerup', onDocPointerUp)

    return () => {
      document.removeEventListener('selectionchange', onSelectionChange)
      document.removeEventListener('mousedown', onDocMouseDownCapture, true)
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('pointermove', onDocPointerMove)
      document.removeEventListener('pointerup', onDocPointerUp)
    }
  })

  return {
    rootRef,
    blocks: blocksRef.current,
    visibleBlocks,
    numbering,
    focusedBlockId,
    selectedBlockId,
    draggingId,
    dropTarget,
    slashState,
    slashMenuApiRef,
    aiMenu,
    ai,
    emojiTriggerState,
    bubble,
    iconPickerRequest,
    setIconPickerRequest,
    showBubbleToolbar,
    readonly,
    upload,
    pickMedia,
    fetchBookmarkMeta,
    editorDir,
    setItemRef,
    textHighlightForBlock,
    isBlockChromeSelected,
    placeholderFor,
    formatToolbarState,
    canUndo,
    canRedo,
    undo,
    redo,
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
    getAISelectionBlocks,
    replaceDocumentBlocks,
    focusFirst: () => {
      const first = visibleBlocks[0]
      if (first) focusBlock(first.id, 'start')
    },
    focusEnd: () => {
      const last = visibleBlocks[visibleBlocks.length - 1]
      if (last) focusBlock(last.id, 'end')
    },
    // Event handlers wired by <BlockEditor>
    onKeydownCapture,
    onRootKeydown,
    onCopy,
    onCut,
    onPaste,
    onDragOver,
    onDrop,
    onDragEnd,
    onTailClick,
    onBlockFocus,
    selectBlock,
    onBlockPointerDown,
    onSelectionPointerDown,
    onDragHandleStart,
    onSlashSelect,
    closeSlash,
    onEmojiTriggerSelect,
    closeEmojiTrigger,
    onBubbleMark,
    onBubbleTurnInto,
    onBubbleClearFormatting,
    onBubbleAskAI,
    onBubbleCopy,
    onBubbleDuplicate,
    onBubbleDelete,
    handleInput,
    handleEnter,
    handleBackspaceStart,
    handleDeleteEnd,
    handleArrow,
    handleTab,
    handleFormat,
    handlePasted,
    patchProps,
    addBelow,
    duplicateBlock,
    copyBlock,
    cutBlock,
    turnBlockInto,
    removeBlock,
    onTableCellFocus,
    onTableCellInput,
    handleTableFormat,
    handleTableTab,
    handleTableNavigate,
    onTableCellSelectionChange,
  }
}

function makeBlock(type: BlockType, partial: Partial<Block> = {}): Block {
  return createBlock(type, partial)
}
