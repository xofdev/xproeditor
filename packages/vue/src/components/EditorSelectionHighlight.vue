<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { getRangeClientRects } from '@xproeditor/core'

const props = defineProps<{
  target: HTMLElement | null
  start: number
  end: number
}>()

const containerRef = ref<HTMLElement | null>(null)
const rects = ref<Array<{ top: number; left: number; width: number; height: number }>>([])

function updateRects() {
  if (!props.target || !containerRef.value || props.end <= props.start) {
    rects.value = []

    return
  }

  const containerBox = containerRef.value.getBoundingClientRect()
  const clientRects = getRangeClientRects(props.target, props.start, props.end)

  rects.value = clientRects.map(r => ({
    top: r.top - containerBox.top,
    left: r.left - containerBox.left,
    width: r.width,
    height: r.height,
  }))
}

let ro: ResizeObserver | null = null

function bindObservers() {
  ro?.disconnect()
  ro = null

  if (!props.target) {
    return
  }

  ro = new ResizeObserver(() => updateRects())
  ro.observe(props.target)
}

watch(
  () => [props.target, props.start, props.end] as const,
  async () => {
    await nextTick()
    updateRects()
    bindObservers()
  },
  { immediate: true },
)

onMounted(() => {
  window.addEventListener('scroll', updateRects, true)
  window.addEventListener('resize', updateRects)
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', updateRects, true)
  window.removeEventListener('resize', updateRects)
  ro?.disconnect()
})
</script>

<template>
  <div ref="containerRef" class="esh-layer pointer-events-none absolute inset-0 overflow-visible">
    <div
      v-for="(rect, i) in rects"
      :key="i"
      class="esh-rect absolute"
      :style="{
        top: `${rect.top}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
      }"
    />
  </div>
</template>

<style scoped>
.esh-rect {
  background: var(--pro-editor-selection, rgb(35 131 226 / 0.18));
  border-radius: 2px;
}
</style>
