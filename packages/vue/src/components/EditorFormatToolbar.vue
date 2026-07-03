<script setup lang="ts">
import {
    AlignCenter,
    AlignJustify,
    AlignLeft,
    AlignRight,
    Bold,
    Check,
    ChevronDown,
    Code,
    IndentDecrease,
    IndentIncrease,
    Italic,
    Languages,
    Link2,
    List,
    ListOrdered,
    Paintbrush,
    Quote,
    Strikethrough,
    Type,
    Heading1,
    Heading2,
    Heading3,
    CheckSquare,
    Lightbulb,
    Underline,
} from 'lucide-vue-next';
import { ref, watch } from 'vue';
import type { BlockType, MarkName, TableStyle } from '@xproeditor/core';
import { Button, IconEmojiPicker, IconValueDisplay, Input } from '../ui';
import EditorTableStylePanel from './toolbar/EditorTableStylePanel.vue';
import EditorToolbarButton from './toolbar/EditorToolbarButton.vue';
import EditorToolbarColorPanel from './toolbar/EditorToolbarColorPanel.vue';
import EditorToolbarPopover from './toolbar/EditorToolbarPopover.vue';
import EditorToolbarSeparator from './toolbar/EditorToolbarSeparator.vue';

export type FormatToolbarAlign = 'left' | 'center' | 'right' | 'justify';

export type FormatToolbarState = {
    blockId: string;
    blockType: BlockType;
    activeMarks: Partial<Record<MarkName, boolean>>;
    currentLink: string | null;
    currentColor?: string | null;
    currentHighlight?: string | null;
    hasSelection: boolean;
    multiBlock?: boolean;
    align: FormatToolbarAlign;
    indent: number;
    dir: 'auto' | 'ltr' | 'rtl';
    calloutIcon?: string | null;
    tableStyle?: TableStyle;
    cellBackground?: string | null;
};

const props = defineProps<{
    state: FormatToolbarState | null;
}>();

const emit = defineEmits<{
    mark: [mark: MarkName, value: boolean | string | null];
    turnInto: [type: BlockType];
    indent: [];
    outdent: [];
    align: [align: FormatToolbarAlign];
    dir: [dir: 'auto' | 'ltr' | 'rtl'];
    calloutIcon: [icon: string | null];
    tableStyle: [patch: Partial<TableStyle>];
    cellBackground: [color: string | null];
}>();

const TURN_INTO: Array<{ type: BlockType; label: string; icon: unknown }> = [
    { type: 'paragraph', label: 'Paragraph', icon: Type },
    { type: 'heading_1', label: 'Heading 1', icon: Heading1 },
    { type: 'heading_2', label: 'Heading 2', icon: Heading2 },
    { type: 'heading_3', label: 'Heading 3', icon: Heading3 },
    { type: 'bulleted_list_item', label: 'Bulleted list', icon: List },
    { type: 'numbered_list_item', label: 'Numbered list', icon: ListOrdered },
    { type: 'to_do', label: 'To-do', icon: CheckSquare },
    { type: 'quote', label: 'Quote', icon: Quote },
    { type: 'callout', label: 'Callout', icon: Lightbulb },
];

const turnIntoOpen = ref(false);
const linkOpen = ref(false);
const colorOpen = ref(false);
const tableStyleOpen = ref(false);
const linkInput = ref('');

const isTable = () => props.state?.blockType === 'table';

watch(
    () => props.state?.blockId,
    () => {
        turnIntoOpen.value = false;
        linkOpen.value = false;
        colorOpen.value = false;
        tableStyleOpen.value = false;
    },
);

function turnIntoLabel(): string {
    return TURN_INTO.find((t) => t.type === props.state?.blockType)?.label ?? 'Paragraph';
}

function openLinkPopover(open: boolean): void {
    if (open) {
        linkInput.value = props.state?.currentLink ?? '';
        turnIntoOpen.value = false;
        colorOpen.value = false;
    }

    linkOpen.value = open;
}

function applyLink(): void {
    const url = linkInput.value.trim();
    emit('mark', 'link', url || null);
    linkOpen.value = false;
}

function onTurnIntoOpen(open: boolean): void {
    if (open) {
        linkOpen.value = false;
        colorOpen.value = false;
    }

    turnIntoOpen.value = open;
}

function onColorOpen(open: boolean): void {
    if (open) {
        linkOpen.value = false;
        turnIntoOpen.value = false;
        tableStyleOpen.value = false;
    }

    colorOpen.value = open;
}

function onTableStyleOpen(open: boolean): void {
    if (open) {
        linkOpen.value = false;
        turnIntoOpen.value = false;
        colorOpen.value = false;
    }

    tableStyleOpen.value = open;
}

const disabled = () => !props.state;
const blockActionsDisabled = () => disabled() || !!props.state?.multiBlock;
const tableActionsDisabled = () => disabled() || !isTable();
</script>

<template>
    <div class="border-b border-gray-100 bg-white px-4 py-2" data-pro-editor-toolbar>
        <div class="mx-auto flex max-w-4xl flex-wrap items-center gap-0.5">
            <EditorToolbarPopover
                v-model:open="turnIntoOpen"
                content-class="w-48 py-1"
                @update:open="onTurnIntoOpen"
            >
                <template #trigger>
                    <EditorToolbarButton wide :disabled="blockActionsDisabled() || isTable()">
                        {{ turnIntoLabel() }}
                        <ChevronDown class="size-3" />
                    </EditorToolbarButton>
                </template>
                <button
                    v-for="t in TURN_INTO"
                    :key="t.type"
                    type="button"
                    class="flex w-full items-center gap-2.5 px-3 py-2 text-start text-[13px] transition-colors"
                    :class="
                        t.type === state?.blockType
                            ? 'bg-indigo-50/60 text-indigo-600'
                            : 'text-gray-700 hover:bg-gray-50'
                    "
                    @click="emit('turnInto', t.type); turnIntoOpen = false"
                >
                    <component :is="t.icon" class="size-3.5 shrink-0 text-gray-400" />
                    <span class="flex-1">{{ t.label }}</span>
                    <Check
                        v-if="t.type === state?.blockType"
                        class="size-3.5 shrink-0 text-indigo-500"
                    />
                </button>
            </EditorToolbarPopover>

            <EditorToolbarSeparator />

            <EditorToolbarButton
                :active="!!state?.activeMarks.bold"
                :disabled="disabled() || !state?.hasSelection"
                title="Bold"
                @click="emit('mark', 'bold', !state?.activeMarks.bold)"
            >
                <Bold class="size-3.5" />
            </EditorToolbarButton>
            <EditorToolbarButton
                :active="!!state?.activeMarks.italic"
                :disabled="disabled() || !state?.hasSelection"
                title="Italic"
                @click="emit('mark', 'italic', !state?.activeMarks.italic)"
            >
                <Italic class="size-3.5" />
            </EditorToolbarButton>
            <EditorToolbarButton
                :active="!!state?.activeMarks.underline"
                :disabled="disabled() || !state?.hasSelection"
                title="Underline"
                @click="emit('mark', 'underline', !state?.activeMarks.underline)"
            >
                <Underline class="size-3.5" />
            </EditorToolbarButton>
            <EditorToolbarButton
                :active="!!state?.activeMarks.strikethrough"
                :disabled="disabled() || !state?.hasSelection"
                title="Strikethrough"
                @click="emit('mark', 'strikethrough', !state?.activeMarks.strikethrough)"
            >
                <Strikethrough class="size-3.5" />
            </EditorToolbarButton>
            <EditorToolbarButton
                :active="!!state?.activeMarks.code"
                :disabled="disabled() || !state?.hasSelection"
                title="Inline code"
                @click="emit('mark', 'code', !state?.activeMarks.code)"
            >
                <Code class="size-3.5" />
            </EditorToolbarButton>

            <EditorToolbarSeparator />

            <EditorToolbarPopover
                v-model:open="linkOpen"
                content-class="p-2"
                title="Link"
                @update:open="openLinkPopover"
            >
                <template #trigger>
                    <EditorToolbarButton
                        :active="linkOpen || !!state?.currentLink"
                        :disabled="disabled() || !state?.hasSelection"
                        title="Link"
                    >
                        <Link2 class="size-3.5" />
                    </EditorToolbarButton>
                </template>
                <div class="flex min-w-[260px] items-center gap-1.5">
                    <Input
                        v-model="linkInput"
                        class="h-8 flex-1 text-xs"
                        placeholder="https://..."
                        @keydown.enter.prevent="applyLink"
                        @keydown.escape="linkOpen = false"
                    />
                    <Button type="button" size="sm" class="h-8 px-3 text-xs" @click="applyLink">
                        Set
                    </Button>
                    <Button
                        v-if="state?.currentLink"
                        type="button"
                        variant="ghost"
                        size="sm"
                        class="h-8 px-2 text-xs text-red-500 hover:bg-red-50 hover:text-red-600"
                        @click="emit('mark', 'link', null); linkOpen = false"
                    >
                        Remove
                    </Button>
                </div>
            </EditorToolbarPopover>

            <EditorToolbarPopover
                v-model:open="colorOpen"
                content-class="p-2"
                @update:open="onColorOpen"
            >
                <template #trigger>
                    <EditorToolbarButton
                        :active="colorOpen || !!state?.currentColor || !!state?.currentHighlight"
                        :disabled="disabled() || !state?.hasSelection"
                        title="Color"
                    >
                        <Paintbrush class="size-3.5" />
                    </EditorToolbarButton>
                </template>
                <EditorToolbarColorPanel
                    :open="colorOpen"
                    :current-color="state?.currentColor"
                    :current-highlight="state?.currentHighlight"
                    @mark="(mark, value) => emit('mark', mark, value)"
                />
            </EditorToolbarPopover>

            <EditorToolbarButton :disabled="blockActionsDisabled()" title="Quote" @click="emit('turnInto', 'quote')">
                <Quote class="size-3.5" />
            </EditorToolbarButton>

            <template v-if="state?.blockType === 'callout'">
                <EditorToolbarSeparator />
                <IconEmojiPicker
                    :model-value="state.calloutIcon ?? '💡'"
                    align="start"
                    side="bottom"
                    @update:model-value="emit('calloutIcon', $event)"
                >
                    <template #trigger="{ selected, toggle }">
                        <EditorToolbarButton
                            wide
                            :disabled="blockActionsDisabled()"
                            title="Callout icon"
                            @click.stop="toggle"
                            @pointerdown.stop
                        >
                            <IconValueDisplay :icon="selected ?? '💡'" class="size-4" />
                            <ChevronDown class="size-3 text-gray-400" />
                        </EditorToolbarButton>
                    </template>
                </IconEmojiPicker>
            </template>

            <EditorToolbarSeparator />

            <EditorToolbarButton
                :active="state?.blockType === 'bulleted_list_item'"
                :disabled="blockActionsDisabled()"
                title="Bulleted list"
                @click="emit('turnInto', 'bulleted_list_item')"
            >
                <List class="size-3.5" />
            </EditorToolbarButton>
            <EditorToolbarButton
                :active="state?.blockType === 'numbered_list_item'"
                :disabled="blockActionsDisabled()"
                title="Numbered list"
                @click="emit('turnInto', 'numbered_list_item')"
            >
                <ListOrdered class="size-3.5" />
            </EditorToolbarButton>

            <EditorToolbarButton
                :active="state?.align === 'left'"
                :disabled="blockActionsDisabled()"
                title="Align left"
                @click="emit('align', 'left')"
            >
                <AlignLeft class="size-3.5" />
            </EditorToolbarButton>
            <EditorToolbarButton
                :active="state?.align === 'center'"
                :disabled="blockActionsDisabled()"
                title="Align center"
                @click="emit('align', 'center')"
            >
                <AlignCenter class="size-3.5" />
            </EditorToolbarButton>
            <EditorToolbarButton
                :active="state?.align === 'right'"
                :disabled="blockActionsDisabled()"
                title="Align right"
                @click="emit('align', 'right')"
            >
                <AlignRight class="size-3.5" />
            </EditorToolbarButton>
            <EditorToolbarButton
                v-if="isTable()"
                :active="state?.align === 'justify'"
                :disabled="tableActionsDisabled()"
                title="Justify"
                @click="emit('align', 'justify')"
            >
                <AlignJustify class="size-3.5" />
            </EditorToolbarButton>

            <EditorToolbarPopover
                v-if="isTable()"
                v-model:open="tableStyleOpen"
                content-class="p-2"
                @update:open="onTableStyleOpen"
            >
                <template #trigger>
                    <EditorToolbarButton
                        :active="tableStyleOpen"
                        :disabled="tableActionsDisabled()"
                        title="Table style"
                    >
                        <Paintbrush class="size-3.5" />
                    </EditorToolbarButton>
                </template>
                <EditorTableStylePanel
                    :open="tableStyleOpen"
                    :current-color="state?.currentColor"
                    :current-highlight="state?.currentHighlight"
                    :cell-background="state?.cellBackground"
                    :table-style="state?.tableStyle"
                    @mark="(mark, value) => emit('mark', mark, value)"
                    @cell-background="emit('cellBackground', $event)"
                    @table-style="emit('tableStyle', $event)"
                />
            </EditorToolbarPopover>

            <EditorToolbarSeparator v-if="!isTable()" />

            <EditorToolbarButton
                :active="state?.dir === 'auto'"
                :disabled="blockActionsDisabled() || isTable()"
                title="Auto direction"
                @click="emit('dir', 'auto')"
            >
                <Languages class="size-3.5" />
            </EditorToolbarButton>
            <EditorToolbarButton
                :active="state?.dir === 'ltr'"
                :disabled="blockActionsDisabled() || isTable()"
                title="Left-to-right"
                @click="emit('dir', 'ltr')"
            >
                <span class="text-[10px] font-bold">LTR</span>
            </EditorToolbarButton>
            <EditorToolbarButton
                :active="state?.dir === 'rtl'"
                :disabled="blockActionsDisabled() || isTable()"
                title="Right-to-left"
                @click="emit('dir', 'rtl')"
            >
                <span class="text-[10px] font-bold">RTL</span>
            </EditorToolbarButton>

            <EditorToolbarButton
                :disabled="blockActionsDisabled() || isTable() || (state?.indent ?? 0) <= 0"
                title="Decrease indent"
                @click="emit('outdent')"
            >
                <IndentDecrease class="size-3.5" />
            </EditorToolbarButton>
            <EditorToolbarButton
                :disabled="blockActionsDisabled() || isTable() || (state?.indent ?? 0) >= 6"
                title="Increase indent"
                @click="emit('indent')"
            >
                <IndentIncrease class="size-3.5" />
            </EditorToolbarButton>
        </div>
    </div>
</template>
