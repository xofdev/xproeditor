import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { GripVertical, Plus, ChevronRight } from 'lucide-react'
import { BUTTON_COLOR_PRESETS, isTextBlock, resolveBlockDirection } from '@xproeditor/core'
import type { Block, BlockType, DocHeading, InlineSpan, MarkName, TableCellCoord } from '@xproeditor/core'
import { IconEmojiPicker } from '../ui'
import { CodeBlock, type CodeBlockHandle } from './CodeBlock'
import { AudioBlock } from './AudioBlock'
import { BlockContextMenu } from './BlockContextMenu'
import { BookmarkBlock } from './BookmarkBlock'
import { EmbedBlock } from './EmbedBlock'
import { TableOfContentsBlock } from './TableOfContentsBlock'
import { ButtonBlock } from './ButtonBlock'
import { FileBlock } from './FileBlock'
import { ImageBlock } from './ImageBlock'
import { SelectionHighlight } from './SelectionHighlight'
import { TableBlock, type TableBlockHandle } from './TableBlock'
import { TextBlock, type TextBlockHandle } from './TextBlock'
import { VideoBlock } from './VideoBlock'
import { useEditorDictionary } from '../i18n'
import type { BlockItemHandle, FetchBookmarkMetaFn, PickMediaFn, UploadFn } from '../types'

const CALLOUT_COLORS = ['#f8fafc', '#fefce8', '#fff7ed', '#fef2f2', '#f0fdf4', '#eff6ff', '#faf5ff']
const LIST_LIKE = [
  'bulleted_list_item',
  'numbered_list_item',
  'to_do',
  'toggle',
  'toggle_heading_1',
  'toggle_heading_2',
  'toggle_heading_3',
]

const TOGGLE_LIKE = ['toggle', 'toggle_heading_1', 'toggle_heading_2', 'toggle_heading_3']

export interface BlockItemProps {
  block: Block
  number?: number
  placeholder?: string
  selected?: boolean
  textHighlight?: { start: number; end: number } | null
  dropPosition?: 'before' | 'after' | null
  upload?: UploadFn
  pickMedia?: PickMediaFn
  fetchBookmarkMeta?: FetchBookmarkMetaFn
  editorDir?: 'ltr' | 'rtl'
  readonly?: boolean
  themeSource?: HTMLElement | null
  iconPickerRequest?: { tab: 'emoji' | 'icon' } | null
  aiEnabled?: boolean
  /** Browser spellcheck in text blocks (default `true`). */
  spellCheck?: boolean
  /** Document headings — only needed by `table_of_contents` blocks. */
  tocHeadings?: DocHeading[]
  /** Jump to another block (table of contents links). */
  onNavigateToBlock?: (blockId: string) => void
  onInput: (spans: InlineSpan[], caret: number | null) => void
  onEnter: (offsets: { start: number; end: number }) => void
  onBackspaceStart: () => void
  onDeleteEnd: () => void
  onArrowUp: () => void
  onArrowDown: () => void
  onTab: (shift: boolean) => void
  onFormat: (mark: MarkName) => void
  onPasted: (payload: {
    html: string
    text: string
    files: File[]
    offsets: { start: number; end: number }
  }) => void
  onFocus: () => void
  onPatch: (patch: Record<string, unknown>) => void
  onSelect: () => void
  onAddBelow: () => void
  onDuplicate: () => void
  onCopy: () => void
  onCut: () => void
  onRemove: () => void
  onTurnInto: (type: BlockType) => void
  onAskAI?: () => void
  onDragHandleStart: (e: React.DragEvent) => void
  onPointerDown: (e: React.PointerEvent) => void
  onSelectionPointerDown: (payload: { shiftKey: boolean; clientX: number; clientY: number }) => void
  onIconPickerOpened: () => void
  onTableCellFocus: (payload: { row: number; col: number; shiftKey: boolean }) => void
  onTableCellInput: (payload: {
    row: number
    col: number
    content: InlineSpan[]
    caret: number | null
  }) => void
  onTableCellFormat: (payload: { row: number; col: number; mark: MarkName }) => void
  onTableCellTab: (payload: { row: number; col: number; shift: boolean }) => void
  onTableCellNavigate: (payload: {
    row: number
    col: number
    direction: 'up' | 'down' | 'left' | 'right'
  }) => void
  onTableCellSelectionChange: (cells: TableCellCoord[]) => void
}

export const BlockItem = forwardRef<BlockItemHandle, BlockItemProps>(
  function BlockItem(props, ref) {
    const {
      block,
      number,
      placeholder,
      selected,
      textHighlight,
      dropPosition,
      upload,
      pickMedia,
      fetchBookmarkMeta,
      editorDir,
      readonly,
      themeSource,
      iconPickerRequest,
      aiEnabled,
      spellCheck = true,
      tocHeadings,
      onNavigateToBlock,
      onInput,
      onEnter,
      onBackspaceStart,
      onDeleteEnd,
      onArrowUp,
      onArrowDown,
      onTab,
      onFormat,
      onPasted,
      onFocus,
      onPatch,
      onSelect,
      onAddBelow,
      onDuplicate,
      onCopy,
      onCut,
      onRemove,
      onTurnInto,
      onAskAI,
      onDragHandleStart,
      onPointerDown,
      onSelectionPointerDown,
      onIconPickerOpened,
      onTableCellFocus,
      onTableCellInput,
      onTableCellFormat,
      onTableCellTab,
      onTableCellNavigate,
      onTableCellSelectionChange,
    } = props

    const dict = useEditorDictionary()
    const innerRef = useRef<TextBlockHandle | CodeBlockHandle | TableBlockHandle | null>(null)
    const calloutIconPickerRef = useRef<{ open: (tab?: 'emoji' | 'icon') => void } | null>(null)
    const [showCalloutColors, setShowCalloutColors] = useState(false)
    const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null)

    function openContextMenuAt(x: number, y: number) {
      onSelect()
      setContextMenuPos({ x, y })
    }

    function onContextMenu(e: React.MouseEvent) {
      if (readonly) return

      e.preventDefault()
      openContextMenuAt(e.clientX, e.clientY)
    }

    function onHandleClick(e: React.MouseEvent<HTMLButtonElement>) {
      e.preventDefault()
      e.stopPropagation()
      const rect = e.currentTarget.getBoundingClientRect()
      openContextMenuAt(rect.right + 4, rect.top)
    }

    const colorPresets =
      block.type === 'callout'
        ? CALLOUT_COLORS
        : block.type === 'button'
          ? [...BUTTON_COLOR_PRESETS]
          : undefined

    useEffect(() => {
      if (!iconPickerRequest || readonly || block.type !== 'callout') return

      requestAnimationFrame(() => {
        calloutIconPickerRef.current?.open(iconPickerRequest.tab)
        onIconPickerOpened()
      })
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [iconPickerRequest])

    const indent = block.props.indent ?? 0
    const textual = isTextBlock(block.type)
    const blockDir = resolveBlockDirection(block, editorDir ?? 'ltr')
    const isRtl = blockDir === 'rtl'

    useImperativeHandle(ref, () => ({
      focusAt: (pos) =>
        (innerRef.current as { focusAt?: (p: number | 'start' | 'end') => void } | null)?.focusAt?.(
          pos,
        ),
      getSelection: () =>
        (
          innerRef.current as { getSelection?: () => { start: number; end: number } | null } | null
        )?.getSelection?.() ?? null,
      setSelection: (start, end) =>
        (
          innerRef.current as { setSelection?: (s: number, e?: number) => void } | null
        )?.setSelection?.(start, end),
      textual,
      getTableSelectedCells: () =>
        (innerRef.current as TableBlockHandle | null)?.getSelectedCells?.() ?? [],
      setTableSelectedCells: (cells) =>
        (innerRef.current as TableBlockHandle | null)?.setSelectedCells?.(cells),
      focusTableCell: (row, col, pos = 'start') =>
        (innerRef.current as TableBlockHandle | null)?.focusCell?.(row, col, pos),
      getTableCellSelection: (row, col) =>
        (innerRef.current as TableBlockHandle | null)?.getCellSelection?.(row, col) ?? null,
      setTableCellSelection: (row, col, start, end) =>
        (innerRef.current as TableBlockHandle | null)?.setCellSelection?.(
          row,
          col,
          start,
          end ?? start,
        ),
    }))

    const textEditableEl = (innerRef.current as { el?: HTMLElement | null } | null)?.el ?? null

    const calloutIcon = block.props.icon ?? '💡'

    function renderTextBlock(extraClassName?: string, extraPlaceholder?: string) {
      return (
        <TextBlock
          ref={innerRef as React.Ref<TextBlockHandle>}
          block={block}
          readonly={readonly}
          placeholder={extraPlaceholder ?? placeholder}
          spellCheck={spellCheck}
          className={extraClassName}
          onInput={onInput}
          onEnter={onEnter}
          onBackspaceStart={onBackspaceStart}
          onDeleteEnd={onDeleteEnd}
          onArrowUp={onArrowUp}
          onArrowDown={onArrowDown}
          onTab={onTab}
          onFormat={onFormat}
          onPasted={onPasted}
          onFocus={onFocus}
          onSelectionPointerDown={onSelectionPointerDown}
        />
      )
    }

    const markerLevel =
      block.type === 'toggle_heading_1'
        ? 'h1'
        : block.type === 'toggle_heading_2'
          ? 'h2'
          : block.type === 'toggle_heading_3'
            ? 'h3'
            : null

    return (
      <div
        className={`ebi group/block${selected ? ' ebi-selected' : ''}`}
        data-block-id={block.id}
        dir={blockDir}
        style={{ ['--xpe-block-indent' as string]: indent }}
        onPointerDown={onPointerDown}
        onContextMenu={onContextMenu}
      >
        {dropPosition === 'before' && <div className="ebi-drop -top-[2px]" />}
        {dropPosition === 'after' && <div className="ebi-drop -bottom-[2px]" />}

        <div className="ebi-row">
          {!readonly && (
            <div
              className="ebi-gutter"
              contentEditable={false}
              suppressContentEditableWarning
            >
              <button
                className="ebi-gutter-btn"
                title={dict.blockMenu.addBelow}
                aria-label={dict.blockMenu.addBelow}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={onAddBelow}
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                className="ebi-gutter-btn ebi-reorder-handle cursor-grab active:cursor-grabbing"
                title={dict.blockMenu.dragHandle}
                aria-label={dict.blockMenu.dragHandle}
                draggable
                onPointerDown={(e) => e.stopPropagation()}
                onDragStart={onDragHandleStart}
                onClick={onHandleClick}
              >
                <GripVertical className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="ebi-body">
            {block.type === 'quote' ? (
              <div className="flex gap-3 border-s-[3px] border-[var(--xpe-foreground)] ps-3.5">
                {renderTextBlock('flex-1', dict.placeholders.quote)}
              </div>
            ) : block.type === 'callout' ? (
              <div
                className="flex items-start gap-2.5 rounded-[var(--xpe-radius)] border border-[var(--xpe-border)] px-3.5 py-3"
                style={{ background: block.props.color ?? 'var(--xpe-muted)' }}
              >
                <div
                  className="relative shrink-0"
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  contentEditable={false}
                  suppressContentEditableWarning
                >
                  <IconEmojiPicker
                    ref={calloutIconPickerRef}
                    value={calloutIcon}
                    onChange={(value) => onPatch({ icon: value ?? '💡' })}
                    disabled={readonly}
                    align="start"
                    side="bottom"
                    renderTrigger={({ selected: sel, toggle }) => (
                      <button
                        type="button"
                        aria-label="Change callout icon"
                        title={dict.blockMenu.changeCalloutIcon}
                        className={`mt-0.5 text-lg leading-none transition-transform${!readonly ? ' hover:scale-110' : ''}`}
                        disabled={readonly}
                        onClick={(e) => {
                          e.stopPropagation()
                          toggle()
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        {sel ?? '💡'}
                      </button>
                    )}
                  />
                  {!readonly && (
                    <button
                      type="button"
                      title={dict.blockMenu.changeCalloutColor}
                      className={`mt-1 block w-full text-[10px] text-[var(--xpe-muted-foreground)] transition-opacity hover:text-[var(--xpe-foreground)] focus-visible:opacity-100 ${showCalloutColors ? 'opacity-100' : 'opacity-0 group-hover/block:opacity-100'}`}
                      onClick={() => setShowCalloutColors((v) => !v)}
                    >
                      {dict.blockMenu.color}
                    </button>
                  )}
                  {showCalloutColors && !readonly && (
                    <div className="absolute start-0 top-full z-[60] mt-1 rounded-[var(--xpe-radius)] border border-[var(--xpe-border)] bg-[var(--xpe-surface)] p-2 shadow-xl">
                      <div className="flex gap-1">
                        {CALLOUT_COLORS.map((c) => (
                          <button
                            key={c}
                            className="h-5 w-5 rounded-md border border-black/10"
                            style={{ background: c }}
                            onClick={() => {
                              onPatch({ color: c })
                              setShowCalloutColors(false)
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                {renderTextBlock('flex-1', dict.placeholders.callout)}
              </div>
            ) : LIST_LIKE.includes(block.type) ? (
              <div className="ebi-list-row">
                <div
                  className={`ebi-list-marker${markerLevel ? ` ebi-list-marker--${markerLevel}` : ''}`}
                  contentEditable={false}
                  suppressContentEditableWarning
                >
                  {block.type === 'bulleted_list_item' && (
                    <span className="ebi-list-bullet">•</span>
                  )}
                  {block.type === 'numbered_list_item' && (
                    <span className="ebi-list-number">{number ?? 1}.</span>
                  )}
                  {block.type === 'to_do' && (
                    <button
                      type="button"
                      role="checkbox"
                      aria-label={dict.blockMenu.toggleToDo}
                      aria-checked={!!block.props.checked}
                      className={`ebi-todo${block.props.checked ? ' ebi-todo--checked' : ''}`}
                      disabled={readonly}
                      onClick={() => onPatch({ checked: !block.props.checked })}
                    >
                      {block.props.checked && (
                        <svg
                          width={10}
                          height={10}
                          className="shrink-0 text-[var(--xpe-primary-foreground)]"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={3}
                          viewBox="0 0 24 24"
                        >
                          <path d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  )}
                  {TOGGLE_LIKE.includes(block.type) && (
                    <button
                      type="button"
                      aria-label={block.props.collapsed ? dict.blockMenu.expandToggle : dict.blockMenu.collapseToggle}
                      aria-expanded={!block.props.collapsed}
                      className="ebi-toggle-btn"
                      disabled={readonly}
                      onClick={() => onPatch({ collapsed: !block.props.collapsed })}
                    >
                      <ChevronRight
                        size={14}
                        className={`shrink-0 transition-transform${!block.props.collapsed ? ' rotate-90' : ''}${isRtl ? ' ebi-chevron-rtl' : ''}`}
                      />
                    </button>
                  )}
                </div>
                {renderTextBlock(
                  block.type === 'to_do' && block.props.checked
                    ? 'flex-1 min-w-0 line-through !text-[var(--xpe-muted-foreground)]'
                    : 'flex-1 min-w-0',
                  block.type === 'to_do'
                    ? dict.placeholders.toDo
                    : block.type === 'toggle'
                      ? dict.placeholders.toggle
                      : block.type === 'toggle_heading_1'
                        ? dict.placeholders.heading1
                        : block.type === 'toggle_heading_2'
                          ? dict.placeholders.heading2
                          : block.type === 'toggle_heading_3'
                            ? dict.placeholders.heading3
                            : dict.placeholders.listItem,
                )}
              </div>
            ) : block.type === 'code' ? (
              <CodeBlock
                ref={innerRef as React.Ref<CodeBlockHandle>}
                block={block}
                readonly={readonly}
                onPatch={onPatch}
                onArrowUp={onArrowUp}
                onArrowDown={onArrowDown}
                onRemoveSelf={onRemove}
                onExitBelow={onAddBelow}
              />
            ) : block.type === 'image' ? (
              <ImageBlock
                block={block}
                selected={selected}
                readonly={readonly}
                upload={upload}
                pickMedia={pickMedia}
                onPatch={onPatch}
                onSelect={onSelect}
              />
            ) : block.type === 'video' ? (
              <VideoBlock
                block={block}
                selected={selected}
                readonly={readonly}
                upload={upload}
                pickMedia={pickMedia}
                onPatch={onPatch}
                onSelect={onSelect}
              />
            ) : block.type === 'audio' ? (
              <AudioBlock
                block={block}
                selected={selected}
                readonly={readonly}
                upload={upload}
                pickMedia={pickMedia}
                onPatch={onPatch}
                onSelect={onSelect}
              />
            ) : block.type === 'file' ? (
              <FileBlock
                block={block}
                selected={selected}
                readonly={readonly}
                upload={upload}
                pickMedia={pickMedia}
                onPatch={onPatch}
                onSelect={onSelect}
              />
            ) : block.type === 'table' ? (
              <TableBlock
                ref={innerRef as React.Ref<TableBlockHandle>}
                block={block}
                readonly={readonly}
                onPatch={onPatch}
                onCellFocus={onTableCellFocus}
                onCellInput={onTableCellInput}
                onCellFormat={onTableCellFormat}
                onCellTab={onTableCellTab}
                onCellNavigate={onTableCellNavigate}
                onCellSelectionChange={onTableCellSelectionChange}
              />
            ) : block.type === 'divider' ? (
              <div className="py-2.5 cursor-pointer" onClick={onSelect}>
                <hr className={`border-[var(--xpe-border)] rounded${selected ? ' !border-[var(--xpe-ring)]' : ''}`} />
              </div>
            ) : block.type === 'button' ? (
              <ButtonBlock
                ref={innerRef as React.Ref<TextBlockHandle>}
                block={block}
                readonly={readonly}
                onInput={onInput}
                onEnter={onEnter}
                onBackspaceStart={onBackspaceStart}
                onDeleteEnd={onDeleteEnd}
                onArrowUp={onArrowUp}
                onArrowDown={onArrowDown}
                onTab={onTab}
                onFormat={onFormat}
                onPasted={onPasted}
                onFocus={onFocus}
                onSelectionPointerDown={onSelectionPointerDown}
                onPatch={onPatch}
                onSelect={onSelect}
              />
            ) : block.type === 'embed' ? (
              <EmbedBlock
                block={block}
                selected={selected}
                readonly={readonly}
                onPatch={onPatch}
                onSelect={onSelect}
              />
            ) : block.type === 'table_of_contents' ? (
              <TableOfContentsBlock
                headings={tocHeadings ?? []}
                selected={selected}
                onSelect={onSelect}
                onNavigate={(id) => onNavigateToBlock?.(id)}
              />
            ) : block.type === 'bookmark' ? (
              <BookmarkBlock
                block={block}
                selected={selected}
                readonly={readonly}
                fetchBookmarkMeta={fetchBookmarkMeta}
                onPatch={onPatch}
                onSelect={onSelect}
              />
            ) : (
              renderTextBlock()
            )}

            {textHighlight && (
              <SelectionHighlight
                target={textEditableEl}
                start={textHighlight.start}
                end={textHighlight.end}
              />
            )}
          </div>
        </div>

        {contextMenuPos && (
          <BlockContextMenu
            position={contextMenuPos}
            blockType={block.type}
            themeSource={themeSource}
            colorPresets={colorPresets}
            currentColor={block.props.color}
            canTurnInto={textual}
            aiEnabled={aiEnabled}
            onColor={(color) => onPatch({ color })}
            onTurnInto={onTurnInto}
            onDuplicate={onDuplicate}
            onCopy={onCopy}
            onCut={onCut}
            onDelete={onRemove}
            onInsertBelow={onAddBelow}
            onAskAI={onAskAI}
            onClose={() => setContextMenuPos(null)}
          />
        )}
      </div>
    )
  },
)
