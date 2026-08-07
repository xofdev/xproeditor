import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { syncThemeVars } from '@xproeditor/core'
import {
  Bold,
  Check,
  ChevronDown,
  ChevronRight,
  Code,
  Copy,
  Italic,
  Link2,
  Paintbrush,
  RemoveFormatting,
  Sparkles,
  Strikethrough,
  Trash2,
  Type,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Lightbulb,
  Bookmark,
  SquareMousePointer,
  Underline,
  Files,
} from 'lucide-react'
import type { BlockType, MarkName } from '@xproeditor/core'
import { Button, Input } from '../ui'
import { ToolbarColorPanel } from './toolbar'

export interface BubbleToolbarProps {
  position: { x: number; y: number }
  /** `above` = classic selection toolbar; `beside` = multi-select panel (Notion-like). */
  placement?: 'above' | 'beside'
  activeMarks: Partial<Record<MarkName, boolean>>
  currentLink: string | null
  currentColor?: string | null
  currentHighlight?: string | null
  blockType: BlockType
  multiBlock?: boolean
  mixedTypes?: boolean
  aiEnabled?: boolean
  /** Element still inside the editor's themed DOM scope — used to resync
   * `--xpe-*` variables onto this toolbar once it's portaled to `<body>`. */
  themeSource?: HTMLElement | null
  onMark: (mark: MarkName, value: boolean | string | null) => void
  onTurnInto: (type: BlockType) => void
  onClearFormatting?: () => void
  onAskAI?: () => void
  onCopy?: () => void
  onDuplicate?: () => void
  onDelete?: () => void
}

const TURN_INTO: Array<{ type: BlockType; label: string; icon: typeof Type }> = [
  { type: 'paragraph', label: 'Text', icon: Type },
  { type: 'heading_1', label: 'Heading 1', icon: Heading1 },
  { type: 'heading_2', label: 'Heading 2', icon: Heading2 },
  { type: 'heading_3', label: 'Heading 3', icon: Heading3 },
  { type: 'bulleted_list_item', label: 'Bulleted list', icon: List },
  { type: 'numbered_list_item', label: 'Numbered list', icon: ListOrdered },
  { type: 'to_do', label: 'To-do', icon: CheckSquare },
  { type: 'toggle', label: 'Toggle list', icon: ChevronRight },
  { type: 'toggle_heading_1', label: 'Toggle heading 1', icon: Heading1 },
  { type: 'toggle_heading_2', label: 'Toggle heading 2', icon: Heading2 },
  { type: 'toggle_heading_3', label: 'Toggle heading 3', icon: Heading3 },
  { type: 'quote', label: 'Quote', icon: Quote },
  { type: 'callout', label: 'Callout', icon: Lightbulb },
  { type: 'button', label: 'Button', icon: SquareMousePointer },
  { type: 'bookmark', label: 'Web bookmark', icon: Bookmark },
]

type Panel = 'none' | 'link' | 'color' | 'turninto'

function clampPosition(
  x: number,
  y: number,
  width: number,
  height: number,
  placement: 'above' | 'beside',
) {
  const pad = 8
  if (placement === 'above') {
    // Anchor is selection center-top; element uses translate(-50%, calc(-100% - 8px)).
    const left = Math.min(Math.max(pad + width / 2, x), window.innerWidth - pad - width / 2)
    const top = Math.min(Math.max(height + pad + 8, y), window.innerHeight - pad)
    return { left, top }
  }

  return {
    left: Math.min(Math.max(pad, x), Math.max(pad, window.innerWidth - width - pad)),
    top: Math.min(Math.max(pad, y), Math.max(pad, window.innerHeight - height - pad)),
  }
}

export function BubbleToolbar({
  position,
  placement = 'above',
  activeMarks,
  currentLink,
  currentColor,
  currentHighlight,
  blockType,
  multiBlock = false,
  mixedTypes = false,
  aiEnabled = false,
  themeSource,
  onMark,
  onTurnInto,
  onClearFormatting,
  onAskAI,
  onCopy,
  onDuplicate,
  onDelete,
}: BubbleToolbarProps) {
  const [panel, setPanel] = useState<Panel>('none')
  const [linkInput, setLinkInput] = useState('')
  const [coords, setCoords] = useState({ left: position.x, top: position.y })
  const toolbarRef = useRef<HTMLDivElement | null>(null)
  const lastPositionKey = useRef<string | null>(null)

  useEffect(() => {
    if (themeSource && toolbarRef.current) {
      syncThemeVars(themeSource, toolbarRef.current)
    }

    const key = `${position.x},${position.y},${placement}`

    if (lastPositionKey.current !== null && lastPositionKey.current !== key) {
      setPanel('none')
    }

    lastPositionKey.current = key
  }, [position, placement, themeSource])

  useLayoutEffect(() => {
    const el = toolbarRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setCoords(clampPosition(position.x, position.y, rect.width, rect.height, placement))
  }, [position.x, position.y, placement, panel, multiBlock])

  function openLinkPanel() {
    setLinkInput(currentLink ?? '')
    setPanel((p) => (p === 'link' ? 'none' : 'link'))
  }

  function applyLink() {
    const url = linkInput.trim()
    onMark('link', url || null)
    setPanel('none')
  }

  const turnIntoEntry = TURN_INTO.find((t) => t.type === blockType)
  const turnIntoLabel = mixedTypes ? 'Turn into' : (turnIntoEntry?.label ?? 'Text')
  const TurnIntoIcon = turnIntoEntry?.icon ?? Type

  const linkPanel = panel === 'link' && (
    <div className="xpe-float xpe-float--panel mt-1.5 flex items-center gap-1.5">
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
          className="h-8 px-2 text-xs text-[var(--xpe-danger)] hover:bg-[var(--xpe-danger-muted)]"
          onClick={() => {
            onMark('link', null)
            setPanel('none')
          }}
        >
          Remove
        </Button>
      )}
    </div>
  )

  const colorPanel = panel === 'color' && (
    <div className="xpe-float xpe-float--panel mt-1.5" onMouseDown={(e) => e.stopPropagation()}>
      <ToolbarColorPanel
        currentColor={currentColor}
        currentHighlight={currentHighlight}
        onMark={onMark}
      />
    </div>
  )

  const turnIntoPanel = panel === 'turninto' && (
    <div className="xpe-float xpe-menu-list mt-1.5 w-52 py-1.5">
      {TURN_INTO.map((t) => {
        const Icon = t.icon
        const selected = !mixedTypes && t.type === blockType
        return (
          <button
            key={t.type}
            type="button"
            className={`xpe-menu-item${selected ? ' xpe-menu-item--selected' : ''}`}
            onClick={() => {
              onTurnInto(t.type)
              setPanel('none')
            }}
          >
            <span className="xpe-menu-item__icon">
              <Icon />
            </span>
            <span className="xpe-menu-item__label">{t.label}</span>
            {selected && <Check className="xpe-menu-item__meta" />}
          </button>
        )
      })}
    </div>
  )

  if (multiBlock) {
    return createPortal(
      <div
        ref={toolbarRef}
        data-pro-editor-toolbar
        className="xpe-menu fixed z-[70] flex flex-col items-stretch"
        style={{ left: coords.left, top: coords.top }}
        onMouseDown={(e) => {
          // Keep managed multi-block selection: portaled outside the editor root,
          // so document mousedown would otherwise clear it before click handlers run.
          // Allow focusing inputs (link URL) so the user can type/paste.
          e.stopPropagation()
          const target = e.target as HTMLElement
          if (!target.closest('input, textarea, select')) {
            e.preventDefault()
          }
        }}
      >
        <div className="xpe-float xpe-bubble-panel">
          <button
            type="button"
            className="xpe-menu-item"
            onClick={() => setPanel((p) => (p === 'turninto' ? 'none' : 'turninto'))}
          >
            <span className="xpe-menu-item__icon">
              <TurnIntoIcon />
            </span>
            <span className="xpe-menu-item__label">{turnIntoLabel}</span>
            <ChevronRight className="xpe-menu-item__meta" />
          </button>

          <div className="xpe-menu-sep" />

          <div className="xpe-bubble-panel__row">
            <button
              type="button"
              className={`ebt-btn${panel === 'color' || currentColor || currentHighlight ? ' ebt-active' : ''}`}
              title="Color"
              onClick={() => setPanel((p) => (p === 'color' ? 'none' : 'color'))}
            >
              <Paintbrush className="size-3.5" />
            </button>
            <button
              type="button"
              className={`ebt-btn${activeMarks.bold ? ' ebt-active' : ''}`}
              title="Bold (Ctrl+B)"
              onClick={() => onMark('bold', !activeMarks.bold)}
            >
              <Bold className="size-3.5" />
            </button>
            <button
              type="button"
              className={`ebt-btn${activeMarks.italic ? ' ebt-active' : ''}`}
              title="Italic (Ctrl+I)"
              onClick={() => onMark('italic', !activeMarks.italic)}
            >
              <Italic className="size-3.5" />
            </button>
            <button
              type="button"
              className={`ebt-btn${activeMarks.underline ? ' ebt-active' : ''}`}
              title="Underline (Ctrl+U)"
              onClick={() => onMark('underline', !activeMarks.underline)}
            >
              <Underline className="size-3.5" />
            </button>
            {onClearFormatting && (
              <button
                type="button"
                className="ebt-btn"
                title="Clear formatting"
                onClick={onClearFormatting}
              >
                <RemoveFormatting className="size-3.5" />
              </button>
            )}
          </div>

          <div className="xpe-bubble-panel__row">
            <button
              type="button"
              className={`ebt-btn${panel === 'link' || currentLink ? ' ebt-active' : ''}`}
              title="Link"
              onClick={openLinkPanel}
            >
              <Link2 className="size-3.5" />
            </button>
            <button
              type="button"
              className={`ebt-btn${activeMarks.strikethrough ? ' ebt-active' : ''}`}
              title="Strikethrough"
              onClick={() => onMark('strikethrough', !activeMarks.strikethrough)}
            >
              <Strikethrough className="size-3.5" />
            </button>
            <button
              type="button"
              className={`ebt-btn${activeMarks.code ? ' ebt-active' : ''}`}
              title="Inline code (Ctrl+E)"
              onClick={() => onMark('code', !activeMarks.code)}
            >
              <Code className="size-3.5" />
            </button>
          </div>

          {(onCopy || onDuplicate || onDelete) && (
            <>
              <div className="xpe-menu-sep" />
              <div className="xpe-bubble-panel__actions">
                {onCopy && (
                  <button type="button" className="xpe-menu-item" onClick={onCopy}>
                    <span className="xpe-menu-item__icon">
                      <Copy />
                    </span>
                    <span className="xpe-menu-item__label">Copy</span>
                    <span className="xpe-menu-item__kbd">⌘C</span>
                  </button>
                )}
                {onDuplicate && (
                  <button type="button" className="xpe-menu-item" onClick={onDuplicate}>
                    <span className="xpe-menu-item__icon">
                      <Files />
                    </span>
                    <span className="xpe-menu-item__label">Duplicate</span>
                    <span className="xpe-menu-item__kbd">⌘D</span>
                  </button>
                )}
                {onDelete && (
                  <button
                    type="button"
                    className="xpe-menu-item xpe-menu-item--danger"
                    onClick={onDelete}
                  >
                    <span className="xpe-menu-item__icon">
                      <Trash2 />
                    </span>
                    <span className="xpe-menu-item__label">Delete</span>
                    <span className="xpe-menu-item__kbd">⌫</span>
                  </button>
                )}
              </div>
            </>
          )}

          {aiEnabled && onAskAI && (
            <>
              <div className="xpe-menu-sep" />
              <button type="button" className="xpe-menu-item" onClick={onAskAI}>
                <span className="xpe-menu-item__icon">
                  <Sparkles />
                </span>
                <span className="xpe-menu-item__label">Ask AI</span>
              </button>
            </>
          )}
        </div>

        {turnIntoPanel}
        {linkPanel}
        {colorPanel}
      </div>,
      document.body,
    )
  }

  return createPortal(
    <div
      ref={toolbarRef}
      data-pro-editor-toolbar
      className="xpe-menu fixed z-[70] flex flex-col items-stretch"
      style={{
        left: coords.left,
        top: coords.top,
        transform: 'translate(-50%, calc(-100% - 8px))',
      }}
      onMouseDown={(e) => {
        e.stopPropagation()
        const target = e.target as HTMLElement
        if (!target.closest('input, textarea, select')) {
          e.preventDefault()
        }
      }}
    >
      <div className="xpe-float xpe-float--compact">
        <button
          className="ebt-btn !w-auto gap-1 px-2 text-[12px] font-medium text-[var(--xpe-muted-foreground)]"
          onClick={() => setPanel((p) => (p === 'turninto' ? 'none' : 'turninto'))}
        >
          {turnIntoLabel}
          <ChevronDown className="size-3" />
        </button>
        <div className="mx-0.5 h-5 w-px bg-[var(--xpe-border)]" />

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

        <div className="mx-0.5 h-5 w-px bg-[var(--xpe-border)]" />

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
        {onClearFormatting && (
          <button
            className="ebt-btn"
            title="Clear formatting"
            onClick={onClearFormatting}
          >
            <RemoveFormatting className="size-3.5" />
          </button>
        )}

        {aiEnabled && onAskAI && (
          <>
            <div className="mx-0.5 h-5 w-px bg-[var(--xpe-border)]" />
            <button className="ebt-btn" title="Ask AI" onClick={onAskAI}>
              <Sparkles className="size-3.5" />
            </button>
          </>
        )}
      </div>

      {linkPanel}
      {colorPanel}
      {turnIntoPanel}
    </div>,
    document.body,
  )
}
