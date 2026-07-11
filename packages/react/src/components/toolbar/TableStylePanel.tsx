import { useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { DEFAULT_TABLE_BORDER, getResolvedTableBorder } from '@xproeditor/core'
import type { MarkName, TableBorderStyleKind, TableBorderWidth, TableStyle } from '@xproeditor/core'
import {
  Button,
  ColorPickerPanel,
  DEFAULT_TEXT_COLOR,
  HIGHLIGHT_PRESETS,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  TABLE_BG_PRESETS,
  TABLE_BORDER_PRESETS,
  TABLE_BORDER_STYLES,
  TABLE_BORDER_WIDTHS,
  TEXT_COLOR_PRESETS,
} from '../../ui'

export interface TableStylePanelProps {
  open?: boolean
  currentColor?: string | null
  currentHighlight?: string | null
  cellBackground?: string | null
  tableStyle?: TableStyle
  onMark: (mark: MarkName, value: boolean | string | null) => void
  onCellBackground: (color: string | null) => void
  onTableStyle: (patch: Partial<TableStyle>) => void
}

type Tab = 'text' | 'cell' | 'table' | 'border'

export function TableStylePanel({
  open,
  currentColor,
  currentHighlight,
  cellBackground,
  tableStyle,
  onMark,
  onCellBackground,
  onTableStyle,
}: TableStylePanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('text')
  const [pickerColor, setPickerColor] = useState(DEFAULT_TEXT_COLOR)
  const isEditingPicker = useRef(false)

  const resolvedBorder = getResolvedTableBorder(tableStyle)

  function syncPickerColor(tab: Tab) {
    if (tab === 'text') setPickerColor(currentColor ?? DEFAULT_TEXT_COLOR)
    else if (tab === 'cell') setPickerColor(cellBackground ?? TABLE_BG_PRESETS[0])
    else if (tab === 'table') setPickerColor(tableStyle?.background ?? TABLE_BG_PRESETS[0])
    else setPickerColor(resolvedBorder.color)
  }

  useEffect(() => {
    if (!open) return
    isEditingPicker.current = false
    syncPickerColor(activeTab)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function changeTab(tab: string) {
    const next = tab as Tab
    setActiveTab(next)
    isEditingPicker.current = false
    syncPickerColor(next)
  }

  function isPresetActive(color: string, active: string | null | undefined): boolean {
    return !!active && active.toLowerCase() === color.toLowerCase()
  }

  function selectTextColor(color: string) {
    onMark('color', color.toLowerCase() === DEFAULT_TEXT_COLOR ? null : color)
  }

  function selectHighlight(color: string) {
    onMark('highlight', color)
  }

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  function debouncedApply(hex: string) {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      if (activeTab === 'text') selectTextColor(hex)
      else if (activeTab === 'cell') onCellBackground(hex)
      else if (activeTab === 'table') onTableStyle({ background: hex })
      else onTableStyle({ border: { color: hex } })
    }, 80)
  }

  function onPickerInput(hex: string) {
    isEditingPicker.current = true
    setPickerColor(hex)
    debouncedApply(hex)
  }

  return (
    <Tabs value={activeTab} onValueChange={changeTab} className="w-[300px]">
      <TabsList className="mb-2 grid w-full grid-cols-4">
        <TabsTrigger value="text" className="text-[10px]">
          Text
        </TabsTrigger>
        <TabsTrigger value="cell" className="text-[10px]">
          Cell
        </TabsTrigger>
        <TabsTrigger value="table" className="text-[10px]">
          Table
        </TabsTrigger>
        <TabsTrigger value="border" className="text-[10px]">
          Border
        </TabsTrigger>
      </TabsList>

      <TabsContent value="text" className="mt-0 space-y-3">
        <p className="text-[10px] font-semibold tracking-wider text-[var(--xpe-muted-foreground)] uppercase">
          Text color
        </p>
        <div className="grid grid-cols-5 gap-1.5">
          {TEXT_COLOR_PRESETS.map((color) => (
            <button
              key={color}
              type="button"
              className={`relative flex size-7 items-center justify-center rounded-md border border-black/5 text-xs font-bold ${isPresetActive(color, currentColor) ? 'ring-2 ring-indigo-500 ring-offset-1' : ''}`}
              style={{ color }}
              onClick={() => selectTextColor(color)}
            >
              A
              {isPresetActive(color, currentColor) && (
                <Check className="absolute -top-1 -end-1 size-3 rounded-full bg-[var(--xpe-primary-muted)]0 p-0.5 text-white" />
              )}
            </button>
          ))}
        </div>

        <p className="text-[10px] font-semibold tracking-wider text-[var(--xpe-muted-foreground)] uppercase">
          Highlight
        </p>
        <div className="grid grid-cols-4 gap-1.5">
          {HIGHLIGHT_PRESETS.map((color) => (
            <button
              key={color}
              type="button"
              className={`relative size-7 rounded-md border border-black/10 ${isPresetActive(color, currentHighlight) ? 'ring-2 ring-indigo-500 ring-offset-1' : ''}`}
              style={{ backgroundColor: color }}
              onClick={() => selectHighlight(color)}
            />
          ))}
        </div>

        <div className="border-t border-[var(--xpe-border)] pt-3">
          <ColorPickerPanel
            value={pickerColor}
            onChange={onPickerInput}
            compact
            hideContrastRatio
            hideDefaultSwatches
          />
        </div>

        <div className="flex gap-2">
          {currentColor && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 flex-1 text-xs"
              onClick={() => onMark('color', null)}
            >
              Reset text
            </Button>
          )}
          {currentHighlight && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 flex-1 text-xs"
              onClick={() => onMark('highlight', null)}
            >
              Reset highlight
            </Button>
          )}
        </div>
      </TabsContent>

      <TabsContent value="cell" className="mt-0 space-y-3">
        <div className="grid grid-cols-5 gap-1.5">
          {TABLE_BG_PRESETS.map((color) => (
            <button
              key={color}
              type="button"
              className={`relative size-7 rounded-md border border-black/10 ${isPresetActive(color, cellBackground) ? 'ring-2 ring-indigo-500 ring-offset-1' : ''}`}
              style={{ backgroundColor: color }}
              onClick={() => onCellBackground(color)}
            />
          ))}
        </div>
        <ColorPickerPanel
          value={pickerColor}
          onChange={onPickerInput}
          compact
          hideContrastRatio
          hideDefaultSwatches
        />
        {cellBackground && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-full text-xs"
            onClick={() => onCellBackground(null)}
          >
            Reset cell background
          </Button>
        )}
      </TabsContent>

      <TabsContent value="table" className="mt-0 space-y-3">
        <p className="text-[10px] font-semibold tracking-wider text-[var(--xpe-muted-foreground)] uppercase">
          Table background
        </p>
        <div className="grid grid-cols-5 gap-1.5">
          {TABLE_BG_PRESETS.map((color) => (
            <button
              key={`table-${color}`}
              type="button"
              className={`relative size-7 rounded-md border border-black/10 ${isPresetActive(color, tableStyle?.background) ? 'ring-2 ring-indigo-500 ring-offset-1' : ''}`}
              style={{ backgroundColor: color }}
              onClick={() => onTableStyle({ background: color })}
            />
          ))}
        </div>

        <p className="text-[10px] font-semibold tracking-wider text-[var(--xpe-muted-foreground)] uppercase">
          Header background
        </p>
        <div className="grid grid-cols-5 gap-1.5">
          {TABLE_BG_PRESETS.map((color) => (
            <button
              key={`header-${color}`}
              type="button"
              className={`relative size-7 rounded-md border border-black/10 ${isPresetActive(color, tableStyle?.headerBackground) ? 'ring-2 ring-indigo-500 ring-offset-1' : ''}`}
              style={{ backgroundColor: color }}
              onClick={() => onTableStyle({ headerBackground: color })}
            />
          ))}
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-full text-xs"
          onClick={() => onTableStyle({ background: undefined })}
        >
          Reset table background
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-full text-xs"
          onClick={() => onTableStyle({ headerBackground: undefined })}
        >
          Reset header background
        </Button>
      </TabsContent>

      <TabsContent value="border" className="mt-0 space-y-3">
        <div
          className="rounded-md border bg-[var(--xpe-surface)] p-3"
          style={{
            border: `${resolvedBorder.width}px ${resolvedBorder.style} ${resolvedBorder.color}`,
          }}
        >
          <div className="text-xs text-[var(--xpe-muted-foreground)]">Preview</div>
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          {TABLE_BORDER_PRESETS.map((color) => (
            <button
              key={color}
              type="button"
              className={`relative size-7 rounded-md border-2 bg-[var(--xpe-surface)] ${isPresetActive(color, resolvedBorder.color) ? 'ring-2 ring-indigo-500 ring-offset-1' : ''}`}
              style={{ borderColor: color }}
              onClick={() => onTableStyle({ border: { color } })}
            />
          ))}
        </div>

        <p className="text-[10px] font-semibold tracking-wider text-[var(--xpe-muted-foreground)] uppercase">Width</p>
        <div className="flex flex-wrap gap-1">
          {TABLE_BORDER_WIDTHS.map((width: TableBorderWidth) => (
            <button
              key={width}
              type="button"
              className={`rounded-md border px-2 py-1 text-[11px] ${resolvedBorder.width === width ? 'border-indigo-300 bg-[var(--xpe-primary-muted)] text-[var(--xpe-primary)]' : 'border-[var(--xpe-border)] text-[var(--xpe-muted-foreground)]'}`}
              onClick={() => onTableStyle({ border: { width } })}
            >
              {width}px
            </button>
          ))}
        </div>

        <p className="text-[10px] font-semibold tracking-wider text-[var(--xpe-muted-foreground)] uppercase">Style</p>
        <div className="flex flex-wrap gap-1">
          {TABLE_BORDER_STYLES.map((style: TableBorderStyleKind) => (
            <button
              key={style}
              type="button"
              className={`rounded-md border px-2 py-1 text-[11px] capitalize ${resolvedBorder.style === style ? 'border-indigo-300 bg-[var(--xpe-primary-muted)] text-[var(--xpe-primary)]' : 'border-[var(--xpe-border)] text-[var(--xpe-muted-foreground)]'}`}
              onClick={() => onTableStyle({ border: { style } })}
            >
              {style}
            </button>
          ))}
        </div>

        <ColorPickerPanel
          value={pickerColor}
          onChange={onPickerInput}
          compact
          hideContrastRatio
          hideDefaultSwatches
        />

        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-full text-xs"
          onClick={() => onTableStyle({ border: { ...DEFAULT_TABLE_BORDER } })}
        >
          Reset border
        </Button>
      </TabsContent>
    </Tabs>
  )
}
