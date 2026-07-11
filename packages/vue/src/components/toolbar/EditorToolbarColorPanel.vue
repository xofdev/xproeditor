<script setup lang="ts">
import { Check, Highlighter } from 'lucide-vue-next';
import { computed, ref, watch } from 'vue';
import type { MarkName } from '@xproeditor/core';
import {
    Button,
    ColorPickerPanel,
    DEFAULT_TEXT_COLOR,
    HIGHLIGHT_PRESETS,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
    TEXT_COLOR_PRESETS,
} from '../../ui';
import { cn } from '../../utils/cn';
import { useDebounceFn } from '../../utils/debounce';

const props = defineProps<{
    open?: boolean;
    currentColor?: string | null;
    currentHighlight?: string | null;
}>();

const emit = defineEmits<{
    mark: [mark: MarkName, value: boolean | string | null];
}>();

const activeTab = ref<'text' | 'highlight'>('text');
const pickerColor = ref(props.currentColor ?? DEFAULT_TEXT_COLOR);
const isEditingPicker = ref(false);

watch(
    () => props.currentColor,
    (value) => {
        if (activeTab.value === 'text' && !isEditingPicker.value) {
            pickerColor.value = value ?? DEFAULT_TEXT_COLOR;
        }
    },
);

watch(
    () => props.currentHighlight,
    (value) => {
        if (activeTab.value === 'highlight' && !isEditingPicker.value) {
            pickerColor.value = value ?? HIGHLIGHT_PRESETS[0];
        }
    },
);

watch(activeTab, (tab) => {
    isEditingPicker.value = false;

    if (tab === 'text') {
        pickerColor.value = props.currentColor ?? DEFAULT_TEXT_COLOR;
    } else {
        pickerColor.value = props.currentHighlight ?? HIGHLIGHT_PRESETS[0];
    }
});

watch(
    () => props.open,
    (open) => {
        if (!open) {
            return;
        }

        isEditingPicker.value = false;
        pickerColor.value = activeTab.value === 'text'
            ? (props.currentColor ?? DEFAULT_TEXT_COLOR)
            : (props.currentHighlight ?? HIGHLIGHT_PRESETS[0]);
    },
);

const activeTextColor = computed(() => props.currentColor?.toLowerCase() ?? null);
const activeHighlight = computed(() => props.currentHighlight?.toLowerCase() ?? null);

function selectTextColor(color: string): void {
    emit('mark', 'color', color.toLowerCase() === DEFAULT_TEXT_COLOR ? null : color);
}

function selectHighlight(color: string): void {
    emit('mark', 'highlight', color);
}

const debouncedApplyPickerColor = useDebounceFn((hex: string) => {
    if (activeTab.value === 'text') {
        selectTextColor(hex);
    } else {
        selectHighlight(hex);
    }
}, 80);

function onPickerInput(hex: string): void {
    isEditingPicker.value = true;
    pickerColor.value = hex;
    debouncedApplyPickerColor(hex);
}

function onPickerFocus(): void {
    isEditingPicker.value = true;
}

function resetCurrent(): void {
    isEditingPicker.value = false;

    if (activeTab.value === 'text') {
        emit('mark', 'color', null);
        pickerColor.value = DEFAULT_TEXT_COLOR;
    } else {
        emit('mark', 'highlight', null);
        pickerColor.value = HIGHLIGHT_PRESETS[0];
    }
}

function isPresetActive(color: string, active: string | null): boolean {
    return active !== null && active === color.toLowerCase();
}
</script>

<template>
    <Tabs v-model="activeTab" class="w-[280px]">
        <TabsList class="mb-2 grid w-full grid-cols-2">
            <TabsTrigger value="text" class="text-xs">Text</TabsTrigger>
            <TabsTrigger value="highlight" class="text-xs">Highlight</TabsTrigger>
        </TabsList>

        <TabsContent value="text" class="mt-0 space-y-3">
            <div class="grid grid-cols-5 gap-1.5">
                <button
                    v-for="color in TEXT_COLOR_PRESETS"
                    :key="color"
                    type="button"
                    class="relative flex size-7 items-center justify-center rounded-md border border-black/5 text-xs font-bold transition-transform hover:scale-105"
                    :class="
                        cn(
                            isPresetActive(color, activeTextColor) &&
                                'ring-2 ring-indigo-500 ring-offset-1',
                        )
                    "
                    :style="{ color }"
                    :title="color"
                    @click="selectTextColor(color)"
                >
                    A
                    <Check
                        v-if="isPresetActive(color, activeTextColor)"
                        class="absolute -top-1 -end-1 size-3 rounded-full bg-indigo-500 p-0.5 text-white"
                    />
                </button>
            </div>

            <div class="border-t border-gray-100 pt-3">
                <p class="mb-2 text-[10px] font-semibold tracking-wider text-gray-400 uppercase">
                    Custom
                </p>
                <div @focusin="onPickerFocus">
                    <ColorPickerPanel
                        v-model="pickerColor"
                        compact
                        hide-contrast-ratio
                        hide-default-swatches
                        @update:model-value="onPickerInput"
                    />
                </div>
            </div>

            <Button
                v-if="activeTextColor"
                type="button"
                variant="ghost"
                size="sm"
                class="h-7 w-full text-xs text-gray-500"
                @click="resetCurrent"
            >
                Reset text color
            </Button>
        </TabsContent>

        <TabsContent value="highlight" class="mt-0 space-y-3">
            <div class="grid grid-cols-4 gap-1.5">
                <button
                    v-for="color in HIGHLIGHT_PRESETS"
                    :key="color"
                    type="button"
                    class="relative size-7 rounded-md border border-black/10 transition-transform hover:scale-105"
                    :class="
                        cn(
                            isPresetActive(color, activeHighlight) &&
                                'ring-2 ring-indigo-500 ring-offset-1',
                        )
                    "
                    :style="{ backgroundColor: color }"
                    :title="color"
                    @click="selectHighlight(color)"
                >
                    <Check
                        v-if="isPresetActive(color, activeHighlight)"
                        class="absolute -top-1 -end-1 size-3 rounded-full bg-indigo-500 p-0.5 text-white"
                    />
                </button>
            </div>

            <div class="border-t border-gray-100 pt-3">
                <p class="mb-2 text-[10px] font-semibold tracking-wider text-gray-400 uppercase">
                    Custom
                </p>
                <div @focusin="onPickerFocus">
                    <ColorPickerPanel
                        v-model="pickerColor"
                        compact
                        hide-contrast-ratio
                        hide-default-swatches
                        @update:model-value="onPickerInput"
                    />
                </div>
            </div>

            <Button
                v-if="activeHighlight"
                type="button"
                variant="ghost"
                size="sm"
                class="h-7 w-full text-xs text-gray-500"
                @click="resetCurrent"
            >
                <Highlighter class="me-1.5 size-3" />
                Remove highlight
            </Button>
        </TabsContent>
    </Tabs>
</template>
