import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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
} from 'lucide-react'
import type { SlashItem } from '../types'

const ITEMS: SlashItem[] = [
  {
    id: 'paragraph',
    type: 'paragraph',
    label: 'Text',
    description: 'Plain paragraph',
    keywords: ['text', 'paragraph', 'p'],
    icon: Type,
  },
  {
    id: 'heading_1',
    type: 'heading_1',
    label: 'Heading 1',
    description: 'Large section heading',
    keywords: ['h1', 'heading', 'title'],
    icon: Heading1,
  },
  {
    id: 'heading_2',
    type: 'heading_2',
    label: 'Heading 2',
    description: 'Medium section heading',
    keywords: ['h2', 'heading', 'subtitle'],
    icon: Heading2,
  },
  {
    id: 'heading_3',
    type: 'heading_3',
    label: 'Heading 3',
    description: 'Small section heading',
    keywords: ['h3', 'heading'],
    icon: Heading3,
  },
  {
    id: 'bulleted_list_item',
    type: 'bulleted_list_item',
    label: 'Bulleted list',
    description: 'Simple bullet list',
    keywords: ['bullet', 'list', 'ul'],
    icon: List,
  },
  {
    id: 'numbered_list_item',
    type: 'numbered_list_item',
    label: 'Numbered list',
    description: 'Ordered list',
    keywords: ['number', 'ordered', 'ol'],
    icon: ListOrdered,
  },
  {
    id: 'to_do',
    type: 'to_do',
    label: 'To-do',
    description: 'Checkbox task',
    keywords: ['todo', 'check', 'task'],
    icon: CheckSquare,
  },
  {
    id: 'toggle',
    type: 'toggle',
    label: 'Toggle',
    description: 'Collapsible content',
    keywords: ['toggle', 'collapse', 'accordion'],
    icon: ChevronRight,
  },
  {
    id: 'quote',
    type: 'quote',
    label: 'Quote',
    description: 'Capture a quote',
    keywords: ['quote', 'blockquote'],
    icon: Quote,
  },
  {
    id: 'callout',
    type: 'callout',
    label: 'Callout',
    description: 'Highlighted note',
    keywords: ['callout', 'note', 'info', 'warning'],
    icon: Lightbulb,
  },
  {
    id: 'emoji',
    type: 'callout',
    label: 'Emoji',
    description: 'Callout with emoji icon',
    keywords: ['emoji', 'emoticon', 'smile'],
    icon: Smile,
    pickIcon: 'emoji',
  },
  {
    id: 'icon',
    type: 'callout',
    label: 'Icon',
    description: 'Callout with vector icon',
    keywords: ['icon', 'symbol', 'lucide'],
    icon: Blocks,
    pickIcon: 'icon',
  },
  {
    id: 'code',
    type: 'code',
    label: 'Code',
    description: 'Code block with syntax',
    keywords: ['code', 'snippet', 'pre'],
    icon: Code2,
  },
  {
    id: 'divider',
    type: 'divider',
    label: 'Divider',
    description: 'Horizontal line',
    keywords: ['divider', 'hr', 'separator', 'line'],
    icon: Minus,
  },
  {
    id: 'image',
    type: 'image',
    label: 'Image',
    description: 'Upload an image',
    keywords: ['image', 'photo', 'picture', 'upload'],
    icon: ImageIcon,
  },
  {
    id: 'video',
    type: 'video',
    label: 'Video',
    description: 'Upload or embed a video',
    keywords: ['video', 'youtube', 'vimeo', 'movie'],
    icon: Video,
  },
  {
    id: 'table',
    type: 'table',
    label: 'Table',
    description: 'Simple table',
    keywords: ['table', 'grid'],
    icon: Table2,
  },
]

export interface SlashMenuHandle {
  move: (dir: 1 | -1) => void
  confirm: () => void
}

export interface SlashMenuProps {
  query: string
  position: { x: number; y: number }
  onSelect: (item: SlashItem) => void
  onClose: () => void
}

export const SlashMenu = forwardRef<SlashMenuHandle, SlashMenuProps>(function SlashMenu(
  { query, position, onSelect, onClose },
  ref,
) {
  const [activeIndex, setActiveIndex] = useState(0)
  const listRef = useRef<HTMLDivElement | null>(null)

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    if (!q) return ITEMS
    return ITEMS.filter(
      (item) => item.label.toLowerCase().includes(q) || item.keywords.some((k) => k.startsWith(q)),
    )
  }, [query])

  useEffect(() => setActiveIndex(0), [query])

  useEffect(() => {
    if (filtered.length === 0) onClose()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered])

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
      className="fixed z-[80] w-72 max-h-80 overflow-y-auto bg-white border border-gray-100 rounded-xl shadow-xl py-1.5"
      style={{ left: position.x, top: position.y }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <p className="px-3 pt-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
        Blocks
      </p>
      <div ref={listRef}>
        {filtered.map((item, idx) => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              className={`flex items-center gap-3 w-full px-3 py-1.5 text-left transition-colors ${idx === activeIndex ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}
              data-active={idx === activeIndex}
              onMouseEnter={() => setActiveIndex(idx)}
              onClick={() => onSelect(item)}
            >
              <span
                className={`flex items-center justify-center w-8 h-8 rounded-lg border shrink-0 ${idx === activeIndex ? 'border-indigo-100 bg-white text-indigo-600' : 'border-gray-100 bg-gray-50 text-gray-500'}`}
              >
                <Icon className="w-4 h-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-medium text-gray-800">{item.label}</span>
                <span className="block text-[11px] text-gray-400 truncate">{item.description}</span>
              </span>
            </button>
          )
        })}
      </div>
    </div>,
    document.body,
  )
})
