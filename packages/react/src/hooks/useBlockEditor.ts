import { useEffect, useMemo, useRef, useState } from 'react'
import { ALL_EMOJIS } from '../ui/emojiData'
import {
  applyMarkToRange,
  applyMarkToTextRange,
  blockTypeForFile,
  caretPointFromClient,
  cloneBlock,
  computeListNumbering,
  createBlock,
  deleteRangeInSpans,
  deleteTextRange,
  extractTextRangeAsBlocks,
  fileToObjectUrl,
  fullBlockTextRange,
  getCaretClientRect,
  getSelectionClientRect,
  getTextRangeSegments,
  htmlToBlocks,
  isBlockFullySelected,
  isCrossBlockTextRange,
  isTextBlock,
  isTextRangeCollapsed,
  mediaPropsFromFile,
  normalizeSpans,
  normalizeTableData,
  nextVisibleCellCoord,
  parseBlocksFromClipboardData,
  patchTableCell,
  patchTableCellsBackground,
  patchTableStyle,
  rangeHasMark,
  rangeHasMarkAcrossSegments,
  rangeMarkValue,
  rangeMarkValueAcrossSegments,
  sliceSpans,
  spansToText,
  splitSpansAt,
  writeBlocksToClipboardData,
} from '@xproeditor/core'
import type {
  Block,
  BlockType,
  InlineSpan,
  MarkName,
  TableCellAlign,
  TableCellCoord,
  TableStyle,
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
  /** Default text direction for new blocks. */
  editorDir?: 'ltr' | 'rtl'
  readonly?: boolean
  /** Floating bubble toolbar on text selection (Notion-like). */
  showBubbleToolbar?: boolean
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
}

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

const TEXT_BLOCK_TYPES_FOR_ENTER = [
  'bulleted_list_item',
  'numbered_list_item',
  'to_do',
  'toggle',
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
  const { readonly = false, editorDir, showBubbleToolbar = false, upload, pickMedia } = options
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
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<{ id: string; position: 'before' | 'after' } | null>(
    null,
  )

  const dragSelectAnchorRef = useRef<TextPoint | null>(null)
  const isDragSelectingRef = useRef(false)

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

  function blockLength(block: Block): number {
    return isTextBlock(block.type) ? spansToText(block.content).length : 0
  }

  function hasActiveManagedSelection(): boolean {
    return (
      managedTextSelection &&
      textRangeSelection !== null &&
      !isTextRangeCollapsed(textRangeSelection, visibleBlocks)
    )
  }

  function textHighlightForBlock(id: string): { start: number; end: number } | null {
    if (!hasActiveManagedSelection() || !textRangeSelection) return null

    const segments = getTextRangeSegments(textRangeSelection, blocksRef.current, visibleBlocks)
    const segment = segments.find((s) => s.blockId === id)

    return segment ? { start: segment.start, end: segment.end } : null
  }

  function clearTextRangeSelection(): void {
    setTextRangeSelection(null)
    setManagedTextSelectionFlag(false)
  }

  function setManagedTextRange(anchor: TextPoint, focus: TextPoint) {
    setTextRangeSelection({ anchor, focus })
    setManagedTextSelectionFlag(true)
    setSelectedBlockId(null)
    setFocusedBlockId(null)
    closeSlash()
    setBubble(null)
    window.getSelection()?.removeAllRanges()
  }

  function selectAllBlocks() {
    const range = fullBlockTextRange(visibleBlocks)
    if (!range) return

    setManagedTextRange(range.anchor, range.focus)
    afterRender(() => rootRef.current?.focus())
  }

  function deleteManagedTextRange() {
    if (!textRangeSelection) return

    const result = deleteTextRange(blocksRef.current, textRangeSelection, visibleBlocks)
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
    const textBlocks = visibleBlocks.filter((b) => isTextBlock(b.type))
    if (textBlocks.length === 0 || !hasActiveManagedSelection() || !textRangeSelection) return false

    return textBlocks.every((b) =>
      isBlockFullySelected(b.id, textRangeSelection, blocksRef.current, visibleBlocks),
    )
  }

  function resolveSelectionAnchor(): TextPoint | null {
    if (textRangeSelection) return textRangeSelection.anchor

    if (focusedBlockId) {
      const sel = itemRefs.current.get(focusedBlockId)?.getSelection()
      return { blockId: focusedBlockId, offset: sel?.start ?? 0 }
    }

    if (selectedBlockId) return { blockId: selectedBlockId, offset: 0 }

    return null
  }

  function finalizeTextRangeSelection() {
    if (!textRangeSelection) return

    if (isCrossBlockTextRange(textRangeSelection, visibleBlocks)) {
      setManagedTextSelectionFlag(true)
      window.getSelection()?.removeAllRanges()
      setFocusedBlockId(null)
      return
    }

    const { anchor, focus } = textRangeSelection
    const start = Math.min(anchor.offset, focus.offset)
    const end = Math.max(anchor.offset, focus.offset)
    const blockId = anchor.blockId

    setTextRangeSelection(null)
    setManagedTextSelectionFlag(false)

    if (start !== end) {
      itemRefs.current.get(blockId)?.setSelection(start, end)
      setFocusedBlockId(blockId)
    }
  }

  function onSelectionPointerDown(
    block: Block,
    payload: { shiftKey: boolean; clientX: number; clientY: number },
  ) {
    if (readonly || !isTextBlock(block.type) || !rootRef.current) return

    const point = caretPointFromClient(rootRef.current, payload.clientX, payload.clientY)
    if (!point) return

    if (payload.shiftKey) {
      const anchor = resolveSelectionAnchor() ?? point

      if (point.blockId === anchor.blockId) {
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

      if (b.type === 'toggle' && b.props.collapsed) hideDeeperThan = ind
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

  function onSlashSelect(item: SlashItem) {
    const state = slashState
    if (!state) return

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
        if (caret === null || caret <= state.index || text[state.index] !== ':') return null

        const query = text.slice(state.index + 1, caret)
        if (/\s/.test(query) || query.length > 20) return null

        return { ...state, query }
      }

      if (caret !== null && caret > 0 && text[caret - 1] === ':') {
        const before = caret >= 2 ? text[caret - 2] : ''

        if (before === '' || /\s/.test(before)) {
          return { blockId: block.id, index: caret - 1, query: '', position: slashPosition() }
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

    const removeEnd = state.index + 1 + state.query.length
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
      else block.type = 'paragraph'

      pushHistory(true)
      focusBlock(block.id, 'start')
      return
    }

    const [before, rest] = splitSpansAt(block.content, offsets.start)
    const [, after] = splitSpansAt(rest, offsets.end - offsets.start)
    block.content = before

    let newType: BlockType = 'paragraph'
    if (KEEP_TYPE_ON_ENTER.includes(block.type)) newType = block.type
    else if (block.type.startsWith('heading') && spansToText(after).length > 0) newType = block.type

    const newProps: Block['props'] = {}
    if (block.props.indent) newProps.indent = block.props.indent
    if (block.props.dir && block.props.dir !== 'auto') newProps.dir = block.props.dir

    if (block.type === 'toggle') {
      newProps.indent = (block.props.indent ?? 0) + 1
      block.props.collapsed = false
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
    const pastedBlocks =
      payload.html && payload.html.includes('<') ? htmlToBlocks(payload.html) : []

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
    if (hasActiveManagedSelection() && textRangeSelection) {
      const extracted = extractTextRangeAsBlocks(
        textRangeSelection,
        blocksRef.current,
        visibleBlocks,
      )
      return extracted.length > 0 ? extracted : null
    }

    if (selectedBlockId) {
      const block = byId(selectedBlockId)
      return block ? [block] : null
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

    if (hasActiveManagedSelection() && textRangeSelection) {
      const deleteResult = deleteTextRange(blocksRef.current, textRangeSelection, visibleBlocks)
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
    if (readonly || isNativeInputTarget(e.target)) return

    const toCopy = getBlocksForClipboard()
    if (!toCopy?.length || !e.clipboardData) return

    e.preventDefault()
    writeBlocksToClipboardData(e.clipboardData, toCopy)
  }

  function onCut(e: React.ClipboardEvent) {
    if (readonly || isNativeInputTarget(e.target)) return

    const toCopy = getBlocksForClipboard()
    if (!toCopy?.length || !e.clipboardData) return

    e.preventDefault()
    writeBlocksToClipboardData(e.clipboardData, toCopy)
    removeBlocksForCut()
  }

  function onPaste(e: React.ClipboardEvent) {
    if (readonly || !e.clipboardData || isNativeInputTarget(e.target)) return

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
      const external = html && html.includes('<') ? htmlToBlocks(html) : []

      if (external.length > 0) {
        e.preventDefault()
        e.stopPropagation()
        insertBlocksFromClipboard(external)
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

  function duplicateBlock(block: Block) {
    if (readonly) return

    const idx = blocksRef.current.indexOf(block)
    blocksRef.current.splice(idx + 1, 0, cloneBlock(block))
    pushHistory(true)
  }

  function removeBlock(block: Block) {
    if (readonly) return

    const idx = blocksRef.current.indexOf(block)
    if (idx === -1) return

    const prev = neighborBlock(block.id, -1)
    const next = neighborBlock(block.id, 1)
    blocksRef.current.splice(idx, 1)
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

  function computeBubble(
    block: Block,
    range: { start: number; end: number },
    rect: DOMRect,
  ): BubbleState {
    const marks: Partial<Record<MarkName, boolean>> = {}
    for (const m of BOOLEAN_MARKS) marks[m] = rangeHasMark(block.content, range.start, range.end, m)

    const slice = sliceSpans(block.content, range.start, range.end)
    const allLinked = slice.length > 0 && slice.every((s) => s.marks?.link)
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
    if (readonly || hasActiveManagedSelection()) {
      setBubble(null)
      return
    }

    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      setBubble(null)
      return
    }

    const node = sel.anchorNode
    const el = node?.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node?.parentElement
    const blockEl = el?.closest('[data-block-id]')

    if (!blockEl || !rootRef.current?.contains(blockEl)) {
      setBubble(null)
      return
    }

    const id = blockEl.getAttribute('data-block-id')
    const block = id ? byId(id) : undefined

    if (!block || !isTextBlock(block.type)) {
      setBubble(null)
      return
    }

    const range = itemRefs.current.get(block.id)?.getSelection()
    const rect = getSelectionClientRect()

    if (!range || range.start === range.end || !rect) {
      setBubble(null)
      return
    }

    setBubble(computeBubble(block, range, rect))
  }

  function onBubbleMark(mark: MarkName, value: boolean | string | null) {
    const state = bubble
    if (!state) return

    const block = byId(state.blockId)
    if (!block) return

    block.content = applyMarkToRange(
      block.content,
      state.range.start,
      state.range.end,
      mark,
      value === false ? null : value,
    )
    pushHistory(true)
    afterRender(() =>
      itemRefs.current.get(block.id)?.setSelection(state.range.start, state.range.end),
    )
  }

  function onBubbleTurnInto(type: BlockType) {
    turnIntoBlock(type)
  }

  function turnIntoBlock(type: BlockType) {
    const state = bubble
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

    const sel = itemRefs.current.get(block.id)?.getSelection()
    if (!sel || sel.start === sel.end) return

    block.content = applyMarkToRange(
      block.content,
      sel.start,
      sel.end,
      mark,
      value === false ? null : value,
    )
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
        multiBlock: false,
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

      const currentColor = multiBlock
        ? null
        : rangeMarkValueAcrossSegments(
            textRangeSelection,
            blocksRef.current,
            visibleBlocks,
            'color',
          )
      const currentHighlight = multiBlock
        ? null
        : rangeMarkValueAcrossSegments(
            textRangeSelection,
            blocksRef.current,
            visibleBlocks,
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
        const sel = itemRefs.current.get(block.id)?.getSelection()
        const hasSelection = !!sel && sel.start !== sel.end
        const marks: Partial<Record<MarkName, boolean>> = {}

        if (hasSelection && sel) {
          for (const m of BOOLEAN_MARKS)
            marks[m] = rangeHasMark(block.content, sel.start, sel.end, m)
        }

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

    const [moved] = blocksRef.current.splice(fromIdx, 1)
    let toIdx = blocksRef.current.findIndex((b) => b.id === target.id)

    if (toIdx === -1) {
      blocksRef.current.splice(fromIdx, 0, moved)
      return
    }

    if (target.position === 'after') toIdx += 1

    blocksRef.current.splice(toIdx, 0, moved)
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
    if (len === 0) return true

    const sel = itemRefs.current.get(block.id)?.getSelection()
    return !!sel && sel.start === 0 && sel.end >= len
  }

  function isFullCodeBlockSelected(blockEl: HTMLElement | null): boolean {
    const textarea = blockEl?.querySelector('textarea')
    if (!textarea) return false

    const len = textarea.value.length
    if (len === 0) return true

    return textarea.selectionStart === 0 && textarea.selectionEnd >= len
  }

  function selectAllTextInBlock(block: Block) {
    if (isTextBlock(block.type)) {
      const len = spansToText(block.content).length
      itemRefs.current.get(block.id)?.setSelection(0, len)
      setFocusedBlockId(block.id)
      return
    }

    if (block.type === 'code') {
      const blockEl = rootRef.current?.querySelector(`[data-block-id="${block.id}"]`)
      const textarea = blockEl?.querySelector('textarea') as HTMLTextAreaElement | null

      if (textarea) {
        textarea.focus()
        textarea.setSelectionRange(0, textarea.value.length)
        setFocusedBlockId(block.id)
      }
    }
  }

  function handleSelectAllShortcut(target: HTMLElement) {
    const block = resolveActiveBlock(target)
    const blockEl =
      target.closest('[data-block-id]') ??
      (block ? rootRef.current?.querySelector(`[data-block-id="${block.id}"]`) : null)

    if (isAllTextBlocksSelected()) return

    const partialRange = hasActiveManagedSelection() && !isAllTextBlocksSelected()
    const singleNonTextSelected =
      block && !isTextBlock(block.type) && block.type !== 'code' && selectedBlockId === block.id

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
        const match = q
          ? ALL_EMOJIS.find((en) => en.name.includes(q) || en.keywords.some((k) => k.includes(q)))
          : null

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

    if (isNativeInputTarget(e.target)) return

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

      if (rootRef.current?.contains(target)) {
        e.preventDefault()
        e.stopPropagation()
        handleSelectAllShortcut(target)
        return
      }
    }

    if (e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      const baseBlockId = focusedBlockId ?? textRangeSelection?.focus.blockId ?? selectedBlockId

      if (!baseBlockId) return

      const neighbor = neighborBlock(baseBlockId, e.key === 'ArrowDown' ? 1 : -1)

      if (neighbor && isTextBlock(neighbor.type)) {
        e.preventDefault()
        e.stopPropagation()

        const anchor = resolveSelectionAnchor() ?? { blockId: baseBlockId, offset: 0 }
        const focusOffset =
          textRangeSelection?.focus.offset ??
          itemRefs.current.get(baseBlockId)?.getSelection()?.end ??
          0
        const clampedOffset = Math.min(focusOffset, blockLength(neighbor))

        setManagedTextRange(anchor, { blockId: neighbor.id, offset: clampedOffset })
        afterRender(() => rootRef.current?.focus())
        return
      }
    }

    if (mod && e.key.toLowerCase() === 'z') {
      e.preventDefault()
      e.stopPropagation()
      if (e.shiftKey) redo()
      else undo()
      return
    }

    if (mod && e.key.toLowerCase() === 'y') {
      e.preventDefault()
      e.stopPropagation()
      redo()
      return
    }

    if (e.key === 'Escape' && bubble) {
      setBubble(null)
    }
  }

  function onBlockPointerDown(block: Block, e: React.PointerEvent) {
    if (readonly) return

    const target = e.target as HTMLElement
    if (target.closest('.ebi-reorder-handle, .ebi-gutter')) return

    if (e.shiftKey && !isTextBlock(block.type)) {
      const anchor = resolveSelectionAnchor() ?? { blockId: block.id, offset: 0 }
      setManagedTextRange(anchor, { blockId: block.id, offset: blockLength(block) })
      e.preventDefault()
      afterRender(() => rootRef.current?.focus())
      return
    }

    if (!e.shiftKey && hasActiveManagedSelection() && !isTextBlock(block.type)) {
      clearTextRangeSelection()
    }
  }

  function onDocPointerMove(e: PointerEvent) {
    if (
      draggingId ||
      !isDragSelectingRef.current ||
      !dragSelectAnchorRef.current ||
      e.buttons === 0 ||
      !rootRef.current
    )
      return

    const point = caretPointFromClient(rootRef.current, e.clientX, e.clientY)
    if (!point) return

    setTextRangeSelection({ anchor: dragSelectAnchorRef.current, focus: point })

    if (point.blockId !== dragSelectAnchorRef.current.blockId || hasActiveManagedSelection()) {
      setManagedTextSelectionFlag(true)
      window.getSelection()?.removeAllRanges()
      setFocusedBlockId(null)
    }
  }

  function onDocPointerUp() {
    if (isDragSelectingRef.current) finalizeTextRangeSelection()
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

  function onDocMouseDown(e: MouseEvent) {
    const target = e.target as HTMLElement

    if (isEditorOverlayTarget(target)) return

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
    document.addEventListener('selectionchange', onSelectionChange)
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('pointermove', onDocPointerMove)
    document.addEventListener('pointerup', onDocPointerUp)

    return () => {
      document.removeEventListener('selectionchange', onSelectionChange)
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
    emojiTriggerState,
    bubble,
    iconPickerRequest,
    setIconPickerRequest,
    showBubbleToolbar,
    readonly,
    upload,
    pickMedia,
    editorDir,
    setItemRef,
    textHighlightForBlock,
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
