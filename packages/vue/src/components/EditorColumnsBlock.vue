<script setup lang="ts">
import { AlignEndHorizontal, AlignStartHorizontal, AlignCenterHorizontal, Columns2, Columns3, Rows3 } from 'lucide-vue-next'
import { computed } from 'vue'
import { COLUMN_GAPS, COLUMN_LAYOUTS, columnAlign, columnCount, columnGap, columnStack, columnWidths } from '@xproeditor/core'
import type { Block, ColumnAlign, ColumnCount, ColumnStack } from '@xproeditor/core'
import { useEditorDictionary } from '../i18n'

/**
 * The header of a columns group in the editor: the group's own block. It shows
 * the layout and lets the author change it — column count, width preset, gap,
 * vertical alignment and the stacking order on small screens — or remove the
 * columns and keep their content. The columns themselves render below it
 * (BlockEditor), each holding ordinary blocks.
 */

const props = defineProps<{
  block: Block
  readonly?: boolean
  selected?: boolean
}>()

const emit = defineEmits<{
  patch: [patch: Record<string, unknown>]
  unwrap: []
  select: []
}>()

const dict = useEditorDictionary()
const t = computed(() => dict.value.columns)

const count = computed(() => columnCount(props.block))
const widths = computed(() => columnWidths(props.block))
const gap = computed(() => columnGap(props.block))
const align = computed(() => columnAlign(props.block))
const stack = computed(() => columnStack(props.block))
const layouts = computed(() => COLUMN_LAYOUTS[count.value])

const sameWidths = (a: number[], b: number[]) => a.length === b.length && a.every((w, i) => Math.abs(w - b[i]) < 0.5)
const GAP_LABELS = ['S', 'M', 'L', 'XL']

function setCount(value: ColumnCount) {
  if (value !== count.value) emit('patch', { columnCount: value })
}

const ALIGNS: Array<{ id: ColumnAlign; icon: unknown; label: () => string }> = [
  { id: 'top', icon: AlignStartHorizontal, label: () => t.value.alignTop },
  { id: 'center', icon: AlignCenterHorizontal, label: () => t.value.alignCenter },
  { id: 'bottom', icon: AlignEndHorizontal, label: () => t.value.alignBottom },
]

const STACKS = computed((): Array<{ id: ColumnStack; label: string }> => [
  { id: 'normal', label: t.value.stackNormal },
  { id: 'reverse', label: t.value.stackReverse },
  { id: 'none', label: t.value.stackNone },
])
</script>

<template>
  <div
    class="xpe-columns-bar flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-md border border-dashed px-2 py-1 text-xs text-[var(--xpe-muted-foreground)]"
    :class="selected ? 'border-[var(--xpe-ring)]' : 'border-[var(--xpe-border)]'"
    contenteditable="false"
    @click.self="emit('select')"
  >
    <span class="flex items-center gap-1 font-medium text-[var(--xpe-foreground)]" @click="emit('select')">
      <component :is="count === 3 ? Columns3 : Columns2" class="size-3.5" />
      {{ t.settings }}
    </span>

    <template v-if="!readonly">
      <!-- Count -->
      <span class="flex items-center gap-0.5" role="radiogroup" :aria-label="t.count">
        <button
          v-for="n in ([2, 3] as const)"
          :key="n"
          type="button"
          role="radio"
          :aria-checked="count === n"
          class="rounded px-1.5 py-0.5"
          :class="count === n ? 'bg-[var(--xpe-primary)] text-[var(--xpe-primary-foreground)]' : 'hover:bg-[var(--xpe-surface-hover)]'"
          @click="setCount(n)"
        >{{ n }}</button>
      </span>

      <!-- Widths: each preset drawn as its proportions -->
      <span class="flex items-center gap-1" role="radiogroup" :aria-label="t.widths">
        <button
          v-for="preset in layouts"
          :key="preset.join('-')"
          type="button"
          role="radio"
          :aria-checked="sameWidths(preset, widths)"
          :title="preset.map(w => `${Math.round(w)}%`).join(' / ')"
          class="flex h-5 w-9 gap-px rounded border p-0.5"
          :class="sameWidths(preset, widths) ? 'border-[var(--xpe-primary)]' : 'border-[var(--xpe-border)] hover:border-[var(--xpe-muted-foreground)]'"
          @click="emit('patch', { columnWidths: preset })"
        >
          <span
            v-for="(w, i) in preset"
            :key="i"
            class="h-full rounded-sm"
            :class="sameWidths(preset, widths) ? 'bg-[var(--xpe-primary)]' : 'bg-[var(--xpe-muted-foreground)] opacity-40'"
            :style="{ flex: w }"
          />
        </button>
      </span>

      <!-- Gap -->
      <span class="flex items-center gap-0.5" role="radiogroup" :aria-label="t.gap">
        <span class="me-0.5">{{ t.gap }}</span>
        <button
          v-for="(value, i) in COLUMN_GAPS"
          :key="value"
          type="button"
          role="radio"
          :aria-checked="gap === value"
          class="rounded px-1 py-0.5"
          :class="gap === value ? 'bg-[var(--xpe-primary-muted)] text-[var(--xpe-foreground)]' : 'hover:bg-[var(--xpe-surface-hover)]'"
          @click="emit('patch', { columnGap: value })"
        >{{ GAP_LABELS[i] }}</button>
      </span>

      <!-- Vertical alignment -->
      <span class="flex items-center gap-0.5" role="radiogroup" :aria-label="t.align">
        <button
          v-for="item in ALIGNS"
          :key="item.id"
          type="button"
          role="radio"
          :aria-checked="align === item.id"
          :title="item.label()"
          :aria-label="item.label()"
          class="rounded p-0.5"
          :class="align === item.id ? 'bg-[var(--xpe-primary-muted)] text-[var(--xpe-foreground)]' : 'hover:bg-[var(--xpe-surface-hover)]'"
          @click="emit('patch', { columnAlign: item.id })"
        >
          <component :is="item.icon" class="size-3.5" />
        </button>
      </span>

      <!-- Small screens -->
      <label class="flex items-center gap-1">
        <span>{{ t.stack }}</span>
        <select
          class="rounded border border-[var(--xpe-border)] bg-[var(--xpe-background)] px-1 py-0.5 text-xs text-[var(--xpe-foreground)]"
          :value="stack"
          @change="emit('patch', { columnStack: ($event.target as HTMLSelectElement).value })"
        >
          <option v-for="item in STACKS" :key="item.id" :value="item.id">{{ item.label }}</option>
        </select>
      </label>

      <button
        type="button"
        class="ms-auto flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-[var(--xpe-surface-hover)]"
        :title="t.unwrap"
        @click="emit('unwrap')"
      >
        <Rows3 class="size-3.5" />
        <span class="hidden sm:inline">{{ t.unwrap }}</span>
      </button>
    </template>
  </div>
</template>
