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
  border-radius: calc(var(--xpe-radius, 12px) * 0.66);
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
  background: var(--xpe-primary, #4f46e5);
  color: var(--xpe-primary-foreground, #fff);
}
.xpe-btn--default:hover:not(:disabled) {
  background: var(--xpe-primary, #4338ca);
}
.xpe-btn--outline {
  background: var(--xpe-surface, #fff);
  border-color: var(--xpe-border, #e5e7eb);
  color: var(--xpe-foreground, #374151);
}
.xpe-btn--outline:hover:not(:disabled) {
  background: var(--xpe-surface-hover, #f9fafb);
}
.xpe-btn--ghost {
  background: transparent;
  color: var(--xpe-foreground, #374151);
}
.xpe-btn--ghost:hover:not(:disabled) {
  background: var(--xpe-muted, #f3f4f6);
}
</style>
