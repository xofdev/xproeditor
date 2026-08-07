<script setup lang="ts">
import {
  Type, Heading1, Heading2, Heading3, List, ListOrdered, CheckSquare,
  ChevronRight, Quote, Lightbulb, Code2, Minus, Image as ImageIcon, Video, Table2,
  Smile, Music, Paperclip, SearchX, SquareMousePointer, Bookmark, Sparkles,
} from 'lucide-vue-next'
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { lockPageScroll, syncThemeVars } from '@xproeditor/core'
import type { BlockType } from '@xproeditor/core'

export type SlashGroup = 'basic' | 'lists' | 'media' | 'advanced' | 'ai'

export interface SlashItem {
  id: string
  type: BlockType
  label: string
  description: string
  keywords: string[]
  icon: unknown
  group: SlashGroup
  /** After applying the block, open the icon picker on this tab. */
  pickIcon?: 'emoji' | 'icon'
  /** Non-block action (open AI menu, emoji picker, …). */
  action?: 'ai' | 'emoji'
}

const GROUP_LABELS: Record<SlashGroup, string> = {
  basic: 'Basic blocks',
  lists: 'Lists & tasks',
  media: 'Media',
  advanced: 'Advanced',
  ai: 'AI',
}

const ITEMS: SlashItem[] = [
  // AI first when enabled — max-height menu otherwise hides it at the bottom.
  { id: 'ai', type: 'paragraph', label: 'Ask AI', description: 'Generate or edit with AI', keywords: ['ai', 'ask', 'gpt', 'write', 'generate'], icon: Sparkles, group: 'ai', action: 'ai' },
  { id: 'paragraph', type: 'paragraph', label: 'Text', description: 'Plain paragraph', keywords: ['text', 'paragraph', 'p'], icon: Type, group: 'basic' },
  { id: 'heading_1', type: 'heading_1', label: 'Heading 1', description: 'Large section heading', keywords: ['h1', 'heading', 'title'], icon: Heading1, group: 'basic' },
  { id: 'heading_2', type: 'heading_2', label: 'Heading 2', description: 'Medium section heading', keywords: ['h2', 'heading', 'subtitle'], icon: Heading2, group: 'basic' },
  { id: 'heading_3', type: 'heading_3', label: 'Heading 3', description: 'Small section heading', keywords: ['h3', 'heading'], icon: Heading3, group: 'basic' },
  { id: 'bulleted_list_item', type: 'bulleted_list_item', label: 'Bulleted list', description: 'Simple bullet list', keywords: ['bullet', 'list', 'ul'], icon: List, group: 'lists' },
  { id: 'numbered_list_item', type: 'numbered_list_item', label: 'Numbered list', description: 'Ordered list', keywords: ['number', 'ordered', 'ol'], icon: ListOrdered, group: 'lists' },
  { id: 'to_do', type: 'to_do', label: 'To-do', description: 'Checkbox task', keywords: ['todo', 'check', 'task'], icon: CheckSquare, group: 'lists' },
  { id: 'toggle', type: 'toggle', label: 'Toggle list', description: 'Collapsible list item', keywords: ['toggle', 'collapse', 'accordion', 'list'], icon: ChevronRight, group: 'lists' },
  { id: 'toggle_heading_1', type: 'toggle_heading_1', label: 'Toggle heading 1', description: 'Large collapsible heading', keywords: ['toggle', 'heading', 'h1', 'collapse'], icon: Heading1, group: 'lists' },
  { id: 'toggle_heading_2', type: 'toggle_heading_2', label: 'Toggle heading 2', description: 'Medium collapsible heading', keywords: ['toggle', 'heading', 'h2', 'collapse'], icon: Heading2, group: 'lists' },
  { id: 'toggle_heading_3', type: 'toggle_heading_3', label: 'Toggle heading 3', description: 'Small collapsible heading', keywords: ['toggle', 'heading', 'h3', 'collapse'], icon: Heading3, group: 'lists' },
  { id: 'image', type: 'image', label: 'Image', description: 'Upload an image', keywords: ['image', 'photo', 'picture', 'upload'], icon: ImageIcon, group: 'media' },
  { id: 'video', type: 'video', label: 'Video', description: 'Upload or embed a video', keywords: ['video', 'youtube', 'vimeo', 'movie'], icon: Video, group: 'media' },
  { id: 'audio', type: 'audio', label: 'Audio', description: 'Upload or link audio', keywords: ['audio', 'music', 'song', 'sound', 'mp3'], icon: Music, group: 'media' },
  { id: 'file', type: 'file', label: 'File', description: 'Attach a downloadable file', keywords: ['file', 'attachment', 'pdf', 'document', 'download'], icon: Paperclip, group: 'media' },
  { id: 'bookmark', type: 'bookmark', label: 'Web bookmark', description: 'Visual bookmark from a link', keywords: ['bookmark', 'link', 'url', 'web', 'embed', 'og'], icon: Bookmark, group: 'media' },
  { id: 'quote', type: 'quote', label: 'Quote', description: 'Capture a quote', keywords: ['quote', 'blockquote'], icon: Quote, group: 'advanced' },
  { id: 'callout', type: 'callout', label: 'Callout', description: 'Highlighted note with emoji or icon', keywords: ['callout', 'note', 'info', 'warning', 'icon'], icon: Lightbulb, group: 'advanced', pickIcon: 'emoji' },
  { id: 'emoji', type: 'paragraph', label: 'Emoji', description: 'Insert an emoji', keywords: ['emoji', 'emoticon', 'smile'], icon: Smile, group: 'advanced', action: 'emoji' },
  { id: 'code', type: 'code', label: 'Code', description: 'Code block with syntax', keywords: ['code', 'snippet', 'pre'], icon: Code2, group: 'advanced' },
  { id: 'divider', type: 'divider', label: 'Divider', description: 'Horizontal line', keywords: ['divider', 'hr', 'separator', 'line'], icon: Minus, group: 'advanced' },
  { id: 'table', type: 'table', label: 'Table', description: 'Simple table', keywords: ['table', 'grid'], icon: Table2, group: 'advanced' },
  { id: 'button', type: 'button', label: 'Button', description: 'A clickable link styled as a button', keywords: ['button', 'link', 'cta', 'action'], icon: SquareMousePointer, group: 'advanced' },
]

const props = defineProps<{
  query: string
  /** Caret anchor in viewport coordinates: menu opens below `bottom`, flips above `top` when needed. */
  position: { x: number; y: number; top?: number }
  dir?: 'ltr' | 'rtl'
  /** Element still inside the editor's themed DOM scope — used to resync
   * `--xpe-*` variables onto this menu once it's teleported to `<body>`. */
  themeSource?: HTMLElement | null
  /**
   * Named `aiEnabled` (not `showAI`) so the Vue kebab form `ai-enabled`
   * camelizes correctly — `show-ai` becomes `showAi`, which never matches `showAI`.
   */
  aiEnabled?: boolean
}>()

const emit = defineEmits<{
  select: [item: SlashItem]
  close: []
}>()

const activeIndex = ref(0)
const listEl = ref<HTMLElement | null>(null)
const menuEl = ref<HTMLElement | null>(null)
const placed = ref<{ left: number; top: number }>({ left: props.position.x, top: props.position.y })

const filtered = computed(() => {
  const base = props.aiEnabled ? ITEMS : ITEMS.filter(item => item.action !== 'ai')
  const q = props.query.toLowerCase().trim()

  if (!q) return base

  return base.filter(item =>
    item.label.toLowerCase().includes(q)
    || item.description.toLowerCase().includes(q)
    || item.keywords.some(k => k.includes(q)),
  )
})

/** Same items, annotated with a group header wherever the group changes. */
const grouped = computed(() =>
  filtered.value.map((item, idx) => ({
    item,
    idx,
    headerLabel: idx === 0 || filtered.value[idx - 1].group !== item.group ? GROUP_LABELS[item.group] : null,
  })),
)

/**
 * Place the menu with its real measured size: below the caret when it fits,
 * flipped above otherwise, clamped to the viewport. In RTL the menu grows
 * toward the start (its end edge hugs the caret).
 */
function place() {
  const el = menuEl.value

  if (!el) {
return
}

  if (props.themeSource) {
syncThemeVars(props.themeSource, el)
}

  const margin = 8
  const gap = 6
  const { width, height } = el.getBoundingClientRect()
  const anchorTop = props.position.top ?? props.position.y
  let left = props.dir === 'rtl' ? props.position.x - width : props.position.x
  left = Math.max(margin, Math.min(left, window.innerWidth - width - margin))
  let top = props.position.y + gap

  if (top + height > window.innerHeight - margin) {
    top = Math.max(margin, anchorTop - height - gap)
  }

  placed.value = { left, top }
}

let unlockScroll: (() => void) | null = null

onMounted(() => {
  nextTick(place)
  window.addEventListener('resize', place)
  // Body scroll is locked below, but a scrollable ancestor of the editor
  // (e.g. an app's own scroll container) can still move — reposition if so.
  window.addEventListener('scroll', place, true)
  unlockScroll = lockPageScroll()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', place)
  window.removeEventListener('scroll', place, true)
  unlockScroll?.()
  unlockScroll = null
})

watch(() => props.query, () => {
  activeIndex.value = 0
  nextTick(place)
})
watch(() => props.position, () => {
 nextTick(place)
}, { deep: true })

function scrollActiveIntoView() {
  nextTick(() => {
    listEl.value?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  })
}

function move(dir: 1 | -1) {
  const len = filtered.value.length

  if (len === 0) {
return
}

  activeIndex.value = (activeIndex.value + dir + len) % len
  scrollActiveIntoView()
}

function confirm() {
  const item = filtered.value[activeIndex.value]

  if (item) {
emit('select', item)
}
}

defineExpose({ move, confirm })
</script>

<template>
  <Teleport to="body">
    <div
      ref="menuEl"
      class="xpe-menu xpe-float xpe-scroll fixed z-[80] w-72 max-h-80 overflow-y-auto py-1.5"
      :style="{ left: `${placed.left}px`, top: `${placed.top}px` }"
      :dir="dir"
      @mousedown.prevent
    >
      <p v-if="filtered.length === 0" class="xpe-menu-empty">
        <SearchX class="w-4 h-4" />
        No results for “{{ query }}”
      </p>
      <div ref="listEl" class="xpe-menu-list">
        <template v-for="entry in grouped" :key="entry.item.id">
          <p
            v-if="entry.headerLabel"
            class="xpe-menu-heading px-2 pt-2.5 pb-1 first:pt-1"
          >
            {{ entry.headerLabel }}
          </p>
          <button
            type="button"
            class="xpe-menu-item"
            :class="{ 'xpe-menu-item--active': entry.idx === activeIndex }"
            :data-active="entry.idx === activeIndex"
            @mouseenter="activeIndex = entry.idx"
            @click="emit('select', entry.item)"
          >
            <span class="xpe-menu-item__icon">
              <component :is="entry.item.icon" />
            </span>
            <span class="xpe-menu-item__text">
              <span class="xpe-menu-item__label">{{ entry.item.label }}</span>
              <span class="xpe-menu-item__desc">{{ entry.item.description }}</span>
            </span>
          </button>
        </template>
      </div>
    </div>
  </Teleport>
</template>
