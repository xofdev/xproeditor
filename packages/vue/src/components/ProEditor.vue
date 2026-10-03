<script setup lang="ts">
import { ref, toRef } from 'vue'
import type { AICommand, AITransport, Block, BlockPatch, DocumentStats, EditorDictionaryOverrides, EditorFocusTarget } from '@xproeditor/core'
import { provideEditorI18n } from '../i18n'
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
    fetchBookmarkMeta?: (url: string) => Promise<{
      title?: string
      description?: string
      favicon?: string
      image?: string
    } | null | undefined>
    editorDir?: 'ltr' | 'rtl'
    readonly?: boolean
    ai?: {
      transport: AITransport
      commands?: AICommand[]
    }
    /** Placeholder shown in the focused empty paragraph. */
    placeholder?: string
    /** Browser spellcheck in text blocks (default `true`). */
    spellcheck?: boolean
    /** Focus the editor on mount (`true` = end of document). */
    autofocus?: boolean | 'start' | 'end'
    /** UI language (`'en'` default, `'fa'` built in). */
    locale?: string
    /** Override any UI string, or supply a whole new language. */
    dictionary?: EditorDictionaryOverrides
  }>(),
  {
    toolbar: 'floating',
    spellcheck: true,
  },
)

const emit = defineEmits<{
  change: []
  /** `upload` rejected for a pasted/dropped file (the file is skipped). */
  'upload-error': [error: unknown, file: File]
}>()

provideEditorI18n(toRef(props, 'locale'), toRef(props, 'dictionary'))

const editorRef = ref<InstanceType<typeof BlockEditor> | null>(null)
const formatState = ref<FormatToolbarState | null>(null)

const showFixedToolbar = () => props.toolbar === 'fixed' || props.toolbar === 'both'
const showBubbleToolbar = () => props.toolbar === 'floating' || props.toolbar === 'both'

defineExpose({
  undo: () => editorRef.value?.undo(),
  redo: () => editorRef.value?.redo(),
  openAIMenu: () => editorRef.value?.openAIMenu(),
  focusFirst: () => editorRef.value?.focusFirst(),
  focusEnd: () => editorRef.value?.focusEnd(),
  focus: (target?: EditorFocusTarget) => editorRef.value?.focus(target),
  getBlocks: (): Block[] => editorRef.value?.getBlocks() ?? [],
  setBlocks: (blocks: Block[], options?: { history?: 'push' | 'reset' }) => editorRef.value?.setBlocks(blocks, options),
  insertBlocks: (blocks: Block[], position?: { after?: string; before?: string }): string[] =>
    editorRef.value?.insertBlocks(blocks, position) ?? [],
  updateBlock: (id: string, patch: BlockPatch): boolean => editorRef.value?.updateBlock(id, patch) ?? false,
  removeBlocks: (ids: string[]) => editorRef.value?.removeBlocks(ids),
  getMarkdown: (): string => editorRef.value?.getMarkdown() ?? '',
  getHTML: (): string => editorRef.value?.getHTML() ?? '',
  getText: (): string => editorRef.value?.getText() ?? '',
  getStats: (): DocumentStats => editorRef.value?.getStats() ?? {
    blocks: 0,
    words: 0,
    characters: 0,
    charactersNoSpaces: 0,
    readingTimeMinutes: 0,
  },
})
</script>

<template>
  <div class="xpe-pro-editor">
    <EditorFormatToolbar
      v-if="showFixedToolbar()"
      :state="formatState"
      :ai-enabled="typeof props.ai?.transport === 'function'"
      @mark="(mark, value) => editorRef?.applyToolbarMark(mark, value)"
      @turn-into="(type) => editorRef?.turnIntoBlock(type)"
      @indent="() => editorRef?.indentFocusedBlock()"
      @outdent="() => editorRef?.outdentFocusedBlock()"
      @align="(align) => editorRef?.setFocusedAlign(align)"
      @dir="(dir) => editorRef?.setFocusedDir(dir)"
      @callout-icon="(icon) => editorRef?.setFocusedCalloutIcon(icon)"
      @table-style="(patch) => editorRef?.patchTableStyle(patch)"
      @cell-background="(color) => editorRef?.patchTableCellBackground(color)"
      @ask-ai="() => editorRef?.openAIMenu()"
    />

    <BlockEditor
      ref="editorRef"
      :model-value="modelValue"
      :upload="upload"
      :pick-media="pickMedia"
      :fetch-bookmark-meta="fetchBookmarkMeta"
      :editor-dir="editorDir"
      :readonly="readonly"
      :show-bubble-toolbar="showBubbleToolbar()"
      :ai="props.ai"
      :placeholder="placeholder"
      :spellcheck="spellcheck"
      :autofocus="autofocus"
      :locale="locale"
      :dictionary="dictionary"
      @change="emit('change')"
      @upload-error="(error, file) => emit('upload-error', error, file)"
      @format-state="formatState = $event"
    />
  </div>
</template>
