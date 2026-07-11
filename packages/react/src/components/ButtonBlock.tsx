import { forwardRef, useState } from 'react'
import { Link2, SquareArrowOutUpRight } from 'lucide-react'
import type { Block, InlineSpan, MarkName } from '@xproeditor/core'
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

export const ButtonBlock = forwardRef<TextBlockHandle, ButtonBlockProps>(function ButtonBlock(
  { block, readonly, onPatch, onSelect, ...textEvents },
  ref,
) {
  const [open, setOpen] = useState(false)
  const variant = STYLE_TO_VARIANT[block.props.buttonStyle ?? 'primary'] ?? 'default'
  const justify = ALIGN_TO_JUSTIFY[block.props.align ?? 'left'] ?? 'justify-start'

  return (
    <div className={`my-1 flex items-center gap-1.5 ${justify}`} onClick={onSelect}>
      <div className={`xpe-btn xpe-btn--${variant} xpe-btn--md min-w-[64px]`}>
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
              title="Button link & style"
              onClick={() => setOpen((o) => !o)}
            >
              <Link2 className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="xpe-button-settings">
            <div className="flex flex-col gap-2.5 p-3 w-64">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-medium text-[var(--xpe-muted-foreground)]">Link URL</span>
                <Input
                  type="url"
                  placeholder="https://..."
                  defaultValue={block.props.url ?? ''}
                  onChange={(e) => onPatch({ url: e.target.value })}
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

              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-medium text-[var(--xpe-muted-foreground)]">Style</span>
                <div className="flex gap-1">
                  {(['primary', 'outline', 'ghost'] as const).map((s) => (
                    <Button
                      key={s}
                      size="sm"
                      variant={block.props.buttonStyle === s ? 'default' : 'outline'}
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
                  {(['left', 'center', 'right'] as const).map((a) => (
                    <Button
                      key={a}
                      size="sm"
                      variant={(block.props.align ?? 'left') === a ? 'default' : 'outline'}
                      onClick={() => onPatch({ align: a })}
                    >
                      {a[0].toUpperCase() + a.slice(1)}
                    </Button>
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
