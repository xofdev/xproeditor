import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
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
  placeFloating,
  selectionTextFromBlocks,
  syncThemeVars,
  type AIAgentStatus,
  type AICommand,
  type AISuggestion,
  type AITransport,
  type Block,
  type FloatingPlacement,
} from '@xproeditor/core'
import { useEditorDictionary } from '../i18n'

export interface AIMenuProps {
  open: boolean
  /** Viewport anchor line: the menu opens below `y`, or above `top` when it doesn't fit. */
  position: { x: number; y: number; top?: number }
  /** Element the anchor belongs to (e.g. the block row) — the menu follows it on scroll. */
  anchorElement?: HTMLElement | null
  dir?: 'ltr' | 'rtl'
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

function previewFromSuggestion(suggestion: AISuggestion, streamText: string): string {
  if (streamText.trim()) return streamText
  return suggestion.blocks.map((b) => b.content.map((s) => s.text).join('')).join('\n')
}

export function AIMenu({
  open,
  position,
  anchorElement,
  dir,
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

  // Place with the panel's real size: below the anchor, flipped above when
  // it doesn't fit, clamped to the viewport. Re-placed when the panel grows
  // (streaming), on resize, and on any scroll — following the anchor block.
  const [placement, setPlacement] = useState<FloatingPlacement | null>(null)
  const { x, y, top } = position

  useLayoutEffect(() => {
    const panel = panelRef.current
    if (!open || !panel) return

    const base = { x, top: top ?? y, bottom: y }
    // Measured before any scroll: `place` shifts `base` by how far it moved.
    const start = anchorElement?.getBoundingClientRect() ?? null

    // An off-screen anchor (e.g. opened from a sticky toolbar) is scrolled
    // into view first; `place` then follows it.
    if (anchorElement && (base.bottom < 0 || base.top > window.innerHeight)) {
      anchorElement.scrollIntoView({ block: 'center' })
    }

    function place() {
      if (!panel) return
      let anchor = base

      if (anchorElement && start && anchorElement.isConnected) {
        const now = anchorElement.getBoundingClientRect()
        const dx = now.left - start.left
        const dy = now.top - start.top
        anchor = { x: base.x + dx, top: base.top + dy, bottom: base.bottom + dy }
      }

      const width = panel.offsetWidth
      const next = placeFloating(anchor, { width, height: panel.scrollHeight }, { dir })
      setPlacement((prev) =>
        prev &&
        prev.left === next.left &&
        prev.top === next.top &&
        prev.maxHeight === next.maxHeight
          ? prev
          : next,
      )
    }

    place()
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(place) : null
    observer?.observe(panel)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, x, y, top, anchorElement, dir])

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

  return createPortal(
    <div
      ref={panelRef}
      className="xpe-ai-menu"
      style={
        placement
          ? { left: placement.left, top: placement.top, maxHeight: placement.maxHeight }
          : { left: x, top: y, visibility: 'hidden' }
      }
      data-side={placement?.side}
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
