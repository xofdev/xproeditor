<script setup lang="ts">
import { Check } from 'lucide-vue-next';
import { computed, ref, watch } from 'vue';
import { DEFAULT_TABLE_BORDER, getResolvedTableBorder } from '@xproeditor/core';
import type { MarkName, TableBorderStyleKind, TableBorderWidth, TableStyle } from '@xproeditor/core';
import {
    Button,
    ColorPickerPanel,
    DEFAULT_TEXT_COLOR,
    HIGHLIGHT_PRESETS,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
    TABLE_BG_PRESETS,
    TABLE_BORDER_PRESETS,
    TABLE_BORDER_STYLES,
    TABLE_BORDER_WIDTHS,
    TEXT_COLOR_PRESETS,
} from '../../ui';
import { cn } from '../../utils/cn';
import { useDebounceFn } from '../../utils/debounce';

const props = defineProps<{
    open?: boolean;
    currentColor?: string | null;
    currentHighlight?: string | null;
    cellBackground?: string | null;
    tableStyle?: TableStyle;
}>();

const emit = defineEmits<{
    mark: [mark: MarkName, value: boolean | string | null];
    cellBackground: [color: string | null];
    tableStyle: [patch: Partial<TableStyle>];
}>();

const activeTab = ref<'text' | 'cell' | 'table' | 'border'>('text');
const pickerColor = ref(DEFAULT_TEXT_COLOR);
const isEditingPicker = ref(false);

const resolvedBorder = computed(() => getResolvedTableBorder(props.tableStyle));

watch(
    () => props.open,
    (open) => {
        if (!open) {
            return;
        }

        isEditingPicker.value = false;
        syncPickerColor();
    },
);

watch(activeTab, () => {
    isEditingPicker.value = false;
    syncPickerColor();
});

function syncPickerColor(): void {
    if (activeTab.value === 'text') {
        pickerColor.value = props.currentColor ?? DEFAULT_TEXT_COLOR;
    } else if (activeTab.value === 'cell') {
        pickerColor.value = props.cellBackground ?? TABLE_BG_PRESETS[0];
    } else if (activeTab.value === 'table') {
        pickerColor.value = props.tableStyle?.background ?? TABLE_BG_PRESETS[0];
    } else {
        pickerColor.value = resolvedBorder.value.color;
    }
}

function isPresetActive(color: string, active: string | null | undefined): boolean {
    return !!active && active.toLowerCase() === color.toLowerCase();
}

function selectTextColor(color: string): void {
    emit('mark', 'color', color.toLowerCase() === DEFAULT_TEXT_COLOR ? null : color);
}

function selectHighlight(color: string): void {
    emit('mark', 'highlight', color);
}

const debouncedApplyPickerColor = useDebounceFn((hex: string) => {
    if (activeTab.value === 'text') {
        selectTextColor(hex);
    } else if (activeTab.value === 'cell') {
        emit('cellBackground', hex);
    } else if (activeTab.value === 'table') {
        emit('tableStyle', { background: hex });
    } else {
        emit('tableStyle', { border: { color: hex } });
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

function resetTextColor(): void {
    emit('mark', 'color', null);
}

function resetHighlight(): void {
    emit('mark', 'highlight', null);
}

function resetCellBackground(): void {
    emit('cellBackground', null);
}

function resetTableBackground(): void {
    emit('tableStyle', { background: undefined });
}

function resetHeaderBackground(): void {
    emit('tableStyle', { headerBackground: undefined });
}

function resetBorder(): void {
    emit('tableStyle', { border: { ...DEFAULT_TABLE_BORDER } });
}

function selectCellBackground(color: string): void {
    emit('cellBackground', color);
}

function selectTableBackground(color: string): void {
    emit('tableStyle', { background: color });
}

function selectHeaderBackground(color: string): void {
    emit('tableStyle', { headerBackground: color });
}

function selectBorderColor(color: string): void {
    emit('tableStyle', { border: { color } });
}

function selectBorderWidth(width: TableBorderWidth): void {
    emit('tableStyle', { border: { width } });
}

function selectBorderStyle(style: TableBorderStyleKind): void {
    emit('tableStyle', { border: { style } });
}
</script>

<template>
    <Tabs v-model="activeTab" class="w-[300px]">
        <TabsList class="mb-2 grid w-full grid-cols-4">
            <TabsTrigger value="text" class="text-[10px]">Text</TabsTrigger>
            <TabsTrigger value="cell" class="text-[10px]">Cell</TabsTrigger>
            <TabsTrigger value="table" class="text-[10px]">Table</TabsTrigger>
            <TabsTrigger value="border" class="text-[10px]">Border</TabsTrigger>
        </TabsList>

        <TabsContent value="text" class="mt-0 space-y-3">
            <p class="text-[10px] font-semibold tracking-wider text-[var(--xpe-muted-foreground)] uppercase">Text color</p>
            <div class="grid grid-cols-5 gap-1.5">
                <button
                    v-for="color in TEXT_COLOR_PRESETS"
                    :key="color"
                    type="button"
                    class="relative flex size-7 items-center justify-center rounded-md border border-black/5 text-xs font-bold"
                    :class="cn(isPresetActive(color, currentColor) && 'ring-2 ring-indigo-500 ring-offset-1')"
                    :style="{ color }"
                    @click="selectTextColor(color)"
                >
                    A
                    <Check
                        v-if="isPresetActive(color, currentColor)"
                        class="absolute -top-1 -end-1 size-3 rounded-full bg-[var(--xpe-primary-muted)]0 p-0.5 text-white"
                    />
                </button>
            </div>

            <p class="text-[10px] font-semibold tracking-wider text-[var(--xpe-muted-foreground)] uppercase">Highlight</p>
            <div class="grid grid-cols-4 gap-1.5">
                <button
                    v-for="color in HIGHLIGHT_PRESETS"
                    :key="color"
                    type="button"
                    class="relative size-7 rounded-md border border-black/10"
                    :class="cn(isPresetActive(color, currentHighlight) && 'ring-2 ring-indigo-500 ring-offset-1')"
                    :style="{ backgroundColor: color }"
                    @click="selectHighlight(color)"
                />
            </div>

            <div class="border-t border-[var(--xpe-border)] pt-3">
                <ColorPickerPanel
                    v-model="pickerColor"
                    compact
                    hide-contrast-ratio
                    hide-default-swatches
                    @update:model-value="onPickerInput"
                    @focusin="onPickerFocus"
                />
            </div>

            <div class="flex gap-2">
                <Button v-if="currentColor" type="button" variant="ghost" size="sm" class="h-7 flex-1 text-xs" @click="resetTextColor">
                    Reset text
                </Button>
                <Button v-if="currentHighlight" type="button" variant="ghost" size="sm" class="h-7 flex-1 text-xs" @click="resetHighlight">
                    Reset highlight
                </Button>
            </div>
        </TabsContent>

        <TabsContent value="cell" class="mt-0 space-y-3">
            <div class="grid grid-cols-5 gap-1.5">
                <button
                    v-for="color in TABLE_BG_PRESETS"
                    :key="color"
                    type="button"
                    class="relative size-7 rounded-md border border-black/10"
                    :class="cn(isPresetActive(color, cellBackground) && 'ring-2 ring-indigo-500 ring-offset-1')"
                    :style="{ backgroundColor: color }"
                    @click="selectCellBackground(color)"
                />
            </div>
            <ColorPickerPanel
                v-model="pickerColor"
                compact
                hide-contrast-ratio
                hide-default-swatches
                @update:model-value="onPickerInput"
                @focusin="onPickerFocus"
            />
            <Button v-if="cellBackground" type="button" variant="ghost" size="sm" class="h-7 w-full text-xs" @click="resetCellBackground">
                Reset cell background
            </Button>
        </TabsContent>

        <TabsContent value="table" class="mt-0 space-y-3">
            <p class="text-[10px] font-semibold tracking-wider text-[var(--xpe-muted-foreground)] uppercase">Table background</p>
            <div class="grid grid-cols-5 gap-1.5">
                <button
                    v-for="color in TABLE_BG_PRESETS"
                    :key="`table-${color}`"
                    type="button"
                    class="relative size-7 rounded-md border border-black/10"
                    :class="cn(isPresetActive(color, tableStyle?.background) && 'ring-2 ring-indigo-500 ring-offset-1')"
                    :style="{ backgroundColor: color }"
                    @click="selectTableBackground(color)"
                />
            </div>

            <p class="text-[10px] font-semibold tracking-wider text-[var(--xpe-muted-foreground)] uppercase">Header background</p>
            <div class="grid grid-cols-5 gap-1.5">
                <button
                    v-for="color in TABLE_BG_PRESETS"
                    :key="`header-${color}`"
                    type="button"
                    class="relative size-7 rounded-md border border-black/10"
                    :class="cn(isPresetActive(color, tableStyle?.headerBackground) && 'ring-2 ring-indigo-500 ring-offset-1')"
                    :style="{ backgroundColor: color }"
                    @click="selectHeaderBackground(color)"
                />
            </div>

            <Button type="button" variant="ghost" size="sm" class="h-7 w-full text-xs" @click="resetTableBackground">
                Reset table background
            </Button>
            <Button type="button" variant="ghost" size="sm" class="h-7 w-full text-xs" @click="resetHeaderBackground">
                Reset header background
            </Button>
        </TabsContent>

        <TabsContent value="border" class="mt-0 space-y-3">
            <div
                class="rounded-md border bg-[var(--xpe-surface)] p-3"
                :style="{ border: `${resolvedBorder.width}px ${resolvedBorder.style} ${resolvedBorder.color}` }"
            >
                <div class="text-xs text-[var(--xpe-muted-foreground)]">Preview</div>
            </div>

            <div class="grid grid-cols-4 gap-1.5">
                <button
                    v-for="color in TABLE_BORDER_PRESETS"
                    :key="color"
                    type="button"
                    class="relative size-7 rounded-md border-2 bg-[var(--xpe-surface)]"
                    :class="cn(isPresetActive(color, resolvedBorder.color) && 'ring-2 ring-indigo-500 ring-offset-1')"
                    :style="{ borderColor: color }"
                    @click="selectBorderColor(color)"
                />
            </div>

            <p class="text-[10px] font-semibold tracking-wider text-[var(--xpe-muted-foreground)] uppercase">Width</p>
            <div class="flex flex-wrap gap-1">
                <button
                    v-for="width in TABLE_BORDER_WIDTHS"
                    :key="width"
                    type="button"
                    class="rounded-md border px-2 py-1 text-[11px]"
                    :class="resolvedBorder.width === width ? 'border-indigo-300 bg-[var(--xpe-primary-muted)] text-[var(--xpe-primary)]' : 'border-[var(--xpe-border)] text-[var(--xpe-muted-foreground)]'"
                    @click="selectBorderWidth(width)"
                >
                    {{ width }}px
                </button>
            </div>

            <p class="text-[10px] font-semibold tracking-wider text-[var(--xpe-muted-foreground)] uppercase">Style</p>
            <div class="flex flex-wrap gap-1">
                <button
                    v-for="style in TABLE_BORDER_STYLES"
                    :key="style"
                    type="button"
                    class="rounded-md border px-2 py-1 text-[11px] capitalize"
                    :class="resolvedBorder.style === style ? 'border-indigo-300 bg-[var(--xpe-primary-muted)] text-[var(--xpe-primary)]' : 'border-[var(--xpe-border)] text-[var(--xpe-muted-foreground)]'"
                    @click="selectBorderStyle(style)"
                >
                    {{ style }}
                </button>
            </div>

            <ColorPickerPanel
                v-model="pickerColor"
                compact
                hide-contrast-ratio
                hide-default-swatches
                @update:model-value="onPickerInput"
                @focusin="onPickerFocus"
            />

            <Button type="button" variant="ghost" size="sm" class="h-7 w-full text-xs" @click="resetBorder">
                Reset border
            </Button>
        </TabsContent>
    </Tabs>
</template>
