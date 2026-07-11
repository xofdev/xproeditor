import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Copy, GripVertical, Plus, ChevronRight, Trash2 } from 'lucide-react'
import { isTextBlock, resolveBlockDirection } from '@xproeditor/core'
import type { Block, InlineSpan, MarkName, TableCellCoord } from '@xproeditor/core'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  IconEmojiPicker,
} from '../ui'
import { CodeBlock, type CodeBlockHandle } from './CodeBlock'
import { AudioBlock } from './AudioBlock'
import { FileBlock } from './FileBlock'
import { ImageBlock } from './ImageBlock'
import { SelectionHighlight } from './SelectionHighlight'
import { TableBlock, type TableBlockHandle } from './TableBlock'
import { TextBlock, type TextBlockHandle } from './TextBlock'
import { VideoBlock } from './VideoBlock'
import type { BlockItemHandle, PickMediaFn, UploadFn } from '../types'

const CALLOUT_COLORS = ['#f8fafc', '#fefce8', '#fff7ed', '#fef2f2', '#f0fdf4', '#eff6ff', '#faf5ff']
const LIST_LIKE = ['bulleted_list_item', 'numbered_list_item', 'to_do', 'toggle']

export interface BlockItemProps {
  block: Block
  number?: number
  placeholder?: string
  selected?: boolean
  textHighlight?: { start: number; end: number } | null
  dropPosition?: 'before' | 'after' | null
  upload?: UploadFn
  pickMedia?: PickMediaFn
  editorDir?: 'ltr' | 'rtl'
  readonly?: boolean
  iconPickerRequest?: { tab: 'emoji' | 'icon' } | null
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
  onRemove: () => void
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
      editorDir,
      readonly,
      iconPickerRequest,
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
      onRemove,
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

    const innerRef = useRef<TextBlockHandle | CodeBlockHandle | TableBlockHandle | null>(null)
    const calloutIconPickerRef = useRef<{ open: (tab?: 'emoji' | 'icon') => void } | null>(null)
    const [showCalloutColors, setShowCalloutColors] = useState(false)

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

    return (
      <div
        className={`ebi group/block relative${selected ? ' ebi-selected' : ''}`}
        data-block-id={block.id}
        dir={blockDir}
        style={{ paddingInlineStart: `${indent * 28}px` }}
        onPointerDown={onPointerDown}
      >
        {dropPosition === 'before' && <div className="ebi-drop -top-[2px]" />}
        {dropPosition === 'after' && <div className="ebi-drop -bottom-[2px]" />}

        <div className="flex items-start gap-0.5">
          {!readonly && (
            <div
              className="ebi-gutter flex items-center shrink-0 pt-[5px] opacity-0 group-hover/block:opacity-100 transition-opacity select-none"
              contentEditable={false}
              suppressContentEditableWarning
            >
              <button
                className="ebi-gutter-btn"
                title="Add block below"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={onAddBelow}
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              <div className="relative">
                <DropdownMenu>
                  <DropdownMenuTrigger>
                    <button
                      className="ebi-gutter-btn ebi-reorder-handle cursor-grab active:cursor-grabbing"
                      title="Drag to move, click for menu"
                      draggable
                      onPointerDown={(e) => e.stopPropagation()}
                      onDragStart={onDragHandleStart}
                    >
                      <GripVertical className="w-3.5 h-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align={isRtl ? 'end' : 'start'} className="w-36">
                    <DropdownMenuItem onClick={onDuplicate}>
                      <Copy className="w-3.5 h-3.5 text-[var(--xpe-muted-foreground)]" />
                      Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-[var(--xpe-danger)]" onClick={onRemove}>
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          )}

          <div className="relative flex-1 min-w-0 py-[3px]">
            {block.type === 'quote' ? (
              <div className="flex gap-3 border-s-[3px] border-[var(--xpe-foreground)] ps-3.5">
                {renderTextBlock('flex-1', 'Quote')}
              </div>
            ) : block.type === 'callout' ? (
              <div
                className="flex items-start gap-2.5 rounded-xl border border-[var(--xpe-border)] px-3.5 py-3"
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
                      className="mt-1 block w-full text-[10px] text-[var(--xpe-muted-foreground)] hover:text-[var(--xpe-foreground)]"
                      onClick={() => setShowCalloutColors((v) => !v)}
                    >
                      Color
                    </button>
                  )}
                  {showCalloutColors && !readonly && (
                    <div className="absolute start-0 top-full z-[60] mt-1 rounded-xl border border-[var(--xpe-border)] bg-[var(--xpe-surface)] p-2 shadow-xl">
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
                {renderTextBlock('flex-1', 'Type something...')}
              </div>
            ) : LIST_LIKE.includes(block.type) ? (
              <div className="ebi-list-row flex items-start gap-1.5">
                <div
                  className="shrink-0 flex items-center justify-center w-6 pt-[5px] select-none"
                  contentEditable={false}
                  suppressContentEditableWarning
                >
                  {block.type === 'bulleted_list_item' && (
                    <span className="text-[var(--xpe-foreground)] text-base leading-none mt-1">•</span>
                  )}
                  {block.type === 'numbered_list_item' && (
                    <span className="text-[var(--xpe-foreground)] text-[14px] leading-snug tabular-nums">
                      {number ?? 1}.
                    </span>
                  )}
                  {block.type === 'to_do' && (
                    <button
                      className={`w-[15px] h-[15px] mt-1 rounded-[4px] border flex items-center justify-center transition-colors ${block.props.checked ? 'bg-[var(--xpe-primary)] border-[var(--xpe-primary)]' : 'border-[var(--xpe-border)] hover:border-[var(--xpe-ring)] bg-[var(--xpe-surface)]'}`}
                      disabled={readonly}
                      onClick={() => onPatch({ checked: !block.props.checked })}
                    >
                      {block.props.checked && (
                        <svg
                          className="w-2.5 h-2.5 text-white"
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
                  {block.type === 'toggle' && (
                    <button
                      className="w-5 h-5 mt-0.5 rounded flex items-center justify-center text-[var(--xpe-muted-foreground)] hover:bg-[var(--xpe-surface-hover)] transition-transform"
                      disabled={readonly}
                      onClick={() => onPatch({ collapsed: !block.props.collapsed })}
                    >
                      <ChevronRight
                        className={`h-3.5 w-3.5 transition-transform${!block.props.collapsed ? ' rotate-90' : ''}${isRtl ? ' ebi-chevron-rtl' : ''}`}
                      />
                    </button>
                  )}
                </div>
                {renderTextBlock(
                  block.type === 'to_do' && block.props.checked
                    ? 'line-through !text-[var(--xpe-muted-foreground)]'
                    : undefined,
                  block.type === 'to_do'
                    ? 'To-do'
                    : block.type === 'toggle'
                      ? 'Toggle'
                      : 'List item',
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
      </div>
    )
  },
)
