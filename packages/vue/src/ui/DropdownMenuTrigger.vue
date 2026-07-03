<script setup lang="ts">
import { inject, onMounted, ref, watch } from 'vue'
import { popoverContextKey } from './popoverContext'

defineProps<{ asChild?: boolean }>()

const ctx = inject(popoverContextKey)
if (!ctx) {
  throw new Error('<DropdownMenuTrigger> must be used inside <DropdownMenu>')
}

const root = ref<HTMLElement | null>(null)

function syncTriggerEl(): void {
  ctx!.triggerEl.value = root.value
}

onMounted(syncTriggerEl)
watch(root, syncTriggerEl)
</script>

<template>
  <span ref="root" @click="ctx.setOpen(!ctx.open.value)">
    <slot />
  </span>
</template>
