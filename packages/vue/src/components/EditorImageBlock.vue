<script setup lang="ts">
import { FolderOpen, ImagePlus, Link2, Loader2, Upload } from 'lucide-vue-next';
import { nextTick, ref, watch } from 'vue';
import type { Block } from '@xproeditor/core';
import { fileToObjectUrl, mediaPropsFromFile } from '@xproeditor/core';

const props = defineProps<{
    block: Block;
    selected?: boolean;
    readonly?: boolean;
    upload?: (file: File) => Promise<string>;
    pickMedia?: (options: {
        accept: string[];
        title?: string;
    }) => Promise<{ url: string; alt?: string; caption?: string } | null>;
}>();

const emit = defineEmits<{
    patch: [patch: Record<string, unknown>];
    select: [];
}>();

type InsertMode = 'upload' | 'library' | 'embed';

const mode = ref<InsertMode>('upload');
const uploading = ref(false);
const picking = ref(false);
const dragOver = ref(false);
const embedInput = ref('');
const embedError = ref('');
const embedInputRef = ref<HTMLInputElement | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);

async function uploadFile(file: File) {
    if (!file.type.startsWith('image/')) {
        return;
    }

    uploading.value = true;

    try {
        const url = await (props.upload ?? fileToObjectUrl)(file);
        emit('patch', mediaPropsFromFile(file, url));
    } finally {
        uploading.value = false;
    }
}

async function pickFromLibrary() {
    if (!props.pickMedia) {
        return;
    }

    picking.value = true;

    try {
        const result = await props.pickMedia({ accept: ['image/*'], title: 'Choose image' });

        if (result?.url) {
            emit('patch', {
                url: result.url,
                ...(result.caption ? { caption: result.caption } : {}),
            });
        }
    } finally {
        picking.value = false;
    }
}

function applyEmbed() {
    embedError.value = '';
    const url = embedInput.value.trim();

    if (!/^https?:\/\//i.test(url)) {
        embedError.value = 'Enter a valid image URL';

        return;
    }

    emit('patch', { url });
    embedInput.value = '';
}

function onFilePicked(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];

    if (file) {
        uploadFile(file);
    }
}

function onDrop(e: DragEvent) {
    dragOver.value = false;
    const file = e.dataTransfer?.files?.[0];

    if (file) {
        uploadFile(file);
    }
}

const widths = [40, 60, 80, 100];
const busy = () => uploading.value || picking.value;

watch(mode, (next) => {
    if (next === 'embed') {
        nextTick(() => embedInputRef.value?.focus());
    }
});
</script>

<template>
    <div class="my-1">
        <div
            v-if="!block.props.url && !readonly"
            class="flex flex-col gap-3 rounded-[var(--xpe-radius)] border-2 border-dashed py-6 transition-colors"
            :class="dragOver ? 'border-[var(--xpe-ring)] bg-[var(--xpe-primary-muted)]' : 'border-[var(--xpe-border)] bg-[var(--xpe-muted)]'"
            @click="emit('select')"
            @dragover.prevent="dragOver = true"
            @dragleave="dragOver = false"
            @drop.prevent.stop="onDrop"
        >
            <div class="flex items-center justify-center gap-2 text-[var(--xpe-muted-foreground)]">
                <Loader2 v-if="busy()" class="h-5 w-5 animate-spin text-[var(--xpe-primary)]" />
                <ImagePlus v-else class="h-5 w-5" />
                <span class="text-sm">{{ busy() ? 'Working...' : 'Add an image' }}</span>
            </div>

            <div v-if="!busy()" class="flex justify-center gap-1 px-4" @click.stop @mousedown.stop @pointerdown.stop>
                <button
                    type="button"
                    class="rounded-lg px-2.5 py-1 text-xs font-medium"
                    :class="mode === 'upload' ? 'bg-[var(--xpe-primary-muted)] text-[var(--xpe-primary)]' : 'text-[var(--xpe-muted-foreground)] hover:bg-[var(--xpe-surface-hover)]'"
                    @click.stop="mode = 'upload'"
                >
                    Upload
                </button>
                <button
                    v-if="pickMedia"
                    type="button"
                    class="rounded-lg px-2.5 py-1 text-xs font-medium"
                    :class="mode === 'library' ? 'bg-[var(--xpe-primary-muted)] text-[var(--xpe-primary)]' : 'text-[var(--xpe-muted-foreground)] hover:bg-[var(--xpe-surface-hover)]'"
                    @click.stop="mode = 'library'"
                >
                    Library
                </button>
                <button
                    type="button"
                    class="rounded-lg px-2.5 py-1 text-xs font-medium"
                    :class="mode === 'embed' ? 'bg-[var(--xpe-primary-muted)] text-[var(--xpe-primary)]' : 'text-[var(--xpe-muted-foreground)] hover:bg-[var(--xpe-surface-hover)]'"
                    @click.stop="mode = 'embed'"
                >
                    Link
                </button>
            </div>

            <div v-if="!busy()" class="px-4" @click.stop @mousedown.stop @pointerdown.stop>
                <div v-if="mode === 'upload'" class="flex justify-center">
                    <button
                        type="button"
                        class="inline-flex items-center gap-1.5 rounded-lg border border-[var(--xpe-border)] bg-[var(--xpe-surface)] px-3 py-1.5 text-xs font-medium text-[var(--xpe-foreground)] hover:bg-[var(--xpe-surface-hover)]"
                        @click.stop="fileInput?.click()"
                    >
                        <Upload class="h-3.5 w-3.5" />
                        Choose image
                    </button>
                    <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="onFilePicked" />
                </div>

                <div v-else-if="mode === 'library'" class="flex justify-center">
                    <button
                        type="button"
                        class="inline-flex items-center gap-1.5 rounded-lg border border-[var(--xpe-border)] bg-[var(--xpe-surface)] px-3 py-1.5 text-xs font-medium text-[var(--xpe-foreground)] hover:bg-[var(--xpe-surface-hover)]"
                        @click.stop="pickFromLibrary"
                    >
                        <FolderOpen class="h-3.5 w-3.5" />
                        Open media library
                    </button>
                </div>

                <div v-else class="space-y-2" @click.stop @mousedown.stop @pointerdown.stop>
                    <div class="flex items-center gap-2">
                        <Link2 class="h-4 w-4 shrink-0 text-[var(--xpe-muted-foreground)]" />
                        <input
                            ref="embedInputRef"
                            v-model="embedInput"
                            type="url"
                            class="min-w-0 flex-1 rounded-lg border border-[var(--xpe-border)] bg-[var(--xpe-surface)] px-2.5 py-1.5 text-xs text-[var(--xpe-foreground)] outline-none focus:border-[var(--xpe-ring)]"
                            placeholder="Paste an image URL"
                            @keydown.enter.prevent="applyEmbed"
                        />
                        <button
                            type="button"
                            class="rounded-lg bg-[var(--xpe-primary)] px-2.5 py-1.5 text-xs text-[var(--xpe-primary-foreground)]"
                            @click.stop="applyEmbed"
                        >
                            Add
                        </button>
                    </div>
                    <p v-if="embedError" class="text-center text-xs text-[var(--xpe-danger)]">{{ embedError }}</p>
                </div>
            </div>
        </div>

        <figure v-else class="group/img relative" :style="{ width: `${block.props.width ?? 100}%` }">
            <div @click="emit('select')">
                <img
                    :src="block.props.url"
                    :alt="block.props.caption || ''"
                    class="w-full rounded-[var(--xpe-radius)] transition-shadow"
                    :class="selected ? 'ring-2 ring-[var(--xpe-ring)]' : ''"
                    draggable="false"
                />
            </div>
            <div
                v-if="!readonly"
                class="absolute end-2 top-2 hidden items-center gap-0.5 rounded-lg bg-black/60 p-0.5 backdrop-blur group-hover/img:flex"
            >
                <button
                    v-for="w in widths"
                    :key="w"
                    class="rounded-md px-1.5 py-0.5 text-[10px] font-medium transition-colors"
                    :class="
                        (block.props.width ?? 100) === w
                            ? 'bg-[var(--xpe-surface)] text-[var(--xpe-foreground)]'
                            : 'text-white/80 hover:bg-white/20'
                    "
                    @click.stop="emit('patch', { width: w })"
                >
                    {{ w }}%
                </button>
                <button
                    class="rounded-md px-1.5 py-0.5 text-[10px] text-white/80 hover:bg-white/20"
                    title="Replace upload"
                    @click.stop="fileInput?.click()"
                >
                    ↻
                </button>
                <button
                    v-if="pickMedia"
                    class="rounded-md px-1.5 py-0.5 text-[10px] text-white/80 hover:bg-white/20"
                    title="Pick from library"
                    @click.stop="pickFromLibrary"
                >
                    Lib
                </button>
                <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="onFilePicked" />
            </div>
            <figcaption @mousedown.stop @click.stop @pointerdown.stop>
                <input
                    class="mt-1.5 w-full bg-transparent text-center text-xs text-[var(--xpe-muted-foreground)] outline-none placeholder:opacity-60"
                    :value="block.props.caption ?? ''"
                    placeholder="Add caption..."
                    :readonly="readonly"
                    @focus="emit('select')"
                    @input="emit('patch', { caption: ($event.target as HTMLInputElement).value })"
                />
            </figcaption>
        </figure>
    </div>
</template>
