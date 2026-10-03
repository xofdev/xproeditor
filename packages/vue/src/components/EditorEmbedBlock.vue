<script setup lang="ts">
import { AppWindow, ExternalLink, Pencil, Settings2 } from 'lucide-vue-next'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import {
  embedFrameHeight,
  extractEmbedSource,
  resolveEmbed,
  sanitizeLinkUrl,
  type Block,
} from '@xproeditor/core'
import { Popover, PopoverContent, PopoverTrigger } from '../ui'
import { useEditorDictionary } from '../i18n'

/**
 * Allow-listed iframe embed (YouTube, Vimeo, Loom, Figma, CodePen, …). The
 * iframe `src` is always re-derived from `props.url` via `resolveEmbed`, so a
 * stored document can't point the frame anywhere else.
 */
const props = defineProps<{
  block: Block
  selected?: boolean
  readonly?: boolean
}>()

const emit = defineEmits<{
  patch: [patch: Record<string, unknown>]
  select: []
}>()

const dict = useEditorDictionary()
const t = computed(() => dict.value.embed)

const url = computed(() => (props.block.props.url ?? '').trim())
const resolved = computed(() => resolveEmbed(url.value))
const height = computed(() =>
  resolved.value ? embedFrameHeight(props.block.props.height, resolved.value.height) : 0,
)
const original = computed(() => sanitizeLinkUrl(url.value))

const open = ref(false)
const draft = ref(url.value)
const heightDraft = ref(String(props.block.props.height ?? ''))
const error = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

watch(url, (v) => { draft.value = v })
watch(() => props.block.props.height, (v) => { heightDraft.value = String(v ?? '') })

watch(open, async (isOpen) => {
  if (!isOpen) return
  await nextTick()
  inputRef.value?.focus()
  inputRef.value?.select()
})

// First insert: open the URL form.
onMounted(() => {
  if (!props.readonly && !url.value) open.value = true
})

function submit() {
  const source = extractEmbedSource(draft.value)
  const next = resolveEmbed(source)

  if (!next) {
    error.value = t.value.invalidUrl
    return
  }

  const h = Number(heightDraft.value)
  error.value = ''
  emit('patch', {
    url: source,
    provider: next.provider.id,
    height: Number.isFinite(h) && h > 0 ? embedFrameHeight(h, next.height) : undefined,
  })
  open.value = false
}

function remove() {
  emit('patch', { url: '', provider: undefined, height: undefined })
  draft.value = ''
  open.value = true
}

function onWrapClick(e: MouseEvent) {
  if ((e.target as HTMLElement).closest('a, button, input')) return
  emit('select')
}

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
  <div v-if="!resolved">
    <div v-if="!readonly" class="my-1">
      <Popover v-model:open="open">
        <PopoverTrigger>
          <button
            type="button"
            class="xpe-bookmark xpe-bookmark--empty"
            :class="{ 'xpe-bookmark--selected': selected }"
            @pointerdown="stopBlockPointer"
            @mousedown="stopBlockPointer"
            @click="onEmptyClick"
          >
            <AppWindow class="xpe-bookmark__icon" />
            <span>{{ t.add }}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" class="xpe-bookmark-popover xpe-float">
          <div class="xpe-bookmark-form" @mousedown.stop>
            <input
              ref="inputRef"
              v-model="draft"
              type="url"
              class="xpe-bookmark-form__input"
              :placeholder="t.placeholder"
              @input="error = ''"
              @keydown.enter.prevent="submit"
              @keydown.escape.prevent="open = false"
            />
            <p v-if="error" class="xpe-bookmark-form__error" role="alert">{{ error }}</p>
            <button
              type="button"
              class="xpe-bookmark-form__submit"
              :disabled="!draft.trim()"
              @click="submit"
            >
              {{ t.submit }}
            </button>
            <p class="xpe-bookmark-form__hint">{{ t.hint }}</p>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  </div>

  <div
    v-else
    class="my-1 xpe-embed xpe-bookmark-wrap"
    :class="{ 'xpe-bookmark-wrap--selected': selected }"
    @click="onWrapClick"
  >
    <div class="xpe-embed__body">
      <div class="xpe-embed__bar" contenteditable="false">
        <span class="xpe-embed__provider">
          <AppWindow aria-hidden="true" />
          {{ resolved.provider.name }}
        </span>
        <a
          v-if="original"
          class="xpe-embed__open"
          :href="original"
          target="_blank"
          rel="noopener noreferrer"
          :title="t.open"
          :aria-label="t.open"
        >
          <ExternalLink />
        </a>
      </div>
      <iframe
        :src="resolved.embedUrl"
        :title="block.props.caption || resolved.provider.name"
        class="xpe-embed__frame"
        :style="{ height: `${height}px` }"
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; gyroscope; picture-in-picture"
        allowfullscreen
        referrerpolicy="strict-origin-when-cross-origin"
        sandbox="allow-scripts allow-same-origin allow-popups allow-presentation allow-forms"
      />
    </div>

    <Popover v-if="!readonly" v-model:open="open">
      <PopoverTrigger>
        <button
          type="button"
          class="xpe-btn-settings-trigger"
          :class="{ 'xpe-btn-settings-trigger--open': open }"
          :title="t.edit"
          :aria-label="t.edit"
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
          <span class="xpe-bookmark-popover__title">{{ t.title }}</span>
        </div>
        <div class="xpe-bookmark-form" @mousedown.stop>
          <input
            ref="inputRef"
            v-model="draft"
            type="url"
            class="xpe-bookmark-form__input"
            :placeholder="t.placeholder"
            @input="error = ''"
            @keydown.enter.prevent="submit"
            @keydown.escape.prevent="open = false"
          />
          <label class="xpe-embed-form__height">
            <span>{{ t.height }}</span>
            <input
              v-model="heightDraft"
              type="number"
              min="80"
              max="1200"
              step="10"
              class="xpe-bookmark-form__input"
              :placeholder="String(resolved.height)"
              @keydown.enter.prevent="submit"
            />
          </label>
          <p v-if="error" class="xpe-bookmark-form__error" role="alert">{{ error }}</p>
          <button
            type="button"
            class="xpe-bookmark-form__submit"
            :disabled="!draft.trim()"
            @click="submit"
          >
            {{ t.update }}
          </button>
          <p class="xpe-bookmark-form__hint">{{ t.hint }}</p>
          <button type="button" class="xpe-bookmark-form__clear" @click="remove">
            {{ t.remove }}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  </div>
</template>
