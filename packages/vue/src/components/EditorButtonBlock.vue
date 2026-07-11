<script setup lang="ts">
import { Link2, SquareArrowOutUpRight } from 'lucide-vue-next'
import { ref, computed } from 'vue'
import type { Block, InlineSpan, MarkName } from '@xproeditor/core'
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
const variant = computed(() => STYLE_TO_VARIANT[props.block.props.buttonStyle ?? 'primary'] ?? 'default')
const justify = computed(() => ALIGN_TO_JUSTIFY[props.block.props.align ?? 'left'] ?? 'justify-start')

const STYLES = ['primary', 'outline', 'ghost'] as const
const ALIGNS = ['left', 'center', 'right'] as const

function capitalize(s: string) {
  return s[0].toUpperCase() + s.slice(1)
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
    <div class="ebtn-preview" :class="`ebtn-preview--${variant}`">
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
          title="Button link & style"
          @click="open = !open"
        >
          <Link2 class="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start">
        <div class="flex flex-col gap-2.5 p-3 w-64">
          <label class="flex flex-col gap-1">
            <span class="text-[11px] font-medium text-[var(--xpe-muted-foreground)]">Link URL</span>
            <Input
              type="url"
              placeholder="https://..."
              :model-value="block.props.url ?? ''"
              @input="emit('patch', { url: ($event.target as HTMLInputElement).value })"
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

          <div class="flex flex-col gap-1">
            <span class="text-[11px] font-medium text-[var(--xpe-muted-foreground)]">Style</span>
            <div class="flex gap-1">
              <Button
                v-for="s in STYLES"
                :key="s"
                size="sm"
                :variant="block.props.buttonStyle === s ? 'default' : 'outline'"
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
                @click="emit('patch', { align: a })"
              >
                {{ capitalize(a) }}
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  </div>
</template>

<style scoped>
/* Mirrors ui/Button.vue's look — can't reuse its scoped .xpe-btn classes
   directly since this is a plain div, not a <Button>, and Vue scoped CSS
   only applies to elements rendered by the component that declares it. */
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
  background: var(--xpe-primary, #4f46e5);
  color: var(--xpe-primary-foreground, #fff);
}
.ebtn-preview--outline {
  background: var(--xpe-surface, #fff);
  border-color: var(--xpe-border, #e5e7eb);
  color: var(--xpe-foreground, #374151);
}
.ebtn-preview--ghost {
  background: transparent;
  color: var(--xpe-foreground, #374151);
}
/* EditorTextBlock's .etb always sets its own color; force the label to
   inherit the button variant's contrast-correct text color instead. */
.ebtn-preview :deep(.etb) {
  color: inherit;
}
</style>
