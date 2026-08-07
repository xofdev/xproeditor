<script setup lang="ts">
import { Bookmark, Globe, Loader2, Pencil, Settings2 } from 'lucide-vue-next'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import {
  bookmarkDisplayTitle,
  bookmarkHostname,
  normalizeBookmarkUrl,
  type Block,
  type FetchBookmarkMetaFn,
} from '@xproeditor/core'
import { Popover, PopoverContent, PopoverTrigger } from '../ui'

const props = defineProps<{
  block: Block
  selected?: boolean
  readonly?: boolean
  fetchBookmarkMeta?: FetchBookmarkMetaFn
}>()

const emit = defineEmits<{
  patch: [patch: Record<string, unknown>]
  select: []
}>()

const open = ref(false)
const urlDraft = ref(props.block.props.url ?? '')
const error = ref('')
const loading = ref(false)
const faviconBroken = ref(false)
const imageBroken = ref(false)
const inputRef = ref<HTMLInputElement | null>(null)

const url = computed(() => (props.block.props.url ?? '').trim())
const hasUrl = computed(() => !!url.value)
const title = computed(() => bookmarkDisplayTitle({ url: url.value, title: props.block.props.title }))
const host = computed(() => (url.value ? bookmarkHostname(url.value) : ''))
const description = computed(() => props.block.props.description?.trim() || '')
const favicon = computed(() => props.block.props.favicon)
const image = computed(() => props.block.props.image)

watch(() => props.block.props.url, (v) => { urlDraft.value = v ?? '' })
watch([favicon, image, url], () => {
  faviconBroken.value = false
  imageBroken.value = false
})

watch(open, async (isOpen) => {
  if (!isOpen) return
  await nextTick()
  inputRef.value?.focus()
  inputRef.value?.select()
})

onMounted(() => {
  if (!props.readonly && !hasUrl.value) open.value = true
})

async function createBookmark() {
  error.value = ''
  const normalized = normalizeBookmarkUrl(urlDraft.value)
  if (!normalized) {
    error.value = 'Enter a valid http(s) URL'
    return
  }

  loading.value = true
  try {
    let meta: {
      title?: string
      description?: string
      favicon?: string
      image?: string
    } = {}

    if (props.fetchBookmarkMeta) {
      try {
        const result = await props.fetchBookmarkMeta(normalized)
        if (result) meta = result
      } catch {
        // Graceful fallback
      }
    }

    emit('patch', {
      url: normalized,
      title: meta.title || '',
      description: meta.description || '',
      favicon: meta.favicon || '',
      image: meta.image || '',
    })
    open.value = false
  } finally {
    loading.value = false
  }
}

function clearBookmark() {
  emit('patch', {
    url: '',
    title: '',
    description: '',
    favicon: '',
    image: '',
  })
  urlDraft.value = ''
  open.value = true
}

function onCardClick(e: MouseEvent) {
  if (props.readonly) return
  e.stopPropagation()
}

function onWrapClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (target.closest('a, button, input, textarea')) return
  emit('select')
}

/** Own open state — stopPropagation blocks PopoverTrigger's parent span. */
function onEmptyClick(e: MouseEvent) {
  e.stopPropagation()
  emit('select')
  open.value = true
}

function onEditClick(e: MouseEvent) {
  e.stopPropagation()
  open.value = !open.value
}

function stopBlockPointer(e: Event) {
  e.stopPropagation()
}
</script>

<template>
  <div v-if="!hasUrl" class="my-1">
    <div
      v-if="readonly"
      class="xpe-bookmark xpe-bookmark--empty xpe-bookmark--readonly"
    >
      <Bookmark class="xpe-bookmark__icon" />
      <span>Web bookmark</span>
    </div>
    <Popover v-else v-model:open="open">
      <PopoverTrigger>
        <button
          type="button"
          class="xpe-bookmark xpe-bookmark--empty"
          :class="{ 'xpe-bookmark--selected': selected }"
          @pointerdown="stopBlockPointer"
          @mousedown="stopBlockPointer"
          @click="onEmptyClick"
        >
          <Bookmark class="xpe-bookmark__icon" />
          <span>Add a web bookmark</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" class="xpe-bookmark-popover xpe-float">
        <div class="xpe-bookmark-form" @mousedown.stop>
          <input
            ref="inputRef"
            type="url"
            class="xpe-bookmark-form__input"
            placeholder="Paste in https://…"
            v-model="urlDraft"
            :disabled="loading"
            @keydown.enter.prevent="createBookmark"
            @keydown.escape.prevent="open = false"
          />
          <p v-if="error" class="xpe-bookmark-form__error">{{ error }}</p>
          <button
            type="button"
            class="xpe-bookmark-form__submit"
            :disabled="loading || !urlDraft.trim()"
            @click="createBookmark"
          >
            <Loader2 v-if="loading" class="xpe-bookmark-form__spin" />
            {{ loading ? 'Creating…' : 'Create bookmark' }}
          </button>
          <p class="xpe-bookmark-form__hint">Create a visual bookmark from a link.</p>
        </div>
      </PopoverContent>
    </Popover>
  </div>

  <div
    v-else
    class="my-1 xpe-bookmark-wrap"
    :class="{ 'xpe-bookmark-wrap--selected': selected }"
    @click="onWrapClick"
  >
    <a
      class="xpe-bookmark-card"
      :href="url"
      target="_blank"
      rel="noopener noreferrer"
      @click="onCardClick"
    >
      <div class="xpe-bookmark-card__body">
        <div class="xpe-bookmark-card__title-row">
          <img
            v-if="favicon && !faviconBroken"
            :src="favicon"
            alt=""
            class="xpe-bookmark-card__favicon"
            @error="faviconBroken = true"
          />
          <Globe v-else class="xpe-bookmark-card__favicon-fallback" aria-hidden="true" />
          <span class="xpe-bookmark-card__title">{{ title }}</span>
        </div>
        <p v-if="description" class="xpe-bookmark-card__desc">{{ description }}</p>
        <span class="xpe-bookmark-card__url">{{ host || url }}</span>
      </div>
      <div v-if="image && !imageBroken" class="xpe-bookmark-card__media">
        <img :src="image" alt="" @error="imageBroken = true" />
      </div>
    </a>

    <Popover v-if="!readonly" v-model:open="open">
      <PopoverTrigger>
        <button
          type="button"
          class="xpe-btn-settings-trigger"
          :class="{ 'xpe-btn-settings-trigger--open': open }"
          title="Edit bookmark"
          aria-label="Edit bookmark"
          :aria-expanded="open"
          @pointerdown="stopBlockPointer"
          @mousedown="stopBlockPointer"
          @click="onEditClick"
        >
          <Pencil class="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" class="xpe-bookmark-popover xpe-float">
        <div class="xpe-bookmark-popover__head">
          <span class="xpe-menu-brand" aria-hidden="true">
            <Settings2 />
          </span>
          <span class="xpe-bookmark-popover__title">Bookmark</span>
        </div>
        <div class="xpe-bookmark-form" @mousedown.stop>
          <input
            ref="inputRef"
            type="url"
            class="xpe-bookmark-form__input"
            placeholder="Paste in https://…"
            v-model="urlDraft"
            :disabled="loading"
            @keydown.enter.prevent="createBookmark"
            @keydown.escape.prevent="open = false"
          />
          <p v-if="error" class="xpe-bookmark-form__error">{{ error }}</p>
          <button
            type="button"
            class="xpe-bookmark-form__submit"
            :disabled="loading || !urlDraft.trim()"
            @click="createBookmark"
          >
            <Loader2 v-if="loading" class="xpe-bookmark-form__spin" />
            {{ loading ? 'Creating…' : 'Update bookmark' }}
          </button>
          <p class="xpe-bookmark-form__hint">Create a visual bookmark from a link.</p>
          <button type="button" class="xpe-bookmark-form__clear" @click="clearBookmark">
            Remove link
          </button>
        </div>
      </PopoverContent>
    </Popover>
  </div>
</template>
