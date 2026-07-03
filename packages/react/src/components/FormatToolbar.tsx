import { useEffect, useState } from 'react'
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Check,
  ChevronDown,
  Code,
  IndentDecrease,
  IndentIncrease,
  Italic,
  Languages,
  Link2,
  List,
  ListOrdered,
  Paintbrush,
  Quote,
  Strikethrough,
  Type,
  Heading1,
  Heading2,
  Heading3,
  CheckSquare,
  Lightbulb,
  Underline,
} from 'lucide-react'
import type { BlockType, MarkName, TableStyle } from '@xproeditor/core'
import { Button, IconEmojiPicker, IconValueDisplay, Input } from '../ui'
import {
  TableStylePanel,
  ToolbarButton,
  ToolbarColorPanel,
  ToolbarPopover,
  ToolbarSeparator,
} from './toolbar'
import type { FormatToolbarAlign, FormatToolbarState } from '../types'

export type { FormatToolbarAlign, FormatToolbarState }

export interface FormatToolbarProps {
  state: FormatToolbarState | null
  onMark: (mark: MarkName, value: boolean | string | null) => void
  onTurnInto: (type: BlockType) => void
  onIndent: () => void
  onOutdent: () => void
  onAlign: (align: FormatToolbarAlign) => void
  onDir: (dir: 'auto' | 'ltr' | 'rtl') => void
  onCalloutIcon: (icon: string | null) => void
  onTableStyle: (patch: Partial<TableStyle>) => void
  onCellBackground: (color: string | null) => void
}

const TURN_INTO: Array<{ type: BlockType; label: string; icon: typeof Type }> = [
  { type: 'paragraph', label: 'Paragraph', icon: Type },
  { type: 'heading_1', label: 'Heading 1', icon: Heading1 },
  { type: 'heading_2', label: 'Heading 2', icon: Heading2 },
  { type: 'heading_3', label: 'Heading 3', icon: Heading3 },
  { type: 'bulleted_list_item', label: 'Bulleted list', icon: List },
  { type: 'numbered_list_item', label: 'Numbered list', icon: ListOrdered },
  { type: 'to_do', label: 'To-do', icon: CheckSquare },
  { type: 'quote', label: 'Quote', icon: Quote },
  { type: 'callout', label: 'Callout', icon: Lightbulb },
]

export function FormatToolbar({
  state,
  onMark,
  onTurnInto,
  onIndent,
  onOutdent,
  onAlign,
  onDir,
  onCalloutIcon,
  onTableStyle,
  onCellBackground,
}: FormatToolbarProps) {
  const [turnIntoOpen, setTurnIntoOpen] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [colorOpen, setColorOpen] = useState(false)
  const [tableStyleOpen, setTableStyleOpen] = useState(false)
  const [linkInput, setLinkInput] = useState('')

  const isTable = state?.blockType === 'table'

  useEffect(() => {
    setTurnIntoOpen(false)
    setLinkOpen(false)
    setColorOpen(false)
    setTableStyleOpen(false)
  }, [state?.blockId])

  const turnIntoLabel = TURN_INTO.find((t) => t.type === state?.blockType)?.label ?? 'Paragraph'

  function openLinkPopover(open: boolean) {
    if (open) {
      setLinkInput(state?.currentLink ?? '')
      setTurnIntoOpen(false)
      setColorOpen(false)
    }
    setLinkOpen(open)
  }

  function applyLink() {
    const url = linkInput.trim()
    onMark('link', url || null)
    setLinkOpen(false)
  }

  function onTurnIntoOpenChange(open: boolean) {
    if (open) {
      setLinkOpen(false)
      setColorOpen(false)
    }
    setTurnIntoOpen(open)
  }

  function onColorOpenChange(open: boolean) {
    if (open) {
      setLinkOpen(false)
      setTurnIntoOpen(false)
      setTableStyleOpen(false)
    }
    setColorOpen(open)
  }

  function onTableStyleOpenChange(open: boolean) {
    if (open) {
      setLinkOpen(false)
      setTurnIntoOpen(false)
      setColorOpen(false)
    }
    setTableStyleOpen(open)
  }

  const disabled = !state
  const blockActionsDisabled = disabled || !!state?.multiBlock
  const tableActionsDisabled = disabled || !isTable

  return (
    <div className="border-b border-gray-100 bg-white px-4 py-2" data-pro-editor-toolbar>
      <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-0.5">
        <ToolbarPopover
          open={turnIntoOpen}
          onOpenChange={onTurnIntoOpenChange}
          contentClassName="w-48 py-1"
          trigger={
            <ToolbarButton wide disabled={blockActionsDisabled || isTable}>
              {turnIntoLabel}
              <ChevronDown className="size-3" />
            </ToolbarButton>
          }
        >
          {TURN_INTO.map((t) => {
            const Icon = t.icon
            return (
              <button
                key={t.type}
                type="button"
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-start text-[13px] transition-colors ${t.type === state?.blockType ? 'bg-indigo-50/60 text-indigo-600' : 'text-gray-700 hover:bg-gray-50'}`}
                onClick={() => {
                  onTurnInto(t.type)
                  setTurnIntoOpen(false)
                }}
              >
                <Icon className="size-3.5 shrink-0 text-gray-400" />
                <span className="flex-1">{t.label}</span>
                {t.type === state?.blockType && (
                  <Check className="size-3.5 shrink-0 text-indigo-500" />
                )}
              </button>
            )
          })}
        </ToolbarPopover>

        <ToolbarSeparator />

        <ToolbarButton
          active={!!state?.activeMarks.bold}
          disabled={disabled || !state?.hasSelection}
          title="Bold"
          onClick={() => onMark('bold', !state?.activeMarks.bold)}
        >
          <Bold className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={!!state?.activeMarks.italic}
          disabled={disabled || !state?.hasSelection}
          title="Italic"
          onClick={() => onMark('italic', !state?.activeMarks.italic)}
        >
          <Italic className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={!!state?.activeMarks.underline}
          disabled={disabled || !state?.hasSelection}
          title="Underline"
          onClick={() => onMark('underline', !state?.activeMarks.underline)}
        >
          <Underline className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={!!state?.activeMarks.strikethrough}
          disabled={disabled || !state?.hasSelection}
          title="Strikethrough"
          onClick={() => onMark('strikethrough', !state?.activeMarks.strikethrough)}
        >
          <Strikethrough className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={!!state?.activeMarks.code}
          disabled={disabled || !state?.hasSelection}
          title="Inline code"
          onClick={() => onMark('code', !state?.activeMarks.code)}
        >
          <Code className="size-3.5" />
        </ToolbarButton>

        <ToolbarSeparator />

        <ToolbarPopover
          open={linkOpen}
          onOpenChange={openLinkPopover}
          contentClassName="p-2"
          title="Link"
          trigger={
            <ToolbarButton
              active={linkOpen || !!state?.currentLink}
              disabled={disabled || !state?.hasSelection}
              title="Link"
            >
              <Link2 className="size-3.5" />
            </ToolbarButton>
          }
        >
          <div className="flex min-w-[260px] items-center gap-1.5">
            <Input
              className="h-8 flex-1 text-xs"
              placeholder="https://..."
              value={linkInput}
              onChange={(e) => setLinkInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  applyLink()
                }
                if (e.key === 'Escape') setLinkOpen(false)
              }}
            />
            <Button size="sm" className="h-8 px-3 text-xs" onClick={applyLink}>
              Set
            </Button>
            {state?.currentLink && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs text-red-500 hover:bg-red-50 hover:text-red-600"
                onClick={() => {
                  onMark('link', null)
                  setLinkOpen(false)
                }}
              >
                Remove
              </Button>
            )}
          </div>
        </ToolbarPopover>

        <ToolbarPopover
          open={colorOpen}
          onOpenChange={onColorOpenChange}
          contentClassName="p-2"
          trigger={
            <ToolbarButton
              active={colorOpen || !!state?.currentColor || !!state?.currentHighlight}
              disabled={disabled || !state?.hasSelection}
              title="Color"
            >
              <Paintbrush className="size-3.5" />
            </ToolbarButton>
          }
        >
          <ToolbarColorPanel
            open={colorOpen}
            currentColor={state?.currentColor}
            currentHighlight={state?.currentHighlight}
            onMark={onMark}
          />
        </ToolbarPopover>

        <ToolbarButton
          disabled={blockActionsDisabled}
          title="Quote"
          onClick={() => onTurnInto('quote')}
        >
          <Quote className="size-3.5" />
        </ToolbarButton>

        {state?.blockType === 'callout' && (
          <>
            <ToolbarSeparator />
            <IconEmojiPicker
              value={state.calloutIcon ?? '💡'}
              onChange={onCalloutIcon}
              align="start"
              side="bottom"
              renderTrigger={({ selected, toggle }) => (
                <ToolbarButton
                  wide
                  disabled={blockActionsDisabled}
                  title="Callout icon"
                  onClick={(e) => {
                    e.stopPropagation()
                    toggle()
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <IconValueDisplay icon={selected ?? '💡'} className="size-4" />
                  <ChevronDown className="size-3 text-gray-400" />
                </ToolbarButton>
              )}
            />
          </>
        )}

        <ToolbarSeparator />

        <ToolbarButton
          active={state?.blockType === 'bulleted_list_item'}
          disabled={blockActionsDisabled}
          title="Bulleted list"
          onClick={() => onTurnInto('bulleted_list_item')}
        >
          <List className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={state?.blockType === 'numbered_list_item'}
          disabled={blockActionsDisabled}
          title="Numbered list"
          onClick={() => onTurnInto('numbered_list_item')}
        >
          <ListOrdered className="size-3.5" />
        </ToolbarButton>

        <ToolbarButton
          active={state?.align === 'left'}
          disabled={blockActionsDisabled}
          title="Align left"
          onClick={() => onAlign('left')}
        >
          <AlignLeft className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={state?.align === 'center'}
          disabled={blockActionsDisabled}
          title="Align center"
          onClick={() => onAlign('center')}
        >
          <AlignCenter className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={state?.align === 'right'}
          disabled={blockActionsDisabled}
          title="Align right"
          onClick={() => onAlign('right')}
        >
          <AlignRight className="size-3.5" />
        </ToolbarButton>
        {isTable && (
          <ToolbarButton
            active={state?.align === 'justify'}
            disabled={tableActionsDisabled}
            title="Justify"
            onClick={() => onAlign('justify')}
          >
            <AlignJustify className="size-3.5" />
          </ToolbarButton>
        )}

        {isTable && (
          <ToolbarPopover
            open={tableStyleOpen}
            onOpenChange={onTableStyleOpenChange}
            contentClassName="p-2"
            trigger={
              <ToolbarButton
                active={tableStyleOpen}
                disabled={tableActionsDisabled}
                title="Table style"
              >
                <Paintbrush className="size-3.5" />
              </ToolbarButton>
            }
          >
            <TableStylePanel
              open={tableStyleOpen}
              currentColor={state?.currentColor}
              currentHighlight={state?.currentHighlight}
              cellBackground={state?.cellBackground}
              tableStyle={state?.tableStyle}
              onMark={onMark}
              onCellBackground={onCellBackground}
              onTableStyle={onTableStyle}
            />
          </ToolbarPopover>
        )}

        {!isTable && <ToolbarSeparator />}

        <ToolbarButton
          active={state?.dir === 'auto'}
          disabled={blockActionsDisabled || isTable}
          title="Auto direction"
          onClick={() => onDir('auto')}
        >
          <Languages className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={state?.dir === 'ltr'}
          disabled={blockActionsDisabled || isTable}
          title="Left-to-right"
          onClick={() => onDir('ltr')}
        >
          <span className="text-[10px] font-bold">LTR</span>
        </ToolbarButton>
        <ToolbarButton
          active={state?.dir === 'rtl'}
          disabled={blockActionsDisabled || isTable}
          title="Right-to-left"
          onClick={() => onDir('rtl')}
        >
          <span className="text-[10px] font-bold">RTL</span>
        </ToolbarButton>

        <ToolbarButton
          disabled={blockActionsDisabled || isTable || (state?.indent ?? 0) <= 0}
          title="Decrease indent"
          onClick={onOutdent}
        >
          <IndentDecrease className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          disabled={blockActionsDisabled || isTable || (state?.indent ?? 0) >= 6}
          title="Increase indent"
          onClick={onIndent}
        >
          <IndentIncrease className="size-3.5" />
        </ToolbarButton>
      </div>
    </div>
  )
}
