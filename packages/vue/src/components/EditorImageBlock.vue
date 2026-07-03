<script setup lang="ts">
import { FolderOpen, ImagePlus, Loader2, Upload } from 'lucide-vue-next';
import { ref } from 'vue';
import type { Block } from '@xproeditor/core';

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
    if (!props.upload || !file.type.startsWith('image/')) {
        return;
    }

    uploading.value = true;

    try {
        const url = await props.upload(file);
        emit('patch', { url });
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
</script>

<template>
    <div class="my-1">
        <div
            v-if="!block.props.url && !readonly"
            class="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-8 transition-colors"
            :class="dragOver ? 'border-indigo-400 bg-indigo-50/50' : 'border-gray-200 bg-gray-50 hover:border-gray-300'"
            @click="emit('select')"
            @dragover.prevent="dragOver = true"
            @dragleave="dragOver = false"
            @drop.prevent.stop="onDrop"
        >
            <Loader2 v-if="busy()" class="h-6 w-6 animate-spin text-indigo-500" />
            <ImagePlus v-else class="h-6 w-6 text-gray-400" />
            <span class="text-sm text-gray-500">
                {{ busy() ? 'Working...' : 'Add an image' }}
            </span>
            <div v-if="!busy()" class="flex flex-wrap items-center justify-center gap-2">
                <button
                    type="button"
                    class="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    @click.stop="fileInput?.click()"
                >
                    <Upload class="h-3.5 w-3.5" />
                    Upload
                </button>
                <button
                    v-if="pickMedia"
                    type="button"
                    class="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    @click.stop="pickFromLibrary"
                >
                    <FolderOpen class="h-3.5 w-3.5" />
                    Library
                </button>
            </div>
            <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="onFilePicked" />
        </div>

        <figure v-else class="group/img relative" :style="{ width: `${block.props.width ?? 100}%` }">
            <div @click="emit('select')">
                <img
                    :src="block.props.url"
                    :alt="block.props.caption || ''"
                    class="w-full rounded-xl transition-shadow"
                    :class="selected ? 'ring-2 ring-indigo-400' : ''"
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
                            ? 'bg-white text-gray-900'
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
                    class="mt-1.5 w-full bg-transparent text-center text-xs text-gray-400 outline-none placeholder:text-gray-300"
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
