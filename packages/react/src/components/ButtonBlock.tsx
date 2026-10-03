import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Check,
  Link2,
  Settings2,
  SquareArrowOutUpRight,
} from 'lucide-react'
import {
  BUTTON_ALIGN_OPTIONS,
  BUTTON_COLOR_PRESETS,
  BUTTON_STYLE_OPTIONS,
  buttonContrastForeground,
  type Block,
  type InlineSpan,
  type MarkName,
} from '@xproeditor/core'
import { Popover, PopoverContent, PopoverTrigger } from '../ui'
import { TextBlock, type TextBlockHandle } from './TextBlock'
import { useEditorDictionary } from '../i18n'

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

function isLightSwatch(hex: string): boolean {
  return buttonContrastForeground(hex) === '#111827'
}

export const ButtonBlock = forwardRef<TextBlockHandle, ButtonBlockProps>(function ButtonBlock(
  { block, readonly, onPatch, onSelect, ...textEvents },
  ref,
) {
  const dict = useEditorDictionary()
  const t = dict.button
  const textRef = useRef<TextBlockHandle>(null)
  const urlInputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [urlDraft, setUrlDraft] = useState(block.props.url ?? '')
  const [labelDraft, setLabelDraft] = useState(
    block.content.map((s) => s.text).join('') || '',
  )

  const variant = STYLE_TO_VARIANT[block.props.buttonStyle ?? 'primary'] ?? 'default'
  const justify = ALIGN_TO_JUSTIFY[block.props.align ?? 'left'] ?? 'justify-start'
  const accent = block.props.color
  const labelText = useMemo(() => block.content.map((s) => s.text).join(''), [block.content])
  const openInNewTab = !!block.props.openInNewTab
  const activeStyle = block.props.buttonStyle ?? 'primary'
  const activeAlign = block.props.align ?? 'left'

  useImperativeHandle(ref, () => ({
    focusAt: (pos) => textRef.current?.focusAt(pos),
    getSelection: () => textRef.current?.getSelection() ?? null,
    setSelection: (start, end) => textRef.current?.setSelection(start, end),
    get el() {
      return textRef.current?.el ?? null
    },
  }))

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

  useEffect(() => {
    if (!open) return
    const id = window.setTimeout(() => urlInputRef.current?.focus(), 0)
    return () => window.clearTimeout(id)
  }, [open])

  const previewStyle = useMemo(() => {
    if (!accent) return undefined
    if (variant === 'default') {
      return {
        background: accent,
        borderColor: accent,
        color: buttonContrastForeground(accent),
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

  /** Clicking the label must edit text — never chrome-select (that clears the caret). */
  function handlePreviewClick(e: React.MouseEvent) {
    e.stopPropagation()
    if (readonly) return
    const target = e.target as HTMLElement
    if (!target.closest('[contenteditable="true"]')) {
      textRef.current?.focusAt(labelText.length > 0 ? 'end' : 'start')
    }
  }

  function handleRowClick(e: React.MouseEvent) {
    const target = e.target as HTMLElement
    if (target.closest('[contenteditable="true"], .xpe-editor-btn, button, input, textarea, label')) {
      return
    }
    onSelect()
  }

  return (
    <div className={`my-1 flex items-center gap-1.5 ${justify}`} onClick={handleRowClick}>
      <div
        className={`xpe-btn xpe-btn--${variant} xpe-btn--md min-w-[64px] xpe-editor-btn`}
        style={previewStyle}
        onClick={handlePreviewClick}
      >
        <TextBlock
          ref={textRef}
          block={block}
          readonly={readonly}
          placeholder={t.defaultLabel}
          className="min-w-0 text-center outline-none"
          {...textEvents}
        />
      </div>

      {!readonly && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger>
            <button
              type="button"
              className={`xpe-btn-settings-trigger${open ? ' xpe-btn-settings-trigger--open' : ''}`}
              title={t.settings}
              aria-label={t.settings}
              aria-expanded={open}
            >
              <Settings2 className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="xpe-button-settings">
            <div className="xpe-button-settings__head">
              <span className="xpe-menu-brand" aria-hidden>
                <Settings2 />
              </span>
              <span className="xpe-button-settings__title">{dict.blockTypes.button}</span>
            </div>

            <div className="xpe-button-settings__body">
              <div className="xpe-button-settings__field">
                <span className="xpe-button-settings__label">{t.link}</span>
                <div className="xpe-button-settings__input-wrap">
                  <Link2 className="xpe-button-settings__input-icon" />
                  <input
                    ref={urlInputRef}
                    type="url"
                    className="xpe-button-settings__input"
                    placeholder="https://…"
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
                </div>
                <button
                  type="button"
                  className="xpe-button-settings__toggle"
                  role="switch"
                  aria-checked={!!openInNewTab}
                  onClick={() => onPatch({ openInNewTab: !openInNewTab })}
                >
                  <span className="xpe-button-settings__toggle-meta">
                    <SquareArrowOutUpRight />
                    {t.openInNewTab}
                  </span>
                  <span
                    className={`xpe-button-settings__switch${openInNewTab ? ' xpe-button-settings__switch--on' : ''}`}
                    aria-hidden
                  />
                </button>
              </div>

              <div className="xpe-button-settings__field">
                <span className="xpe-button-settings__label">{t.label}</span>
                <div className="xpe-button-settings__input-wrap">
                  <input
                    type="text"
                    className="xpe-button-settings__input"
                    style={{ paddingInlineStart: 10 }}
                    placeholder={t.defaultLabel}
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
                </div>
              </div>

              <div className="xpe-button-settings__field">
                <span className="xpe-button-settings__label">{t.style}</span>
                <div className="xpe-button-settings__seg" role="group" aria-label={t.style}>
                  {BUTTON_STYLE_OPTIONS.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className={`xpe-button-settings__seg-item${activeStyle === s.id ? ' xpe-button-settings__seg-item--active' : ''}`}
                      onClick={() => onPatch({ buttonStyle: s.id })}
                    >
                      {s.id === 'outline' ? t.outline : s.id === 'ghost' ? t.ghost : t.fill}
                    </button>
                  ))}
                </div>
              </div>

              <div className="xpe-button-settings__field">
                <span className="xpe-button-settings__label">{t.align}</span>
                <div className="xpe-button-settings__seg" role="group" aria-label={t.align}>
                  {BUTTON_ALIGN_OPTIONS.map((a) => {
                    const Icon = ALIGN_ICONS[a]
                    return (
                      <button
                        key={a}
                        type="button"
                        className={`xpe-button-settings__seg-item${activeAlign === a ? ' xpe-button-settings__seg-item--active' : ''}`}
                        onClick={() => onPatch({ align: a })}
                        aria-label={a === 'left' ? dict.toolbar.alignLeft : a === 'center' ? dict.toolbar.alignCenter : dict.toolbar.alignRight}
                        aria-pressed={activeAlign === a}
                      >
                        <Icon />
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="xpe-button-settings__field">
                <span className="xpe-button-settings__label">{t.color}</span>
                <div className="xpe-button-settings__swatches">
                  <button
                    type="button"
                    title={t.themeDefault}
                    aria-label={t.themeDefault}
                    className={`xpe-button-settings__swatch${!accent ? ' xpe-button-settings__swatch--active' : ''}`}
                    style={{ background: 'var(--xpe-primary, #4f46e5)' }}
                    onClick={() => onPatch({ color: undefined })}
                  >
                    {!accent && <Check />}
                  </button>
                  {BUTTON_COLOR_PRESETS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      title={c}
                      aria-label={c}
                      className={`xpe-button-settings__swatch${accent === c ? ' xpe-button-settings__swatch--active' : ''}${isLightSwatch(c) ? ' xpe-button-settings__swatch--light' : ''}`}
                      style={{ background: c }}
                      onClick={() => onPatch({ color: c })}
                    >
                      {accent === c && <Check />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
})
