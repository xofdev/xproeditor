import { sanitizeLinkUrl, sanitizeMediaUrl } from '@xproeditor/core'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronRight, Copy, Link as LinkIcon, X } from 'lucide-react'
import {
  computeListNumbering,
  embedFrameHeight,
  escapeHtml,
  extractHeadings,
  resolveEmbed,
  formatFileSize,
  headingAnchorIds,
  isAllowedEmbedUrl,
  isToggleBlock,
  normalizeTableData,
  resolveBlockDirection,
  spansToHtml,
  tableCellStyle,
  tableWrapperStyle,
  toggleHeadingLevel,
} from '@xproeditor/core'
import type { Block, TableCell } from '@xproeditor/core'
import { IconValueDisplay } from '../ui'
import { EditorI18nProvider, useEditorDictionary, type EditorI18nProps } from '../i18n'
import { highlightCode, isHighlighterReady, loadHighlighter } from '../utils/highlight'

export interface DocRendererProps {
  blocks: Block[]
  /** Fallback direction when block dir is auto and content is empty. */
  editorDir?: 'ltr' | 'rtl'
  /** UI language for the renderer chrome (`'en'` default, `'fa'` built in). */
  locale?: EditorI18nProps['locale']
  /** Override any UI string. */
  dictionary?: EditorI18nProps['dictionary']
}

function headingTag(type: string): 'h2' | 'h3' | 'h4' {
  return type === 'heading_1' ? 'h2' : type === 'heading_2' ? 'h3' : 'h4'
}

function indentVars(indent = 0): CSSProperties {
  return { ['--xpe-block-indent' as string]: indent }
}

/** Read-only renderer for a `Block[]` document (blog posts, docs pages, previews). */
export function DocRenderer({ locale, dictionary, ...props }: DocRendererProps) {
  return (
    <EditorI18nProvider locale={locale} dictionary={dictionary}>
      <DocRendererContent {...props} />
    </EditorI18nProvider>
  )
}

function DocRendererContent({ blocks, editorDir }: Omit<DocRendererProps, 'locale' | 'dictionary'>) {
  const dict = useEditorDictionary()
  const headings = useMemo(() => extractHeadings(blocks), [blocks])
  const [toggleOverrides, setToggleOverrides] = useState<Record<number, boolean>>({})
  const [copiedAnchor, setCopiedAnchor] = useState<string | null>(null)
  const [copiedCode, setCopiedCode] = useState<number | null>(null)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const hasCode = useMemo(() => blocks.some((b) => b.type === 'code'), [blocks])

  // Escape closes the image lightbox.
  useEffect(() => {
    if (!lightboxUrl) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxUrl(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightboxUrl])
  const [, setHighlighterReady] = useState(isHighlighterReady)

  useEffect(() => {
    if (!hasCode || isHighlighterReady()) return
    let alive = true
    void loadHighlighter().then(() => {
      if (alive) setHighlighterReady(true)
    })
    return () => {
      alive = false
    }
  }, [hasCode])

  function isCollapsed(idx: number, block: Block): boolean {
    return toggleOverrides[idx] ?? block.props.collapsed ?? false
  }

  const visible = useMemo(() => {
    const out: Array<{ block: Block; idx: number }> = []
    let hideDeeperThan: number | null = null

    blocks.forEach((block, idx) => {
      const ind = block.props.indent ?? 0

      if (hideDeeperThan !== null) {
        if (ind > hideDeeperThan) return
        hideDeeperThan = null
      }

      out.push({ block, idx })

      if (isToggleBlock(block.type) && (toggleOverrides[idx] ?? block.props.collapsed))
        hideDeeperThan = ind
    })

    return out
  }, [blocks, toggleOverrides])

  const numbering = useMemo(() => computeListNumbering(visible.map((v) => v.block)), [visible])
  const anchors = useMemo(() => headingAnchorIds(blocks), [blocks])

  function copyAnchor(id: string) {
    const url = `${window.location.origin}${window.location.pathname}#${id}`
    navigator.clipboard?.writeText(url)
    setCopiedAnchor(id)
    setTimeout(() => setCopiedAnchor(null), 1500)
  }

  async function copyCodeBlock(idx: number, text: string) {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      /* ignore */
    }
    setCopiedCode(idx)
    setTimeout(() => setCopiedCode((cur) => (cur === idx ? null : cur)), 1600)
  }

  function safeVideoEmbedUrl(block: Block): string {
    const url = block.props.url ?? ''
    if (block.props.provider === 'youtube' || block.props.provider === 'vimeo')
      return isAllowedEmbedUrl(url) ? url : ''
    return url
  }

  function renderCellStyle(cell: TableCell, rowIdx: number, hasHeader: boolean, block: Block) {
    return tableCellStyle(cell, rowIdx, hasHeader, normalizeTableData(block.props.table).style)
  }

  return (
    <div className="doc-blocks" dir="auto">
      {visible.map(({ block, idx }) => {
        const blockDir = resolveBlockDirection(block, editorDir ?? 'ltr')

        if (block.type.startsWith('heading')) {
          const Tag = headingTag(block.type)
          const anchorId = anchors.get(block.id)

          return (
            <Tag key={idx} id={anchorId} className={`db-heading group db-${block.type}`} dir="auto">
              <span dangerouslySetInnerHTML={{ __html: spansToHtml(block.content) }} />
              {anchorId && (
                <button
                  className="db-anchor-btn"
                  title={copiedAnchor === anchorId ? dict.renderer.linkCopied : dict.renderer.copyLink}
                  aria-label={dict.renderer.copyLink}
                  onClick={() => copyAnchor(anchorId)}
                >
                  <LinkIcon className="w-3.5 h-3.5" />
                </button>
              )}
            </Tag>
          )
        }

        if (block.type === 'paragraph') {
          return (
            <p
              key={idx}
              className="db-p db-indent"
              dir="auto"
              style={{
                ...indentVars(block.props.indent),
                textAlign: block.props.align,
              }}
              dangerouslySetInnerHTML={{ __html: spansToHtml(block.content) }}
            />
          )
        }

        if (block.type === 'bulleted_list_item' || block.type === 'numbered_list_item') {
          return (
            <div
              key={idx}
              className="db-li db-indent"
              dir={blockDir}
              style={indentVars(block.props.indent)}
            >
              <span
                className={`db-li-marker${block.type === 'numbered_list_item' ? ' tabular-nums' : ''}`}
              >
                {block.type === 'bulleted_list_item' ? '•' : `${numbering.get(block.id) ?? 1}.`}
              </span>
              <span
                className="db-li-content"
                dangerouslySetInnerHTML={{ __html: spansToHtml(block.content) }}
              />
            </div>
          )
        }

        if (block.type === 'to_do') {
          return (
            <div
              key={idx}
              className="db-li db-indent"
              dir={blockDir}
              style={indentVars(block.props.indent)}
            >
              <span className={`db-todo-box${block.props.checked ? ' db-todo-checked' : ''}`}>
                {block.props.checked && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </span>
              <span
                className={`db-li-content${block.props.checked ? ' line-through opacity-50' : ''}`}
                dangerouslySetInnerHTML={{ __html: spansToHtml(block.content) }}
              />
            </div>
          )
        }

        if (isToggleBlock(block.type)) {
          const collapsed = isCollapsed(idx, block)
          const level = toggleHeadingLevel(block.type)

          return (
            <div
              key={idx}
              className={`db-li db-toggle db-indent${level ? ` db-toggle-heading_${level}` : ''}`}
              dir={blockDir}
              style={indentVars(block.props.indent)}
              role="button"
              aria-expanded={!collapsed}
              onClick={() => setToggleOverrides((prev) => ({ ...prev, [idx]: !collapsed }))}
            >
              <span
                className={`db-toggle-chevron${!collapsed ? ' rotate-90' : ''}${blockDir === 'rtl' ? ' db-toggle-chevron--rtl' : ''}`}
              >
                <ChevronRight className="w-4 h-4" />
              </span>
              <span
                className={`db-li-content${level ? '' : ' font-medium'}`}
                dangerouslySetInnerHTML={{ __html: spansToHtml(block.content) }}
              />
            </div>
          )
        }

        if (block.type === 'quote') {
          return (
            <blockquote
              key={idx}
              className="db-quote db-indent-margin"
              dir="auto"
              style={indentVars(block.props.indent)}
              dangerouslySetInnerHTML={{ __html: spansToHtml(block.content) }}
            />
          )
        }

        if (block.type === 'callout') {
          return (
            <div
              key={idx}
              className="db-callout db-indent-margin"
              dir={blockDir}
              style={{
                ...indentVars(block.props.indent),
                background: block.props.color || undefined,
              }}
            >
              <span className="db-callout-icon">
                <IconValueDisplay icon={block.props.icon ?? '💡'} className="text-lg" />
              </span>
              <span
                className="db-li-content"
                dangerouslySetInnerHTML={{ __html: spansToHtml(block.content) }}
              />
            </div>
          )
        }

        if (block.type === 'code') {
          const lang = block.props.language ?? 'plaintext'
          const text = block.props.code ?? ''
          const isCopied = copiedCode === idx
          return (
            <div
              key={idx}
              className={`db-code${block.props.wrap ? ' db-code--wrap' : ''}`}
              dir="ltr"
            >
              <div className="db-code-header">
                <span className="db-code-lang">{lang === 'plaintext' ? 'Plain text' : lang}</span>
                <button
                  type="button"
                  className={`db-code-copy${isCopied ? ' db-code-copy--ok' : ''}`}
                  title={isCopied ? dict.renderer.codeCopied : dict.renderer.copyCode}
                  aria-label={isCopied ? dict.renderer.codeCopied : dict.renderer.copyCode}
                  onClick={() => void copyCodeBlock(idx, text)}
                >
                  {isCopied ? <Check /> : <Copy />}
                </button>
              </div>
              <pre>
                <code
                  className="hljs"
                  dangerouslySetInnerHTML={{
                    __html: highlightCode(text, block.props.language),
                  }}
                />
              </pre>
            </div>
          )
        }

        if (block.type === 'divider') return <hr key={idx} className="db-divider" />

        if (block.type === 'image' && block.props.url) {
          return (
            <figure key={idx} className="db-figure">
              <img
                src={sanitizeMediaUrl(block.props.url) || undefined}
                alt={block.props.caption || ''}
                style={{ width: `${block.props.width ?? 100}%` }}
                className="db-img"
                loading="lazy"
                onClick={() => setLightboxUrl(block.props.url ?? null)}
              />
              {block.props.caption && (
                <figcaption className="db-caption">{block.props.caption}</figcaption>
              )}
            </figure>
          )
        }

        if (block.type === 'video' && block.props.url) {
          const embed =
            (block.props.provider === 'youtube' || block.props.provider === 'vimeo') &&
            safeVideoEmbedUrl(block)

          return (
            <figure key={idx} className="db-figure">
              <div
                className="db-video-wrap overflow-hidden rounded-xl bg-black"
                style={{ width: `${block.props.width ?? 100}%` }}
              >
                {embed ? (
                  <iframe
                    src={safeVideoEmbedUrl(block)}
                    className="aspect-video w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title={block.props.caption || dict.media.videoEmbedded}
                  />
                ) : (
                  <video
                    src={sanitizeMediaUrl(block.props.url) || undefined}
                    className="aspect-video w-full"
                    controls
                    playsInline
                  />
                )}
              </div>
              {block.props.caption && (
                <figcaption className="db-caption">{block.props.caption}</figcaption>
              )}
            </figure>
          )
        }

        if (block.type === 'audio' && block.props.url) {
          return (
            <figure key={idx} className="db-figure">
              <div className="db-audio-wrap">
                {block.props.name && <div className="db-audio-name">{block.props.name}</div>}
                <audio src={sanitizeMediaUrl(block.props.url) || undefined} controls preload="metadata" className="w-full" />
              </div>
              {block.props.caption && (
                <figcaption className="db-caption">{block.props.caption}</figcaption>
              )}
            </figure>
          )
        }

        if (block.type === 'file' && block.props.url) {
          return (
            <a
              key={idx}
              href={sanitizeLinkUrl(block.props.url, { allowBlob: true }) || undefined}
              download={block.props.name ?? true}
              className="db-file"
            >
              <span className="db-file-name">{block.props.name || dict.renderer.downloadFile}</span>
              {block.props.size ? (
                <span className="db-file-size">{formatFileSize(block.props.size)}</span>
              ) : null}
            </a>
          )
        }

        if (block.type === 'button') {
          const variant = block.props.buttonStyle ?? 'primary'
          const justify =
            block.props.align === 'center' ? 'center' : block.props.align === 'right' ? 'flex-end' : 'flex-start'
          const label = spansToHtml(block.content) || escapeHtml(dict.button.defaultLabel)
          const accent = block.props.color
          const style: CSSProperties | undefined = accent
            ? variant === 'primary'
              ? { background: accent, borderColor: accent, color: '#fff', ['--xpe-btn-accent' as string]: accent }
              : variant === 'outline'
                ? { borderColor: accent, color: accent, ['--xpe-btn-accent' as string]: accent }
                : { color: accent, ['--xpe-btn-accent' as string]: accent }
            : undefined

          return (
            <div key={idx} className="db-button-row" style={{ justifyContent: justify }}>
              {block.props.url ? (
                <a
                  href={sanitizeLinkUrl(block.props.url, { allowBlob: true }) || undefined}
                  target={block.props.openInNewTab ? '_blank' : undefined}
                  rel={block.props.openInNewTab ? 'noopener noreferrer' : undefined}
                  className={`db-button db-button--${variant}`}
                  style={style}
                  dangerouslySetInnerHTML={{ __html: label }}
                />
              ) : (
                <span
                  className={`db-button db-button--${variant}`}
                  style={style}
                  dangerouslySetInnerHTML={{ __html: label }}
                />
              )}
            </div>
          )
        }

        if (block.type === 'bookmark' && block.props.url) {
          const title = block.props.title || block.props.url
          let host = block.props.url
          try {
            host = new URL(block.props.url).hostname.replace(/^www\./i, '')
          } catch {
            /* keep raw url */
          }

          return (
            <a
              key={idx}
              className="db-bookmark"
              href={sanitizeLinkUrl(block.props.url, { allowBlob: true }) || undefined}
              target="_blank"
              rel="noopener noreferrer"
            >
              <div className="db-bookmark__body">
                <div className="db-bookmark__title">
                  {block.props.favicon ? (
                    <img src={sanitizeMediaUrl(block.props.favicon) || undefined} alt="" className="db-bookmark__favicon" />
                  ) : null}
                  <span>{title}</span>
                </div>
                {block.props.description ? (
                  <p className="db-bookmark__desc">{block.props.description}</p>
                ) : null}
                <span className="db-bookmark__url">{host}</span>
              </div>
              {block.props.image ? (
                <div className="db-bookmark__media">
                  <img src={sanitizeMediaUrl(block.props.image) || undefined} alt="" />
                </div>
              ) : null}
            </a>
          )
        }

        if (block.type === 'embed') {
          const resolved = resolveEmbed(block.props.url)
          if (!resolved) return null
          const height = embedFrameHeight(block.props.height, resolved.height)

          return (
            <figure key={idx} className="db-figure db-embed">
              <iframe
                src={resolved.embedUrl}
                title={block.props.caption || resolved.provider.name}
                className="db-embed__frame"
                style={{ height }}
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; gyroscope; picture-in-picture"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                sandbox="allow-scripts allow-same-origin allow-popups allow-presentation allow-forms"
              />
              {block.props.caption && (
                <figcaption className="db-caption">{block.props.caption}</figcaption>
              )}
            </figure>
          )
        }

        if (block.type === 'table_of_contents') {
          if (headings.length === 0) return null

          return (
            <nav key={idx} className="db-toc" aria-label={dict.toc.title} dir="auto">
              <p className="db-toc__title">{dict.toc.title}</p>
              <ul className="db-toc__list">
                {headings.map((h) => (
                  <li key={h.id} className={`db-toc__item db-toc__item--${h.level}`}>
                    <a href={`#${h.id}`}>{h.text}</a>
                  </li>
                ))}
              </ul>
            </nav>
          )
        }

        if (block.type === 'table' && block.props.table) {
          const table = normalizeTableData(block.props.table)

          return (
            <div
              key={idx}
              className="db-table-wrap"
              dir="auto"
              style={tableWrapperStyle(table.style, table.width)}
            >
              <table className="db-table">
                <tbody>
                  {table.rows.map((row, rIdx) => (
                    <tr key={rIdx}>
                      {row.map((cell, cIdx) => {
                        if (cell.hidden) return null
                        const Tag = rIdx === 0 && table.hasHeader ? 'th' : 'td'

                        return (
                          <Tag
                            key={cIdx}
                            colSpan={cell.colspan && cell.colspan > 1 ? cell.colspan : undefined}
                            rowSpan={cell.rowspan && cell.rowspan > 1 ? cell.rowspan : undefined}
                            style={renderCellStyle(cell, rIdx, table.hasHeader, block)}
                            dir="auto"
                            dangerouslySetInnerHTML={{ __html: spansToHtml(cell.content) }}
                          />
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }

        return null
      })}

      {lightboxUrl &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-6 cursor-zoom-out"
            onClick={() => setLightboxUrl(null)}
          >
            <img src={sanitizeMediaUrl(lightboxUrl) || undefined} className="max-w-full max-h-full rounded-lg shadow-2xl" alt="" />
            <button
              type="button"
              aria-label={dict.common.close}
              className="absolute top-4 end-4 text-white/80 hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>
          </div>,
          document.body,
        )}
    </div>
  )
}
