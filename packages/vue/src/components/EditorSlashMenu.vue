<script setup lang="ts">
import {
  Type, Heading1, Heading2, Heading3, List, ListOrdered, CheckSquare,
  ChevronRight, Quote, Lightbulb, Code2, Minus, Image as ImageIcon, Video, Table2,
  Smile, Blocks,
} from 'lucide-vue-next'
import { ref, computed, watch, nextTick } from 'vue'
import type { BlockType } from '@xproeditor/core'

export interface SlashItem {
  id: string
  type: BlockType
  label: string
  description: string
  keywords: string[]
  icon: unknown
  /** After applying the block, open the icon picker on this tab. */
  pickIcon?: 'emoji' | 'icon'
}

const ITEMS: SlashItem[] = [
  { id: 'paragraph', type: 'paragraph', label: 'Text', description: 'Plain paragraph', keywords: ['text', 'paragraph', 'p'], icon: Type },
  { id: 'heading_1', type: 'heading_1', label: 'Heading 1', description: 'Large section heading', keywords: ['h1', 'heading', 'title'], icon: Heading1 },
  { id: 'heading_2', type: 'heading_2', label: 'Heading 2', description: 'Medium section heading', keywords: ['h2', 'heading', 'subtitle'], icon: Heading2 },
  { id: 'heading_3', type: 'heading_3', label: 'Heading 3', description: 'Small section heading', keywords: ['h3', 'heading'], icon: Heading3 },
  { id: 'bulleted_list_item', type: 'bulleted_list_item', label: 'Bulleted list', description: 'Simple bullet list', keywords: ['bullet', 'list', 'ul'], icon: List },
  { id: 'numbered_list_item', type: 'numbered_list_item', label: 'Numbered list', description: 'Ordered list', keywords: ['number', 'ordered', 'ol'], icon: ListOrdered },
  { id: 'to_do', type: 'to_do', label: 'To-do', description: 'Checkbox task', keywords: ['todo', 'check', 'task'], icon: CheckSquare },
  { id: 'toggle', type: 'toggle', label: 'Toggle', description: 'Collapsible content', keywords: ['toggle', 'collapse', 'accordion'], icon: ChevronRight },
  { id: 'quote', type: 'quote', label: 'Quote', description: 'Capture a quote', keywords: ['quote', 'blockquote'], icon: Quote },
  { id: 'callout', type: 'callout', label: 'Callout', description: 'Highlighted note', keywords: ['callout', 'note', 'info', 'warning'], icon: Lightbulb },
  { id: 'emoji', type: 'callout', label: 'Emoji', description: 'Callout with emoji icon', keywords: ['emoji', 'emoticon', 'smile'], icon: Smile, pickIcon: 'emoji' },
  { id: 'icon', type: 'callout', label: 'Icon', description: 'Callout with vector icon', keywords: ['icon', 'symbol', 'lucide'], icon: Blocks, pickIcon: 'icon' },
  { id: 'code', type: 'code', label: 'Code', description: 'Code block with syntax', keywords: ['code', 'snippet', 'pre'], icon: Code2 },
  { id: 'divider', type: 'divider', label: 'Divider', description: 'Horizontal line', keywords: ['divider', 'hr', 'separator', 'line'], icon: Minus },
  { id: 'image', type: 'image', label: 'Image', description: 'Upload an image', keywords: ['image', 'photo', 'picture', 'upload'], icon: ImageIcon },
  { id: 'video', type: 'video', label: 'Video', description: 'Upload or embed a video', keywords: ['video', 'youtube', 'vimeo', 'movie'], icon: Video },
  { id: 'table', type: 'table', label: 'Table', description: 'Simple table', keywords: ['table', 'grid'], icon: Table2 },
]

const props = defineProps<{
  query: string
  position: { x: number; y: number }
}>()

const emit = defineEmits<{
  select: [item: SlashItem]
  close: []
}>()

const activeIndex = ref(0)
const listEl = ref<HTMLElement | null>(null)

const filtered = computed(() => {
  const q = props.query.toLowerCase().trim()

  if (!q) {
return ITEMS
}

  return ITEMS.filter(item =>
    item.label.toLowerCase().includes(q) || item.keywords.some(k => k.startsWith(q)),
  )
})

watch(() => props.query, () => {
 activeIndex.value = 0 
})
watch(filtered, (items) => {
  if (items.length === 0) {
emit('close')
}
})

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
      class="fixed z-[80] w-72 max-h-80 overflow-y-auto bg-white border border-gray-100 rounded-xl shadow-xl py-1.5"
      :style="{ left: `${position.x}px`, top: `${position.y}px` }"
      @mousedown.prevent
    >
      <p class="px-3 pt-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Blocks</p>
      <div ref="listEl">
        <button
          v-for="(item, idx) in filtered"
          :key="item.id"
          class="flex items-center gap-3 w-full px-3 py-1.5 text-left transition-colors"
          :class="idx === activeIndex ? 'bg-indigo-50' : 'hover:bg-gray-50'"
          :data-active="idx === activeIndex"
          @mouseenter="activeIndex = idx"
          @click="emit('select', item)"
        >
          <span
            class="flex items-center justify-center w-8 h-8 rounded-lg border shrink-0"
            :class="idx === activeIndex ? 'border-indigo-100 bg-white text-indigo-600' : 'border-gray-100 bg-gray-50 text-gray-500'"
          >
            <component :is="item.icon" class="w-4 h-4" />
          </span>
          <span class="min-w-0">
            <span class="block text-[13px] font-medium text-gray-800">{{ item.label }}</span>
            <span class="block text-[11px] text-gray-400 truncate">{{ item.description }}</span>
          </span>
        </button>
      </div>
    </div>
  </Teleport>
</template>
