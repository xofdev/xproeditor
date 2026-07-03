<script setup lang="ts">
import { ref } from 'vue'
import type { Block } from '@xproeditor/core'
import BlockEditor from './BlockEditor.vue'
import EditorFormatToolbar from './EditorFormatToolbar.vue'
import type { FormatToolbarState } from './EditorFormatToolbar.vue'

/**
 * Drop-in editor that wires {@link BlockEditor} together with the sticky
 * format toolbar and/or the Notion-like floating bubble toolbar, so most
 * apps never need to touch the lower-level pieces directly.
 *
 * `toolbar="fixed"` renders a sticky top toolbar (classic WYSIWYG feel).
 * `toolbar="floating"` (default) is the Notion-like experience: a bubble
 * toolbar appears on text selection and `/` opens the slash menu.
 * `toolbar="both"` shows both. `toolbar="none"` renders neither — build
 * your own chrome around {@link BlockEditor} using its exposed API.
 */
const props = withDefaults(
  defineProps<{
    modelValue: Block[]
    toolbar?: 'fixed' | 'floating' | 'both' | 'none'
    upload?: (file: File) => Promise<string>
    pickMedia?: (options: {
      accept: string[]
      title?: string
    }) => Promise<{ url: string; alt?: string; caption?: string } | null>
    editorDir?: 'ltr' | 'rtl'
    readonly?: boolean
  }>(),
  {
    toolbar: 'floating',
  },
)

const emit = defineEmits<{
  change: []
}>()

const editorRef = ref<InstanceType<typeof BlockEditor> | null>(null)
const formatState = ref<FormatToolbarState | null>(null)

const showFixedToolbar = () => props.toolbar === 'fixed' || props.toolbar === 'both'
const showBubbleToolbar = () => props.toolbar === 'floating' || props.toolbar === 'both'

defineExpose({
  undo: () => editorRef.value?.undo(),
  redo: () => editorRef.value?.redo(),
  focusFirst: () => editorRef.value?.focusFirst(),
  focusEnd: () => editorRef.value?.focusEnd(),
})
</script>

<template>
  <div class="xpe-pro-editor">
    <EditorFormatToolbar
      v-if="showFixedToolbar()"
      :state="formatState"
      @mark="(mark, value) => editorRef?.applyToolbarMark(mark, value)"
      @turn-into="(type) => editorRef?.turnIntoBlock(type)"
      @indent="() => editorRef?.indentFocusedBlock()"
      @outdent="() => editorRef?.outdentFocusedBlock()"
      @align="(align) => editorRef?.setFocusedAlign(align)"
      @dir="(dir) => editorRef?.setFocusedDir(dir)"
      @callout-icon="(icon) => editorRef?.setFocusedCalloutIcon(icon)"
      @table-style="(patch) => editorRef?.patchTableStyle(patch)"
      @cell-background="(color) => editorRef?.patchTableCellBackground(color)"
    />

    <BlockEditor
      ref="editorRef"
      :model-value="modelValue"
      :upload="upload"
      :pick-media="pickMedia"
      :editor-dir="editorDir"
      :readonly="readonly"
      :show-bubble-toolbar="showBubbleToolbar()"
      @change="emit('change')"
      @format-state="formatState = $event"
    />
  </div>
</template>
