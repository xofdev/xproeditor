<script setup lang="ts">
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Check,
  Link2,
  Settings2,
  SquareArrowOutUpRight,
} from 'lucide-vue-next'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import {
  BUTTON_ALIGN_OPTIONS,
  BUTTON_COLOR_PRESETS,
  BUTTON_STYLE_OPTIONS,
  buttonContrastForeground,
  type Block,
  type InlineSpan,
  type MarkName,
} from '@xproeditor/core'
import { Popover, PopoverContent, PopoverTrigger } from '../ui'
import EditorTextBlock from './EditorTextBlock.vue'
import { useEditorDictionary } from '../i18n'

const dict = useEditorDictionary()
const t = computed(() => dict.value.button)

const props = defineProps<{
  block: Block
  readonly?: boolean
}>()

const emit = defineEmits<{
  input: [spans: InlineSpan[], caret: number | null]
  enter: [offsets: { start: number; end: number }]
  backspaceStart: []
  deleteEnd: []
  arrowUp: []
  arrowDown: []
  tab: [shift: boolean]
  format: [mark: MarkName]
  pasted: [payload: { html: string; text: string; files: File[]; offsets: { start: number; end: number } }]
  focus: []
  selectionPointerDown: [payload: { shiftKey: boolean; clientX: number; clientY: number }]
  patch: [patch: Record<string, unknown>]
  select: []
}>()

const STYLE_TO_VARIANT: Record<string, 'default' | 'outline' | 'ghost'> = {
  primary: 'default',
  outline: 'outline',
  ghost: 'ghost',
}

const ALIGN_TO_JUSTIFY: Record<string, string> = {
  left: 'justify-start',
  center: 'justify-center',
  right: 'justify-end',
}

const ALIGN_ICONS = { left: AlignLeft, center: AlignCenter, right: AlignRight }

const open = ref(false)
const urlDraft = ref(props.block.props.url ?? '')
const labelDraft = ref(props.block.content.map(s => s.text).join('') || '')
const urlInputRef = ref<HTMLInputElement | null>(null)
const textRef = ref<InstanceType<typeof EditorTextBlock> | null>(null)

const variant = computed(() => STYLE_TO_VARIANT[props.block.props.buttonStyle ?? 'primary'] ?? 'default')
const justify = computed(() => ALIGN_TO_JUSTIFY[props.block.props.align ?? 'left'] ?? 'justify-start')
const accent = computed(() => props.block.props.color || undefined)
const labelText = computed(() => props.block.content.map(s => s.text).join(''))
const openInNewTab = computed(() => !!props.block.props.openInNewTab)
const activeStyle = computed(() => props.block.props.buttonStyle ?? 'primary')
const activeAlign = computed(() => props.block.props.align ?? 'left')

watch(() => props.block.props.url, (v) => { urlDraft.value = v ?? '' })
watch(labelText, (v) => { labelDraft.value = v })

watch(open, async (isOpen) => {
  if (!isOpen) return
  await nextTick()
  urlInputRef.value?.focus()
})

onMounted(() => {
  if (!props.readonly && !(props.block.props.url ?? '') && !labelText.value.trim()) {
    open.value = true
  }
})

const previewStyle = computed(() => {
  const color = accent.value
  if (!color) return undefined
  if (variant.value === 'default') {
    return {
      background: color,
      borderColor: color,
      color: buttonContrastForeground(color),
      '--xpe-btn-accent': color,
    }
  }
  if (variant.value === 'outline') {
    return { borderColor: color, color, '--xpe-btn-accent': color }
  }
  return { color, '--xpe-btn-accent': color }
})

function isLightSwatch(hex: string): boolean {
  return buttonContrastForeground(hex) === '#111827'
}

function commitUrl() {
  const next = urlDraft.value.trim()
  if (next !== (props.block.props.url ?? '')) {
    emit('patch', { url: next })
  }
}

function commitLabel() {
  if (labelDraft.value !== labelText.value) {
    emit('input', [{ text: labelDraft.value }], labelDraft.value.length)
  }
}

/** Clicking the label must edit text — never chrome-select (that clears the caret). */
function handlePreviewClick(e: MouseEvent) {
  e.stopPropagation()
  if (props.readonly) return
  const target = e.target as HTMLElement
  if (!target.closest('[contenteditable="true"]')) {
    textRef.value?.focusAt?.(labelText.value.length > 0 ? 'end' : 'start')
  }
}

function handleRowClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (target.closest('[contenteditable="true"], .ebtn-preview, button, input, textarea, label')) {
    return
  }
  emit('select')
}

defineExpose({
  focusAt: (pos: number | 'start' | 'end') => textRef.value?.focusAt?.(pos),
  getSelection: () => textRef.value?.getSelection?.() ?? null,
  setSelection: (start: number, end?: number) => textRef.value?.setSelection?.(start, end),
})
</script>

<template>
  <div class="my-1 flex items-center gap-1.5" :class="justify" @click="handleRowClick">
    <div
      class="ebtn-preview"
      :class="`ebtn-preview--${variant}`"
      :style="previewStyle"
      @click="handlePreviewClick"
    >
      <EditorTextBlock
        ref="textRef"
        :block="block"
        :readonly="readonly"
        :placeholder="t.defaultLabel"
        class="min-w-0 text-center outline-none"
        @input="(s, c) => emit('input', s, c)"
        @enter="o => emit('enter', o)"
        @backspace-start="emit('backspaceStart')"
        @delete-end="emit('deleteEnd')"
        @arrow-up="emit('arrowUp')"
        @arrow-down="emit('arrowDown')"
        @tab="s => emit('tab', s)"
        @format="m => emit('format', m)"
        @pasted="p => emit('pasted', p)"
        @focus="emit('focus')"
        @selection-pointer-down="p => emit('selectionPointerDown', p)"
      />
    </div>

    <Popover v-if="!readonly" v-model:open="open">
      <PopoverTrigger>
        <button
          type="button"
          class="xpe-btn-settings-trigger"
          :class="{ 'xpe-btn-settings-trigger--open': open }"
          :title="t.settings"
          :aria-label="t.settings"
          :aria-expanded="open"
        >
          <Settings2 class="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" class="xpe-button-settings">
        <div class="xpe-button-settings__head">
          <span class="xpe-menu-brand" aria-hidden="true">
            <Settings2 />
          </span>
          <span class="xpe-button-settings__title">{{ dict.blockTypes.button }}</span>
        </div>

        <div class="xpe-button-settings__body">
          <div class="xpe-button-settings__field">
            <span class="xpe-button-settings__label">{{ t.link }}</span>
            <div class="xpe-button-settings__input-wrap">
              <Link2 class="xpe-button-settings__input-icon" />
              <input
                ref="urlInputRef"
                type="url"
                class="xpe-button-settings__input"
                placeholder="https://…"
                v-model="urlDraft"
                @blur="commitUrl"
                @keydown.enter.prevent="commitUrl"
              />
            </div>
            <button
              type="button"
              class="xpe-button-settings__toggle"
              role="switch"
              :aria-checked="!!openInNewTab"
              @click="emit('patch', { openInNewTab: !openInNewTab })"
            >
              <span class="xpe-button-settings__toggle-meta">
                <SquareArrowOutUpRight />
                {{ t.openInNewTab }}
              </span>
              <span
                class="xpe-button-settings__switch"
                :class="{ 'xpe-button-settings__switch--on': openInNewTab }"
                aria-hidden="true"
              />
            </button>
          </div>

          <div class="xpe-button-settings__field">
            <span class="xpe-button-settings__label">{{ t.label }}</span>
            <div class="xpe-button-settings__input-wrap">
              <input
                type="text"
                class="xpe-button-settings__input"
                style="padding-inline-start: 10px"
                :placeholder="t.defaultLabel"
                v-model="labelDraft"
                @blur="commitLabel"
                @keydown.enter.prevent="commitLabel"
              />
            </div>
          </div>

          <div class="xpe-button-settings__field">
            <span class="xpe-button-settings__label">{{ t.style }}</span>
            <div class="xpe-button-settings__seg" role="group" :aria-label="t.style">
              <button
                v-for="s in BUTTON_STYLE_OPTIONS"
                :key="s.id"
                type="button"
                class="xpe-button-settings__seg-item"
                :class="{ 'xpe-button-settings__seg-item--active': activeStyle === s.id }"
                @click="emit('patch', { buttonStyle: s.id })"
              >
                {{ s.id === 'outline' ? t.outline : s.id === 'ghost' ? t.ghost : t.fill }}
              </button>
            </div>
          </div>

          <div class="xpe-button-settings__field">
            <span class="xpe-button-settings__label">{{ t.align }}</span>
            <div class="xpe-button-settings__seg" role="group" :aria-label="t.align">
              <button
                v-for="a in BUTTON_ALIGN_OPTIONS"
                :key="a"
                type="button"
                class="xpe-button-settings__seg-item"
                :class="{ 'xpe-button-settings__seg-item--active': activeAlign === a }"
:aria-label="a === 'left' ? dict.toolbar.alignLeft : a === 'center' ? dict.toolbar.alignCenter : dict.toolbar.alignRight"
                :aria-pressed="activeAlign === a"
                @click="emit('patch', { align: a })"
              >
                <component :is="ALIGN_ICONS[a]" />
              </button>
            </div>
          </div>

          <div class="xpe-button-settings__field">
            <span class="xpe-button-settings__label">{{ t.color }}</span>
            <div class="xpe-button-settings__swatches">
              <button
                type="button"
                :title="t.themeDefault"
                :aria-label="t.themeDefault"
                class="xpe-button-settings__swatch"
                :class="{ 'xpe-button-settings__swatch--active': !accent }"
                style="background: var(--xpe-primary, #4f46e5)"
                @click="emit('patch', { color: '' })"
              >
                <Check v-if="!accent" />
              </button>
              <button
                v-for="c in BUTTON_COLOR_PRESETS"
                :key="c"
                type="button"
                :title="c"
                :aria-label="c"
                class="xpe-button-settings__swatch"
                :class="{
                  'xpe-button-settings__swatch--active': accent === c,
                  'xpe-button-settings__swatch--light': isLightSwatch(c),
                }"
                :style="{ background: c }"
                @click="emit('patch', { color: c })"
              >
                <Check v-if="accent === c" />
              </button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  </div>
</template>

<style scoped>
.ebtn-preview {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 64px;
  max-width: 100%;
  height: 36px;
  padding: 0 14px;
  border-radius: 8px;
  border: 1px solid transparent;
  font-weight: 500;
  font-size: 13px;
  cursor: text;
  overflow: hidden;
}
.ebtn-preview--default {
  background: var(--xpe-btn-accent, var(--xpe-primary, #4f46e5));
  color: var(--xpe-primary-foreground, #fff);
}
.ebtn-preview--outline {
  background: var(--xpe-surface, #fff);
  border-color: var(--xpe-btn-accent, var(--xpe-border, #e5e7eb));
  color: var(--xpe-btn-accent, var(--xpe-foreground, #374151));
}
.ebtn-preview--ghost {
  background: transparent;
  color: var(--xpe-btn-accent, var(--xpe-foreground, #374151));
}
.ebtn-preview :deep(.etb) {
  color: inherit;
  font-size: inherit;
  font-weight: inherit;
  line-height: 1.25;
  min-height: 0;
  width: 100%;
}
</style>
