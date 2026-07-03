<script setup lang="ts">
import { cn } from '../utils/cn'

withDefaults(
  defineProps<{
    type?: 'button' | 'submit' | 'reset'
    variant?: 'default' | 'outline' | 'ghost'
    size?: 'sm' | 'md' | 'icon'
    disabled?: boolean
  }>(),
  {
    type: 'button',
    variant: 'default',
    size: 'md',
    disabled: false,
  },
)
</script>

<template>
  <button
    :type="type"
    class="xpe-btn"
    :class="cn(`xpe-btn--${variant}`, `xpe-btn--${size}`)"
    :disabled="disabled"
  >
    <slot />
  </button>
</template>

<style scoped>
.xpe-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border-radius: 8px;
  border: 1px solid transparent;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.12s, color 0.12s, border-color 0.12s;
  white-space: nowrap;
}
.xpe-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.xpe-btn--md {
  height: 36px;
  padding: 0 14px;
  font-size: 13px;
}
.xpe-btn--sm {
  height: 28px;
  padding: 0 10px;
  font-size: 12px;
}
.xpe-btn--icon {
  height: 32px;
  width: 32px;
  padding: 0;
}
.xpe-btn--default {
  background: #4f46e5;
  color: #fff;
}
.xpe-btn--default:hover:not(:disabled) {
  background: #4338ca;
}
.xpe-btn--outline {
  background: #fff;
  border-color: #e5e7eb;
  color: #374151;
}
.xpe-btn--outline:hover:not(:disabled) {
  background: #f9fafb;
}
.xpe-btn--ghost {
  background: transparent;
  color: #374151;
}
.xpe-btn--ghost:hover:not(:disabled) {
  background: #f3f4f6;
}
</style>
