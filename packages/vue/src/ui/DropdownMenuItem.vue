<script setup lang="ts">
import { inject } from 'vue'
import { popoverContextKey } from './popoverContext'

const ctx = inject(popoverContextKey)
</script>

<template>
  <button type="button" class="xpe-dropdown-item" @click="ctx?.setOpen(false)">
    <slot />
  </button>
</template>

<style scoped>
.xpe-dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 10px;
  border: none;
  background: transparent;
  border-radius: calc(var(--xpe-radius, 12px) * 0.5);
  font-size: 13px;
  color: var(--xpe-foreground, #374151);
  cursor: pointer;
  text-align: start;
}
.xpe-dropdown-item:hover {
  background: var(--xpe-surface-hover, #f9fafb);
}
</style>
