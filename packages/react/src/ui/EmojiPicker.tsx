import { useEffect, useMemo, useRef, useState } from 'react'
import { Clock, Hash, Lightbulb, Leaf, Music, Plane, Search, Smile, UtensilsCrossed } from 'lucide-react'
import { ALL_EMOJIS, EMOJI_CATEGORIES, type EmojiEntry } from './emojiData'

const RECENTS_KEY = 'xpe-emoji-recents'
const MAX_RECENTS = 24

function readRecents(): string[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : []
  } catch {
    return []
  }
}

function pushRecent(char: string) {
  try {
    const next = [char, ...readRecents().filter((c) => c !== char)].slice(0, MAX_RECENTS)
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next))
  } catch {
    /* storage unavailable */
  }
}

const CATEGORY_ICONS: Record<string, typeof Smile> = {
  smileys: Smile,
  nature: Leaf,
  food: UtensilsCrossed,
  activities: Music,
  travel: Plane,
  objects: Lightbulb,
  symbols: Hash,
}

export interface EmojiPickerProps {
  onSelect: (emoji: string) => void
  /** Focus the search input as soon as the picker mounts. */
  autoFocus?: boolean
  /**
   * Controlled query, driving the grid without rendering an internal search
   * input — used by the ':' inline trigger, where the query is typed
   * directly into the text block rather than into the popover itself.
   */
  query?: string
}

export function EmojiPicker({ onSelect, autoFocus, query: externalQuery }: EmojiPickerProps) {
  const controlled = externalQuery !== undefined
  const [internalQuery, setInternalQuery] = useState('')
  const query = controlled ? externalQuery : internalQuery
  const [recents, setRecents] = useState<string[]>(() => readRecents())
  const searchRef = useRef<HTMLInputElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})

  useEffect(() => {
    if (autoFocus && !controlled) searchRef.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFocus])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return null
    return ALL_EMOJIS.filter(
      (e) => e.name.includes(q) || e.keywords.some((k) => k.includes(q)),
    ).slice(0, 60)
  }, [query])

  function pick(entry: EmojiEntry) {
    pushRecent(entry.char)
    setRecents(readRecents())
    onSelect(entry.char)
  }

  function scrollToCategory(id: string) {
    setInternalQuery('')
    requestAnimationFrame(() => {
      sectionRefs.current[id]?.scrollIntoView({ block: 'start' })
    })
  }

  const categoriesToRender =
    recents.length > 0
      ? [{ id: 'recents', label: 'Recently used', emojis: recents.map(charToEntry).filter(Boolean) as EmojiEntry[] }, ...EMOJI_CATEGORIES]
      : EMOJI_CATEGORIES

  return (
    <div className={`xpe-emoji-picker${controlled ? ' xpe-emoji-picker--controlled' : ''}`}>
      {!controlled && (
        <div className="xpe-emoji-search">
          <Search className="h-3.5 w-3.5 shrink-0 text-[var(--xpe-muted-foreground)]" />
          <input
            ref={searchRef}
            type="text"
            value={internalQuery}
            placeholder="Search emoji..."
            className="xpe-emoji-search-input"
            onChange={(e) => setInternalQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && filtered && filtered[0]) {
                e.preventDefault()
                pick(filtered[0])
              }
            }}
          />
        </div>
      )}

      <div ref={scrollRef} className="xpe-emoji-scroll">
        {controlled && !filtered ? (
          <p className="xpe-emoji-empty">Keep typing to search emoji…</p>
        ) : filtered ? (
          filtered.length === 0 ? (
            <p className="xpe-emoji-empty">No emoji found</p>
          ) : (
            <div className="xpe-emoji-grid">
              {filtered.map((entry) => (
                <button
                  key={entry.char}
                  type="button"
                  className="xpe-emoji-cell"
                  title={entry.name}
                  onClick={() => pick(entry)}
                >
                  {entry.char}
                </button>
              ))}
            </div>
          )
        ) : (
          categoriesToRender.map((cat) => (
            <div key={cat.id} ref={(el) => { sectionRefs.current[cat.id] = el }}>
              <p className="xpe-emoji-heading">{cat.label}</p>
              <div className="xpe-emoji-grid">
                {cat.emojis.map((entry) => (
                  <button
                    key={entry.char}
                    type="button"
                    className="xpe-emoji-cell"
                    title={entry.name}
                    onClick={() => pick(entry)}
                  >
                    {entry.char}
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {!controlled && (
        <div className="xpe-emoji-catbar">
          <button type="button" title="Recently used" onClick={() => scrollToCategory('recents')}>
            <Clock className="h-4 w-4" />
          </button>
          {EMOJI_CATEGORIES.map((cat) => {
            const Icon = CATEGORY_ICONS[cat.id] ?? Hash
            return (
              <button key={cat.id} type="button" title={cat.label} onClick={() => scrollToCategory(cat.id)}>
                <Icon className="h-4 w-4" />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function charToEntry(char: string): EmojiEntry | undefined {
  return ALL_EMOJIS.find((e) => e.char === char)
}
