import { AlignCenterHorizontal, AlignEndHorizontal, AlignStartHorizontal, Columns2, Columns3, Rows3 } from 'lucide-react'
import { COLUMN_GAPS, COLUMN_LAYOUTS, columnAlign, columnCount, columnGap, columnStack, columnWidths } from '@xproeditor/core'
import type { Block, ColumnAlign, ColumnCount, ColumnStack } from '@xproeditor/core'
import { useEditorDictionary } from '../i18n'

/**
 * The header of a columns group in the editor: the group's own block. It shows
 * the layout and lets the author change it — column count, width preset, gap,
 * vertical alignment and the stacking order on small screens — or remove the
 * columns and keep their content. The columns themselves render below it
 * (BlockEditor), each holding ordinary blocks.
 */

export interface ColumnsBlockProps {
  block: Block
  readonly?: boolean
  selected?: boolean
  className?: string
  onPatch: (patch: Record<string, unknown>) => void
  onUnwrap: () => void
  onSelect: () => void
}

const sameWidths = (a: number[], b: number[]) => a.length === b.length && a.every((w, i) => Math.abs(w - b[i]) < 0.5)
const GAP_LABELS = ['S', 'M', 'L', 'XL']

export function ColumnsBlock({ block, readonly, selected, className, onPatch, onUnwrap, onSelect }: ColumnsBlockProps) {
  const t = useEditorDictionary().columns

  const count = columnCount(block)
  const widths = columnWidths(block)
  const gap = columnGap(block)
  const align = columnAlign(block)
  const stack = columnStack(block)
  const layouts = COLUMN_LAYOUTS[count]
  const CountIcon = count === 3 ? Columns3 : Columns2

  function setCount(value: ColumnCount) {
    if (value !== count) onPatch({ columnCount: value })
  }

  const aligns: Array<{ id: ColumnAlign; icon: typeof Columns2; label: string }> = [
    { id: 'top', icon: AlignStartHorizontal, label: t.alignTop },
    { id: 'center', icon: AlignCenterHorizontal, label: t.alignCenter },
    { id: 'bottom', icon: AlignEndHorizontal, label: t.alignBottom },
  ]

  const stacks: Array<{ id: ColumnStack; label: string }> = [
    { id: 'normal', label: t.stackNormal },
    { id: 'reverse', label: t.stackReverse },
    { id: 'none', label: t.stackNone },
  ]

  return (
    <div
      className={`xpe-columns-bar flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-md border border-dashed px-2 py-1 text-xs text-[var(--xpe-muted-foreground)] ${
        selected ? 'border-[var(--xpe-ring)]' : 'border-[var(--xpe-border)]'
      }${className ? ` ${className}` : ''}`}
      contentEditable={false}
      onClick={(e) => {
        if (e.target === e.currentTarget) onSelect()
      }}
    >
      <span className="flex items-center gap-1 font-medium text-[var(--xpe-foreground)]" onClick={onSelect}>
        <CountIcon className="size-3.5" />
        {t.settings}
      </span>

      {!readonly && (
        <>
          {/* Count */}
          <span className="flex items-center gap-0.5" role="radiogroup" aria-label={t.count}>
            {([2, 3] as const).map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={count === n}
                className={`rounded px-1.5 py-0.5 ${
                  count === n
                    ? 'bg-[var(--xpe-primary)] text-[var(--xpe-primary-foreground)]'
                    : 'hover:bg-[var(--xpe-surface-hover)]'
                }`}
                onClick={() => setCount(n)}
              >
                {n}
              </button>
            ))}
          </span>

          {/* Widths: each preset drawn as its proportions */}
          <span className="flex items-center gap-1" role="radiogroup" aria-label={t.widths}>
            {layouts.map((preset) => {
              const active = sameWidths(preset, widths)

              return (
                <button
                  key={preset.join('-')}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  title={preset.map((w) => `${Math.round(w)}%`).join(' / ')}
                  className={`flex h-5 w-9 gap-px rounded border p-0.5 ${
                    active
                      ? 'border-[var(--xpe-primary)]'
                      : 'border-[var(--xpe-border)] hover:border-[var(--xpe-muted-foreground)]'
                  }`}
                  onClick={() => onPatch({ columnWidths: preset })}
                >
                  {preset.map((w, i) => (
                    <span
                      key={i}
                      className={`h-full rounded-sm ${
                        active ? 'bg-[var(--xpe-primary)]' : 'bg-[var(--xpe-muted-foreground)] opacity-40'
                      }`}
                      style={{ flex: w }}
                    />
                  ))}
                </button>
              )
            })}
          </span>

          {/* Gap */}
          <span className="flex items-center gap-0.5" role="radiogroup" aria-label={t.gap}>
            <span className="me-0.5">{t.gap}</span>
            {COLUMN_GAPS.map((value, i) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={gap === value}
                className={`rounded px-1 py-0.5 ${
                  gap === value
                    ? 'bg-[var(--xpe-primary-muted)] text-[var(--xpe-foreground)]'
                    : 'hover:bg-[var(--xpe-surface-hover)]'
                }`}
                onClick={() => onPatch({ columnGap: value })}
              >
                {GAP_LABELS[i]}
              </button>
            ))}
          </span>

          {/* Vertical alignment */}
          <span className="flex items-center gap-0.5" role="radiogroup" aria-label={t.align}>
            {aligns.map((item) => (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={align === item.id}
                title={item.label}
                aria-label={item.label}
                className={`rounded p-0.5 ${
                  align === item.id
                    ? 'bg-[var(--xpe-primary-muted)] text-[var(--xpe-foreground)]'
                    : 'hover:bg-[var(--xpe-surface-hover)]'
                }`}
                onClick={() => onPatch({ columnAlign: item.id })}
              >
                <item.icon className="size-3.5" />
              </button>
            ))}
          </span>

          {/* Small screens */}
          <label className="flex items-center gap-1">
            <span>{t.stack}</span>
            <select
              className="rounded border border-[var(--xpe-border)] bg-[var(--xpe-background)] px-1 py-0.5 text-xs text-[var(--xpe-foreground)]"
              value={stack}
              onChange={(e) => onPatch({ columnStack: e.target.value })}
            >
              {stacks.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className="ms-auto flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-[var(--xpe-surface-hover)]"
            title={t.unwrap}
            onClick={onUnwrap}
          >
            <Rows3 className="size-3.5" />
            <span className="hidden sm:inline">{t.unwrap}</span>
          </button>
        </>
      )}
    </div>
  )
}
