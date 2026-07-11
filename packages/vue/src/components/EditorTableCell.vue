<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import {
  focusEnd,
  focusStart,
  getSelectionOffsets,
  isCaretOnFirstLine,
  isCaretOnLastLine,
  setSelectionOffsets,
  elementToSpans,
  spansToHtml,
  normalizeSpans,
} from '@xproeditor/core'
import type { InlineSpan, MarkName, TableCell, TableCellAlign } from '@xproeditor/core'

const props = defineProps<{
  cell: TableCell
  rowIdx: number
  colIdx: number
  isHeader?: boolean
  selected?: boolean
  readonly?: boolean
  cellStyle?: Record<string, string>
}>()

const emit = defineEmits<{
  input: [spans: InlineSpan[], caret: number | null]
  focus: [payload: { row: number; col: number; shiftKey: boolean }]
  format: [mark: MarkName]
  tab: [shift: boolean]
  arrowUp: []
  arrowDown: []
  arrowLeft: []
  arrowRight: []
  cellClick: [payload: { row: number; col: number; shiftKey: boolean }]
}>()

const el = ref<HTMLElement | null>(null)
let lastJson = ''

function render() {
  if (!el.value) {
    return
  }

  const html = spansToHtml(normalizeSpans(props.cell.content))

  if (el.value.innerHTML !== html) {
    el.value.innerHTML = html || ''
  }

  lastJson = JSON.stringify(props.cell.content)
}

onMounted(render)

watch(
  () => props.cell.content,
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

  if (spans.length === 1 && spans[0].text === '\n' && !spans[0].marks) {
    spans = []
  }

  return spans
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

function onPointerDown(e: PointerEvent) {
  if (props.readonly || e.button !== 0) {
    return
  }

  emit('cellClick', { row: props.rowIdx, col: props.colIdx, shiftKey: e.shiftKey })
}

function onFocus(e: FocusEvent) {
  emit('focus', {
    row: props.rowIdx,
    col: props.colIdx,
    shiftKey: (e as FocusEvent & { shiftKey?: boolean }).shiftKey ?? false,
  })
}

function onKeydown(e: KeyboardEvent) {
  if (props.readonly || !el.value || e.isComposing) {
    return
  }

  const mod = e.ctrlKey || e.metaKey

  if (mod && !e.altKey) {
    const key = e.key.toLowerCase()

    if (key === 'b') {
      e.preventDefault()
      emit('format', 'bold')

      return
    }

    if (key === 'i') {
      e.preventDefault()
      emit('format', 'italic')

      return
    }

    if (key === 'u') {
      e.preventDefault()
      emit('format', 'underline')

      return
    }

    if (key === 'e') {
      e.preventDefault()
      emit('format', 'code')

      return
    }

    if (key === 's' && e.shiftKey) {
      e.preventDefault()
      emit('format', 'strikethrough')

      return
    }
  }

  if (e.key === 'Tab') {
    e.preventDefault()
    emit('tab', e.shiftKey)

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

  const offsets = getSelectionOffsets(el.value)
  const len = el.value.textContent?.length ?? 0

  if (e.key === 'ArrowLeft' && !e.shiftKey && offsets && offsets.start === 0 && offsets.end === 0) {
    e.preventDefault()
    emit('arrowLeft')

    return
  }

  if (e.key === 'ArrowRight' && !e.shiftKey && offsets && offsets.start === len && offsets.end === len) {
    e.preventDefault()
    emit('arrowRight')
  }
}

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
  <component
    :is="isHeader ? 'th' : 'td'"
    class="etc-cell border border-gray-150 p-0 relative min-w-[100px] align-top"
    :class="[
      isHeader ? 'bg-[var(--xpe-muted)]/80' : '',
      selected ? 'ring-2 ring-[var(--xpe-ring)] ring-inset' : '',
    ]"
    :style="cellStyle"
    :colspan="cell.colspan && cell.colspan > 1 ? cell.colspan : undefined"
    :rowspan="cell.rowspan && cell.rowspan > 1 ? cell.rowspan : undefined"
    @click.stop
  >
    <div
      ref="el"
      :contenteditable="!readonly"
      class="etc-editor outline-none w-full px-3 py-2 text-sm text-[var(--xpe-foreground)] min-h-[2.25rem]"
      :class="isHeader ? 'font-semibold text-[var(--xpe-foreground)]' : ''"
      :style="cell.align ? { textAlign: cell.align as TableCellAlign } : undefined"
      dir="auto"
      spellcheck="false"
      @input="onInput"
      @pointerdown="onPointerDown"
      @focus="onFocus"
      @keydown="onKeydown"
    />
  </component>
</template>

<style scoped>
.etc-editor {
  white-space: pre-wrap;
  word-break: break-word;
  caret-color: var(--xpe-primary, #4f46e5);
}
.etc-editor:empty::before {
  content: ' ';
  pointer-events: none;
}
.etc-editor :deep(code) {
  background: var(--xpe-muted, #f1f3f5);
  border: 1px solid var(--xpe-border, #e9ecef);
  border-radius: 4px;
  padding: 1px 5px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.85em;
  color: #e0316e;
}
.etc-editor :deep(a) {
  color: var(--xpe-primary, #4f46e5);
  text-decoration: underline;
  text-underline-offset: 2px;
}
.border-gray-150 {
  border-color: #eceef1;
}
</style>
