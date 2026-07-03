<script setup lang="ts">
import { inject, onMounted, ref, watch } from 'vue'
import { popoverContextKey } from './popoverContext'

const ctx = inject(popoverContextKey)
if (!ctx) {
  throw new Error('<PopoverTrigger> must be used inside <Popover>')
}

const root = ref<HTMLElement | null>(null)

function syncTriggerEl(): void {
  ctx!.triggerEl.value = root.value
}

onMounted(syncTriggerEl)
watch(root, syncTriggerEl)

function toggle(): void {
  ctx!.setOpen(!ctx!.open.value)
}
</script>

<template>
  <span ref="root" class="xpe-popover-trigger" @click="toggle">
    <slot />
  </span>
</template>

