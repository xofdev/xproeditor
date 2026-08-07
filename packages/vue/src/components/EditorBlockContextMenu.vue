<script setup lang="ts">
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
} from 'lucide-vue-next'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { syncThemeVars, type BlockType } from '@xproeditor/core'

const props = defineProps<{
  position: { x: number; y: number }
  blockType: BlockType
  colorPresets?: string[]
  currentColor?: string
  canTurnInto?: boolean
  aiEnabled?: boolean
  themeSource?: HTMLElement | null
}>()

const emit = defineEmits<{
  color: [color: string | undefined]
  turnInto: [type: BlockType]
  duplicate: []
  copy: []
  cut: []
  delete: []
  insertBelow: []
  askAI: []
  close: []
}>()

type View = 'root' | 'turn-into' | 'color'

const TURN_INTO: Array<{ type: BlockType; label: string; icon: unknown; keywords: string[] }> = [
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
  TURN_INTO.map(t => [t.type, t.label]),
)

const view = ref<View>('root')
const query = ref('')
const menuEl = ref<HTMLElement | null>(null)
const searchRef = ref<HTMLInputElement | null>(null)
const placed = ref({ left: props.position.x, top: props.position.y })

const isMac = /Mac|iPhone|iPad|iPod/i.test(
  typeof navigator !== 'undefined' ? navigator.platform || navigator.userAgent : '',
)
const mod = isMac ? '⌘' : 'Ctrl+'

const q = computed(() => query.value.trim().toLowerCase())
const blockLabel = computed(
  () => BLOCK_LABELS[props.blockType] ?? props.blockType.replace(/_/g, ' '),
)

function matches(hay: string[]): boolean {
  if (!q.value) return true
  return hay.join(' ').toLowerCase().includes(q.value)
}

type ActionItem = {
  id: string
  label: string
  icon: unknown
  shortcut?: string
  danger?: boolean
  chevron?: boolean
  run: () => void
}

const sections = computed(() => {
  const transform: ActionItem[] = []
  if (props.canTurnInto) {
    transform.push({
      id: 'turn-into',
      label: 'Turn into',
      icon: Type,
      chevron: true,
      run: () => { view.value = 'turn-into' },
    })
  }
  if (props.colorPresets?.length) {
    transform.push({
      id: 'color',
      label: 'Color',
      icon: Palette,
      chevron: true,
      run: () => { view.value = 'color' },
    })
  }

  const manage: ActionItem[] = [
    {
      id: 'duplicate',
      label: 'Duplicate',
      icon: Copy,
      shortcut: `${mod}D`,
      run: () => { emit('duplicate'); emit('close') },
    },
    {
      id: 'copy',
      label: 'Copy',
      icon: ClipboardCopy,
      shortcut: `${mod}C`,
      run: () => { emit('copy'); emit('close') },
    },
    {
      id: 'cut',
      label: 'Cut',
      icon: Scissors,
      shortcut: `${mod}X`,
      run: () => { emit('cut'); emit('close') },
    },
    {
      id: 'delete',
      label: 'Delete',
      icon: Trash2,
      shortcut: 'Del',
      danger: true,
      run: () => { emit('delete'); emit('close') },
    },
  ]

  const insert: ActionItem[] = [
    {
      id: 'insert-below',
      label: 'Insert below',
      icon: ArrowDownToLine,
      run: () => { emit('insertBelow'); emit('close') },
    },
  ]

  const ai: ActionItem[] = props.aiEnabled
    ? [{
        id: 'ask-ai',
        label: 'Ask AI',
        icon: Sparkles,
        run: () => { emit('askAI'); emit('close') },
      }]
    : []

  const filter = (items: ActionItem[], keywords: Record<string, string[]>) =>
    items.filter(item => matches([item.label, ...(keywords[item.id] ?? [])]))

  return [
    filter(transform, { 'turn-into': ['turn', 'convert', 'type'], color: ['color', 'background'] }),
    filter(manage, {
      duplicate: ['duplicate', 'clone'],
      copy: ['copy'],
      cut: ['cut'],
      delete: ['delete', 'remove'],
    }),
    filter(insert, { 'insert-below': ['insert', 'below', 'add'] }),
    filter(ai, { 'ask-ai': ['ai', 'ask', 'gpt'] }),
  ].filter(s => s.length > 0)
})

const turnIntoItems = computed(() =>
  TURN_INTO.filter(t => matches([t.label, t.type, ...t.keywords])),
)

function place() {
  const el = menuEl.value
  if (!el) return
  if (props.themeSource) syncThemeVars(props.themeSource, el)
  const margin = 8
  const { width, height } = el.getBoundingClientRect()
  placed.value = {
    left: Math.max(margin, Math.min(props.position.x, window.innerWidth - width - margin)),
    top: Math.max(margin, Math.min(props.position.y, window.innerHeight - height - margin)),
  }
}

function onOutside(e: MouseEvent) {
  if (!menuEl.value?.contains(e.target as Node)) emit('close')
}

function onKey(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  if (view.value !== 'root') {
    view.value = 'root'
    query.value = ''
  } else emit('close')
}

onMounted(() => {
  nextTick(() => {
    place()
    searchRef.value?.focus()
  })
  window.addEventListener('mousedown', onOutside, true)
  window.addEventListener('keydown', onKey)
})

onBeforeUnmount(() => {
  window.removeEventListener('mousedown', onOutside, true)
  window.removeEventListener('keydown', onKey)
})

watch([view, query, sections], () => nextTick(place))
watch(view, () => nextTick(() => searchRef.value?.focus()))
</script>

<template>
  <Teleport to="body">
    <div
      ref="menuEl"
      class="xpe-ctx-menu xpe-float xpe-scroll fixed z-[80]"
      :style="{ left: `${placed.left}px`, top: `${placed.top}px` }"
      role="menu"
      @mousedown.stop
    >
      <div class="xpe-menu-search">
        <Search class="xpe-menu-search__icon" />
        <input
          ref="searchRef"
          v-model="query"
          class="xpe-menu-search__input"
          placeholder="Search actions…"
        />
      </div>

      <template v-if="view === 'root'">
        <p class="xpe-ctx-menu__type">{{ blockLabel }}</p>
        <p v-if="!sections.length" class="xpe-menu-empty">No matching actions</p>
        <div v-for="(section, si) in sections" :key="si" class="xpe-ctx-menu__section">
          <div v-if="si > 0" class="xpe-menu-sep" />
          <button
            v-for="item in section"
            :key="item.id"
            type="button"
            class="xpe-menu-item"
            :class="{ 'xpe-menu-item--danger': item.danger }"
            @click="item.run()"
          >
            <span class="xpe-menu-item__icon">
              <component :is="item.icon" />
            </span>
            <span class="xpe-menu-item__label">{{ item.label }}</span>
            <span v-if="item.shortcut" class="xpe-menu-item__kbd">{{ item.shortcut }}</span>
            <ChevronRight v-if="item.chevron" class="xpe-menu-item__meta" />
          </button>
        </div>
      </template>

      <template v-else-if="view === 'turn-into'">
        <button type="button" class="xpe-ctx-menu__back" @click="view = 'root'; query = ''">
          <ChevronLeft />
          Turn into
        </button>
        <div class="xpe-ctx-menu__section">
          <button
            v-for="t in turnIntoItems"
            :key="t.type"
            type="button"
            class="xpe-menu-item"
            :class="{ 'xpe-menu-item--selected': t.type === blockType }"
            @click="emit('turnInto', t.type); emit('close')"
          >
            <span class="xpe-menu-item__icon">
              <component :is="t.icon" />
            </span>
            <span class="xpe-menu-item__label">{{ t.label }}</span>
            <Check v-if="t.type === blockType" class="xpe-menu-item__meta" />
          </button>
        </div>
      </template>

      <template v-else>
        <button type="button" class="xpe-ctx-menu__back" @click="view = 'root'; query = ''">
          <ChevronLeft />
          Color
        </button>
        <div class="xpe-ctx-menu__swatches">
          <button
            type="button"
            title="Default"
            class="xpe-ctx-menu__swatch"
            :class="{ 'xpe-ctx-menu__swatch--active': !currentColor }"
            style="background: var(--xpe-muted, #f3f4f6)"
            @click="emit('color', undefined); emit('close')"
          />
          <button
            v-for="color in colorPresets"
            :key="color"
            type="button"
            :title="color"
            class="xpe-ctx-menu__swatch"
            :class="{ 'xpe-ctx-menu__swatch--active': currentColor === color }"
            :style="{ background: color }"
            @click="emit('color', color); emit('close')"
          />
        </div>
      </template>
    </div>
  </Teleport>
</template>
