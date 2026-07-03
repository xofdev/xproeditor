<script setup lang="ts">
import { ref, computed, nextTick, onMounted } from 'vue'
import type { Block } from '@xproeditor/core'

const props = defineProps<{ block: Block; readonly?: boolean }>()

const emit = defineEmits<{
  patch: [patch: Record<string, unknown>]
  arrowUp: []
  arrowDown: []
  removeSelf: []
  exitBelow: []
}>()

const LANGUAGES = [
  'plaintext', 'javascript', 'typescript', 'python', 'bash', 'json', 'yaml',
  'html', 'css', 'sql', 'go', 'rust', 'java', 'c', 'cpp', 'csharp', 'php',
  'ruby', 'swift', 'kotlin', 'dockerfile', 'markdown', 'xml', 'diff',
]

const textarea = ref<HTMLTextAreaElement | null>(null)
const code = computed(() => props.block.props.code ?? '')

function autoresize() {
  const ta = textarea.value

  if (!ta) {
return
}

  ta.style.height = 'auto'
  ta.style.height = `${ta.scrollHeight}px`
}

onMounted(autoresize)

function onInput(e: Event) {
  if (props.readonly) {
return
}

  emit('patch', { code: (e.target as HTMLTextAreaElement).value })
  autoresize()
}

function onKeydown(e: KeyboardEvent) {
  if (props.readonly) {
return
}

  const ta = textarea.value

  if (!ta) {
return
}

  if (e.key === 'Tab') {
    e.preventDefault()
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const value = ta.value.slice(0, start) + '  ' + ta.value.slice(end)
    emit('patch', { code: value })
    nextTick(() => {
      ta.selectionStart = ta.selectionEnd = start + 2
      autoresize()
    })

    return
  }

  if (e.key === 'Backspace' && ta.value === '') {
    e.preventDefault()
    emit('removeSelf')

    return
  }

  if (e.key === 'ArrowUp' && ta.selectionStart === 0 && ta.selectionEnd === 0 && !ta.value.slice(0, 1).includes('\n')) {
    const beforeCaret = ta.value.slice(0, ta.selectionStart)

    if (!beforeCaret.includes('\n')) {
      e.preventDefault()
      emit('arrowUp')
    }

    return
  }

  if (e.key === 'ArrowDown' && ta.selectionStart === ta.value.length) {
    e.preventDefault()
    emit('arrowDown')

    return
  }

  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault()
    emit('exitBelow')
  }
}

function focusAt(pos: number | 'start' | 'end' = 'end') {
  const ta = textarea.value

  if (!ta) {
return
}

  ta.focus()
  const offset = pos === 'start' ? 0 : pos === 'end' ? ta.value.length : pos
  ta.selectionStart = ta.selectionEnd = offset
}

defineExpose({ focusAt })
</script>

<template>
  <div class="ecb group/code rounded-xl overflow-hidden border border-gray-200" dir="ltr">
    <div class="flex items-center justify-between px-3 py-1.5 bg-[#16182a] border-b border-white/5">
      <select
        class="bg-transparent text-[11px] text-gray-400 outline-none cursor-pointer hover:text-gray-200"
        :value="block.props.language ?? 'plaintext'"
        :disabled="readonly"
        @change="emit('patch', { language: ($event.target as HTMLSelectElement).value })"
        @mousedown.stop
      >
        <option v-for="lang in LANGUAGES" :key="lang" :value="lang" class="bg-[#16182a]">{{ lang }}</option>
      </select>
      <span class="text-[10px] text-gray-500 opacity-0 group-hover/code:opacity-100 transition-opacity select-none">Ctrl+Enter to exit</span>
    </div>
    <textarea
      ref="textarea"
      :value="code"
      :readonly="readonly"
      class="block w-full resize-none outline-none px-4 py-3 bg-[#1e1e2e] text-[#cdd6f4] font-mono text-[13px] leading-relaxed"
      rows="1"
      placeholder="Write code..."
      spellcheck="false"
      @input="onInput"
      @keydown="onKeydown"
    />
  </div>
</template>

<style scoped>
.ecb textarea { min-height: 48px; tab-size: 2; }
</style>
