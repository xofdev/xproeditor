<script setup lang="ts">
import { Check, Copy, WrapText } from 'lucide-vue-next'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import type { Block } from '@xproeditor/core'

const props = defineProps<{ block: Block; readonly?: boolean }>()

const emit = defineEmits<{
  patch: [patch: Record<string, unknown>]
  arrowUp: []
  arrowDown: []
  removeSelf: []
  exitBelow: []
}>()

const INDENT = '  '

const LANGUAGES: { id: string; label: string }[] = [
  { id: 'plaintext', label: 'Plain text' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'typescript', label: 'TypeScript' },
  { id: 'python', label: 'Python' },
  { id: 'bash', label: 'Bash' },
  { id: 'json', label: 'JSON' },
  { id: 'yaml', label: 'YAML' },
  { id: 'html', label: 'HTML' },
  { id: 'css', label: 'CSS' },
  { id: 'sql', label: 'SQL' },
  { id: 'go', label: 'Go' },
  { id: 'rust', label: 'Rust' },
  { id: 'java', label: 'Java' },
  { id: 'c', label: 'C' },
  { id: 'cpp', label: 'C++' },
  { id: 'csharp', label: 'C#' },
  { id: 'php', label: 'PHP' },
  { id: 'ruby', label: 'Ruby' },
  { id: 'swift', label: 'Swift' },
  { id: 'kotlin', label: 'Kotlin' },
  { id: 'dockerfile', label: 'Dockerfile' },
  { id: 'markdown', label: 'Markdown' },
  { id: 'xml', label: 'XML' },
  { id: 'diff', label: 'Diff' },
]

const textarea = ref<HTMLTextAreaElement | null>(null)
const code = computed(() => props.block.props.code ?? '')
const wrap = computed(() => Boolean(props.block.props.wrap))
const language = computed(() => props.block.props.language ?? 'plaintext')
const copied = ref(false)
let copiedTimer: ReturnType<typeof setTimeout> | null = null

function autoresize() {
  const ta = textarea.value
  if (!ta) return
  ta.style.height = 'auto'
  ta.style.height = `${ta.scrollHeight}px`
}

onMounted(autoresize)
watch([code, wrap], () => nextTick(autoresize))

onUnmounted(() => {
  if (copiedTimer) clearTimeout(copiedTimer)
})

function outdentLine(line: string): { text: string; removed: number } {
  if (line.startsWith('\t')) return { text: line.slice(1), removed: 1 }
  if (line.startsWith(INDENT)) return { text: line.slice(INDENT.length), removed: INDENT.length }
  if (line.startsWith(' ')) return { text: line.slice(1), removed: 1 }
  return { text: line, removed: 0 }
}

function onInput(e: Event) {
  if (props.readonly) return
  emit('patch', { code: (e.target as HTMLTextAreaElement).value })
}

function applyTab(shift: boolean) {
  const ta = textarea.value
  if (!ta) return

  const start = ta.selectionStart
  const end = ta.selectionEnd
  const value = ta.value

  if (!shift && start === end) {
    const next = value.slice(0, start) + INDENT + value.slice(end)
    emit('patch', { code: next })
    nextTick(() => {
      ta.selectionStart = ta.selectionEnd = start + INDENT.length
      autoresize()
    })
    return
  }

  const lineStart = value.lastIndexOf('\n', start - 1) + 1
  let lineEnd = end
  if (end === start || value[end - 1] !== '\n') {
    const nextNl = value.indexOf('\n', end)
    lineEnd = nextNl === -1 ? value.length : nextNl
  } else {
    lineEnd = end - 1
  }

  const blockText = value.slice(lineStart, lineEnd)
  const lines = blockText.split('\n')
  let startDelta = 0
  let totalDelta = 0

  const nextLines = lines.map((line, i) => {
    if (shift) {
      const { text, removed } = outdentLine(line)
      if (i === 0) startDelta = -Math.min(removed, Math.max(0, start - lineStart))
      totalDelta -= removed
      return text
    }
    if (i === 0) startDelta = INDENT.length
    totalDelta += INDENT.length
    return INDENT + line
  })

  const next = value.slice(0, lineStart) + nextLines.join('\n') + value.slice(lineEnd)
  emit('patch', { code: next })
  nextTick(() => {
    ta.selectionStart = Math.max(lineStart, start + startDelta)
    ta.selectionEnd = Math.max(ta.selectionStart, end + totalDelta)
    autoresize()
  })
}

function onKeydown(e: KeyboardEvent) {
  if (props.readonly) return

  const ta = textarea.value
  if (!ta) return

  if (e.key === 'Tab') {
    e.preventDefault()
    applyTab(e.shiftKey)
    return
  }

  if (e.key === 'Backspace' && ta.value === '') {
    e.preventDefault()
    emit('removeSelf')
    return
  }

  if (e.key === 'ArrowUp' && ta.selectionStart === 0 && ta.selectionEnd === 0) {
    const beforeCaret = ta.value.slice(0, ta.selectionStart)
    if (!beforeCaret.includes('\n')) {
      e.preventDefault()
      emit('arrowUp')
    }
    return
  }

  if (e.key === 'ArrowDown' && ta.selectionStart === ta.value.length && ta.selectionEnd === ta.value.length) {
    e.preventDefault()
    emit('arrowDown')
    return
  }

  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault()
    emit('exitBelow')
  }
}

async function copyCode() {
  const text = code.value
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const ta = textarea.value
    if (ta) {
      ta.focus()
      ta.select()
      document.execCommand('copy')
      const len = ta.value.length
      ta.selectionStart = ta.selectionEnd = len
    }
  }
  copied.value = true
  if (copiedTimer) clearTimeout(copiedTimer)
  copiedTimer = setTimeout(() => {
    copied.value = false
  }, 1600)
}

function focusAt(pos: number | 'start' | 'end' = 'end') {
  const ta = textarea.value
  if (!ta) return
  ta.focus()
  const offset = pos === 'start' ? 0 : pos === 'end' ? ta.value.length : pos
  ta.selectionStart = ta.selectionEnd = offset
}

defineExpose({ focusAt })
</script>

<template>
  <div class="ecb" :class="{ 'ecb--wrap': wrap }" dir="ltr">
    <div class="ecb-toolbar">
      <select
        class="ecb-lang"
        :value="language"
        :disabled="readonly"
        aria-label="Language"
        @change="emit('patch', { language: ($event.target as HTMLSelectElement).value })"
        @mousedown.stop
      >
        <option v-for="lang in LANGUAGES" :key="lang.id" :value="lang.id">{{ lang.label }}</option>
      </select>
      <div class="ecb-actions">
        <button
          type="button"
          class="ecb-action"
          :class="{ 'ecb-action--active': wrap }"
          :title="wrap ? 'Disable wrap' : 'Wrap lines'"
          :aria-label="wrap ? 'Disable wrap' : 'Wrap lines'"
          :aria-pressed="wrap"
          :disabled="readonly"
          @mousedown.prevent
          @click="emit('patch', { wrap: !wrap })"
        >
          <WrapText />
        </button>
        <button
          type="button"
          class="ecb-action"
          :class="{ 'ecb-action--ok': copied }"
          :title="copied ? 'Copied' : 'Copy code'"
          :aria-label="copied ? 'Copied' : 'Copy code'"
          @mousedown.prevent
          @click="copyCode"
        >
          <Check v-if="copied" />
          <Copy v-else />
        </button>
        <span class="ecb-hint">Ctrl+↵ exit</span>
      </div>
    </div>
    <textarea
      ref="textarea"
      :value="code"
      :readonly="readonly"
      class="ecb-input"
      rows="1"
      placeholder="Write code…"
      spellcheck="false"
      autocapitalize="off"
      autocorrect="off"
      autocomplete="off"
      @input="onInput"
      @keydown="onKeydown"
    />
  </div>
</template>
