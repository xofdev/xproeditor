<script setup lang="ts">
import {
  Type, Heading1, Heading2, Heading3, List, ListOrdered, CheckSquare,
  ChevronRight, Quote, Lightbulb, Code2, Minus, Image as ImageIcon, Video, Table2,
  Smile, Blocks, Music, Paperclip, SearchX, SquareMousePointer,
} from 'lucide-vue-next'
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { lockPageScroll, syncThemeVars } from '@xproeditor/core'
import type { BlockType } from '@xproeditor/core'

export type SlashGroup = 'basic' | 'lists' | 'media' | 'advanced'

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
}

const GROUP_LABELS: Record<SlashGroup, string> = {
  basic: 'Basic blocks',
  lists: 'Lists & tasks',
  media: 'Media',
  advanced: 'Advanced',
}

const ITEMS: SlashItem[] = [
  { id: 'paragraph', type: 'paragraph', label: 'Text', description: 'Plain paragraph', keywords: ['text', 'paragraph', 'p'], icon: Type, group: 'basic' },
  { id: 'heading_1', type: 'heading_1', label: 'Heading 1', description: 'Large section heading', keywords: ['h1', 'heading', 'title'], icon: Heading1, group: 'basic' },
  { id: 'heading_2', type: 'heading_2', label: 'Heading 2', description: 'Medium section heading', keywords: ['h2', 'heading', 'subtitle'], icon: Heading2, group: 'basic' },
  { id: 'heading_3', type: 'heading_3', label: 'Heading 3', description: 'Small section heading', keywords: ['h3', 'heading'], icon: Heading3, group: 'basic' },
  { id: 'bulleted_list_item', type: 'bulleted_list_item', label: 'Bulleted list', description: 'Simple bullet list', keywords: ['bullet', 'list', 'ul'], icon: List, group: 'lists' },
  { id: 'numbered_list_item', type: 'numbered_list_item', label: 'Numbered list', description: 'Ordered list', keywords: ['number', 'ordered', 'ol'], icon: ListOrdered, group: 'lists' },
  { id: 'to_do', type: 'to_do', label: 'To-do', description: 'Checkbox task', keywords: ['todo', 'check', 'task'], icon: CheckSquare, group: 'lists' },
  { id: 'toggle', type: 'toggle', label: 'Toggle', description: 'Collapsible content', keywords: ['toggle', 'collapse', 'accordion'], icon: ChevronRight, group: 'lists' },
  { id: 'image', type: 'image', label: 'Image', description: 'Upload an image', keywords: ['image', 'photo', 'picture', 'upload'], icon: ImageIcon, group: 'media' },
  { id: 'video', type: 'video', label: 'Video', description: 'Upload or embed a video', keywords: ['video', 'youtube', 'vimeo', 'movie'], icon: Video, group: 'media' },
  { id: 'audio', type: 'audio', label: 'Audio', description: 'Upload or link audio', keywords: ['audio', 'music', 'song', 'sound', 'mp3'], icon: Music, group: 'media' },
  { id: 'file', type: 'file', label: 'File', description: 'Attach a downloadable file', keywords: ['file', 'attachment', 'pdf', 'document', 'download'], icon: Paperclip, group: 'media' },
  { id: 'quote', type: 'quote', label: 'Quote', description: 'Capture a quote', keywords: ['quote', 'blockquote'], icon: Quote, group: 'advanced' },
  { id: 'callout', type: 'callout', label: 'Callout', description: 'Highlighted note', keywords: ['callout', 'note', 'info', 'warning'], icon: Lightbulb, group: 'advanced' },
  { id: 'emoji', type: 'callout', label: 'Emoji', description: 'Callout with emoji icon', keywords: ['emoji', 'emoticon', 'smile'], icon: Smile, group: 'advanced', pickIcon: 'emoji' },
  { id: 'icon', type: 'callout', label: 'Icon', description: 'Callout with vector icon', keywords: ['icon', 'symbol', 'lucide'], icon: Blocks, group: 'advanced', pickIcon: 'icon' },
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
  const q = props.query.toLowerCase().trim()

  if (!q) {
return ITEMS
}

  return ITEMS.filter(item =>
    item.label.toLowerCase().includes(q) || item.keywords.some(k => k.startsWith(q)),
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
      class="fixed z-[80] w-72 max-h-80 overflow-y-auto border py-1.5 bg-[var(--xpe-surface)] border-[var(--xpe-border)] rounded-[var(--xpe-radius)] [box-shadow:var(--xpe-shadow)]"
      :style="{ left: `${placed.left}px`, top: `${placed.top}px` }"
      :dir="dir"
      @mousedown.prevent
    >
      <div v-if="filtered.length === 0" class="flex items-center gap-2 px-3 py-4 text-[13px] text-[var(--xpe-muted-foreground)]">
        <SearchX class="w-4 h-4" />
        No results for “{{ query }}”
      </div>
      <div ref="listEl">
        <template v-for="entry in grouped" :key="entry.item.id">
          <p
            v-if="entry.headerLabel"
            class="px-3 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--xpe-muted-foreground)] first:pt-1"
          >
            {{ entry.headerLabel }}
          </p>
          <button
            class="flex items-center gap-3 w-full px-3 py-1.5 text-start transition-colors"
            :class="entry.idx === activeIndex ? 'bg-[var(--xpe-primary-muted)]' : 'hover:bg-[var(--xpe-surface-hover)]'"
            :data-active="entry.idx === activeIndex"
            @mouseenter="activeIndex = entry.idx"
            @click="emit('select', entry.item)"
          >
            <span
              class="flex items-center justify-center w-8 h-8 rounded-lg border shrink-0"
              :class="entry.idx === activeIndex ? 'border-[var(--xpe-border)] bg-[var(--xpe-surface)] text-[var(--xpe-primary)]' : 'border-[var(--xpe-border)] bg-[var(--xpe-muted)] text-[var(--xpe-muted-foreground)]'"
            >
              <component :is="entry.item.icon" class="w-4 h-4" />
            </span>
            <span class="min-w-0">
              <span class="block text-[13px] font-medium text-[var(--xpe-foreground)]">{{ entry.item.label }}</span>
              <span class="block text-[11px] text-[var(--xpe-muted-foreground)] truncate">{{ entry.item.description }}</span>
            </span>
          </button>
        </template>
      </div>
    </div>
  </Teleport>
</template>
