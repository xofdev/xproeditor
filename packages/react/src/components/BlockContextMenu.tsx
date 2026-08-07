import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowDownToLine,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  Copy,
  Heading1,
  Heading2,
  Heading3,
  Lightbulb,
  List,
  ListOrdered,
  CheckSquare,
  Palette,
  Quote,
  Scissors,
  Search,
  Sparkles,
  Bookmark,
  SquareMousePointer,
  Trash2,
  Type,
} from 'lucide-react'
import { syncThemeVars, type BlockType } from '@xproeditor/core'

export interface BlockContextMenuProps {
  position: { x: number; y: number }
  blockType: BlockType
  /** Background color swatches — callout / button. */
  colorPresets?: string[]
  currentColor?: string
  canTurnInto?: boolean
  aiEnabled?: boolean
  themeSource?: HTMLElement | null
  onColor?: (color: string | undefined) => void
  onTurnInto?: (type: BlockType) => void
  onDuplicate: () => void
  onCopy: () => void
  onCut: () => void
  onDelete: () => void
  onInsertBelow: () => void
  onAskAI?: () => void
  onClose: () => void
}

type View = 'root' | 'turn-into' | 'color'

const TURN_INTO: Array<{ type: BlockType; label: string; icon: typeof Type; keywords: string[] }> = [
  { type: 'paragraph', label: 'Text', icon: Type, keywords: ['text', 'paragraph'] },
  { type: 'heading_1', label: 'Heading 1', icon: Heading1, keywords: ['h1', 'heading'] },
  { type: 'heading_2', label: 'Heading 2', icon: Heading2, keywords: ['h2', 'heading'] },
  { type: 'heading_3', label: 'Heading 3', icon: Heading3, keywords: ['h3', 'heading'] },
  { type: 'bulleted_list_item', label: 'Bulleted list', icon: List, keywords: ['bullet', 'list'] },
  { type: 'numbered_list_item', label: 'Numbered list', icon: ListOrdered, keywords: ['number', 'list'] },
  { type: 'to_do', label: 'To-do', icon: CheckSquare, keywords: ['todo', 'check'] },
  { type: 'toggle', label: 'Toggle list', icon: ChevronRight, keywords: ['toggle', 'list'] },
  { type: 'toggle_heading_1', label: 'Toggle heading 1', icon: Heading1, keywords: ['toggle', 'heading', 'h1'] },
  { type: 'toggle_heading_2', label: 'Toggle heading 2', icon: Heading2, keywords: ['toggle', 'heading', 'h2'] },
  { type: 'toggle_heading_3', label: 'Toggle heading 3', icon: Heading3, keywords: ['toggle', 'heading', 'h3'] },
  { type: 'quote', label: 'Quote', icon: Quote, keywords: ['quote'] },
  { type: 'callout', label: 'Callout', icon: Lightbulb, keywords: ['callout', 'note'] },
  { type: 'button', label: 'Button', icon: SquareMousePointer, keywords: ['button', 'cta'] },
  { type: 'bookmark', label: 'Web bookmark', icon: Bookmark, keywords: ['bookmark', 'link', 'url'] },
]

const BLOCK_LABELS: Partial<Record<BlockType, string>> = Object.fromEntries(
  TURN_INTO.map((t) => [t.type, t.label]),
)

type ActionItem = {
  id: string
  label: string
  icon: typeof Type
  shortcut?: string
  danger?: boolean
  chevron?: boolean
  keywords: string[]
  run: () => void
}

function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent)
}

function matchQuery(hay: string[], q: string): boolean {
  if (!q) return true
  return hay.join(' ').toLowerCase().includes(q)
}

export function BlockContextMenu({
  position,
  blockType,
  colorPresets,
  currentColor,
  canTurnInto = false,
  aiEnabled = false,
  themeSource,
  onColor,
  onTurnInto,
  onDuplicate,
  onCopy,
  onCut,
  onDelete,
  onInsertBelow,
  onAskAI,
  onClose,
}: BlockContextMenuProps) {
  const [view, setView] = useState<View>('root')
  const [query, setQuery] = useState('')
  const menuRef = useRef<HTMLDivElement | null>(null)
  const searchRef = useRef<HTMLInputElement | null>(null)
  const [placed, setPlaced] = useState({ left: position.x, top: position.y })
  const mod = isMacPlatform() ? '⌘' : 'Ctrl+'
  const q = query.trim().toLowerCase()
  const blockLabel = BLOCK_LABELS[blockType] ?? blockType.replace(/_/g, ' ')

  const sections = useMemo(() => {
    const transform: ActionItem[] = []
    if (canTurnInto) {
      transform.push({
        id: 'turn-into',
        label: 'Turn into',
        icon: Type,
        chevron: true,
        keywords: ['turn', 'convert', 'type'],
        run: () => setView('turn-into'),
      })
    }
    if (colorPresets?.length) {
      transform.push({
        id: 'color',
        label: 'Color',
        icon: Palette,
        chevron: true,
        keywords: ['color', 'background'],
        run: () => setView('color'),
      })
    }

    const manage: ActionItem[] = [
      {
        id: 'duplicate',
        label: 'Duplicate',
        icon: Copy,
        shortcut: `${mod}D`,
        keywords: ['duplicate', 'clone'],
        run: () => {
          onDuplicate()
          onClose()
        },
      },
      {
        id: 'copy',
        label: 'Copy',
        icon: ClipboardCopy,
        shortcut: `${mod}C`,
        keywords: ['copy'],
        run: () => {
          onCopy()
          onClose()
        },
      },
      {
        id: 'cut',
        label: 'Cut',
        icon: Scissors,
        shortcut: `${mod}X`,
        keywords: ['cut'],
        run: () => {
          onCut()
          onClose()
        },
      },
      {
        id: 'delete',
        label: 'Delete',
        icon: Trash2,
        shortcut: 'Del',
        danger: true,
        keywords: ['delete', 'remove'],
        run: () => {
          onDelete()
          onClose()
        },
      },
    ]

    const insert: ActionItem[] = [
      {
        id: 'insert-below',
        label: 'Insert below',
        icon: ArrowDownToLine,
        keywords: ['insert', 'below', 'add'],
        run: () => {
          onInsertBelow()
          onClose()
        },
      },
    ]

    const ai: ActionItem[] =
      aiEnabled && onAskAI
        ? [
            {
              id: 'ask-ai',
              label: 'Ask AI',
              icon: Sparkles,
              keywords: ['ai', 'ask', 'gpt'],
              run: () => {
                onAskAI()
                onClose()
              },
            },
          ]
        : []

    return [transform, manage, insert, ai]
      .map((section) => section.filter((item) => matchQuery([item.label, ...item.keywords], q)))
      .filter((section) => section.length > 0)
  }, [
    aiEnabled,
    canTurnInto,
    colorPresets,
    mod,
    onAskAI,
    onClose,
    onCopy,
    onCut,
    onDelete,
    onDuplicate,
    onInsertBelow,
    q,
  ])

  const turnIntoItems = useMemo(() => {
    return TURN_INTO.filter((t) => matchQuery([t.label, t.type, ...t.keywords], q))
  }, [q])

  useLayoutEffect(() => {
    const el = menuRef.current
    if (!el) return
    if (themeSource) syncThemeVars(themeSource, el)
    const margin = 8
    const { width, height } = el.getBoundingClientRect()
    setPlaced({
      left: Math.max(margin, Math.min(position.x, window.innerWidth - width - margin)),
      top: Math.max(margin, Math.min(position.y, window.innerHeight - height - margin)),
    })
  }, [position, themeSource, view, query, sections])

  useLayoutEffect(() => {
    function onOutside(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) onClose()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (view !== 'root') {
        setView('root')
        setQuery('')
      } else onClose()
    }
    window.addEventListener('mousedown', onOutside, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onOutside, true)
      window.removeEventListener('keydown', onKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view])

  useEffect(() => {
    const id = window.setTimeout(() => searchRef.current?.focus(), 0)
    return () => window.clearTimeout(id)
  }, [view])

  return createPortal(
    <div
      ref={menuRef}
      className="xpe-ctx-menu xpe-float xpe-scroll fixed z-[80]"
      style={{ left: placed.left, top: placed.top }}
      onMouseDown={(e) => e.stopPropagation()}
      role="menu"
    >
      <div className="xpe-menu-search">
        <Search className="xpe-menu-search__icon" />
        <input
          ref={searchRef}
          className="xpe-menu-search__input"
          placeholder="Search actions…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {view === 'root' && (
        <>
          <p className="xpe-ctx-menu__type">{blockLabel}</p>
          {sections.length === 0 ? (
            <p className="xpe-menu-empty">No matching actions</p>
          ) : (
            sections.map((section, si) => (
              <div key={si} className="xpe-ctx-menu__section">
                {si > 0 && <div className="xpe-menu-sep" />}
                {section.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`xpe-menu-item${item.danger ? ' xpe-menu-item--danger' : ''}`}
                    onClick={item.run}
                  >
                    <span className="xpe-menu-item__icon">
                      <item.icon />
                    </span>
                    <span className="xpe-menu-item__label">{item.label}</span>
                    {item.shortcut && <span className="xpe-menu-item__kbd">{item.shortcut}</span>}
                    {item.chevron && <ChevronRight className="xpe-menu-item__meta" />}
                  </button>
                ))}
              </div>
            ))
          )}
        </>
      )}

      {view === 'turn-into' && (
        <>
          <button
            type="button"
            className="xpe-ctx-menu__back"
            onClick={() => {
              setView('root')
              setQuery('')
            }}
          >
            <ChevronLeft />
            Turn into
          </button>
          <div className="xpe-ctx-menu__section">
            {turnIntoItems.map((t) => {
              const Icon = t.icon
              const selected = t.type === blockType
              return (
                <button
                  key={t.type}
                  type="button"
                  className={`xpe-menu-item${selected ? ' xpe-menu-item--selected' : ''}`}
                  onClick={() => {
                    onTurnInto?.(t.type)
                    onClose()
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
        </>
      )}

      {view === 'color' && (
        <>
          <button
            type="button"
            className="xpe-ctx-menu__back"
            onClick={() => {
              setView('root')
              setQuery('')
            }}
          >
            <ChevronLeft />
            Color
          </button>
          <div className="xpe-ctx-menu__swatches">
            <button
              type="button"
              title="Default"
              className={`xpe-ctx-menu__swatch${!currentColor ? ' xpe-ctx-menu__swatch--active' : ''}`}
              style={{ background: 'var(--xpe-muted, #f3f4f6)' }}
              onClick={() => {
                onColor?.(undefined)
                onClose()
              }}
            />
            {colorPresets?.map((color) => (
              <button
                key={color}
                type="button"
                title={color}
                className={`xpe-ctx-menu__swatch${currentColor === color ? ' xpe-ctx-menu__swatch--active' : ''}`}
                style={{ background: color }}
                onClick={() => {
                  onColor?.(color)
                  onClose()
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>,
    document.body,
  )
}
