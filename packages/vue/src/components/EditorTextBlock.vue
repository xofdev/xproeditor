<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue'
import {
  getSelectionOffsets,
  setSelectionOffsets,
  isCaretOnFirstLine,
  isCaretOnLastLine,
  focusStart,
  focusEnd,
  spansToHtml,
  elementToSpans,
} from '@xproeditor/core'
import type { Block, InlineSpan, MarkName } from '@xproeditor/core'

const props = defineProps<{
  block: Block
  placeholder?: string
  readonly?: boolean
}>()

const emit = defineEmits<{
  input: [spans: InlineSpan[], caret: number | null]
  enter: [offsets: { start: number; end: number }]
  backspaceStart: []
  deleteEnd: []
  arrowUp: []
  arrowDown: []
  tab: [shift: boolean]
  format: [mark: MarkName]
  pasted: [payload: { html: string; text: string; files: File[]; offsets: { start: number; end: number } }]
  focus: []
  selectionPointerDown: [payload: { shiftKey: boolean; clientX: number; clientY: number }]
}>()

const el = ref<HTMLElement | null>(null)
let lastJson = ''

const typeClass = computed(() => `etb-${props.block.type}`)

function render() {
  if (!el.value) {
return
}

  const html = spansToHtml(props.block.content)

  if (el.value.innerHTML !== html) {
el.value.innerHTML = html
}

  lastJson = JSON.stringify(props.block.content)
}

onMounted(render)

watch(
  () => props.block.content,
  (content) => {
    const json = JSON.stringify(content)

    if (json === lastJson) {
return
}

    const focused = el.value && document.activeElement === el.value
    const offsets = focused && el.value ? getSelectionOffsets(el.value) : null
    render()

    if (focused && offsets && el.value) {
      setSelectionOffsets(el.value, offsets.start, offsets.end)
    }
  },
  { deep: true },
)

function readSpans(): InlineSpan[] {
  if (!el.value) {
return []
}

  let spans = elementToSpans(el.value)

  // A lone <br> is the contenteditable "empty" state
  if (spans.length === 1 && spans[0].text === '\n' && !spans[0].marks) {
spans = []
}

  return spans
}

function onPointerDown(e: PointerEvent) {
  if (props.readonly || !el.value || e.button !== 0) {
    return
  }

  emit('selectionPointerDown', {
    shiftKey: e.shiftKey,
    clientX: e.clientX,
    clientY: e.clientY,
  })
}

function onInput() {
  if (props.readonly || !el.value) {
return
}

  const spans = readSpans()
  lastJson = JSON.stringify(spans)
  const caret = getSelectionOffsets(el.value)?.start ?? null
  emit('input', spans, caret)
}

function onKeydown(e: KeyboardEvent) {
  if (props.readonly || !el.value || e.isComposing) {
return
}

  const mod = e.ctrlKey || e.metaKey

  if (mod && !e.altKey) {
    const key = e.key.toLowerCase()

    if (key === 'b') {
 e.preventDefault(); emit('format', 'bold');

 return 
}

    if (key === 'i') {
 e.preventDefault(); emit('format', 'italic');

 return 
}

    if (key === 'u') {
 e.preventDefault(); emit('format', 'underline');

 return 
}

    if (key === 'e') {
 e.preventDefault(); emit('format', 'code');

 return 
}

    if (key === 's' && e.shiftKey) {
 e.preventDefault(); emit('format', 'strikethrough');

 return 
}
  }

  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    const offsets = getSelectionOffsets(el.value) ?? { start: 0, end: 0 }
    emit('enter', offsets)

    return
  }

  if (e.key === 'Backspace') {
    const offsets = getSelectionOffsets(el.value)

    if (offsets && offsets.start === 0 && offsets.end === 0) {
      e.preventDefault()
      emit('backspaceStart')
    }

    return
  }

  if (e.key === 'Delete') {
    const offsets = getSelectionOffsets(el.value)
    const len = el.value.textContent?.length ?? 0

    if (offsets && offsets.start === offsets.end && offsets.start >= len) {
      e.preventDefault()
      emit('deleteEnd')
    }

    return
  }

  if (e.key === 'ArrowUp' && !e.shiftKey && isCaretOnFirstLine(el.value)) {
    e.preventDefault()
    emit('arrowUp')

    return
  }

  if (e.key === 'ArrowDown' && !e.shiftKey && isCaretOnLastLine(el.value)) {
    e.preventDefault()
    emit('arrowDown')

    return
  }

  if (e.key === 'Tab') {
    e.preventDefault()
    emit('tab', e.shiftKey)
  }
}

function onPaste(e: ClipboardEvent) {
  if (props.readonly || !el.value || !e.clipboardData) {
return
}

  e.preventDefault()
  const offsets = getSelectionOffsets(el.value) ?? { start: 0, end: 0 }
  emit('pasted', {
    html: e.clipboardData.getData('text/html'),
    text: e.clipboardData.getData('text/plain'),
    files: Array.from(e.clipboardData.files ?? []),
    offsets,
  })
}

// ─── Exposed API ──────────────────────────────────────────────────────────────

function focusAt(pos: number | 'start' | 'end') {
  if (!el.value) {
return
}

  if (pos === 'start') {
focusStart(el.value)
} else if (pos === 'end') {
focusEnd(el.value)
} else {
    el.value.focus()
    setSelectionOffsets(el.value, pos)
  }
}

function getSelection(): { start: number; end: number } | null {
  return el.value ? getSelectionOffsets(el.value) : null
}

function setSelection(start: number, end = start) {
  if (!el.value) {
return
}

  el.value.focus()
  setSelectionOffsets(el.value, start, end)
}

defineExpose({ focusAt, getSelection, setSelection, el })
</script>

<template>
  <div
    ref="el"
    :contenteditable="!readonly"
    class="etb outline-none w-full"
    :class="[typeClass, { 'etb-readonly': readonly }]"
    :dir="block.props.dir === 'ltr' || block.props.dir === 'rtl' ? block.props.dir : undefined"
    :style="block.props.align ? { textAlign: block.props.align } : undefined"
    :data-placeholder="placeholder"
    spellcheck="false"
    @input="onInput"
    @pointerdown="onPointerDown"
    @keydown="onKeydown"
    @paste="onPaste"
    @focus="emit('focus')"
  />
</template>

<style scoped>
.etb {
  min-height: 1.6em;
  line-height: 1.65;
  font-size: 16px;
  color: #1f2937;
  white-space: pre-wrap;
  word-break: break-word;
  caret-color: #4f46e5;
  --pro-editor-selection: rgb(35 131 226 / 0.18);
}
.etb::selection {
  background: var(--pro-editor-selection);
}
.etb-readonly {
  cursor: default;
  user-select: text;
}
.etb:empty::before {
  content: attr(data-placeholder);
  color: #c4c8d0;
  pointer-events: none;
  float: inline-start;
}

.etb-heading_1 { font-size: 28px; font-weight: 700; line-height: 1.3; color: #111827; }
.etb-heading_2 { font-size: 22px; font-weight: 650; line-height: 1.35; color: #111827; }
.etb-heading_3 { font-size: 18px; font-weight: 600; line-height: 1.4; color: #111827; }
.etb-quote { font-style: italic; color: #4b5563; }
.etb-callout { font-size: 15px; }

.etb :deep(code) {
  background: #f1f3f5;
  border: 1px solid #e9ecef;
  border-radius: 4px;
  padding: 1px 5px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.85em;
  color: #e0316e;
}
.etb :deep(a) {
  color: #4f46e5;
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}
</style>
