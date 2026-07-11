import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { lockPageScroll, syncThemeVars } from '@xproeditor/core'
import {
  Type,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  ChevronRight,
  Quote,
  Lightbulb,
  Code2,
  Minus,
  Image as ImageIcon,
  Video,
  Table2,
  Smile,
  Blocks,
  Music,
  Paperclip,
  SearchX,
  SquareMousePointer,
} from 'lucide-react'
import type { SlashGroup, SlashItem } from '../types'

const GROUP_LABELS: Record<SlashGroup, string> = {
  basic: 'Basic blocks',
  lists: 'Lists & tasks',
  media: 'Media',
  advanced: 'Advanced',
}

const ITEMS: SlashItem[] = [
  {
    id: 'paragraph',
    type: 'paragraph',
    label: 'Text',
    description: 'Plain paragraph',
    keywords: ['text', 'paragraph', 'p'],
    icon: Type,
    group: 'basic',
  },
  {
    id: 'heading_1',
    type: 'heading_1',
    label: 'Heading 1',
    description: 'Large section heading',
    keywords: ['h1', 'heading', 'title'],
    icon: Heading1,
    group: 'basic',
  },
  {
    id: 'heading_2',
    type: 'heading_2',
    label: 'Heading 2',
    description: 'Medium section heading',
    keywords: ['h2', 'heading', 'subtitle'],
    icon: Heading2,
    group: 'basic',
  },
  {
    id: 'heading_3',
    type: 'heading_3',
    label: 'Heading 3',
    description: 'Small section heading',
    keywords: ['h3', 'heading'],
    icon: Heading3,
    group: 'basic',
  },
  {
    id: 'bulleted_list_item',
    type: 'bulleted_list_item',
    label: 'Bulleted list',
    description: 'Simple bullet list',
    keywords: ['bullet', 'list', 'ul'],
    icon: List,
    group: 'lists',
  },
  {
    id: 'numbered_list_item',
    type: 'numbered_list_item',
    label: 'Numbered list',
    description: 'Ordered list',
    keywords: ['number', 'ordered', 'ol'],
    icon: ListOrdered,
    group: 'lists',
  },
  {
    id: 'to_do',
    type: 'to_do',
    label: 'To-do',
    description: 'Checkbox task',
    keywords: ['todo', 'check', 'task'],
    icon: CheckSquare,
    group: 'lists',
  },
  {
    id: 'toggle',
    type: 'toggle',
    label: 'Toggle',
    description: 'Collapsible content',
    keywords: ['toggle', 'collapse', 'accordion'],
    icon: ChevronRight,
    group: 'lists',
  },
  {
    id: 'image',
    type: 'image',
    label: 'Image',
    description: 'Upload an image',
    keywords: ['image', 'photo', 'picture', 'upload'],
    icon: ImageIcon,
    group: 'media',
  },
  {
    id: 'video',
    type: 'video',
    label: 'Video',
    description: 'Upload or embed a video',
    keywords: ['video', 'youtube', 'vimeo', 'movie'],
    icon: Video,
    group: 'media',
  },
  {
    id: 'audio',
    type: 'audio',
    label: 'Audio',
    description: 'Upload or link audio',
    keywords: ['audio', 'music', 'song', 'sound', 'mp3'],
    icon: Music,
    group: 'media',
  },
  {
    id: 'file',
    type: 'file',
    label: 'File',
    description: 'Attach a downloadable file',
    keywords: ['file', 'attachment', 'pdf', 'document', 'download'],
    icon: Paperclip,
    group: 'media',
  },
  {
    id: 'quote',
    type: 'quote',
    label: 'Quote',
    description: 'Capture a quote',
    keywords: ['quote', 'blockquote'],
    icon: Quote,
    group: 'advanced',
  },
  {
    id: 'callout',
    type: 'callout',
    label: 'Callout',
    description: 'Highlighted note',
    keywords: ['callout', 'note', 'info', 'warning'],
    icon: Lightbulb,
    group: 'advanced',
  },
  {
    id: 'emoji',
    type: 'callout',
    label: 'Emoji',
    description: 'Callout with emoji icon',
    keywords: ['emoji', 'emoticon', 'smile'],
    icon: Smile,
    group: 'advanced',
    pickIcon: 'emoji',
  },
  {
    id: 'icon',
    type: 'callout',
    label: 'Icon',
    description: 'Callout with vector icon',
    keywords: ['icon', 'symbol', 'lucide'],
    icon: Blocks,
    group: 'advanced',
    pickIcon: 'icon',
  },
  {
    id: 'code',
    type: 'code',
    label: 'Code',
    description: 'Code block with syntax',
    keywords: ['code', 'snippet', 'pre'],
    icon: Code2,
    group: 'advanced',
  },
  {
    id: 'divider',
    type: 'divider',
    label: 'Divider',
    description: 'Horizontal line',
    keywords: ['divider', 'hr', 'separator', 'line'],
    icon: Minus,
    group: 'advanced',
  },
  {
    id: 'table',
    type: 'table',
    label: 'Table',
    description: 'Simple table',
    keywords: ['table', 'grid'],
    icon: Table2,
    group: 'advanced',
  },
  {
    id: 'button',
    type: 'button',
    label: 'Button',
    description: 'A clickable link styled as a button',
    keywords: ['button', 'link', 'cta', 'action'],
    icon: SquareMousePointer,
    group: 'advanced',
  },
]

export interface SlashMenuHandle {
  move: (dir: 1 | -1) => void
  confirm: () => void
}

export interface SlashMenuProps {
  query: string
  /** Caret anchor in viewport coordinates: menu opens below `y`, flips above `top` when needed. */
  position: { x: number; y: number; top?: number }
  dir?: 'ltr' | 'rtl'
  /** Element still inside the editor's themed DOM scope — used to resync
   * `--xpe-*` variables onto this menu once it's portaled to `<body>`. */
  themeSource?: HTMLElement | null
  onSelect: (item: SlashItem) => void
  onClose: () => void
}

export const SlashMenu = forwardRef<SlashMenuHandle, SlashMenuProps>(function SlashMenu(
  { query, position, dir, themeSource, onSelect },
  ref,
) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [placed, setPlaced] = useState<{ left: number; top: number }>({
    left: position.x,
    top: position.y,
  })
  const listRef = useRef<HTMLDivElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    if (!q) return ITEMS
    return ITEMS.filter(
      (item) => item.label.toLowerCase().includes(q) || item.keywords.some((k) => k.startsWith(q)),
    )
  }, [query])

  useEffect(() => setActiveIndex(0), [query])

  // Lock page scroll while the menu is open (Notion-like) — a scrollable
  // ancestor outside document.body can still move, so `place` below still
  // listens for scroll to keep the menu anchored if that happens.
  useEffect(() => {
    const unlock = lockPageScroll()
    return unlock
  }, [])

  // Place the menu with its real measured size: below the caret when it fits,
  // flipped above otherwise, clamped to the viewport. In RTL the menu grows
  // toward the start (its end edge hugs the caret).
  useLayoutEffect(() => {
    function place() {
      const el = menuRef.current
      if (!el) return

      if (themeSource) syncThemeVars(themeSource, el)

      const margin = 8
      const gap = 6
      const { width, height } = el.getBoundingClientRect()
      const anchorTop = position.top ?? position.y
      let left = dir === 'rtl' ? position.x - width : position.x
      left = Math.max(margin, Math.min(left, window.innerWidth - width - margin))
      let top = position.y + gap

      if (top + height > window.innerHeight - margin) {
        top = Math.max(margin, anchorTop - height - gap)
      }

      setPlaced({ left, top })
    }

    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [position, dir, themeSource, filtered.length])

  function scrollActiveIntoView() {
    requestAnimationFrame(() => {
      listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
    })
  }

  function move(dir: 1 | -1) {
    const len = filtered.length
    if (len === 0) return

    setActiveIndex((idx) => {
      const next = (idx + dir + len) % len
      scrollActiveIntoView()
      return next
    })
  }

  function confirm() {
    const item = filtered[activeIndex]
    if (item) onSelect(item)
  }

  useImperativeHandle(ref, () => ({ move, confirm }))

  return createPortal(
    <div
      ref={menuRef}
      className="xpe-scroll fixed z-[80] w-72 max-h-80 overflow-y-auto border py-1.5 bg-[var(--xpe-surface)] border-[var(--xpe-border)] rounded-[var(--xpe-radius)] [box-shadow:var(--xpe-shadow)]"
      style={{ left: placed.left, top: placed.top }}
      dir={dir}
      onMouseDown={(e) => e.preventDefault()}
    >
      {filtered.length === 0 && (
        <div className="flex items-center gap-2 px-3 py-4 text-[13px] text-[var(--xpe-muted-foreground)]">
          <SearchX className="w-4 h-4" />
          No results for “{query}”
        </div>
      )}
      <div ref={listRef}>
        {filtered.map((item, idx) => {
          const Icon = item.icon
          const showHeader = idx === 0 || filtered[idx - 1].group !== item.group
          return (
            <div key={item.id}>
              {showHeader && (
                <p className="px-3 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--xpe-muted-foreground)] first:pt-1">
                  {GROUP_LABELS[item.group]}
                </p>
              )}
              <button
                className={`flex items-center gap-3 w-full px-3 py-1.5 text-start transition-colors ${idx === activeIndex ? 'bg-[var(--xpe-primary-muted)]' : 'hover:bg-[var(--xpe-surface-hover)]'}`}
                data-active={idx === activeIndex}
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() => onSelect(item)}
              >
                <span
                  className={`flex items-center justify-center w-8 h-8 rounded-lg border shrink-0 ${idx === activeIndex ? 'border-[var(--xpe-border)] bg-[var(--xpe-surface)] text-[var(--xpe-primary)]' : 'border-[var(--xpe-border)] bg-[var(--xpe-muted)] text-[var(--xpe-muted-foreground)]'}`}
                >
                  <Icon className="w-4 h-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium text-[var(--xpe-foreground)]">
                    {item.label}
                  </span>
                  <span className="block text-[11px] text-[var(--xpe-muted-foreground)] truncate">
                    {item.description}
                  </span>
                </span>
              </button>
            </div>
          )
        })}
      </div>
    </div>,
    document.body,
  )
})
