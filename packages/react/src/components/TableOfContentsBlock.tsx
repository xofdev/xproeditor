import { ListTree } from 'lucide-react'
import type { DocHeading } from '@xproeditor/core'
import { useEditorDictionary } from '../i18n'

export interface TableOfContentsBlockProps {
  headings: DocHeading[]
  selected?: boolean
  onSelect: () => void
  /** Scroll to / focus a heading block. */
  onNavigate: (blockId: string) => void
}

/** Live table of contents built from the document's headings. */
export function TableOfContentsBlock({
  headings,
  selected,
  onSelect,
  onNavigate,
}: TableOfContentsBlockProps) {
  const t = useEditorDictionary().toc

  return (
    <nav
      className={`xpe-toc my-1${selected ? ' xpe-toc--selected' : ''}`}
      aria-label={t.title}
      contentEditable={false}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('button')) return
        onSelect()
      }}
    >
      <p className="xpe-toc__title">
        <ListTree aria-hidden className="xpe-toc__icon" />
        {t.title}
      </p>
      {headings.length === 0 ? (
        <p className="xpe-toc__empty">{t.empty}</p>
      ) : (
        <ul className="xpe-toc__list">
          {headings.map((h) => (
            <li key={h.blockId} className={`xpe-toc__item xpe-toc__item--${h.level}`}>
              <button type="button" onClick={() => onNavigate(h.blockId)}>
                {h.text}
              </button>
            </li>
          ))}
        </ul>
      )}
    </nav>
  )
}
