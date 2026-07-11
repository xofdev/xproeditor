<script setup lang="ts">
import { Clock, Hash, Leaf, Lightbulb, Music, Plane, Search, Smile, UtensilsCrossed } from 'lucide-vue-next'
import { computed, nextTick, onMounted, ref } from 'vue'
import { ALL_EMOJIS, EMOJI_CATEGORIES, type EmojiEntry } from './emojiData'

const RECENTS_KEY = 'xpe-emoji-recents'
const MAX_RECENTS = 24

function readRecents(): string[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY)
    const parsed = raw ? JSON.parse(raw) : []

    return Array.isArray(parsed) ? parsed.filter(v => typeof v === 'string') : []
  } catch {
    return []
  }
}

function pushRecent(char: string) {
  try {
    const next = [char, ...readRecents().filter(c => c !== char)].slice(0, MAX_RECENTS)
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next))
  } catch {
    /* storage unavailable */
  }
}

const CATEGORY_ICONS: Record<string, unknown> = {
  smileys: Smile,
  nature: Leaf,
  food: UtensilsCrossed,
  activities: Music,
  travel: Plane,
  objects: Lightbulb,
  symbols: Hash,
}

const props = defineProps<{
  autoFocus?: boolean
  /**
   * Controlled query, driving the grid without rendering an internal search
   * input — used by the ':' inline trigger, where the query is typed
   * directly into the text block rather than into the picker itself.
   */
  query?: string
}>()

const emit = defineEmits<{
  select: [emoji: string]
}>()

const controlled = computed(() => props.query !== undefined)
const internalQuery = ref('')
const query = computed(() => (controlled.value ? props.query ?? '' : internalQuery.value))
const recents = ref<string[]>(readRecents())
const searchEl = ref<HTMLInputElement | null>(null)
const sectionEls = ref<Record<string, HTMLElement | null>>({})

onMounted(() => {
  if (props.autoFocus && !controlled.value) {
    nextTick(() => searchEl.value?.focus())
  }
})

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()

  if (!q) {
return null
}

  return ALL_EMOJIS.filter(e => e.name.includes(q) || e.keywords.some(k => k.includes(q))).slice(0, 60)
})

function charToEntry(char: string): EmojiEntry | undefined {
  return ALL_EMOJIS.find(e => e.char === char)
}

const categoriesToRender = computed(() => {
  if (recents.value.length === 0) {
return EMOJI_CATEGORIES
}

  const recentEntries = recents.value.map(charToEntry).filter((e): e is EmojiEntry => !!e)

  return [{ id: 'recents', label: 'Recently used', emojis: recentEntries }, ...EMOJI_CATEGORIES]
})

function pick(entry: EmojiEntry) {
  pushRecent(entry.char)
  recents.value = readRecents()
  emit('select', entry.char)
}

function confirmSearch() {
  if (filtered.value && filtered.value[0]) {
    pick(filtered.value[0])
  }
}

function scrollToCategory(id: string) {
  internalQuery.value = ''
  nextTick(() => {
    sectionEls.value[id]?.scrollIntoView({ block: 'start' })
  })
}
</script>

<template>
  <div class="xpe-emoji-picker" :class="{ 'xpe-emoji-picker--controlled': controlled }">
    <div v-if="!controlled" class="xpe-emoji-search">
      <Search class="h-3.5 w-3.5 shrink-0 text-[var(--xpe-muted-foreground)]" />
      <input
        ref="searchEl"
        v-model="internalQuery"
        type="text"
        placeholder="Search emoji..."
        class="xpe-emoji-search-input"
        @keydown.enter.prevent="confirmSearch"
      />
    </div>

    <div class="xpe-emoji-scroll">
      <p v-if="controlled && !filtered" class="xpe-emoji-empty">Keep typing to search emoji…</p>
      <template v-else-if="filtered">
        <p v-if="filtered.length === 0" class="xpe-emoji-empty">No emoji found</p>
        <div v-else class="xpe-emoji-grid">
          <button
            v-for="entry in filtered"
            :key="entry.char"
            type="button"
            class="xpe-emoji-cell"
            :title="entry.name"
            @click="pick(entry)"
          >
            {{ entry.char }}
          </button>
        </div>
      </template>
      <template v-else>
        <div v-for="cat in categoriesToRender" :key="cat.id" :ref="(el) => { sectionEls[cat.id] = el as HTMLElement }">
          <p class="xpe-emoji-heading">{{ cat.label }}</p>
          <div class="xpe-emoji-grid">
            <button
              v-for="entry in cat.emojis"
              :key="entry.char"
              type="button"
              class="xpe-emoji-cell"
              :title="entry.name"
              @click="pick(entry)"
            >
              {{ entry.char }}
            </button>
          </div>
        </div>
      </template>
    </div>

    <div v-if="!controlled" class="xpe-emoji-catbar">
      <button type="button" title="Recently used" @click="scrollToCategory('recents')">
        <Clock class="h-4 w-4" />
      </button>
      <button
        v-for="cat in EMOJI_CATEGORIES"
        :key="cat.id"
        type="button"
        :title="cat.label"
        @click="scrollToCategory(cat.id)"
      >
        <component :is="CATEGORY_ICONS[cat.id] ?? Hash" class="h-4 w-4" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.xpe-emoji-picker { display: flex; flex-direction: column; width: 300px; height: 340px; }
.xpe-emoji-picker--controlled { height: auto; max-height: 260px; width: 280px; }
.xpe-emoji-search { display: flex; align-items: center; gap: 6px; padding: 8px 10px; border-bottom: 1px solid var(--xpe-border, #e5e7eb); flex-shrink: 0; }
.xpe-emoji-search-input { flex: 1; border: none; background: transparent; outline: none; font-size: 13px; color: var(--xpe-foreground, #111827); }
.xpe-emoji-search-input::placeholder { color: var(--xpe-muted-foreground, #9ca3af); }
.xpe-emoji-scroll { flex: 1; overflow-y: auto; padding: 6px 8px; }
.xpe-emoji-heading { padding: 6px 4px 4px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--xpe-muted-foreground, #9ca3af); }
.xpe-emoji-grid { display: grid; grid-template-columns: repeat(8, 1fr); gap: 2px; }
.xpe-emoji-cell { display: flex; align-items: center; justify-content: center; height: 32px; border-radius: 8px; border: none; background: transparent; font-size: 19px; line-height: 1; cursor: pointer; transition: background 0.1s, transform 0.1s; }
.xpe-emoji-cell:hover { background: var(--xpe-muted, #f3f4f6); transform: scale(1.12); }
.xpe-emoji-empty { padding: 24px 8px; text-align: center; font-size: 12px; color: var(--xpe-muted-foreground, #9ca3af); }
.xpe-emoji-catbar { display: flex; align-items: center; justify-content: space-between; gap: 2px; padding: 6px 8px; border-top: 1px solid var(--xpe-border, #e5e7eb); flex-shrink: 0; }
.xpe-emoji-catbar button { display: flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 6px; border: none; background: transparent; color: var(--xpe-muted-foreground, #9ca3af); cursor: pointer; transition: background 0.1s, color 0.1s; }
.xpe-emoji-catbar button:hover { background: var(--xpe-muted, #f3f4f6); color: var(--xpe-foreground, #111827); }
</style>
