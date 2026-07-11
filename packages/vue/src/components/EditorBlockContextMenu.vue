<script setup lang="ts">
import { ChevronLeft, ChevronRight, Copy, Palette, Trash2 } from 'lucide-vue-next'
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { syncThemeVars } from '@xproeditor/core'

const props = defineProps<{
  position: { x: number; y: number }
  /** Background color swatches — only shown when the block supports one (e.g. callout). */
  colorPresets?: string[]
  currentColor?: string
  themeSource?: HTMLElement | null
}>()

const emit = defineEmits<{
  color: [color: string]
  duplicate: []
  delete: []
  close: []
}>()

const view = ref<'root' | 'color'>('root')
const menuEl = ref<HTMLElement | null>(null)
const placed = ref({ left: props.position.x, top: props.position.y })

function place() {
  const el = menuEl.value

  if (!el) {
return
}

  if (props.themeSource) {
syncThemeVars(props.themeSource, el)
}

  const margin = 8
  const { width, height } = el.getBoundingClientRect()
  const left = Math.max(margin, Math.min(props.position.x, window.innerWidth - width - margin))
  const top = Math.max(margin, Math.min(props.position.y, window.innerHeight - height - margin))
  placed.value = { left, top }
}

function onOutside(e: MouseEvent) {
  if (!menuEl.value?.contains(e.target as Node)) {
emit('close')
}
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') {
emit('close')
}
}

onMounted(() => {
  nextTick(place)
  window.addEventListener('mousedown', onOutside, true)
  window.addEventListener('keydown', onKey)
})

onBeforeUnmount(() => {
  window.removeEventListener('mousedown', onOutside, true)
  window.removeEventListener('keydown', onKey)
})

function openColor() {
  view.value = 'color'
  nextTick(place)
}
</script>

<template>
  <Teleport to="body">
    <div
      ref="menuEl"
      class="xpe-popover-content xpe-scroll fixed z-[80] w-52 overflow-y-auto py-1.5"
      :style="{ left: `${placed.left}px`, top: `${placed.top}px` }"
      @mousedown.stop
    >
      <template v-if="view === 'root'">
        <button
          v-if="colorPresets"
          type="button"
          class="flex w-full items-center gap-2.5 px-3 py-1.5 text-start text-[13px] text-[var(--xpe-foreground)] hover:bg-[var(--xpe-surface-hover)]"
          @click="openColor"
        >
          <Palette class="h-3.5 w-3.5 text-[var(--xpe-muted-foreground)]" />
          <span class="flex-1">Color</span>
          <ChevronRight class="h-3.5 w-3.5 text-[var(--xpe-muted-foreground)]" />
        </button>
        <button
          type="button"
          class="flex w-full items-center gap-2.5 px-3 py-1.5 text-start text-[13px] text-[var(--xpe-foreground)] hover:bg-[var(--xpe-surface-hover)]"
          @click="emit('duplicate'); emit('close')"
        >
          <Copy class="h-3.5 w-3.5 text-[var(--xpe-muted-foreground)]" />
          Duplicate
        </button>
        <button
          type="button"
          class="flex w-full items-center gap-2.5 px-3 py-1.5 text-start text-[13px] text-[var(--xpe-danger)] hover:bg-[var(--xpe-surface-hover)]"
          @click="emit('delete'); emit('close')"
        >
          <Trash2 class="h-3.5 w-3.5" />
          Delete
        </button>
      </template>
      <template v-else>
        <button
          type="button"
          class="flex w-full items-center gap-2 px-3 py-1.5 text-start text-[12px] font-medium text-[var(--xpe-muted-foreground)] hover:text-[var(--xpe-foreground)]"
          @click="view = 'root'"
        >
          <ChevronLeft class="h-3.5 w-3.5" />
          Color
        </button>
        <div class="grid grid-cols-7 gap-1.5 px-3 py-1.5">
          <button
            v-for="color in colorPresets"
            :key="color"
            type="button"
            class="h-6 w-6 rounded-full border transition-transform hover:scale-110"
            :class="currentColor === color ? 'border-[var(--xpe-ring)] ring-2 ring-[var(--xpe-ring)]' : 'border-[var(--xpe-border)]'"
            :style="{ background: color }"
            :title="color"
            @click="emit('color', color); emit('close')"
          />
        </div>
      </template>
    </div>
  </Teleport>
</template>
