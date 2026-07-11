<script setup lang="ts">
import { Popover, PopoverContent, PopoverTrigger } from '../../ui';
import { cn } from '../../utils/cn';

withDefaults(
    defineProps<{
        open?: boolean;
        align?: 'start' | 'center' | 'end';
        side?: 'top' | 'bottom' | 'left' | 'right';
        contentClass?: string;
        title?: string;
    }>(),
    {
        open: undefined,
        align: 'start',
        side: 'bottom',
        contentClass: '',
        title: '',
    },
);

const emit = defineEmits<{
    'update:open': [value: boolean];
}>();
</script>

<template>
    <Popover :open="open" @update:open="emit('update:open', $event)">
        <PopoverTrigger>
            <slot name="trigger" />
        </PopoverTrigger>
        <PopoverContent
            :align="align"
            :side="side"
            :side-offset="6"
            :class="cn('w-auto rounded-xl border-[var(--xpe-border)] p-2 shadow-xl', contentClass)"
            @mousedown.stop
        >
            <p
                v-if="title"
                class="mb-2 px-1 text-[11px] font-semibold tracking-wide text-[var(--xpe-muted-foreground)] uppercase"
            >
                {{ title }}
            </p>
            <slot />
        </PopoverContent>
    </Popover>
</template>
