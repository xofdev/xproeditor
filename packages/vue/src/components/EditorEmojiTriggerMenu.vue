<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { lockPageScroll, syncThemeVars } from '@xproeditor/core'
import { EmojiPicker } from '../ui'

const props = defineProps<{
  query: string
  /** Caret anchor in viewport coordinates: menu opens below `y`, flips above `top` when needed. */
  position: { x: number; y: number; top?: number }
  dir?: 'ltr' | 'rtl'
  themeSource?: HTMLElement | null
}>()

const emit = defineEmits<{
  select: [emoji: string]
}>()

const menuEl = ref<HTMLElement | null>(null)
const placed = ref<{ left: number; top: number }>({ left: props.position.x, top: props.position.y })

function place() {
  const el = menuEl.value

  if (!el) {
return
}

  if (props.themeSource) {
syncThemeVars(props.themeSource, el)
}

  const margin = 8
  const gap = 6
  const { width, height } = el.getBoundingClientRect()
  const anchorTop = props.position.top ?? props.position.y
  let left = props.dir === 'rtl' ? props.position.x - width : props.position.x
  left = Math.max(margin, Math.min(left, window.innerWidth - width - margin))
  let top = props.position.y + gap

  if (top + height > window.innerHeight - margin) {
    top = Math.max(margin, anchorTop - height - gap)
  }

  placed.value = { left, top }
}

let unlockScroll: (() => void) | null = null

onMounted(() => {
  nextTick(place)
  window.addEventListener('resize', place)
  window.addEventListener('scroll', place, true)
  unlockScroll = lockPageScroll()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', place)
  window.removeEventListener('scroll', place, true)
  unlockScroll?.()
  unlockScroll = null
})

watch(() => props.position, () => {
 nextTick(place)
}, { deep: true })
watch(() => props.query, () => {
 nextTick(place)
})
</script>

<template>
  <Teleport to="body">
    <div
      ref="menuEl"
      class="fixed z-[80] border bg-[var(--xpe-surface)] border-[var(--xpe-border)] rounded-[var(--xpe-radius)] [box-shadow:var(--xpe-shadow)] overflow-hidden"
      :style="{ left: `${placed.left}px`, top: `${placed.top}px` }"
      :dir="dir"
      @mousedown.prevent
    >
      <EmojiPicker :query="query" @select="emoji => emit('select', emoji)" />
    </div>
  </Teleport>
</template>
