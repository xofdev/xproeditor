<script setup lang="ts">
import { AlignCenter, AlignLeft, AlignRight, Link2, SquareArrowOutUpRight } from 'lucide-vue-next'
import { computed, onMounted, ref, watch } from 'vue'
import { BUTTON_COLOR_PRESETS, type Block, type InlineSpan, type MarkName } from '@xproeditor/core'
import { Button, Input, Popover, PopoverContent, PopoverTrigger } from '../ui'
import EditorTextBlock from './EditorTextBlock.vue'

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

const open = ref(false)
const urlDraft = ref(props.block.props.url ?? '')
const labelDraft = ref(props.block.content.map(s => s.text).join('') || '')

const variant = computed(() => STYLE_TO_VARIANT[props.block.props.buttonStyle ?? 'primary'] ?? 'default')
const justify = computed(() => ALIGN_TO_JUSTIFY[props.block.props.align ?? 'left'] ?? 'justify-start')
const accent = computed(() => props.block.props.color || undefined)
const labelText = computed(() => props.block.content.map(s => s.text).join(''))

watch(() => props.block.props.url, (v) => { urlDraft.value = v ?? '' })
watch(labelText, (v) => { labelDraft.value = v })

onMounted(() => {
  if (!props.readonly && !(props.block.props.url ?? '') && !labelText.value.trim()) {
    open.value = true
  }
})

function contrastText(hex: string): string {
  const raw = hex.replace('#', '')
  if (raw.length !== 6) return '#ffffff'
  const r = parseInt(raw.slice(0, 2), 16)
  const g = parseInt(raw.slice(2, 4), 16)
  const b = parseInt(raw.slice(4, 6), 16)
  const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luma > 0.62 ? '#111827' : '#ffffff'
}

const previewStyle = computed(() => {
  const color = accent.value
  if (!color) return undefined
  if (variant.value === 'default') {
    return {
      background: color,
      borderColor: color,
      color: contrastText(color),
      '--xpe-btn-accent': color,
    }
  }
  if (variant.value === 'outline') {
    return { borderColor: color, color, '--xpe-btn-accent': color }
  }
  return { color, '--xpe-btn-accent': color }
})

const STYLES = ['primary', 'outline', 'ghost'] as const
const ALIGNS = ['left', 'center', 'right'] as const
const ALIGN_ICONS = { left: AlignLeft, center: AlignCenter, right: AlignRight }

function capitalize(s: string) {
  return s[0].toUpperCase() + s.slice(1)
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

defineExpose({
  focusAt: (pos: number | 'start' | 'end') => textRef.value?.focusAt?.(pos),
  getSelection: () => textRef.value?.getSelection?.() ?? null,
  setSelection: (start: number, end?: number) => textRef.value?.setSelection?.(start, end),
})

const textRef = ref<InstanceType<typeof EditorTextBlock> | null>(null)
</script>

<template>
  <div class="my-1 flex items-center gap-1.5" :class="justify" @click="emit('select')">
    <div class="ebtn-preview" :class="`ebtn-preview--${variant}`" :style="previewStyle">
      <EditorTextBlock
        ref="textRef"
        :block="block"
        :readonly="readonly"
        placeholder="Button"
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
          class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--xpe-muted-foreground)] hover:bg-[var(--xpe-surface-hover)] hover:text-[var(--xpe-foreground)]"
          title="Button settings"
          aria-label="Button settings"
          @click.stop="open = !open"
        >
          <Link2 class="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start">
        <div class="flex flex-col gap-3 p-3 w-72">
          <label class="flex flex-col gap-1">
            <span class="text-[11px] font-medium text-[var(--xpe-muted-foreground)]">Label</span>
            <Input
              placeholder="Button"
              v-model="labelDraft"
              @blur="commitLabel"
              @keydown.enter.prevent="commitLabel"
            />
          </label>

          <label class="flex flex-col gap-1">
            <span class="text-[11px] font-medium text-[var(--xpe-muted-foreground)]">Link URL</span>
            <Input
              placeholder="https://..."
              v-model="urlDraft"
              @blur="commitUrl"
              @keydown.enter.prevent="commitUrl"
            />
          </label>

          <label class="flex items-center gap-2 text-[12px] text-[var(--xpe-foreground)]">
            <input
              type="checkbox"
              :checked="!!block.props.openInNewTab"
              @change="emit('patch', { openInNewTab: ($event.target as HTMLInputElement).checked })"
            />
            <SquareArrowOutUpRight class="h-3.5 w-3.5 text-[var(--xpe-muted-foreground)]" />
            Open in new tab
          </label>

          <div class="flex flex-col gap-1.5">
            <span class="text-[11px] font-medium text-[var(--xpe-muted-foreground)]">Color</span>
            <div class="flex flex-wrap gap-1.5">
              <button
                type="button"
                title="Theme default"
                class="h-6 w-6 rounded-full border border-[var(--xpe-border)]"
                :class="!accent ? 'ring-2 ring-[var(--xpe-primary)] ring-offset-1' : ''"
                style="background: var(--xpe-primary, #4f46e5)"
                @click="emit('patch', { color: '' })"
              />
              <button
                v-for="c in BUTTON_COLOR_PRESETS"
                :key="c"
                type="button"
                :title="c"
                class="h-6 w-6 rounded-full border border-[var(--xpe-border)]"
                :class="accent === c ? 'ring-2 ring-[var(--xpe-primary)] ring-offset-1' : ''"
                :style="{ background: c }"
                @click="emit('patch', { color: c })"
              />
            </div>
          </div>

          <div class="flex flex-col gap-1">
            <span class="text-[11px] font-medium text-[var(--xpe-muted-foreground)]">Style</span>
            <div class="flex gap-1">
              <Button
                v-for="s in STYLES"
                :key="s"
                size="sm"
                :variant="(block.props.buttonStyle ?? 'primary') === s ? 'default' : 'outline'"
                @click="emit('patch', { buttonStyle: s })"
              >
                {{ capitalize(s) }}
              </Button>
            </div>
          </div>

          <div class="flex flex-col gap-1">
            <span class="text-[11px] font-medium text-[var(--xpe-muted-foreground)]">Alignment</span>
            <div class="flex gap-1">
              <Button
                v-for="a in ALIGNS"
                :key="a"
                size="sm"
                :variant="(block.props.align ?? 'left') === a ? 'default' : 'outline'"
                :aria-label="a"
                @click="emit('patch', { align: a })"
              >
                <component :is="ALIGN_ICONS[a]" class="h-3.5 w-3.5" />
              </Button>
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
  height: 36px;
  padding: 0 14px;
  border-radius: 8px;
  border: 1px solid transparent;
  font-weight: 500;
  font-size: 13px;
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
}
</style>
