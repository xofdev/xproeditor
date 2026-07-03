<script setup lang="ts">
import { inject } from 'vue'
import { tabsContextKey } from './tabsContext'

const props = defineProps<{ value: string }>()

const ctx = inject(tabsContextKey)
if (!ctx) {
  throw new Error('<TabsContent> must be used inside <Tabs>')
}
</script>

<template>
  <div v-if="ctx.active.value === props.value" class="xpe-tabs-content">
    <slot />
  </div>
</template>
