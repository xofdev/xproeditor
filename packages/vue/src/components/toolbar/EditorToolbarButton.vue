<script setup lang="ts">
import { cn } from '../../utils/cn';

withDefaults(
    defineProps<{
        active?: boolean;
        disabled?: boolean;
        title?: string;
        wide?: boolean;
    }>(),
    {
        active: false,
        disabled: false,
        title: '',
        wide: false,
    },
);
</script>

<template>
    <button
        type="button"
        class="ebt-btn"
        :class="cn(active && 'ebt-active', wide && '!w-auto gap-1 px-2 text-xs font-medium text-[var(--xpe-muted-foreground)]')"
        :disabled="disabled"
        :title="title"
    >
        <slot />
    </button>
</template>

<style scoped>
.ebt-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 8px;
    border: none;
    background: transparent;
    color: var(--xpe-muted-foreground, #4b5563);
    cursor: pointer;
    transition:
        background 0.1s,
        color 0.1s;
}
.ebt-btn:hover:not(:disabled) {
    background: var(--xpe-muted, #f3f4f6);
    color: var(--xpe-foreground, #111827);
}
.ebt-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
}
.ebt-active {
    background: var(--xpe-primary-muted, #eef2ff);
    color: var(--xpe-primary, #4f46e5);
}
</style>
