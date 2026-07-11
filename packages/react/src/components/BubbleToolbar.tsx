import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { syncThemeVars } from '@xproeditor/core'
import {
  Bold,
  Check,
  ChevronDown,
  Code,
  Italic,
  Link2,
  Paintbrush,
  Strikethrough,
  Type,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Lightbulb,
  Underline,
} from 'lucide-react'
import type { BlockType, MarkName } from '@xproeditor/core'
import { Button, Input } from '../ui'
import { ToolbarColorPanel } from './toolbar'

export interface BubbleToolbarProps {
  position: { x: number; y: number }
  activeMarks: Partial<Record<MarkName, boolean>>
  currentLink: string | null
  currentColor?: string | null
  currentHighlight?: string | null
  blockType: BlockType
  /** Element still inside the editor's themed DOM scope — used to resync
   * `--xpe-*` variables onto this toolbar once it's portaled to `<body>`. */
  themeSource?: HTMLElement | null
  onMark: (mark: MarkName, value: boolean | string | null) => void
  onTurnInto: (type: BlockType) => void
}

const TURN_INTO: Array<{ type: BlockType; label: string; icon: typeof Type }> = [
  { type: 'paragraph', label: 'Text', icon: Type },
  { type: 'heading_1', label: 'Heading 1', icon: Heading1 },
  { type: 'heading_2', label: 'Heading 2', icon: Heading2 },
  { type: 'heading_3', label: 'Heading 3', icon: Heading3 },
  { type: 'bulleted_list_item', label: 'Bulleted list', icon: List },
  { type: 'numbered_list_item', label: 'Numbered list', icon: ListOrdered },
  { type: 'to_do', label: 'To-do', icon: CheckSquare },
  { type: 'quote', label: 'Quote', icon: Quote },
  { type: 'callout', label: 'Callout', icon: Lightbulb },
]

type Panel = 'none' | 'link' | 'color' | 'turninto'

export function BubbleToolbar({
  position,
  activeMarks,
  currentLink,
  currentColor,
  currentHighlight,
  blockType,
  themeSource,
  onMark,
  onTurnInto,
}: BubbleToolbarProps) {
  const [panel, setPanel] = useState<Panel>('none')
  const [linkInput, setLinkInput] = useState('')
  const toolbarRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setPanel('none')

    if (themeSource && toolbarRef.current) {
      syncThemeVars(themeSource, toolbarRef.current)
    }
  }, [position, themeSource])

  function openLinkPanel() {
    setLinkInput(currentLink ?? '')
    setPanel((p) => (p === 'link' ? 'none' : 'link'))
  }

  function applyLink() {
    const url = linkInput.trim()
    onMark('link', url || null)
    setPanel('none')
  }

  const turnIntoLabel = TURN_INTO.find((t) => t.type === blockType)?.label ?? 'Text'

  return createPortal(
    <div
      ref={toolbarRef}
      className="fixed z-[70] flex flex-col items-stretch"
      style={{ left: position.x, top: position.y, transform: 'translate(-50%, calc(-100% - 8px))' }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="flex items-center gap-0.5 rounded-xl border border-[var(--xpe-border)] bg-[var(--xpe-surface)] px-1 py-1 shadow-xl">
        <button
          className="ebt-btn !w-auto gap-1 px-2 text-[12px] font-medium text-[var(--xpe-muted-foreground)]"
          onClick={() => setPanel((p) => (p === 'turninto' ? 'none' : 'turninto'))}
        >
          {turnIntoLabel}
          <ChevronDown className="size-3" />
        </button>
        <div className="mx-0.5 h-5 w-px bg-[var(--xpe-muted)]" />

        <button
          className={`ebt-btn${activeMarks.bold ? ' ebt-active' : ''}`}
          title="Bold (Ctrl+B)"
          onClick={() => onMark('bold', !activeMarks.bold)}
        >
          <Bold className="size-3.5" />
        </button>
        <button
          className={`ebt-btn${activeMarks.italic ? ' ebt-active' : ''}`}
          title="Italic (Ctrl+I)"
          onClick={() => onMark('italic', !activeMarks.italic)}
        >
          <Italic className="size-3.5" />
        </button>
        <button
          className={`ebt-btn${activeMarks.underline ? ' ebt-active' : ''}`}
          title="Underline (Ctrl+U)"
          onClick={() => onMark('underline', !activeMarks.underline)}
        >
          <Underline className="size-3.5" />
        </button>
        <button
          className={`ebt-btn${activeMarks.strikethrough ? ' ebt-active' : ''}`}
          title="Strikethrough"
          onClick={() => onMark('strikethrough', !activeMarks.strikethrough)}
        >
          <Strikethrough className="size-3.5" />
        </button>
        <button
          className={`ebt-btn${activeMarks.code ? ' ebt-active' : ''}`}
          title="Inline code (Ctrl+E)"
          onClick={() => onMark('code', !activeMarks.code)}
        >
          <Code className="size-3.5" />
        </button>

        <div className="mx-0.5 h-5 w-px bg-[var(--xpe-muted)]" />

        <button
          className={`ebt-btn${panel === 'link' || currentLink ? ' ebt-active' : ''}`}
          title="Link"
          onClick={openLinkPanel}
        >
          <Link2 className="size-3.5" />
        </button>
        <button
          className={`ebt-btn${panel === 'color' || currentColor || currentHighlight ? ' ebt-active' : ''}`}
          title="Color"
          onClick={() => setPanel((p) => (p === 'color' ? 'none' : 'color'))}
        >
          <Paintbrush className="size-3.5" />
        </button>
      </div>

      {panel === 'link' && (
        <div className="mt-1.5 flex items-center gap-1.5 rounded-xl border border-[var(--xpe-border)] bg-[var(--xpe-surface)] p-2 shadow-xl">
          <Input
            className="h-8 w-52 text-xs"
            placeholder="https://..."
            value={linkInput}
            onMouseDown={(e) => e.stopPropagation()}
            onChange={(e) => setLinkInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                applyLink()
              }
              if (e.key === 'Escape') setPanel('none')
            }}
          />
          <Button size="sm" className="h-8 px-3 text-xs" onClick={applyLink}>
            Set
          </Button>
          {currentLink && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs text-[var(--xpe-danger)] hover:bg-red-50 hover:text-red-600"
              onClick={() => {
                onMark('link', null)
                setPanel('none')
              }}
            >
              Remove
            </Button>
          )}
        </div>
      )}

      {panel === 'color' && (
        <div
          className="mt-1.5 rounded-xl border border-[var(--xpe-border)] bg-[var(--xpe-surface)] p-2 shadow-xl"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <ToolbarColorPanel
            currentColor={currentColor}
            currentHighlight={currentHighlight}
            onMark={onMark}
          />
        </div>
      )}

      {panel === 'turninto' && (
        <div className="mt-1.5 w-48 rounded-xl border border-[var(--xpe-border)] bg-[var(--xpe-surface)] py-1 shadow-xl">
          {TURN_INTO.map((t) => {
            const Icon = t.icon
            return (
              <button
                key={t.type}
                type="button"
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-start text-[13px] transition-colors ${t.type === blockType ? 'bg-[var(--xpe-primary-muted)] text-[var(--xpe-primary)]' : 'text-[var(--xpe-foreground)] hover:bg-[var(--xpe-surface-hover)]'}`}
                onClick={() => {
                  onTurnInto(t.type)
                  setPanel('none')
                }}
              >
                <Icon className="size-3.5 shrink-0 text-[var(--xpe-muted-foreground)]" />
                <span className="flex-1">{t.label}</span>
                {t.type === blockType && <Check className="size-3.5 shrink-0 text-[var(--xpe-primary)]" />}
              </button>
            )
          })}
        </div>
      )}
    </div>,
    document.body,
  )
}
