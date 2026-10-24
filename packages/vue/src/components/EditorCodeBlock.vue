<script setup lang="ts">
import { Check, ChevronDown, Copy, ListOrdered, WrapText } from 'lucide-vue-next'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import {
  CODE_LANGUAGES,
  codeLanguageLabel,
  indentCode,
  newlineInCode,
  normalizeCodeLanguage,
  splitHighlightedLines,
  toggleCodeComment,
  type CodeEdit,
} from '@xproeditor/core'
import type { Block } from '@xproeditor/core'
import { useEditorDictionary } from '../i18n'
import { modKeyLabel } from '../utils/shortcut'
import { detectLanguage, highlightCode, isHighlighterReady, loadHighlighter } from '../utils/highlight'

/**
 * Code block: a transparent `<textarea>` over a syntax-highlighted `<pre>`
 * with identical metrics, so you type into a native, accessible field while
 * seeing live colours. Line numbers come from CSS counters on the
 * highlighted lines, so they stay aligned in wrap mode too.
 */
const dictionary = useEditorDictionary()
const t = computed(() => dictionary.value.code)

const props = defineProps<{ block: Block; readonly?: boolean }>()

const emit = defineEmits<{
  patch: [patch: Record<string, unknown>]
  arrowUp: []
  arrowDown: []
  removeSelf: []
  exitBelow: []
}>()

const LANGUAGE_IDS = CODE_LANGUAGES.map(lang => lang.id)

const textarea = ref<HTMLTextAreaElement | null>(null)
const copied = ref(false)
const detected = ref<string | null>(null)
const highlighterReady = ref(isHighlighterReady())
const timers: ReturnType<typeof setTimeout>[] = []

const code = computed(() => props.block.props.code ?? '')
const wrap = computed(() => Boolean(props.block.props.wrap))
const lineNumbers = computed(() => Boolean(props.block.props.lineNumbers))
const language = computed(() => normalizeCodeLanguage(props.block.props.language))
const fileName = computed(() => props.block.props.caption ?? '')
const known = computed(() => CODE_LANGUAGES.some(lang => lang.id === language.value))
const exitHint = computed(() => t.value.exitHint.replace(/^Ctrl\+/, modKeyLabel()))

const lines = computed(() => {
  // Re-highlight once the lazy highlight.js chunk has loaded.
  void highlighterReady.value

  return splitHighlightedLines(highlightCode(code.value, language.value))
})
const linesHtml = computed(() => lines.value.map(line => `<span class="ecb-line">${line || '<br>'}</span>`).join(''))
const gutter = computed(() => `${Math.max(2, String(lines.value.length).length)}ch`)

onMounted(() => {
  if (!highlighterReady.value) {
    void loadHighlighter().then((hl) => {
      if (hl) {
        highlighterReady.value = true
      }
    })
  }
})

onUnmounted(() => timers.forEach(clearTimeout))

function later(fn: () => void, ms: number) {
  timers.push(setTimeout(fn, ms))
}

/**
 * Write the edit to the textarea synchronously, then sync the block. Going
 * through state first and restoring the selection a frame later would let
 * keys typed in that frame land on the old value and be overwritten.
 */
function apply(edit: CodeEdit) {
  const ta = textarea.value

  if (!ta) {
    return
  }

  ta.value = edit.value
  ta.setSelectionRange(edit.selectionStart, edit.selectionEnd)
  emit('patch', { code: edit.value })
}

function onInput(e: Event) {
  if (!props.readonly) {
    emit('patch', { code: (e.target as HTMLTextAreaElement).value })
  }
}

function onKeydown(e: KeyboardEvent) {
  const ta = textarea.value

  if (props.readonly || !ta || e.isComposing) {
    return
  }

  const { selectionStart: start, selectionEnd: end, value } = ta
  const mod = e.metaKey || e.ctrlKey

  if (e.key === 'Tab') {
    e.preventDefault()
    apply(indentCode(value, start, end, e.shiftKey))
    return
  }

  if (e.key === 'Enter' && mod) {
    e.preventDefault()
    emit('exitBelow')
    return
  }

  if (e.key === 'Enter' && !e.shiftKey && !e.altKey) {
    e.preventDefault()
    apply(newlineInCode(value, start, end))
    return
  }

  if (mod && e.key === '/') {
    const edit = toggleCodeComment(value, start, end, language.value)

    if (edit) {
      e.preventDefault()
      apply(edit)
    }

    return
  }

  if (e.key === 'Backspace' && value === '') {
    e.preventDefault()
    emit('removeSelf')
    return
  }

  if (e.key === 'ArrowUp' && start === 0 && end === 0) {
    e.preventDefault()
    emit('arrowUp')
    return
  }

  if (e.key === 'ArrowDown' && start === value.length && end === value.length) {
    e.preventDefault()
    emit('arrowDown')
  }
}

function onPaste(e: ClipboardEvent) {
  if (props.readonly || language.value !== 'plaintext' || code.value.trim() !== '') {
    return
  }

  // Pasting into an empty plain-text block: guess the language.
  const text = e.clipboardData?.getData('text/plain') ?? ''
  void loadHighlighter().then(() => {
    const guess = detectLanguage(text, LANGUAGE_IDS)

    if (!guess) {
      return
    }

    emit('patch', { language: guess })
    detected.value = codeLanguageLabel(guess)
    later(() => {
      detected.value = null
    }, 2400)
  })
}

function onFileNameKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' || e.key === 'ArrowDown') {
    e.preventDefault()
    textarea.value?.focus()
  }
}

async function copyCode() {
  try {
    await navigator.clipboard.writeText(code.value)
  } catch {
    const ta = textarea.value

    if (ta) {
      ta.focus()
      ta.select()
      document.execCommand('copy')
      ta.selectionStart = ta.selectionEnd = ta.value.length
    }
  }

  copied.value = true
  later(() => {
    copied.value = false
  }, 1600)
}

function focusAt(pos: number | 'start' | 'end' = 'end') {
  const ta = textarea.value

  if (!ta) {
    return
  }

  ta.focus({ preventScroll: true })
  const offset = pos === 'start' ? 0 : pos === 'end' ? ta.value.length : pos
  ta.selectionStart = ta.selectionEnd = offset
  ta.scrollIntoView({ block: 'nearest' })
}

defineExpose({ focusAt })
</script>

<template>
  <div
    class="ecb"
    :class="{ 'ecb--wrap': wrap, 'ecb--numbered': lineNumbers }"
    dir="ltr"
    :style="{ '--ecb-gutter': gutter }"
  >
    <div class="ecb-header">
      <label
        class="ecb-lang"
        :title="t.language"
      >
        <span>{{ language === 'plaintext' ? t.plainText : codeLanguageLabel(language) }}</span>
        <ChevronDown
          v-if="!readonly"
          aria-hidden="true"
        />
        <select
          :value="language"
          :disabled="readonly"
          :aria-label="t.language"
          @change="emit('patch', { language: ($event.target as HTMLSelectElement).value })"
          @mousedown.stop
        >
          <!-- Keep languages from imported Markdown/HTML selectable even if not in the list. -->
          <option
            v-if="!known"
            :value="language"
          >{{ language }}</option>
          <option
            v-for="lang in CODE_LANGUAGES"
            :key="lang.id"
            :value="lang.id"
          >
            {{ lang.id === 'plaintext' ? t.plainText : lang.label }}
          </option>
        </select>
      </label>

      <span
        v-if="detected"
        class="ecb-detected"
        role="status"
      >{{ t.detected }}: {{ detected }}</span>

      <template v-if="readonly">
        <span
          v-if="fileName"
          class="ecb-filename"
        >{{ fileName }}</span>
      </template>
      <input
        v-else
        class="ecb-filename"
        :value="fileName"
        :placeholder="t.fileName"
        :aria-label="t.fileName"
        spellcheck="false"
        :size="Math.max(8, fileName.length + 1)"
        @input="emit('patch', { caption: ($event.target as HTMLInputElement).value || undefined })"
        @mousedown.stop
        @keydown="onFileNameKeydown"
      >

      <div class="ecb-actions">
        <template v-if="!readonly">
          <button
            type="button"
            class="ecb-action"
            :class="{ 'ecb-action--active': lineNumbers }"
            :title="lineNumbers ? t.hideLineNumbers : t.lineNumbers"
            :aria-label="lineNumbers ? t.hideLineNumbers : t.lineNumbers"
            :aria-pressed="lineNumbers"
            @mousedown.prevent
            @click="emit('patch', { lineNumbers: !lineNumbers || undefined })"
          >
            <ListOrdered />
          </button>
          <button
            type="button"
            class="ecb-action"
            :class="{ 'ecb-action--active': wrap }"
            :title="wrap ? t.disableWrap : t.wrap"
            :aria-label="wrap ? t.disableWrap : t.wrap"
            :aria-pressed="wrap"
            @mousedown.prevent
            @click="emit('patch', { wrap: !wrap })"
          >
            <WrapText />
          </button>
        </template>
        <button
          type="button"
          class="ecb-action ecb-action--copy"
          :class="{ 'ecb-action--ok': copied }"
          :title="copied ? t.copied : t.copy"
          :aria-label="copied ? t.copied : t.copy"
          @mousedown.prevent
          @click="copyCode"
        >
          <Check v-if="copied" />
          <Copy v-else />
          <span v-if="copied">{{ t.copied }}</span>
        </button>
      </div>
    </div>

    <div class="ecb-body xpe-scroll">
      <div class="ecb-layer">
        <!-- eslint-disable-next-line vue/no-v-html -- highlighter output, code is HTML-escaped -->
        <pre
          class="ecb-highlight hljs"
          aria-hidden="true"
        ><code v-html="linesHtml" /></pre>
        <textarea
          ref="textarea"
          :value="code"
          :readonly="readonly"
          class="ecb-input"
          rows="1"
          :wrap="wrap ? 'soft' : 'off'"
          :placeholder="t.placeholder"
          :aria-label="`${t.language}: ${codeLanguageLabel(language)}`"
          spellcheck="false"
          autocapitalize="off"
          autocorrect="off"
          autocomplete="off"
          @input="onInput"
          @keydown="onKeydown"
          @paste="onPaste"
        />
      </div>
    </div>
    <span
      v-if="!readonly"
      class="ecb-hint"
    >{{ exitHint }}</span>
  </div>
</template>
