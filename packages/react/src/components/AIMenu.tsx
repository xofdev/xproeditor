import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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
} from 'lucide-react'
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
import { useEditorDictionary } from '../i18n'

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

const CMD_ICONS: Record<string, typeof Sparkles> = {
  improve: WandSparkles,
  'fix-spelling': SpellCheck,
  simplify: Minimize2,
  continue: Text,
  summarize: Text,
  'action-items': ListTodo,
}

function clampMenuPosition(x: number, y: number, width: number, height: number) {
  const pad = 8
  const maxX = Math.max(pad, window.innerWidth - width - pad)
  const maxY = Math.max(pad, window.innerHeight - height - pad)
  return {
    left: Math.min(Math.max(pad, x), maxX),
    top: Math.min(Math.max(pad, y), maxY),
  }
}

function previewFromSuggestion(suggestion: AISuggestion, streamText: string): string {
  if (streamText.trim()) return streamText
  return suggestion.blocks.map((b) => b.content.map((s) => s.text).join('')).join('\n')
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
  const t = useEditorDictionary().ai
  const [status, setStatus] = useState<AIAgentStatus>('user-input')
  const [prompt, setPrompt] = useState('')
  const [streamText, setStreamText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [suggestion, setSuggestion] = useState<AISuggestion | null>(null)
  const [activeCommand, setActiveCommand] = useState<AICommand | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const abortRef = useRef<AbortController | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const hasSelection = selectionBlocks.length > 0

  const visibleCommands = useMemo(
    () => filterAICommands(commands, prompt, hasSelection),
    [commands, prompt, hasSelection],
  )

  const isBusy = status === 'thinking' || status === 'ai-writing'
  const canSubmit = prompt.trim().length > 0 && !isBusy

  useEffect(() => {
    if (!open) {
      abortRef.current?.abort()
      setStatus('closed')
      setPrompt('')
      setStreamText('')
      setError(null)
      setSuggestion(null)
      setActiveCommand(null)
      setActiveIndex(0)
      return
    }
    setStatus('user-input')
    const id = window.setTimeout(() => inputRef.current?.focus(), 0)
    return () => window.clearTimeout(id)
  }, [open])

  useEffect(() => {
    setActiveIndex(0)
  }, [prompt, hasSelection, open])

  useEffect(() => {
    if (open && themeSource && panelRef.current) {
      syncThemeVars(themeSource, panelRef.current)
    }
  }, [open, themeSource, position])

  useEffect(() => {
    if (!open) return

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        if (isBusy) stop()
        else onClose()
      }
    }

    function onOutside(e: MouseEvent) {
      const target = e.target as Node
      if (panelRef.current?.contains(target)) return
      if (isBusy) return
      onClose()
    }

    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onOutside, true)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onOutside, true)
    }
  }, [open, isBusy, onClose])

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

      if (ac.signal.aborted) return

      const parsed = parseAIResponseToBlocks({ text: accumulated, blocks: structured })
      if (!parsed.length) {
        setError(t.noResponse)
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
      setError(err instanceof Error ? err.message : t.failed)
      setStatus('error')
    }
  }

  function stop() {
    abortRef.current?.abort()
    abortRef.current = null
    setStatus('user-input')
    setStreamText('')
    setSuggestion(null)
    setError(null)
    window.setTimeout(() => inputRef.current?.focus(), 0)
  }

  function accept() {
    if (!suggestion) return
    const result = applyAISuggestion(blocks, suggestion, focusBlockId)
    onApply(result.blocks, result.focusBlockId)
    onClose()
  }

  function reject() {
    setSuggestion(null)
    setStreamText('')
    setStatus('user-input')
    window.setTimeout(() => inputRef.current?.focus(), 0)
  }

  function submitCustom() {
    if (!canSubmit) return
    void run(
      activeCommand ?? { id: 'ask', label: t.ask, kind: hasSelection ? 'update' : 'add' },
      prompt,
    )
  }

  function selectCommand(cmd: AICommand) {
    setActiveCommand(cmd)
    if (cmd.prompt) {
      setPrompt(cmd.prompt)
      void run(cmd, cmd.prompt)
      return
    }
    setPrompt('')
    inputRef.current?.focus()
  }

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (status === 'user-input' && !prompt.trim() && visibleCommands[activeIndex]) {
        selectCommand(visibleCommands[activeIndex])
        return
      }
      submitCustom()
      return
    }

    if (status !== 'user-input' || visibleCommands.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => (i + 1) % visibleCommands.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => (i - 1 + visibleCommands.length) % visibleCommands.length)
    }
  }

  if (!open) return null

  const coords = clampMenuPosition(position.x, position.y, 380, 420)

  return createPortal(
    <div
      ref={panelRef}
      className="xpe-ai-menu"
      style={{ left: coords.left, top: coords.top }}
      role="dialog"
      aria-label={t.askAI}
    >
      <div className="xpe-ai-menu__head">
        <span className="xpe-ai-menu__brand" aria-hidden>
          <Sparkles />
        </span>
        <span className="xpe-ai-menu__title">{t.askAI}</span>
        {hasSelection && <span className="xpe-ai-menu__badge">{t.selection}</span>}
        <button type="button" className="xpe-ai-menu__icon-btn" onClick={onClose} aria-label={t.close}>
          <X />
        </button>
      </div>

      <div className="xpe-ai-menu__body">
        {(status === 'user-input' || status === 'error') && (
          <>
            <div className="xpe-ai-menu__composer">
              <input
                ref={inputRef}
                className="xpe-ai-menu__input"
                placeholder={hasSelection ? t.editSelectionPlaceholder : t.writePlaceholder}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={onInputKeyDown}
              />
              <button
                type="button"
                className="xpe-ai-menu__send"
                disabled={!canSubmit}
                onClick={submitCustom}
                aria-label={t.send}
              >
                <ArrowUp />
              </button>
            </div>

            {status === 'user-input' && (
              <>
                {visibleCommands.length > 0 ? (
                  <div className="xpe-ai-menu__cmds" role="listbox" aria-label={t.commands}>
                    {visibleCommands.map((cmd, i) => {
                      const Icon = CMD_ICONS[cmd.id] ?? Sparkles
                      return (
                        <button
                          key={cmd.id}
                          type="button"
                          role="option"
                          aria-selected={i === activeIndex}
                          className={`xpe-ai-menu__cmd${i === activeIndex ? ' xpe-ai-menu__cmd--active' : ''}`}
                          onMouseEnter={() => setActiveIndex(i)}
                          onClick={() => selectCommand(cmd)}
                        >
                          <span className="xpe-ai-menu__cmd-icon">
                            <Icon />
                          </span>
                          <span className="xpe-ai-menu__cmd-text">
                            <span className="xpe-ai-menu__cmd-label">{cmd.label}</span>
                            {cmd.description && (
                              <span className="xpe-ai-menu__cmd-desc">{cmd.description}</span>
                            )}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <p className="xpe-ai-menu__hint">{t.noMatching}</p>
                )}
              </>
            )}
          </>
        )}

        {isBusy && (
          <div className="xpe-ai-menu__stream">
            <div className="xpe-ai-menu__stream-meta">
              <Loader2 className="xpe-ai-menu__spin" />
              {t.writing}
            </div>
            {streamText || t.thinking}
          </div>
        )}

        {isBusy && (
          <div className="xpe-ai-menu__actions">
            <button type="button" className="xpe-ai-menu__btn xpe-ai-menu__btn--danger" onClick={stop}>
              {t.stop}
            </button>
          </div>
        )}

        {status === 'error' && error && (
          <>
            <div className="xpe-ai-menu__error">{error}</div>
            <div className="xpe-ai-menu__actions">
              <button
                type="button"
                className="xpe-ai-menu__btn xpe-ai-menu__btn--primary"
                onClick={() => void run(activeCommand, prompt)}
              >
                {t.retry}
              </button>
              <button type="button" className="xpe-ai-menu__btn xpe-ai-menu__btn--ghost" onClick={onClose}>
                {t.cancel}
              </button>
            </div>
          </>
        )}

        {status === 'user-reviewing' && suggestion && (
          <>
            <div className="xpe-ai-menu__preview">
              {previewFromSuggestion(suggestion, streamText)}
            </div>
            <div className="xpe-ai-menu__actions">
              <button type="button" className="xpe-ai-menu__btn xpe-ai-menu__btn--primary" onClick={accept}>
                <Check /> {t.accept}
              </button>
              <button type="button" className="xpe-ai-menu__btn xpe-ai-menu__btn--ghost" onClick={reject}>
                {t.discard}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
