import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import hljs from 'highlight.js/lib/common'
import { ChevronRight, Link as LinkIcon, X } from 'lucide-react'
import {
  computeListNumbering,
  escapeHtml,
  formatFileSize,
  headingAnchorIds,
  isAllowedEmbedUrl,
  normalizeTableData,
  resolveBlockDirection,
  spansToHtml,
  tableCellStyle,
  tableWrapperStyle,
} from '@xproeditor/core'
import type { Block, TableCell } from '@xproeditor/core'
import { IconValueDisplay } from '../ui'

export interface DocRendererProps {
  blocks: Block[]
  /** Fallback direction when block dir is auto and content is empty. */
  editorDir?: 'ltr' | 'rtl'
}

function headingTag(type: string): 'h2' | 'h3' | 'h4' {
  return type === 'heading_1' ? 'h2' : type === 'heading_2' ? 'h3' : 'h4'
}

function highlightCode(code: string, language?: string): string {
  try {
    if (language && language !== 'plaintext' && hljs.getLanguage(language)) {
      return hljs.highlight(code, { language }).value
    }
  } catch {
    /* fall through */
  }

  return escapeHtml(code)
}

export function DocRenderer({ blocks, editorDir }: DocRendererProps) {
  const [toggleOverrides, setToggleOverrides] = useState<Record<number, boolean>>({})
  const [copiedAnchor, setCopiedAnchor] = useState<string | null>(null)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

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

      if (block.type === 'toggle' && (toggleOverrides[idx] ?? block.props.collapsed))
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
                  title={copiedAnchor === anchorId ? 'Copied!' : 'Copy link'}
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
              className="db-p"
              dir="auto"
              style={{
                paddingInlineStart: `${(block.props.indent ?? 0) * 24}px`,
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
              className="db-li"
              dir={blockDir}
              style={{ paddingInlineStart: `${(block.props.indent ?? 0) * 24}px` }}
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
              className="db-li"
              dir={blockDir}
              style={{ paddingInlineStart: `${(block.props.indent ?? 0) * 24}px` }}
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

        if (block.type === 'toggle') {
          const collapsed = isCollapsed(idx, block)

          return (
            <div
              key={idx}
              className="db-li db-toggle"
              dir={blockDir}
              style={{ paddingInlineStart: `${(block.props.indent ?? 0) * 24}px` }}
              role="button"
              onClick={() => setToggleOverrides((prev) => ({ ...prev, [idx]: !collapsed }))}
            >
              <span
                className={`db-toggle-chevron${!collapsed ? ' rotate-90' : ''}${blockDir === 'rtl' ? ' db-toggle-chevron--rtl' : ''}`}
              >
                <ChevronRight className="w-4 h-4" />
              </span>
              <span
                className="db-li-content font-medium"
                dangerouslySetInnerHTML={{ __html: spansToHtml(block.content) }}
              />
            </div>
          )
        }

        if (block.type === 'quote') {
          return (
            <blockquote
              key={idx}
              className="db-quote"
              dir="auto"
              style={{ marginInlineStart: `${(block.props.indent ?? 0) * 24}px` }}
              dangerouslySetInnerHTML={{ __html: spansToHtml(block.content) }}
            />
          )
        }

        if (block.type === 'callout') {
          return (
            <div
              key={idx}
              className="db-callout"
              dir={blockDir}
              style={{
                marginInlineStart: `${(block.props.indent ?? 0) * 24}px`,
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
          return (
            <div key={idx} className="db-code" dir="ltr">
              <div className="db-code-header">
                <span>{block.props.language ?? 'plaintext'}</span>
              </div>
              <pre>
                <code
                  className="hljs"
                  dangerouslySetInnerHTML={{
                    __html: highlightCode(block.props.code ?? '', block.props.language),
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
                src={block.props.url}
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
                    title="Embedded video"
                  />
                ) : (
                  <video
                    src={block.props.url}
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
                <audio src={block.props.url} controls preload="metadata" className="w-full" />
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
              href={block.props.url}
              download={block.props.name ?? true}
              className="db-file"
            >
              <span className="db-file-name">{block.props.name || 'Download file'}</span>
              {block.props.size ? (
                <span className="db-file-size">{formatFileSize(block.props.size)}</span>
              ) : null}
            </a>
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
            <img src={lightboxUrl} className="max-w-full max-h-full rounded-lg shadow-2xl" alt="" />
            <button className="absolute top-4 end-4 text-white/80 hover:text-white">
              <X className="w-6 h-6" />
            </button>
          </div>,
          document.body,
        )}
    </div>
  )
}
