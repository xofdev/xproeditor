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
            :class="cn('xpe-float--panel w-auto', contentClass)"
            @mousedown.stop
        >
            <p
                v-if="title"
                class="xpe-menu-heading mb-2 px-1"
            >
                {{ title }}
            </p>
            <slot />
        </PopoverContent>
    </Popover>
</template>
