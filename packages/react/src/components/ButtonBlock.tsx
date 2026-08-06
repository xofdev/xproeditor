import { forwardRef, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { AlignCenter, AlignLeft, AlignRight, Link2, SquareArrowOutUpRight } from 'lucide-react'
import { BUTTON_COLOR_PRESETS, type Block, type InlineSpan, type MarkName } from '@xproeditor/core'
import { Button, Input, Popover, PopoverContent, PopoverTrigger } from '../ui'
import { TextBlock, type TextBlockHandle } from './TextBlock'

export interface ButtonBlockProps {
  block: Block
  readonly?: boolean
  onInput: (spans: InlineSpan[], caret: number | null) => void
  onEnter: (offsets: { start: number; end: number }) => void
  onBackspaceStart: () => void
  onDeleteEnd: () => void
  onArrowUp: () => void
  onArrowDown: () => void
  onTab: (shift: boolean) => void
  onFormat: (mark: MarkName) => void
  onPasted: (payload: {
    html: string
    text: string
    files: File[]
    offsets: { start: number; end: number }
  }) => void
  onFocus: () => void
  onSelectionPointerDown: (payload: { shiftKey: boolean; clientX: number; clientY: number }) => void
  onPatch: (patch: Record<string, unknown>) => void
  onSelect: () => void
}

const STYLE_TO_VARIANT: Record<string, 'default' | 'outline' | 'ghost'> = {
  primary: 'default',
  outline: 'outline',
  ghost: 'ghost',
}

const ALIGN_TO_JUSTIFY: Record<string, string> = {
  left: 'justify-start',
  center: 'justify-center',
  right: 'justify-end',
}

const ALIGN_ICONS = {
  left: AlignLeft,
  center: AlignCenter,
  right: AlignRight,
} as const

function contrastText(hex: string): string {
  const raw = hex.replace('#', '')
  if (raw.length !== 6) return '#ffffff'
  const r = parseInt(raw.slice(0, 2), 16)
  const g = parseInt(raw.slice(2, 4), 16)
  const b = parseInt(raw.slice(4, 6), 16)
  const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luma > 0.62 ? '#111827' : '#ffffff'
}

export const ButtonBlock = forwardRef<TextBlockHandle, ButtonBlockProps>(function ButtonBlock(
  { block, readonly, onPatch, onSelect, ...textEvents },
  ref,
) {
  const [open, setOpen] = useState(false)
  const [urlDraft, setUrlDraft] = useState(block.props.url ?? '')
  const [labelDraft, setLabelDraft] = useState(
    block.content.map((s) => s.text).join('') || '',
  )

  const variant = STYLE_TO_VARIANT[block.props.buttonStyle ?? 'primary'] ?? 'default'
  const justify = ALIGN_TO_JUSTIFY[block.props.align ?? 'left'] ?? 'justify-start'
  const accent = block.props.color
  const labelText = useMemo(() => block.content.map((s) => s.text).join(''), [block.content])

  useEffect(() => {
    setUrlDraft(block.props.url ?? '')
  }, [block.props.url])

  useEffect(() => {
    setLabelDraft(labelText)
  }, [labelText])

  // First insert: open settings so URL/color are obvious
  useEffect(() => {
    if (!readonly && !(block.props.url ?? '') && !labelText.trim()) {
      setOpen(true)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const previewStyle = useMemo(() => {
    if (!accent) return undefined
    if (variant === 'default') {
      return {
        background: accent,
        borderColor: accent,
        color: contrastText(accent),
        ['--xpe-btn-accent' as string]: accent,
      } as CSSProperties
    }
    if (variant === 'outline') {
      return {
        borderColor: accent,
        color: accent,
        ['--xpe-btn-accent' as string]: accent,
      } as CSSProperties
    }
    return { color: accent, ['--xpe-btn-accent' as string]: accent } as CSSProperties
  }, [accent, variant])

  function commitUrl() {
    const next = urlDraft.trim()
    if (next !== (block.props.url ?? '')) {
      onPatch({ url: next })
    }
  }

  function commitLabel() {
    const next = labelDraft
    if (next !== labelText) {
      textEvents.onInput([{ text: next }], next.length)
    }
  }

  return (
    <div className={`my-1 flex items-center gap-1.5 ${justify}`} onClick={onSelect}>
      <div
        className={`xpe-btn xpe-btn--${variant} xpe-btn--md min-w-[64px] xpe-editor-btn`}
        style={previewStyle}
      >
        <TextBlock
          ref={ref}
          block={block}
          readonly={readonly}
          placeholder="Button"
          className="min-w-0 text-center outline-none"
          {...textEvents}
        />
      </div>

      {!readonly && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger>
            <button
              type="button"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--xpe-muted-foreground)] hover:bg-[var(--xpe-surface-hover)] hover:text-[var(--xpe-foreground)]"
              title="Button settings"
              aria-label="Button settings"
              onClick={(e) => {
                e.stopPropagation()
                setOpen((o) => !o)
              }}
            >
              <Link2 className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="xpe-button-settings">
            <div className="flex flex-col gap-3 p-3 w-72">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-medium text-[var(--xpe-muted-foreground)]">Label</span>
                <Input
                  type="text"
                  placeholder="Button"
                  value={labelDraft}
                  onChange={(e) => setLabelDraft(e.target.value)}
                  onBlur={commitLabel}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      commitLabel()
                    }
                  }}
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-medium text-[var(--xpe-muted-foreground)]">Link URL</span>
                <Input
                  type="url"
                  placeholder="https://..."
                  value={urlDraft}
                  onChange={(e) => setUrlDraft(e.target.value)}
                  onBlur={commitUrl}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      commitUrl()
                    }
                  }}
                />
              </label>

              <label className="flex items-center gap-2 text-[12px] text-[var(--xpe-foreground)]">
                <input
                  type="checkbox"
                  checked={!!block.props.openInNewTab}
                  onChange={(e) => onPatch({ openInNewTab: e.target.checked })}
                />
                <SquareArrowOutUpRight className="h-3.5 w-3.5 text-[var(--xpe-muted-foreground)]" />
                Open in new tab
              </label>

              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-medium text-[var(--xpe-muted-foreground)]">Color</span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    title="Theme default"
                    className={`h-6 w-6 rounded-full border border-[var(--xpe-border)] ${!accent ? 'ring-2 ring-[var(--xpe-primary)] ring-offset-1' : ''}`}
                    style={{ background: 'var(--xpe-primary, #4f46e5)' }}
                    onClick={() => onPatch({ color: undefined })}
                  />
                  {BUTTON_COLOR_PRESETS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      title={c}
                      className={`h-6 w-6 rounded-full border border-[var(--xpe-border)] ${accent === c ? 'ring-2 ring-[var(--xpe-primary)] ring-offset-1' : ''}`}
                      style={{ background: c }}
                      onClick={() => onPatch({ color: c })}
                    />
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-medium text-[var(--xpe-muted-foreground)]">Style</span>
                <div className="flex gap-1">
                  {(['primary', 'outline', 'ghost'] as const).map((s) => (
                    <Button
                      key={s}
                      size="sm"
                      variant={(block.props.buttonStyle ?? 'primary') === s ? 'default' : 'outline'}
                      onClick={() => onPatch({ buttonStyle: s })}
                    >
                      {s === 'primary' ? 'Primary' : s === 'outline' ? 'Outline' : 'Ghost'}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-medium text-[var(--xpe-muted-foreground)]">Alignment</span>
                <div className="flex gap-1">
                  {(['left', 'center', 'right'] as const).map((a) => {
                    const Icon = ALIGN_ICONS[a]
                    return (
                      <Button
                        key={a}
                        size="sm"
                        variant={(block.props.align ?? 'left') === a ? 'default' : 'outline'}
                        onClick={() => onPatch({ align: a })}
                        aria-label={a}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </Button>
                    )
                  })}
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
})
