import { useEffect, useState } from 'react'

export function ColorPickerPanel({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
  compact?: boolean
  hideContrastRatio?: boolean
  hideDefaultSwatches?: boolean
}) {
  const [hexDraft, setHexDraft] = useState(value)

  useEffect(() => {
    setHexDraft(value)
  }, [value])

  const isValidHex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hexDraft)

  function commitHex() {
    if (isValidHex) onChange(hexDraft)
  }

  return (
    <div className="xpe-color-picker">
      <input
        type="color"
        className="xpe-color-swatch"
        value={value}
        onChange={(e) => {
          setHexDraft(e.target.value)
          onChange(e.target.value)
        }}
      />
      <input
        type="text"
        className="xpe-color-hex"
        spellCheck={false}
        placeholder="#000000"
        value={hexDraft}
        onChange={(e) => setHexDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commitHex()
          }
        }}
        onBlur={commitHex}
      />
    </div>
  )
}
