import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Loader2, Sparkles, X } from 'lucide-react'
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

export interface AIMenuProps {
  open: boolean
  position: { x: number; y: number }
  transport: AITransport
  commands?: AICommand[]
  blocks: Block[]
  selectionBlocks: Block[]
  focusBlockId: string | null
  themeSource?: HTMLElement | null
  onApply: (nextBlocks: Block[], focusBlockId: string | null) => void
  onClose: () => void
}

export function AIMenu({
  open,
  position,
  transport,
  commands = DEFAULT_AI_COMMANDS,
  blocks,
  selectionBlocks,
  focusBlockId,
  themeSource,
  onApply,
  onClose,
}: AIMenuProps) {
  const [status, setStatus] = useState<AIAgentStatus>('user-input')
  const [prompt, setPrompt] = useState('')
  const [streamText, setStreamText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [suggestion, setSuggestion] = useState<AISuggestion | null>(null)
  const [activeCommand, setActiveCommand] = useState<AICommand | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const hasSelection = selectionBlocks.length > 0

  const visibleCommands = useMemo(
    () => filterAICommands(commands, prompt, hasSelection),
    [commands, prompt, hasSelection],
  )

  useEffect(() => {
    if (!open) {
      abortRef.current?.abort()
      setStatus('closed')
      setPrompt('')
      setStreamText('')
      setError(null)
      setSuggestion(null)
      setActiveCommand(null)
      return
    }
    setStatus('user-input')
  }, [open])

  useEffect(() => {
    if (open && themeSource && panelRef.current) {
      syncThemeVars(themeSource, panelRef.current)
    }
  }, [open, themeSource, position])

  async function run(command: AICommand | null, customPrompt: string) {
    const finalPrompt = (customPrompt || command?.prompt || '').trim()
    if (!finalPrompt) return

    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    setActiveCommand(command)
    setStatus('ai-writing')
    setError(null)
    setStreamText('')
    setSuggestion(null)

    const kind = command?.kind ?? (hasSelection ? 'update' : 'add')

    try {
      let accumulated = ''
      let structured: Block[] | undefined

      for await (const chunk of transport({
        prompt: finalPrompt,
        commandId: command?.id ?? null,
        context: {
          blocks,
          selection: selectionBlocks,
          selectionText: selectionTextFromBlocks(selectionBlocks),
          focusBlockId,
        },
        signal: ac.signal,
      })) {
        if (ac.signal.aborted) return
        if (chunk.error) {
          setError(chunk.error)
          setStatus('error')
          return
        }
        if (chunk.text) {
          accumulated += chunk.text
          setStreamText(accumulated)
        }
        if (chunk.blocks) structured = chunk.blocks
        if (chunk.done) break
      }

      const parsed = parseAIResponseToBlocks({ text: accumulated, blocks: structured })
      if (!parsed.length) {
        setError('No response from AI')
        setStatus('error')
        return
      }

      setSuggestion({
        id: `sug-${Date.now()}`,
        blocks: parsed,
        kind,
        replaceBlockIds: hasSelection ? selectionBlocks.map((b) => b.id) : [],
      })
      setStatus('user-reviewing')
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return
      setError(err instanceof Error ? err.message : 'AI request failed')
      setStatus('error')
    }
  }

  function accept() {
    if (!suggestion) return
    const result = applyAISuggestion(blocks, suggestion, focusBlockId)
    onApply(result.blocks, result.focusBlockId)
    onClose()
  }

  if (!open) return null

  return createPortal(
    <div
      ref={panelRef}
      className="xpe-ai-menu fixed z-[10050] w-[min(420px,calc(100vw-24px))] rounded-xl border border-[var(--xpe-border)] bg-[var(--xpe-surface)] shadow-xl"
      style={{ left: Math.max(8, position.x), top: Math.max(8, position.y) }}
      role="dialog"
      aria-label="Ask AI"
    >
      <div className="flex items-center gap-2 border-b border-[var(--xpe-border)] px-3 py-2">
        <Sparkles className="h-4 w-4 text-[var(--xpe-primary)]" />
        <span className="text-[13px] font-medium text-[var(--xpe-foreground)]">Ask AI</span>
        <button
          type="button"
          className="ms-auto rounded-md p-1 text-[var(--xpe-muted-foreground)] hover:bg-[var(--xpe-surface-hover)]"
          onClick={onClose}
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-3">
        <Input
          autoFocus
          placeholder="Ask AI anything…"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void run(
                activeCommand ?? { id: 'ask', label: 'Ask', kind: hasSelection ? 'update' : 'add' },
                prompt,
              )
            }
            if (e.key === 'Escape') onClose()
          }}
        />

        {status === 'user-input' && (
          <div className="mt-2 max-h-48 overflow-y-auto">
            {visibleCommands.map((cmd) => (
              <button
                key={cmd.id}
                type="button"
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start text-[13px] text-[var(--xpe-foreground)] hover:bg-[var(--xpe-surface-hover)]"
                onClick={() => {
                  setActiveCommand(cmd)
                  if (cmd.prompt) {
                    setPrompt(cmd.prompt)
                    void run(cmd, cmd.prompt)
                  } else {
                    setPrompt('')
                  }
                }}
              >
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-[var(--xpe-muted-foreground)]" />
                {cmd.label}
              </button>
            ))}
          </div>
        )}

        {(status === 'thinking' || status === 'ai-writing') && (
          <div className="mt-3 flex items-start gap-2 text-[13px] text-[var(--xpe-muted-foreground)]">
            <Loader2 className="mt-0.5 h-4 w-4 animate-spin" />
            <div className="min-w-0 flex-1 whitespace-pre-wrap break-words">
              {streamText || 'Thinking…'}
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="mt-3 text-[13px] text-red-500">
            {error}
            <div className="mt-2 flex gap-2">
              <Button size="sm" onClick={() => void run(activeCommand, prompt)}>Retry</Button>
              <Button size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
            </div>
          </div>
        )}

        {status === 'user-reviewing' && suggestion && (
          <div className="mt-3">
            <div className="max-h-40 overflow-y-auto rounded-lg border border-[var(--xpe-border)] bg-[var(--xpe-muted)]/30 p-2 text-[13px] text-[var(--xpe-foreground)] whitespace-pre-wrap">
              {streamText
                || suggestion.blocks.map((b) => b.content.map((s) => s.text).join('')).join('\n')}
            </div>
            <div className="mt-2 flex gap-2">
              <Button size="sm" onClick={accept}>
                <Check className="me-1 h-3.5 w-3.5" /> Accept
              </Button>
              <Button size="sm" variant="ghost" onClick={onClose}>Reject</Button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
