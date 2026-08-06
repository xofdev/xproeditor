<script setup lang="ts">
import { Check, Loader2, Sparkles, X } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
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
import { Button, Input } from '../ui'

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

const status = ref<AIAgentStatus>('user-input')
const prompt = ref('')
const streamText = ref('')
const error = ref<string | null>(null)
const suggestion = ref<AISuggestion | null>(null)
const activeCommand = ref<AICommand | null>(null)
const panelEl = ref<HTMLElement | null>(null)
let abort: AbortController | null = null

const hasSelection = computed(() => props.selectionBlocks.length > 0)
const commands = computed(() => props.commands ?? DEFAULT_AI_COMMANDS)
const visibleCommands = computed(() =>
  filterAICommands(commands.value, prompt.value, hasSelection.value),
)

watch(
  () => props.open,
  (open) => {
    abort?.abort()
    if (!open) {
      status.value = 'closed'
      prompt.value = ''
      streamText.value = ''
      error.value = null
      suggestion.value = null
      activeCommand.value = null
      return
    }
    status.value = 'user-input'
  },
)

watch(
  () => [props.open, props.themeSource, props.position] as const,
  () => {
    if (props.open && props.themeSource && panelEl.value) {
      syncThemeVars(props.themeSource, panelEl.value)
    }
  },
)

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

function accept() {
  if (!suggestion.value) return
  const result = applyAISuggestion(props.blocks, suggestion.value, props.focusBlockId)
  emit('apply', result.blocks, result.focusBlockId)
  emit('close')
}

function onEnter() {
  void run(
    activeCommand.value ?? { id: 'ask', label: 'Ask', kind: hasSelection.value ? 'update' : 'add' },
    prompt.value,
  )
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      ref="panelEl"
      class="xpe-ai-menu fixed z-[10050] w-[min(420px,calc(100vw-24px))] rounded-xl border border-[var(--xpe-border)] bg-[var(--xpe-surface)] shadow-xl"
      :style="{ left: `${Math.max(8, position.x)}px`, top: `${Math.max(8, position.y)}px` }"
      role="dialog"
      aria-label="Ask AI"
    >
      <div class="flex items-center gap-2 border-b border-[var(--xpe-border)] px-3 py-2">
        <Sparkles class="h-4 w-4 text-[var(--xpe-primary)]" />
        <span class="text-[13px] font-medium text-[var(--xpe-foreground)]">Ask AI</span>
        <button
          type="button"
          class="ms-auto rounded-md p-1 text-[var(--xpe-muted-foreground)] hover:bg-[var(--xpe-surface-hover)]"
          aria-label="Close"
          @click="emit('close')"
        >
          <X class="h-4 w-4" />
        </button>
      </div>

      <div class="p-3">
        <Input
          v-model="prompt"
          placeholder="Ask AI anything…"
          @keydown.enter.prevent="onEnter"
          @keydown.escape="emit('close')"
        />

        <div v-if="status === 'user-input'" class="mt-2 max-h-48 overflow-y-auto">
          <button
            v-for="cmd in visibleCommands"
            :key="cmd.id"
            type="button"
            class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start text-[13px] text-[var(--xpe-foreground)] hover:bg-[var(--xpe-surface-hover)]"
            @click="() => { activeCommand = cmd; if (cmd.prompt) { prompt = cmd.prompt; void run(cmd, cmd.prompt) } else { prompt = '' } }"
          >
            <Sparkles class="h-3.5 w-3.5 shrink-0 text-[var(--xpe-muted-foreground)]" />
            {{ cmd.label }}
          </button>
        </div>

        <div
          v-if="status === 'thinking' || status === 'ai-writing'"
          class="mt-3 flex items-start gap-2 text-[13px] text-[var(--xpe-muted-foreground)]"
        >
          <Loader2 class="mt-0.5 h-4 w-4 animate-spin" />
          <div class="min-w-0 flex-1 whitespace-pre-wrap break-words">
            {{ streamText || 'Thinking…' }}
          </div>
        </div>

        <div v-if="status === 'error'" class="mt-3 text-[13px] text-red-500">
          {{ error }}
          <div class="mt-2 flex gap-2">
            <Button size="sm" @click="() => void run(activeCommand, prompt)">Retry</Button>
            <Button size="sm" variant="ghost" @click="emit('close')">Cancel</Button>
          </div>
        </div>

        <div v-if="status === 'user-reviewing' && suggestion" class="mt-3">
          <div class="max-h-40 overflow-y-auto rounded-lg border border-[var(--xpe-border)] bg-[var(--xpe-muted)]/30 p-2 text-[13px] text-[var(--xpe-foreground)] whitespace-pre-wrap">
            {{ streamText || suggestion.blocks.map(b => b.content.map(s => s.text).join('')).join('\n') }}
          </div>
          <div class="mt-2 flex gap-2">
            <Button size="sm" @click="accept">
              <Check class="me-1 h-3.5 w-3.5" /> Accept
            </Button>
            <Button size="sm" variant="ghost" @click="emit('close')">Reject</Button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
