import { sanitizeLinkUrl, sanitizeMediaUrl } from '@xproeditor/core'
import { useEffect, useRef, useState } from 'react'
import { Bookmark, Globe, Loader2, Pencil, Settings2 } from 'lucide-react'
import {
  bookmarkDisplayTitle,
  bookmarkHostname,
  normalizeBookmarkUrl,
  type Block,
  type FetchBookmarkMetaFn,
} from '@xproeditor/core'
import { Popover, PopoverContent, PopoverTrigger } from '../ui'
import { useEditorDictionary } from '../i18n'

export interface BookmarkBlockProps {
  block: Block
  selected?: boolean
  readonly?: boolean
  fetchBookmarkMeta?: FetchBookmarkMetaFn
  onPatch: (patch: Record<string, unknown>) => void
  onSelect: () => void
}

export function BookmarkBlock({
  block,
  selected,
  readonly,
  fetchBookmarkMeta,
  onPatch,
  onSelect,
}: BookmarkBlockProps) {
  const dict = useEditorDictionary()
  const t = dict.bookmark
  const url = (block.props.url ?? '').trim()
  const hasUrl = !!url
  const [open, setOpen] = useState(false)
  const [urlDraft, setUrlDraft] = useState(url)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [faviconBroken, setFaviconBroken] = useState(false)
  const [imageBroken, setImageBroken] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setUrlDraft(url)
  }, [url])

  useEffect(() => {
    setFaviconBroken(false)
    setImageBroken(false)
  }, [block.props.favicon, block.props.image, url])

  // First insert: open the create popover
  useEffect(() => {
    if (!readonly && !hasUrl) setOpen(true)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return
    const id = window.setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 0)
    return () => window.clearTimeout(id)
  }, [open])

  async function createBookmark() {
    setError('')
    const normalized = normalizeBookmarkUrl(urlDraft)
    if (!normalized) {
      setError(t.invalidUrl)
      return
    }

    setLoading(true)
    try {
      let meta: {
        title?: string
        description?: string
        favicon?: string
        image?: string
      } = {}

      if (fetchBookmarkMeta) {
        try {
          const result = await fetchBookmarkMeta(normalized)
          if (result) meta = result
        } catch {
          // Graceful fallback — card still works from URL alone
        }
      }

      onPatch({
        url: normalized,
        title: meta.title || '',
        description: meta.description || '',
        favicon: meta.favicon || '',
        image: meta.image || '',
      })
      setOpen(false)
    } finally {
      setLoading(false)
    }
  }

  function clearBookmark() {
    onPatch({
      url: '',
      title: '',
      description: '',
      favicon: '',
      image: '',
    })
    setUrlDraft('')
    setOpen(true)
  }

  const title = bookmarkDisplayTitle({ url, title: block.props.title })
  const host = url ? bookmarkHostname(url) : ''
  const description = block.props.description?.trim() || ''
  const favicon = block.props.favicon
  const image = block.props.image

  const form = (
    <div className="xpe-bookmark-form" onMouseDown={(e) => e.stopPropagation()}>
      <input
        ref={inputRef}
        type="url"
        className="xpe-bookmark-form__input"
        placeholder={t.placeholder}
        value={urlDraft}
        disabled={loading}
        onChange={(e) => {
          setUrlDraft(e.target.value)
          if (error) setError('')
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            void createBookmark()
          }
          if (e.key === 'Escape') {
            e.preventDefault()
            setOpen(false)
          }
        }}
      />
      {error && <p className="xpe-bookmark-form__error">{error}</p>}
      <button
        type="button"
        className="xpe-bookmark-form__submit"
        disabled={loading || !urlDraft.trim()}
        onClick={() => void createBookmark()}
      >
        {loading ? (
          <>
            <Loader2 className="xpe-bookmark-form__spin" />
            {t.creating}
          </>
        ) : hasUrl ? (
          t.update
        ) : (
          t.create
        )}
      </button>
      <p className="xpe-bookmark-form__hint">{t.hint}</p>
      {hasUrl && !readonly && (
        <button type="button" className="xpe-bookmark-form__clear" onClick={clearBookmark}>
          {t.removeLink}
        </button>
      )}
    </div>
  )

  if (!hasUrl) {
    if (readonly) {
      return (
        <div className="xpe-bookmark xpe-bookmark--empty xpe-bookmark--readonly">
          <Bookmark className="xpe-bookmark__icon" />
          <span>{dict.blockTypes.bookmark}</span>
        </div>
      )
    }

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
                // Own open state: stopPropagation blocks PopoverTrigger's parent span.
                e.stopPropagation()
                onSelect()
                setOpen(true)
              }}
            >
              <Bookmark className="xpe-bookmark__icon" />
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

  return (
    <div
      className={`my-1 xpe-bookmark-wrap${selected ? ' xpe-bookmark-wrap--selected' : ''}`}
      onClick={(e) => {
        const target = e.target as HTMLElement
        if (target.closest('a, button, input, textarea')) return
        onSelect()
      }}
    >
      <a
        className="xpe-bookmark-card"
        href={sanitizeLinkUrl(url, { allowBlob: true }) || undefined}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => {
          if (readonly) return
          // Allow selection chrome; cmd/ctrl+click still opens
          if (!e.metaKey && !e.ctrlKey) {
            // Normal click opens in new tab (target=_blank) — stop editor select noise
            e.stopPropagation()
          }
        }}
      >
        <div className="xpe-bookmark-card__body">
          <div className="xpe-bookmark-card__title-row">
            {favicon && !faviconBroken ? (
              <img
                src={sanitizeMediaUrl(favicon) || undefined}
                alt=""
                className="xpe-bookmark-card__favicon"
                onError={() => setFaviconBroken(true)}
              />
            ) : (
              <Globe className="xpe-bookmark-card__favicon-fallback" aria-hidden />
            )}
            <span className="xpe-bookmark-card__title">{title}</span>
          </div>
          {description && <p className="xpe-bookmark-card__desc">{description}</p>}
          <span className="xpe-bookmark-card__url">{host || url}</span>
        </div>
        {image && !imageBroken && (
          <div className="xpe-bookmark-card__media">
            <img src={sanitizeMediaUrl(image) || undefined} alt="" onError={() => setImageBroken(true)} />
          </div>
        )}
      </a>

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
                // Toggle here: stopPropagation blocks PopoverTrigger's parent span.
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
