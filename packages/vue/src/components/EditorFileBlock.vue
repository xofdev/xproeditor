<script setup lang="ts">
import { Download, FileText, FolderOpen, Loader2, Paperclip, Upload } from 'lucide-vue-next';
import { ref } from 'vue';
import type { Block } from '@xproeditor/core';
import { fileToObjectUrl, formatFileSize, mediaPropsFromFile } from '@xproeditor/core';

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

const uploading = ref(false);
const picking = ref(false);
const dragOver = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

async function uploadFile(file: File) {
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
        const result = await props.pickMedia({ accept: ['*/*'], title: 'Choose file' });

        if (result?.url) {
            emit('patch', {
                url: result.url,
                ...(result.caption ? { name: result.caption } : {}),
            });
        }
    } finally {
        picking.value = false;
    }
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

const busy = () => uploading.value || picking.value;
</script>

<template>
    <div class="my-1">
        <div
            v-if="!block.props.url && !readonly"
            class="flex flex-col items-center justify-center gap-3 rounded-[var(--xpe-radius)] border-2 border-dashed py-6 transition-colors"
            :class="dragOver ? 'border-[var(--xpe-ring)] bg-[var(--xpe-primary-muted)]' : 'border-[var(--xpe-border)] bg-[var(--xpe-muted)]'"
            @click="emit('select')"
            @dragover.prevent="dragOver = true"
            @dragleave="dragOver = false"
            @drop.prevent.stop="onDrop"
        >
            <div class="flex items-center gap-2 text-[var(--xpe-muted-foreground)]">
                <Loader2 v-if="busy()" class="h-5 w-5 animate-spin text-[var(--xpe-primary)]" />
                <Paperclip v-else class="h-5 w-5" />
                <span class="text-sm">{{ busy() ? 'Working...' : 'Attach a file' }}</span>
            </div>
            <div v-if="!busy()" class="flex flex-wrap items-center justify-center gap-2" @click.stop @mousedown.stop @pointerdown.stop>
                <button
                    type="button"
                    class="inline-flex items-center gap-1.5 rounded-lg border border-[var(--xpe-border)] bg-[var(--xpe-surface)] px-3 py-1.5 text-xs font-medium text-[var(--xpe-foreground)] hover:bg-[var(--xpe-surface-hover)]"
                    @click.stop="fileInput?.click()"
                >
                    <Upload class="h-3.5 w-3.5" />
                    Upload
                </button>
                <button
                    v-if="pickMedia"
                    type="button"
                    class="inline-flex items-center gap-1.5 rounded-lg border border-[var(--xpe-border)] bg-[var(--xpe-surface)] px-3 py-1.5 text-xs font-medium text-[var(--xpe-foreground)] hover:bg-[var(--xpe-surface-hover)]"
                    @click.stop="pickFromLibrary"
                >
                    <FolderOpen class="h-3.5 w-3.5" />
                    Library
                </button>
            </div>
            <input ref="fileInput" type="file" class="hidden" @change="onFilePicked" />
        </div>

        <div v-else class="group/file relative">
            <div
                class="flex items-center gap-3 rounded-[var(--xpe-radius)] border bg-[var(--xpe-muted)] px-3.5 py-2.5 transition-shadow"
                :class="selected ? 'border-[var(--xpe-ring)] ring-1 ring-[var(--xpe-ring)]' : 'border-[var(--xpe-border)]'"
                @click="emit('select')"
            >
                <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--xpe-surface)] text-[var(--xpe-primary)]">
                    <FileText class="h-5 w-5" />
                </span>
                <span class="min-w-0 flex-1">
                    <span class="block truncate text-sm font-medium text-[var(--xpe-foreground)]">
                        {{ block.props.name || 'File' }}
                    </span>
                    <span v-if="block.props.size" class="block text-xs text-[var(--xpe-muted-foreground)]">
                        {{ formatFileSize(block.props.size) }}
                    </span>
                </span>
                <a
                    :href="block.props.url"
                    :download="block.props.name ?? true"
                    class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--xpe-muted-foreground)] hover:bg-[var(--xpe-surface-hover)] hover:text-[var(--xpe-foreground)]"
                    title="Download"
                    @click.stop
                >
                    <Download class="h-4 w-4" />
                </a>
            </div>

            <div
                v-if="!readonly"
                class="absolute end-12 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded-lg bg-black/60 p-0.5 backdrop-blur group-hover/file:flex"
            >
                <button
                    class="rounded-md px-1.5 py-0.5 text-[10px] text-white/80 hover:bg-white/20"
                    title="Replace file"
                    @click.stop="fileInput?.click()"
                >
                    ↻
                </button>
                <button
                    class="rounded-md px-1.5 py-0.5 text-[10px] text-white/80 hover:bg-white/20"
                    title="Remove file"
                    @click.stop="emit('patch', { url: '', name: undefined, size: undefined, mime: undefined })"
                >
                    ✕
                </button>
                <input ref="fileInput" type="file" class="hidden" @change="onFilePicked" />
            </div>
        </div>
    </div>
</template>
