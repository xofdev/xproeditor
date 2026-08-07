<script setup lang="ts">
import {
  ArrowUp,
  Check,
  ListTodo,
  Loader2,
  Minimize2,
  SpellCheck,
  Sparkles,
  Text,
  WandSparkles,
  X,
} from 'lucide-vue-next'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import {
  applyAISuggestion,
  DEFAULT_AI_COMMANDS,
  filterAICommands,
  parseAIResponseToBlocks,
  selectionTextFromBlocks,
  syncThemeVars,
  type AIAgentStatus,
  type AICommand,
  type AISuggestion,
  type AITransport,
  type Block,
} from '@xproeditor/core'

const props = defineProps<{
  open: boolean
  position: { x: number; y: number }
  transport: AITransport
  commands?: AICommand[]
  blocks: Block[]
  selectionBlocks: Block[]
  focusBlockId: string | null
  themeSource?: HTMLElement | null
}>()

const emit = defineEmits<{
  apply: [nextBlocks: Block[], focusBlockId: string | null]
  close: []
}>()

const CMD_ICONS: Record<string, typeof Sparkles> = {
  improve: WandSparkles,
  'fix-spelling': SpellCheck,
  simplify: Minimize2,
  continue: Text,
  summarize: Text,
  'action-items': ListTodo,
}

const status = ref<AIAgentStatus>('user-input')
const prompt = ref('')
const streamText = ref('')
const error = ref<string | null>(null)
const suggestion = ref<AISuggestion | null>(null)
const activeCommand = ref<AICommand | null>(null)
const activeIndex = ref(0)
const panelEl = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLInputElement | null>(null)
let abort: AbortController | null = null

const hasSelection = computed(() => props.selectionBlocks.length > 0)
const commands = computed(() => props.commands ?? DEFAULT_AI_COMMANDS)
const visibleCommands = computed(() =>
  filterAICommands(commands.value, prompt.value, hasSelection.value),
)
const isBusy = computed(() => status.value === 'thinking' || status.value === 'ai-writing')
const canSubmit = computed(() => prompt.value.trim().length > 0 && !isBusy.value)

const coords = computed(() => clampMenuPosition(props.position.x, props.position.y, 380, 420))

const previewText = computed(() => {
  if (!suggestion.value) return ''
  if (streamText.value.trim()) return streamText.value
  return suggestion.value.blocks.map(b => b.content.map(s => s.text).join('')).join('\n')
})

function clampMenuPosition(x: number, y: number, width: number, height: number) {
  const pad = 8
  const maxX = Math.max(pad, window.innerWidth - width - pad)
  const maxY = Math.max(pad, window.innerHeight - height - pad)
  return {
    left: Math.min(Math.max(pad, x), maxX),
    top: Math.min(Math.max(pad, y), maxY),
  }
}

function resetIdle() {
  status.value = 'user-input'
  streamText.value = ''
  suggestion.value = null
  error.value = null
}

watch(
  () => props.open,
  async (open) => {
    abort?.abort()
    if (!open) {
      status.value = 'closed'
      prompt.value = ''
      streamText.value = ''
      error.value = null
      suggestion.value = null
      activeCommand.value = null
      activeIndex.value = 0
      return
    }
    status.value = 'user-input'
    await nextTick()
    inputRef.value?.focus()
  },
)

watch([() => prompt.value, hasSelection, () => props.open], () => {
  activeIndex.value = 0
})

watch(
  () => [props.open, props.themeSource, props.position] as const,
  () => {
    if (props.open && props.themeSource && panelEl.value) {
      syncThemeVars(props.themeSource, panelEl.value)
    }
  },
)

function onDocKeydown(e: KeyboardEvent) {
  if (!props.open) return
  if (e.key !== 'Escape') return
  e.preventDefault()
  if (isBusy.value) stop()
  else emit('close')
}

function onDocMouseDown(e: MouseEvent) {
  if (!props.open || isBusy.value) return
  const target = e.target as Node
  if (panelEl.value?.contains(target)) return
  emit('close')
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      window.addEventListener('keydown', onDocKeydown)
      window.addEventListener('mousedown', onDocMouseDown, true)
    } else {
      window.removeEventListener('keydown', onDocKeydown)
      window.removeEventListener('mousedown', onDocMouseDown, true)
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  abort?.abort()
  window.removeEventListener('keydown', onDocKeydown)
  window.removeEventListener('mousedown', onDocMouseDown, true)
})

async function run(command: AICommand | null, customPrompt: string) {
  const finalPrompt = (customPrompt || command?.prompt || '').trim()
  if (!finalPrompt) return

  abort?.abort()
  abort = new AbortController()
  activeCommand.value = command
  status.value = 'ai-writing'
  error.value = null
  streamText.value = ''
  suggestion.value = null

  const kind = command?.kind ?? (hasSelection.value ? 'update' : 'add')

  try {
    let accumulated = ''
    let structured: Block[] | undefined

    for await (const chunk of props.transport({
      prompt: finalPrompt,
      commandId: command?.id ?? null,
      context: {
        blocks: props.blocks,
        selection: props.selectionBlocks,
        selectionText: selectionTextFromBlocks(props.selectionBlocks),
        focusBlockId: props.focusBlockId,
      },
      signal: abort.signal,
    })) {
      if (abort.signal.aborted) return
      if (chunk.error) {
        error.value = chunk.error
        status.value = 'error'
        return
      }
      if (chunk.text) {
        accumulated += chunk.text
        streamText.value = accumulated
      }
      if (chunk.blocks) structured = chunk.blocks
      if (chunk.done) break
    }

    if (abort.signal.aborted) return

    const parsed = parseAIResponseToBlocks({ text: accumulated, blocks: structured })
    if (!parsed.length) {
      error.value = 'No response from AI'
      status.value = 'error'
      return
    }

    suggestion.value = {
      id: `sug-${Date.now()}`,
      blocks: parsed,
      kind,
      replaceBlockIds: hasSelection.value ? props.selectionBlocks.map(b => b.id) : [],
    }
    status.value = 'user-reviewing'
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') return
    error.value = err instanceof Error ? err.message : 'AI request failed'
    status.value = 'error'
  }
}

function stop() {
  abort?.abort()
  abort = null
  resetIdle()
  nextTick(() => inputRef.value?.focus())
}

function accept() {
  if (!suggestion.value) return
  const result = applyAISuggestion(props.blocks, suggestion.value, props.focusBlockId)
  emit('apply', result.blocks, result.focusBlockId)
  emit('close')
}

function reject() {
  resetIdle()
  nextTick(() => inputRef.value?.focus())
}

function submitCustom() {
  if (!canSubmit.value) return
  void run(
    activeCommand.value ?? { id: 'ask', label: 'Ask', kind: hasSelection.value ? 'update' : 'add' },
    prompt.value,
  )
}

function selectCommand(cmd: AICommand) {
  activeCommand.value = cmd
  if (cmd.prompt) {
    prompt.value = cmd.prompt
    void run(cmd, cmd.prompt)
    return
  }
  prompt.value = ''
  inputRef.value?.focus()
}

function onInputKeyDown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    if (status.value === 'user-input' && !prompt.value.trim() && visibleCommands.value[activeIndex.value]) {
      selectCommand(visibleCommands.value[activeIndex.value])
      return
    }
    submitCustom()
    return
  }

  if (status.value !== 'user-input' || visibleCommands.value.length === 0) return

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    activeIndex.value = (activeIndex.value + 1) % visibleCommands.value.length
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    activeIndex.value =
      (activeIndex.value - 1 + visibleCommands.value.length) % visibleCommands.value.length
  }
}

function iconFor(id: string) {
  return CMD_ICONS[id] ?? Sparkles
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      ref="panelEl"
      class="xpe-ai-menu"
      :style="{ left: `${coords.left}px`, top: `${coords.top}px` }"
      role="dialog"
      aria-label="Ask AI"
    >
      <div class="xpe-ai-menu__head">
        <span class="xpe-ai-menu__brand" aria-hidden="true">
          <Sparkles />
        </span>
        <span class="xpe-ai-menu__title">Ask AI</span>
        <span v-if="hasSelection" class="xpe-ai-menu__badge">Selection</span>
        <button type="button" class="xpe-ai-menu__icon-btn" aria-label="Close" @click="emit('close')">
          <X />
        </button>
      </div>

      <div class="xpe-ai-menu__body">
        <template v-if="status === 'user-input' || status === 'error'">
          <div class="xpe-ai-menu__composer">
            <input
              ref="inputRef"
              v-model="prompt"
              class="xpe-ai-menu__input"
              :placeholder="hasSelection ? 'Edit selection with AI…' : 'Ask AI to write…'"
              @keydown="onInputKeyDown"
            />
            <button
              type="button"
              class="xpe-ai-menu__send"
              :disabled="!canSubmit"
              aria-label="Send"
              @click="submitCustom"
            >
              <ArrowUp />
            </button>
          </div>

          <template v-if="status === 'user-input'">
            <div
              v-if="visibleCommands.length"
              class="xpe-ai-menu__cmds"
              role="listbox"
              aria-label="AI commands"
            >
              <button
                v-for="(cmd, i) in visibleCommands"
                :key="cmd.id"
                type="button"
                role="option"
                :aria-selected="i === activeIndex"
                class="xpe-ai-menu__cmd"
                :class="{ 'xpe-ai-menu__cmd--active': i === activeIndex }"
                @mouseenter="activeIndex = i"
                @click="selectCommand(cmd)"
              >
                <span class="xpe-ai-menu__cmd-icon">
                  <component :is="iconFor(cmd.id)" />
                </span>
                <span class="xpe-ai-menu__cmd-text">
                  <span class="xpe-ai-menu__cmd-label">{{ cmd.label }}</span>
                  <span v-if="cmd.description" class="xpe-ai-menu__cmd-desc">{{ cmd.description }}</span>
                </span>
              </button>
            </div>
            <p v-else class="xpe-ai-menu__hint">
              No matching commands — press Enter to run your prompt.
            </p>
          </template>
        </template>

        <template v-if="isBusy">
          <div class="xpe-ai-menu__stream">
            <div class="xpe-ai-menu__stream-meta">
              <Loader2 class="xpe-ai-menu__spin" />
              Writing…
            </div>
            {{ streamText || 'Thinking…' }}
          </div>
          <div class="xpe-ai-menu__actions">
            <button type="button" class="xpe-ai-menu__btn xpe-ai-menu__btn--danger" @click="stop">
              Stop
            </button>
          </div>
        </template>

        <template v-if="status === 'error' && error">
          <div class="xpe-ai-menu__error">{{ error }}</div>
          <div class="xpe-ai-menu__actions">
            <button
              type="button"
              class="xpe-ai-menu__btn xpe-ai-menu__btn--primary"
              @click="() => void run(activeCommand, prompt)"
            >
              Retry
            </button>
            <button type="button" class="xpe-ai-menu__btn xpe-ai-menu__btn--ghost" @click="emit('close')">
              Cancel
            </button>
          </div>
        </template>

        <template v-if="status === 'user-reviewing' && suggestion">
          <div class="xpe-ai-menu__preview">{{ previewText }}</div>
          <div class="xpe-ai-menu__actions">
            <button type="button" class="xpe-ai-menu__btn xpe-ai-menu__btn--primary" @click="accept">
              <Check /> Accept
            </button>
            <button type="button" class="xpe-ai-menu__btn xpe-ai-menu__btn--ghost" @click="reject">
              Discard
            </button>
          </div>
        </template>
      </div>
    </div>
  </Teleport>
</template>
