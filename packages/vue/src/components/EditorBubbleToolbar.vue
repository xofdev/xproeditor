<script setup lang="ts">
import {
    Bold,
    Check,
    ChevronDown,
    ChevronRight,
    Code,
    Copy,
    Files,
    Italic,
    Link2,
    Paintbrush,
    RemoveFormatting,
    Sparkles,
    Strikethrough,
    Trash2,
    Type,
    Heading1,
    Heading2,
    Heading3,
    List,
    ListOrdered,
    CheckSquare,
    Quote,
    Lightbulb,
    Bookmark,
    SquareMousePointer,
    Underline,
} from 'lucide-vue-next';
import { computed, nextTick, ref, watch } from 'vue';
import { syncThemeVars } from '@xproeditor/core';
import type { BlockType, MarkName } from '@xproeditor/core';
import { Button, Input } from '../ui';
import EditorToolbarColorPanel from './toolbar/EditorToolbarColorPanel.vue';

const props = withDefaults(
    defineProps<{
        position: { x: number; y: number };
        placement?: 'above' | 'beside';
        activeMarks: Partial<Record<MarkName, boolean>>;
        currentLink: string | null;
        currentColor?: string | null;
        currentHighlight?: string | null;
        blockType: BlockType;
        multiBlock?: boolean;
        mixedTypes?: boolean;
        aiEnabled?: boolean;
        /** Element still inside the editor's themed DOM scope — used to resync
         * `--xpe-*` variables onto this toolbar once it's teleported to `<body>`. */
        themeSource?: HTMLElement | null;
    }>(),
    {
        placement: 'above',
        multiBlock: false,
        mixedTypes: false,
        aiEnabled: false,
    },
);

const emit = defineEmits<{
    mark: [mark: MarkName, value: boolean | string | null];
    turnInto: [type: BlockType];
    clearFormatting: [];
    askAi: [];
    copy: [];
    duplicate: [];
    delete: [];
}>();

const toolbarEl = ref<HTMLElement | null>(null);
const coords = ref({ left: props.position.x, top: props.position.y });

const TURN_INTO: Array<{ type: BlockType; label: string; icon: unknown }> = [
    { type: 'paragraph', label: 'Text', icon: Type },
    { type: 'heading_1', label: 'Heading 1', icon: Heading1 },
    { type: 'heading_2', label: 'Heading 2', icon: Heading2 },
    { type: 'heading_3', label: 'Heading 3', icon: Heading3 },
    { type: 'bulleted_list_item', label: 'Bulleted list', icon: List },
    { type: 'numbered_list_item', label: 'Numbered list', icon: ListOrdered },
    { type: 'to_do', label: 'To-do', icon: CheckSquare },
    { type: 'toggle', label: 'Toggle list', icon: ChevronRight },
    { type: 'toggle_heading_1', label: 'Toggle heading 1', icon: Heading1 },
    { type: 'toggle_heading_2', label: 'Toggle heading 2', icon: Heading2 },
    { type: 'toggle_heading_3', label: 'Toggle heading 3', icon: Heading3 },
    { type: 'quote', label: 'Quote', icon: Quote },
    { type: 'callout', label: 'Callout', icon: Lightbulb },
    { type: 'button', label: 'Button', icon: SquareMousePointer },
    { type: 'bookmark', label: 'Web bookmark', icon: Bookmark },
];

const panel = ref<'none' | 'link' | 'color' | 'turninto'>('none');
const linkInput = ref('');
let lastPositionKey: string | null = null;

const turnIntoEntry = computed(() => TURN_INTO.find((t) => t.type === props.blockType));
const turnIntoLabel = computed(() =>
    props.mixedTypes ? 'Turn into' : (turnIntoEntry.value?.label ?? 'Text'),
);
const turnIntoIcon = computed(() => turnIntoEntry.value?.icon ?? Type);

function clampPosition(
    x: number,
    y: number,
    width: number,
    height: number,
    placement: 'above' | 'beside',
) {
    const pad = 8;
    if (placement === 'above') {
        return {
            left: Math.min(Math.max(pad + width / 2, x), window.innerWidth - pad - width / 2),
            top: Math.min(Math.max(height + pad + 8, y), window.innerHeight - pad),
        };
    }

    return {
        left: Math.min(Math.max(pad, x), Math.max(pad, window.innerWidth - width - pad)),
        top: Math.min(Math.max(pad, y), Math.max(pad, window.innerHeight - height - pad)),
    };
}

async function syncPosition(): Promise<void> {
    await nextTick();
    const el = toolbarEl.value;
    if (!el) {
        coords.value = { left: props.position.x, top: props.position.y };
        return;
    }

    const rect = el.getBoundingClientRect();
    coords.value = clampPosition(
        props.position.x,
        props.position.y,
        rect.width,
        rect.height,
        props.placement,
    );
}

watch(
    [() => props.position, () => props.themeSource, () => props.placement, panel, () => props.multiBlock],
    async () => {
        await nextTick();

        if (props.themeSource && toolbarEl.value) {
            syncThemeVars(props.themeSource, toolbarEl.value);
        }

        await syncPosition();
    },
    { immediate: true },
);

watch(
    () => props.position,
    (position) => {
        const key = `${position.x},${position.y},${props.placement}`;

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

function onToolbarMouseDown(e: MouseEvent): void {
    // Keep selection for mark buttons; allow focusing inputs (link URL).
    e.stopPropagation();
    const target = e.target as HTMLElement;
    if (!target.closest('input, textarea, select')) {
        e.preventDefault();
    }
}
</script>

<template>
    <Teleport to="body">
        <div
            ref="toolbarEl"
            data-pro-editor-toolbar
            class="xpe-menu fixed z-[70] flex flex-col items-stretch"
            :style="
                multiBlock
                    ? { left: `${coords.left}px`, top: `${coords.top}px` }
                    : {
                          left: `${coords.left}px`,
                          top: `${coords.top}px`,
                          transform: 'translate(-50%, calc(-100% - 8px))',
                      }
            "
            @mousedown="onToolbarMouseDown"
        >
            <!-- Multi-block Notion-like panel -->
            <div v-if="multiBlock" class="xpe-float xpe-bubble-panel">
                <button
                    type="button"
                    class="xpe-menu-item"
                    @click="panel = panel === 'turninto' ? 'none' : 'turninto'"
                >
                    <span class="xpe-menu-item__icon">
                        <component :is="turnIntoIcon" />
                    </span>
                    <span class="xpe-menu-item__label">{{ turnIntoLabel }}</span>
                    <ChevronRight class="xpe-menu-item__meta" />
                </button>

                <div class="xpe-menu-sep" />

                <div class="xpe-bubble-panel__row">
                    <button
                        type="button"
                        class="ebt-btn"
                        :class="{
                            'ebt-active': panel === 'color' || !!currentColor || !!currentHighlight,
                        }"
                        title="Color"
                        @click="openColorPanel"
                    >
                        <Paintbrush class="size-3.5" />
                    </button>
                    <button
                        type="button"
                        class="ebt-btn"
                        :class="{ 'ebt-active': activeMarks.bold }"
                        title="Bold (Ctrl+B)"
                        @click="emit('mark', 'bold', !activeMarks.bold)"
                    >
                        <Bold class="size-3.5" />
                    </button>
                    <button
                        type="button"
                        class="ebt-btn"
                        :class="{ 'ebt-active': activeMarks.italic }"
                        title="Italic (Ctrl+I)"
                        @click="emit('mark', 'italic', !activeMarks.italic)"
                    >
                        <Italic class="size-3.5" />
                    </button>
                    <button
                        type="button"
                        class="ebt-btn"
                        :class="{ 'ebt-active': activeMarks.underline }"
                        title="Underline (Ctrl+U)"
                        @click="emit('mark', 'underline', !activeMarks.underline)"
                    >
                        <Underline class="size-3.5" />
                    </button>
                    <button
                        type="button"
                        class="ebt-btn"
                        title="Clear formatting"
                        @click="emit('clearFormatting')"
                    >
                        <RemoveFormatting class="size-3.5" />
                    </button>
                </div>

                <div class="xpe-bubble-panel__row">
                    <button
                        type="button"
                        class="ebt-btn"
                        :class="{ 'ebt-active': panel === 'link' || !!currentLink }"
                        title="Link"
                        @click="openLinkPanel"
                    >
                        <Link2 class="size-3.5" />
                    </button>
                    <button
                        type="button"
                        class="ebt-btn"
                        :class="{ 'ebt-active': activeMarks.strikethrough }"
                        title="Strikethrough"
                        @click="emit('mark', 'strikethrough', !activeMarks.strikethrough)"
                    >
                        <Strikethrough class="size-3.5" />
                    </button>
                    <button
                        type="button"
                        class="ebt-btn"
                        :class="{ 'ebt-active': activeMarks.code }"
                        title="Inline code (Ctrl+E)"
                        @click="emit('mark', 'code', !activeMarks.code)"
                    >
                        <Code class="size-3.5" />
                    </button>
                </div>

                <div class="xpe-menu-sep" />

                <div class="xpe-bubble-panel__actions">
                    <button type="button" class="xpe-menu-item" @click="emit('copy')">
                        <span class="xpe-menu-item__icon">
                            <Copy />
                        </span>
                        <span class="xpe-menu-item__label">Copy</span>
                        <span class="xpe-menu-item__kbd">⌘C</span>
                    </button>
                    <button type="button" class="xpe-menu-item" @click="emit('duplicate')">
                        <span class="xpe-menu-item__icon">
                            <Files />
                        </span>
                        <span class="xpe-menu-item__label">Duplicate</span>
                        <span class="xpe-menu-item__kbd">⌘D</span>
                    </button>
                    <button
                        type="button"
                        class="xpe-menu-item xpe-menu-item--danger"
                        @click="emit('delete')"
                    >
                        <span class="xpe-menu-item__icon">
                            <Trash2 />
                        </span>
                        <span class="xpe-menu-item__label">Delete</span>
                        <span class="xpe-menu-item__kbd">⌫</span>
                    </button>
                </div>

                <template v-if="aiEnabled">
                    <div class="xpe-menu-sep" />
                    <button type="button" class="xpe-menu-item" @click="emit('askAi')">
                        <span class="xpe-menu-item__icon">
                            <Sparkles />
                        </span>
                        <span class="xpe-menu-item__label">Ask AI</span>
                    </button>
                </template>
            </div>

            <!-- Compact single-selection toolbar -->
            <div v-else class="xpe-float xpe-float--compact">
                <button
                    class="ebt-btn !w-auto gap-1 px-2 text-[12px] font-medium text-[var(--xpe-muted-foreground)]"
                    @click="panel = panel === 'turninto' ? 'none' : 'turninto'"
                >
                    {{ turnIntoLabel }}
                    <ChevronDown class="size-3" />
                </button>
                <div class="mx-0.5 h-5 w-px bg-[var(--xpe-border)]" />

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

                <div class="mx-0.5 h-5 w-px bg-[var(--xpe-border)]" />

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
                <button
                    class="ebt-btn"
                    title="Clear formatting"
                    @click="emit('clearFormatting')"
                >
                    <RemoveFormatting class="size-3.5" />
                </button>

                <template v-if="aiEnabled">
                    <div class="mx-0.5 h-5 w-px bg-[var(--xpe-border)]" />
                    <button class="ebt-btn" title="Ask AI" @click="emit('askAi')">
                        <Sparkles class="size-3.5" />
                    </button>
                </template>
            </div>

            <div
                v-if="panel === 'link'"
                class="xpe-float xpe-float--panel mt-1.5 flex items-center gap-1.5"
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
                    class="h-8 px-2 text-xs text-[var(--xpe-danger)] hover:bg-[var(--xpe-danger-muted)]"
                    @click="emit('mark', 'link', null); panel = 'none'"
                >
                    Remove
                </Button>
            </div>

            <div
                v-if="panel === 'color'"
                class="xpe-float xpe-float--panel mt-1.5"
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
                class="xpe-float xpe-menu-list mt-1.5 w-52 py-1.5"
            >
                <button
                    v-for="t in TURN_INTO"
                    :key="t.type"
                    type="button"
                    class="xpe-menu-item"
                    :class="{ 'xpe-menu-item--selected': !mixedTypes && t.type === blockType }"
                    @click="emit('turnInto', t.type); panel = 'none'"
                >
                    <span class="xpe-menu-item__icon">
                        <component :is="t.icon" />
                    </span>
                    <span class="xpe-menu-item__label">{{ t.label }}</span>
                    <Check
                        v-if="!mixedTypes && t.type === blockType"
                        class="xpe-menu-item__meta"
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
