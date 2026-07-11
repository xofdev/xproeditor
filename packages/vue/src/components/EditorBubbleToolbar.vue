<script setup lang="ts">
import {
    Bold,
    Check,
    ChevronDown,
    Code,
    Italic,
    Link2,
    Paintbrush,
    Strikethrough,
    Type,
    Heading1,
    Heading2,
    Heading3,
    List,
    ListOrdered,
    CheckSquare,
    Quote,
    Lightbulb,
    Underline,
} from 'lucide-vue-next';
import { nextTick, ref, watch } from 'vue';
import { syncThemeVars } from '@xproeditor/core';
import type { BlockType, MarkName } from '@xproeditor/core';
import { Button, Input } from '../ui';
import EditorToolbarColorPanel from './toolbar/EditorToolbarColorPanel.vue';

const props = defineProps<{
    position: { x: number; y: number };
    activeMarks: Partial<Record<MarkName, boolean>>;
    currentLink: string | null;
    currentColor?: string | null;
    currentHighlight?: string | null;
    blockType: BlockType;
    /** Element still inside the editor's themed DOM scope — used to resync
     * `--xpe-*` variables onto this toolbar once it's teleported to `<body>`. */
    themeSource?: HTMLElement | null;
}>();

const toolbarEl = ref<HTMLElement | null>(null);

watch(
    [() => props.position, () => props.themeSource],
    async () => {
        await nextTick();

        if (props.themeSource && toolbarEl.value) {
            syncThemeVars(props.themeSource, toolbarEl.value);
        }
    },
    { immediate: true },
);

const emit = defineEmits<{
    mark: [mark: MarkName, value: boolean | string | null];
    turnInto: [type: BlockType];
}>();

const TURN_INTO: Array<{ type: BlockType; label: string; icon: unknown }> = [
    { type: 'paragraph', label: 'Text', icon: Type },
    { type: 'heading_1', label: 'Heading 1', icon: Heading1 },
    { type: 'heading_2', label: 'Heading 2', icon: Heading2 },
    { type: 'heading_3', label: 'Heading 3', icon: Heading3 },
    { type: 'bulleted_list_item', label: 'Bulleted list', icon: List },
    { type: 'numbered_list_item', label: 'Numbered list', icon: ListOrdered },
    { type: 'to_do', label: 'To-do', icon: CheckSquare },
    { type: 'quote', label: 'Quote', icon: Quote },
    { type: 'callout', label: 'Callout', icon: Lightbulb },
];

const panel = ref<'none' | 'link' | 'color' | 'turninto'>('none');
const linkInput = ref('');
let lastPositionKey: string | null = null;

watch(
    () => props.position,
    (position) => {
        // `position` is a fresh object on every parent update (e.g. a
        // same-range selectionchange), so only close an open panel when the
        // selection actually moved — Vue's default watch compares by
        // reference, which would close the color/link panel the instant a
        // swatch inside it is clicked.
        const key = `${position.x},${position.y}`;

        if (lastPositionKey !== null && lastPositionKey !== key) {
            panel.value = 'none';
        }

        lastPositionKey = key;
    },
);

function openLinkPanel(): void {
    linkInput.value = props.currentLink ?? '';
    panel.value = panel.value === 'link' ? 'none' : 'link';
}

function openColorPanel(): void {
    panel.value = panel.value === 'color' ? 'none' : 'color';
}

function applyLink(): void {
    const url = linkInput.value.trim();
    emit('mark', 'link', url || null);
    panel.value = 'none';
}

function turnIntoLabel(): string {
    return TURN_INTO.find((t) => t.type === props.blockType)?.label ?? 'Text';
}
</script>

<template>
    <Teleport to="body">
        <div
            ref="toolbarEl"
            class="fixed z-[70] flex flex-col items-stretch"
            :style="{
                left: `${position.x}px`,
                top: `${position.y}px`,
                transform: 'translate(-50%, calc(-100% - 8px))',
            }"
            @mousedown.prevent
        >
            <div
                class="flex items-center gap-0.5 rounded-xl border border-[var(--xpe-border)] bg-[var(--xpe-surface)] px-1 py-1 shadow-xl"
            >
                <button
                    class="ebt-btn !w-auto gap-1 px-2 text-[12px] font-medium text-[var(--xpe-muted-foreground)]"
                    @click="panel = panel === 'turninto' ? 'none' : 'turninto'"
                >
                    {{ turnIntoLabel() }}
                    <ChevronDown class="size-3" />
                </button>
                <div class="mx-0.5 h-5 w-px bg-[var(--xpe-muted)]" />

                <button
                    class="ebt-btn"
                    :class="{ 'ebt-active': activeMarks.bold }"
                    title="Bold (Ctrl+B)"
                    @click="emit('mark', 'bold', !activeMarks.bold)"
                >
                    <Bold class="size-3.5" />
                </button>
                <button
                    class="ebt-btn"
                    :class="{ 'ebt-active': activeMarks.italic }"
                    title="Italic (Ctrl+I)"
                    @click="emit('mark', 'italic', !activeMarks.italic)"
                >
                    <Italic class="size-3.5" />
                </button>
                <button
                    class="ebt-btn"
                    :class="{ 'ebt-active': activeMarks.underline }"
                    title="Underline (Ctrl+U)"
                    @click="emit('mark', 'underline', !activeMarks.underline)"
                >
                    <Underline class="size-3.5" />
                </button>
                <button
                    class="ebt-btn"
                    :class="{ 'ebt-active': activeMarks.strikethrough }"
                    title="Strikethrough"
                    @click="emit('mark', 'strikethrough', !activeMarks.strikethrough)"
                >
                    <Strikethrough class="size-3.5" />
                </button>
                <button
                    class="ebt-btn"
                    :class="{ 'ebt-active': activeMarks.code }"
                    title="Inline code (Ctrl+E)"
                    @click="emit('mark', 'code', !activeMarks.code)"
                >
                    <Code class="size-3.5" />
                </button>

                <div class="mx-0.5 h-5 w-px bg-[var(--xpe-muted)]" />

                <button
                    class="ebt-btn"
                    :class="{ 'ebt-active': panel === 'link' || !!currentLink }"
                    title="Link"
                    @click="openLinkPanel"
                >
                    <Link2 class="size-3.5" />
                </button>
                <button
                    class="ebt-btn"
                    :class="{
                        'ebt-active':
                            panel === 'color' || !!currentColor || !!currentHighlight,
                    }"
                    title="Color"
                    @click="openColorPanel"
                >
                    <Paintbrush class="size-3.5" />
                </button>
            </div>

            <div
                v-if="panel === 'link'"
                class="mt-1.5 flex items-center gap-1.5 rounded-xl border border-[var(--xpe-border)] bg-[var(--xpe-surface)] p-2 shadow-xl"
            >
                <Input
                    v-model="linkInput"
                    class="h-8 w-52 text-xs"
                    placeholder="https://..."
                    @mousedown.stop
                    @keydown.enter.prevent="applyLink"
                    @keydown.escape="panel = 'none'"
                />
                <Button type="button" size="sm" class="h-8 px-3 text-xs" @click="applyLink">
                    Set
                </Button>
                <Button
                    v-if="currentLink"
                    type="button"
                    variant="ghost"
                    size="sm"
                    class="h-8 px-2 text-xs text-[var(--xpe-danger)] hover:bg-red-50 hover:text-red-600"
                    @click="emit('mark', 'link', null); panel = 'none'"
                >
                    Remove
                </Button>
            </div>

            <div
                v-if="panel === 'color'"
                class="mt-1.5 rounded-xl border border-[var(--xpe-border)] bg-[var(--xpe-surface)] p-2 shadow-xl"
                @mousedown.stop
            >
                <EditorToolbarColorPanel
                    :current-color="currentColor"
                    :current-highlight="currentHighlight"
                    @mark="(mark, value) => emit('mark', mark, value)"
                />
            </div>

            <div
                v-if="panel === 'turninto'"
                class="mt-1.5 w-48 rounded-xl border border-[var(--xpe-border)] bg-[var(--xpe-surface)] py-1 shadow-xl"
            >
                <button
                    v-for="t in TURN_INTO"
                    :key="t.type"
                    type="button"
                    class="flex w-full items-center gap-2.5 px-3 py-2 text-start text-[13px] transition-colors"
                    :class="
                        t.type === blockType
                            ? 'bg-[var(--xpe-primary-muted)] text-[var(--xpe-primary)]'
                            : 'text-[var(--xpe-foreground)] hover:bg-[var(--xpe-surface-hover)]'
                    "
                    @click="emit('turnInto', t.type); panel = 'none'"
                >
                    <component :is="t.icon" class="size-3.5 shrink-0 text-[var(--xpe-muted-foreground)]" />
                    <span class="flex-1">{{ t.label }}</span>
                    <Check
                        v-if="t.type === blockType"
                        class="size-3.5 shrink-0 text-[var(--xpe-primary)]"
                    />
                </button>
            </div>
        </div>
    </Teleport>
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
.ebt-btn:hover {
    background: var(--xpe-muted, #f3f4f6);
    color: var(--xpe-foreground, #111827);
}
.ebt-active {
    background: var(--xpe-primary-muted, #eef2ff);
    color: var(--xpe-primary, #4f46e5);
}
</style>
