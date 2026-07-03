import { forwardRef, useImperativeHandle, useState, type ReactNode } from 'react'
import { EMOJI_PRESETS } from './emojiPresets'
import { Popover, PopoverContent, PopoverTrigger } from './Popover'

export interface IconEmojiPickerHandle {
  open: (tab?: 'emoji' | 'icon') => void
}

export interface IconEmojiPickerProps {
  value: string | null
  onChange: (value: string) => void
  disabled?: boolean
  align?: 'start' | 'center' | 'end'
  side?: 'top' | 'bottom' | 'left' | 'right'
  renderTrigger?: (args: {
    selected: string | null
    isIconify: boolean
    toggle: () => void
  }) => ReactNode
}

export const IconEmojiPicker = forwardRef<IconEmojiPickerHandle, IconEmojiPickerProps>(
  function IconEmojiPicker(
    { value, onChange, disabled = false, align = 'start', side = 'bottom', renderTrigger },
    ref,
  ) {
    const [open, setOpen] = useState(false)
    const [customValue, setCustomValue] = useState('')

    function pick(icon: string) {
      onChange(icon)
      setOpen(false)
    }

    function applyCustom() {
      const trimmed = customValue.trim()
      if (trimmed) {
        onChange(trimmed)
        setCustomValue('')
        setOpen(false)
      }
    }

    function toggle() {
      setOpen((o) => !o)
    }

    useImperativeHandle(ref, () => ({
      open: () => setOpen(true),
    }))

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger>
          {renderTrigger ? (
            renderTrigger({ selected: value, isIconify: false, toggle })
          ) : (
            <button type="button" className="xpe-icon-trigger" disabled={disabled} onClick={toggle}>
              {value ?? '💡'}
            </button>
          )}
        </PopoverTrigger>
        <PopoverContent align={align} side={side} className="xpe-icon-popover">
          <div className="xpe-icon-grid">
            {EMOJI_PRESETS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className={`xpe-icon-cell${emoji === value ? ' xpe-icon-cell--active' : ''}`}
                onClick={() => pick(emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
          <div className="xpe-icon-custom">
            <input
              type="text"
              maxLength={8}
              placeholder="Custom emoji or text"
              className="xpe-icon-custom-input"
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  applyCustom()
                }
              }}
            />
            <button type="button" className="xpe-icon-custom-apply" onClick={applyCustom}>
              Set
            </button>
          </div>
        </PopoverContent>
      </Popover>
    )
  },
)
