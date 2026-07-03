<script setup lang="ts">
import { FolderOpen, Link2, Loader2, Upload, Video } from 'lucide-vue-next';
import { nextTick, ref, watch } from 'vue';
import type { Block } from '@xproeditor/core';
import { isAllowedEmbedUrl, parseVideoEmbed } from '@xproeditor/core';

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
    if (!props.upload || !file.type.startsWith('video/')) {
        return;
    }

    uploading.value = true;

    try {
        const url = await props.upload(file);
        emit('patch', { url, provider: 'file' });
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
        const result = await props.pickMedia({ accept: ['video/*'], title: 'Choose video' });

        if (result?.url) {
            emit('patch', {
                url: result.url,
                provider: 'file',
                ...(result.caption ? { caption: result.caption } : {}),
            });
        }
    } finally {
        picking.value = false;
    }
}

function applyEmbed() {
    embedError.value = '';
    const parsed = parseVideoEmbed(embedInput.value);

    if (!parsed) {
        embedError.value = 'Enter a valid YouTube or Vimeo URL';

        return;
    }

    emit('patch', {
        url: parsed.embedUrl,
        provider: parsed.provider,
    });
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
const isEmbed = () => props.block.props.provider === 'youtube' || props.block.props.provider === 'vimeo';
const safeEmbedUrl = () => {
    const url = props.block.props.url ?? '';

    return isAllowedEmbedUrl(url) ? url : '';
};

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
            class="flex flex-col gap-3 rounded-xl border-2 border-dashed py-6 transition-colors"
            :class="dragOver ? 'border-indigo-400 bg-indigo-50/50' : 'border-gray-200 bg-gray-50 hover:border-gray-300'"
            @click="emit('select')"
            @dragover.prevent="dragOver = true"
            @dragleave="dragOver = false"
            @drop.prevent.stop="onDrop"
        >
            <div class="flex items-center justify-center gap-2 text-gray-500">
                <Loader2 v-if="busy()" class="h-5 w-5 animate-spin text-indigo-500" />
                <Video v-else class="h-5 w-5" />
                <span class="text-sm">{{ busy() ? 'Working...' : 'Add a video' }}</span>
            </div>

            <div v-if="!busy()" class="flex justify-center gap-1 px-4" @click.stop @mousedown.stop @pointerdown.stop>
                <button
                    type="button"
                    class="rounded-lg px-2.5 py-1 text-xs font-medium"
                    :class="mode === 'upload' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:bg-gray-100'"
                    @click.stop="mode = 'upload'"
                >
                    Upload
                </button>
                <button
                    v-if="pickMedia"
                    type="button"
                    class="rounded-lg px-2.5 py-1 text-xs font-medium"
                    :class="mode === 'library' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:bg-gray-100'"
                    @click.stop="mode = 'library'"
                >
                    Library
                </button>
                <button
                    type="button"
                    class="rounded-lg px-2.5 py-1 text-xs font-medium"
                    :class="mode === 'embed' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:bg-gray-100'"
                    @click.stop="mode = 'embed'"
                >
                    Embed
                </button>
            </div>

            <div v-if="!busy()" class="px-4" @click.stop @mousedown.stop @pointerdown.stop>
                <div v-if="mode === 'upload'" class="flex justify-center">
                    <button
                        type="button"
                        class="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                        @click.stop="fileInput?.click()"
                    >
                        <Upload class="h-3.5 w-3.5" />
                        Choose video file
                    </button>
                    <input ref="fileInput" type="file" accept="video/*" class="hidden" @change="onFilePicked" />
                </div>

                <div v-else-if="mode === 'library'" class="flex justify-center">
                    <button
                        type="button"
                        class="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                        @click.stop="pickFromLibrary"
                    >
                        <FolderOpen class="h-3.5 w-3.5" />
                        Open media library
                    </button>
                </div>

            <div v-else class="space-y-2" @click.stop @mousedown.stop @pointerdown.stop>
                    <div class="flex items-center gap-2">
                        <Link2 class="h-4 w-4 shrink-0 text-gray-400" />
                        <input
                            ref="embedInputRef"
                            v-model="embedInput"
                            type="url"
                            class="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-indigo-300"
                            placeholder="YouTube or Vimeo URL"
                            @keydown.enter.prevent="applyEmbed"
                        />
                        <button
                            type="button"
                            class="rounded-lg bg-gray-800 px-2.5 py-1.5 text-xs text-white"
                            @click.stop="applyEmbed"
                        >
                            Add
                        </button>
                    </div>
                    <p v-if="embedError" class="text-center text-xs text-red-500">{{ embedError }}</p>
                </div>
            </div>
        </div>

        <figure v-else class="group/video relative" :style="{ width: `${block.props.width ?? 100}%` }">
            <div @click="emit('select')">
                <div
                    class="overflow-hidden rounded-xl bg-black"
                    :class="selected ? 'ring-2 ring-indigo-400' : ''"
                >
                    <iframe
                        v-if="isEmbed() && safeEmbedUrl()"
                        :src="safeEmbedUrl()"
                        class="aspect-video w-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowfullscreen
                        title="Embedded video"
                    />
                    <video
                        v-else
                        :src="block.props.url"
                        class="aspect-video w-full"
                        controls
                        playsinline
                    />
                </div>
            </div>

            <div
                v-if="!readonly"
                class="absolute end-2 top-2 hidden items-center gap-0.5 rounded-lg bg-black/60 p-0.5 backdrop-blur group-hover/video:flex"
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
                    title="Remove video"
                    @click.stop="emit('patch', { url: '', provider: 'file' })"
                >
                    ✕
                </button>
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
