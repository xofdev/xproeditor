import { useEffect, useRef, useState } from 'react'
import { AppWindow, ExternalLink, Pencil, Settings2 } from 'lucide-react'
import {
  embedFrameHeight,
  resolveEmbed,
  sanitizeLinkUrl,
  extractEmbedSource,
  type Block,
} from '@xproeditor/core'
import { Popover, PopoverContent, PopoverTrigger } from '../ui'
import { useEditorDictionary } from '../i18n'

export interface EmbedBlockProps {
  block: Block
  selected?: boolean
  readonly?: boolean
  onPatch: (patch: Record<string, unknown>) => void
  onSelect: () => void
}

/**
 * Allow-listed iframe embed (YouTube, Vimeo, Loom, Figma, CodePen, …). The
 * iframe `src` is always re-derived from `props.url` via `resolveEmbed`, so a
 * stored document can't point the frame anywhere else.
 */
export function EmbedBlock({ block, selected, readonly, onPatch, onSelect }: EmbedBlockProps) {
  const t = useEditorDictionary().embed
  const url = (block.props.url ?? '').trim()
  const resolved = resolveEmbed(url)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(url)
  const [heightDraft, setHeightDraft] = useState(String(block.props.height ?? ''))
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => setDraft(url), [url])
  useEffect(() => setHeightDraft(String(block.props.height ?? '')), [block.props.height])

  // First insert: open the URL form.
  useEffect(() => {
    if (!readonly && !url) setOpen(true)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return
    const id = window.setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 0)
    return () => window.clearTimeout(id)
  }, [open])

  function submit() {
    const source = extractEmbedSource(draft)
    const next = resolveEmbed(source)

    if (!next) {
      setError(t.invalidUrl)
      return
    }

    const height = Number(heightDraft)
    setError('')
    onPatch({
      url: source,
      provider: next.provider.id,
      height:
        Number.isFinite(height) && height > 0 ? embedFrameHeight(height, next.height) : undefined,
    })
    setOpen(false)
  }

  function remove() {
    onPatch({ url: '', provider: undefined, height: undefined })
    setDraft('')
    setOpen(true)
  }

  const form = (
    <div className="xpe-bookmark-form" onMouseDown={(e) => e.stopPropagation()}>
      <input
        ref={inputRef}
        type="url"
        className="xpe-bookmark-form__input"
        placeholder={t.placeholder}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value)
          if (error) setError('')
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            submit()
          }
          if (e.key === 'Escape') {
            e.preventDefault()
            setOpen(false)
          }
        }}
      />
      {url && (
        <label className="xpe-embed-form__height">
          <span>{t.height}</span>
          <input
            type="number"
            min={80}
            max={1200}
            step={10}
            className="xpe-bookmark-form__input"
            value={heightDraft}
            placeholder={String(resolved?.height ?? 400)}
            onChange={(e) => setHeightDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                submit()
              }
            }}
          />
        </label>
      )}
      {error && (
        <p className="xpe-bookmark-form__error" role="alert">
          {error}
        </p>
      )}
      <button
        type="button"
        className="xpe-bookmark-form__submit"
        disabled={!draft.trim()}
        onClick={submit}
      >
        {url ? t.update : t.submit}
      </button>
      <p className="xpe-bookmark-form__hint">{t.hint}</p>
      {url && !readonly && (
        <button type="button" className="xpe-bookmark-form__clear" onClick={remove}>
          {t.remove}
        </button>
      )}
    </div>
  )

  if (!resolved) {
    if (readonly) return null

    return (
      <div className="my-1">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger>
            <button
              type="button"
              className={`xpe-bookmark xpe-bookmark--empty${selected ? ' xpe-bookmark--selected' : ''}`}
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                onSelect()
                setOpen(true)
              }}
            >
              <AppWindow className="xpe-bookmark__icon" />
              <span>{t.add}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="xpe-bookmark-popover xpe-float">
            {form}
          </PopoverContent>
        </Popover>
      </div>
    )
  }

  const height = embedFrameHeight(block.props.height, resolved.height)
  const original = sanitizeLinkUrl(url)

  return (
    <div
      className={`my-1 xpe-embed xpe-bookmark-wrap${selected ? ' xpe-bookmark-wrap--selected' : ''}`}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('a, button, input')) return
        onSelect()
      }}
    >
      <div className="xpe-embed__body">
        <div className="xpe-embed__bar" contentEditable={false}>
          <span className="xpe-embed__provider">
            <AppWindow aria-hidden />
            {resolved.provider.name}
          </span>
          {original && (
            <a
              className="xpe-embed__open"
              href={original}
              target="_blank"
              rel="noopener noreferrer"
              title={t.open}
              aria-label={t.open}
            >
              <ExternalLink />
            </a>
          )}
        </div>
        <iframe
          src={resolved.embedUrl}
          title={block.props.caption || resolved.provider.name}
          className="xpe-embed__frame"
          style={{ height }}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; gyroscope; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-scripts allow-same-origin allow-popups allow-presentation allow-forms"
        />
      </div>

      {!readonly && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger>
            <button
              type="button"
              className={`xpe-btn-settings-trigger${open ? ' xpe-btn-settings-trigger--open' : ''}`}
              title={t.edit}
              aria-label={t.edit}
              aria-expanded={open}
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                setOpen((v) => !v)
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="xpe-bookmark-popover xpe-float">
            <div className="xpe-bookmark-popover__head">
              <span className="xpe-menu-brand" aria-hidden>
                <Settings2 />
              </span>
              <span className="xpe-bookmark-popover__title">{t.title}</span>
            </div>
            {form}
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}
