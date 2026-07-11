<script setup lang="ts">
import { computed, inject } from 'vue'
import { tabsContextKey } from './tabsContext'

const props = defineProps<{ value: string }>()

const ctx = inject(tabsContextKey)
if (!ctx) {
  throw new Error('<TabsTrigger> must be used inside <Tabs>')
}

const isActive = computed(() => ctx.active.value === props.value)
</script>

<template>
  <button
    type="button"
    class="xpe-tabs-trigger"
    :class="{ 'xpe-tabs-trigger--active': isActive }"
    @click="ctx.setActive(value)"
  >
    <slot />
  </button>
</template>

<style scoped>
.xpe-tabs-trigger {
  border: none;
  background: transparent;
  border-radius: calc(var(--xpe-radius, 12px) * 0.5);
  padding: 5px 8px;
  font-size: 12px;
  font-weight: 500;
  color: var(--xpe-muted-foreground, #6b7280);
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}
.xpe-tabs-trigger:hover {
  color: var(--xpe-foreground, #111827);
}
.xpe-tabs-trigger--active {
  background: var(--xpe-surface, #fff);
  color: var(--xpe-foreground, #111827);
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.06);
}
</style>
