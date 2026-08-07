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
  Music,
  Paperclip,
  SearchX,
  SquareMousePointer,
  Bookmark,
  Sparkles,
} from 'lucide-react'
import type { SlashGroup, SlashItem } from '../types'

const GROUP_LABELS: Record<SlashGroup, string> = {
  basic: 'Basic blocks',
  lists: 'Lists & tasks',
  media: 'Media',
  advanced: 'Advanced',
  ai: 'AI',
}

const ITEMS: SlashItem[] = [
  // AI first when enabled — max-height menu otherwise hides it at the bottom.
  {
    id: 'ai',
    type: 'paragraph',
    label: 'Ask AI',
    description: 'Generate or edit with AI',
    keywords: ['ai', 'ask', 'gpt', 'write', 'generate'],
    icon: Sparkles,
    group: 'ai',
    action: 'ai',
  },
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
    label: 'Toggle list',
    description: 'Collapsible list item',
    keywords: ['toggle', 'collapse', 'accordion', 'list'],
    icon: ChevronRight,
    group: 'lists',
  },
  {
    id: 'toggle_heading_1',
    type: 'toggle_heading_1',
    label: 'Toggle heading 1',
    description: 'Large collapsible heading',
    keywords: ['toggle', 'heading', 'h1', 'collapse'],
    icon: Heading1,
    group: 'lists',
  },
  {
    id: 'toggle_heading_2',
    type: 'toggle_heading_2',
    label: 'Toggle heading 2',
    description: 'Medium collapsible heading',
    keywords: ['toggle', 'heading', 'h2', 'collapse'],
    icon: Heading2,
    group: 'lists',
  },
  {
    id: 'toggle_heading_3',
    type: 'toggle_heading_3',
    label: 'Toggle heading 3',
    description: 'Small collapsible heading',
    keywords: ['toggle', 'heading', 'h3', 'collapse'],
    icon: Heading3,
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
    id: 'bookmark',
    type: 'bookmark',
    label: 'Web bookmark',
    description: 'Visual bookmark from a link',
    keywords: ['bookmark', 'link', 'url', 'web', 'embed', 'og'],
    icon: Bookmark,
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
    description: 'Highlighted note with emoji or icon',
    keywords: ['callout', 'note', 'info', 'warning', 'icon'],
    icon: Lightbulb,
    group: 'advanced',
    pickIcon: 'emoji',
  },
  {
    id: 'emoji',
    type: 'paragraph',
    label: 'Emoji',
    description: 'Insert an emoji',
    keywords: ['emoji', 'emoticon', 'smile'],
    icon: Smile,
    group: 'advanced',
    action: 'emoji',
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
  /** Show Ask AI slash item (requires host AI transport). */
  aiEnabled?: boolean
  onSelect: (item: SlashItem) => void
  onClose: () => void
}

export const SlashMenu = forwardRef<SlashMenuHandle, SlashMenuProps>(function SlashMenu(
  { query, position, dir, themeSource, aiEnabled = false, onSelect },
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
    const base = aiEnabled ? ITEMS : ITEMS.filter((item) => item.action !== 'ai')
    const q = query.toLowerCase().trim()
    if (!q) return base
    return base.filter(
      (item) =>
        item.label.toLowerCase().includes(q)
        || item.description.toLowerCase().includes(q)
        || item.keywords.some((k) => k.includes(q)),
    )
  }, [query, aiEnabled])

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
      className="xpe-menu xpe-float xpe-scroll fixed z-[80] w-72 max-h-80 overflow-y-auto py-1.5"
      style={{ left: placed.left, top: placed.top }}
      dir={dir}
      onMouseDown={(e) => e.preventDefault()}
    >
      {filtered.length === 0 && (
        <p className="xpe-menu-empty">
          <SearchX className="w-4 h-4" />
          No results for “{query}”
        </p>
      )}
      <div ref={listRef} className="xpe-menu-list">
        {filtered.map((item, idx) => {
          const Icon = item.icon
          const showHeader = idx === 0 || filtered[idx - 1].group !== item.group
          const active = idx === activeIndex
          return (
            <div key={item.id}>
              {showHeader && (
                <p className="xpe-menu-heading px-2 pt-2.5 pb-1 first:pt-1">
                  {GROUP_LABELS[item.group]}
                </p>
              )}
              <button
                type="button"
                className={`xpe-menu-item${active ? ' xpe-menu-item--active' : ''}`}
                data-active={active}
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() => onSelect(item)}
              >
                <span className="xpe-menu-item__icon">
                  <Icon />
                </span>
                <span className="xpe-menu-item__text">
                  <span className="xpe-menu-item__label">{item.label}</span>
                  <span className="xpe-menu-item__desc">{item.description}</span>
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
