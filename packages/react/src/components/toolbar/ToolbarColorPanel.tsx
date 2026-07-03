import { useEffect, useRef, useState } from 'react'
import { Check, Highlighter } from 'lucide-react'
import type { MarkName } from '@xproeditor/core'
import {
  Button,
  ColorPickerPanel,
  DEFAULT_TEXT_COLOR,
  HIGHLIGHT_PRESETS,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  TEXT_COLOR_PRESETS,
} from '../../ui'

export interface ToolbarColorPanelProps {
  open?: boolean
  currentColor?: string | null
  currentHighlight?: string | null
  onMark: (mark: MarkName, value: boolean | string | null) => void
}

export function ToolbarColorPanel({
  open,
  currentColor,
  currentHighlight,
  onMark,
}: ToolbarColorPanelProps) {
  const [activeTab, setActiveTab] = useState<'text' | 'highlight'>('text')
  const [pickerColor, setPickerColor] = useState(currentColor ?? DEFAULT_TEXT_COLOR)
  const isEditingPicker = useRef(false)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (activeTab === 'text' && !isEditingPicker.current)
      setPickerColor(currentColor ?? DEFAULT_TEXT_COLOR)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentColor])

  useEffect(() => {
    if (activeTab === 'highlight' && !isEditingPicker.current)
      setPickerColor(currentHighlight ?? HIGHLIGHT_PRESETS[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentHighlight])

  useEffect(() => {
    if (!open) return

    isEditingPicker.current = false
    setPickerColor(
      activeTab === 'text'
        ? (currentColor ?? DEFAULT_TEXT_COLOR)
        : (currentHighlight ?? HIGHLIGHT_PRESETS[0]),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function changeTab(tab: string) {
    const next = tab as 'text' | 'highlight'
    setActiveTab(next)
    isEditingPicker.current = false
    setPickerColor(
      next === 'text'
        ? (currentColor ?? DEFAULT_TEXT_COLOR)
        : (currentHighlight ?? HIGHLIGHT_PRESETS[0]),
    )
  }

  const activeTextColor = currentColor?.toLowerCase() ?? null
  const activeHighlight = currentHighlight?.toLowerCase() ?? null

  function selectTextColor(color: string) {
    onMark('color', color.toLowerCase() === DEFAULT_TEXT_COLOR ? null : color)
  }

  function selectHighlight(color: string) {
    onMark('highlight', color)
  }

  function debouncedApply(hex: string) {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      if (activeTab === 'text') selectTextColor(hex)
      else selectHighlight(hex)
    }, 80)
  }

  function onPickerInput(hex: string) {
    isEditingPicker.current = true
    setPickerColor(hex)
    debouncedApply(hex)
  }

  function resetCurrent() {
    isEditingPicker.current = false

    if (activeTab === 'text') {
      onMark('color', null)
      setPickerColor(DEFAULT_TEXT_COLOR)
    } else {
      onMark('highlight', null)
      setPickerColor(HIGHLIGHT_PRESETS[0])
    }
  }

  function isPresetActive(color: string, active: string | null): boolean {
    return active !== null && active === color.toLowerCase()
  }

  return (
    <Tabs value={activeTab} onValueChange={changeTab} className="w-[280px]">
      <TabsList className="mb-2 grid w-full grid-cols-2">
        <TabsTrigger value="text" className="text-xs">
          Text
        </TabsTrigger>
        <TabsTrigger value="highlight" className="text-xs">
          Highlight
        </TabsTrigger>
      </TabsList>

      <TabsContent value="text" className="mt-0 space-y-3">
        <div className="grid grid-cols-5 gap-1.5">
          {TEXT_COLOR_PRESETS.map((color) => (
            <button
              key={color}
              type="button"
              className={`relative flex size-7 items-center justify-center rounded-md border border-black/5 text-xs font-bold transition-transform hover:scale-105 ${isPresetActive(color, activeTextColor) ? 'ring-2 ring-indigo-500 ring-offset-1' : ''}`}
              style={{ color }}
              title={color}
              onClick={() => selectTextColor(color)}
            >
              A
              {isPresetActive(color, activeTextColor) && (
                <Check className="absolute -top-1 -right-1 size-3 rounded-full bg-indigo-500 p-0.5 text-white" />
              )}
            </button>
          ))}
        </div>

        <div className="border-t border-gray-100 pt-3">
          <p className="mb-2 text-[10px] font-semibold tracking-wider text-gray-400 uppercase">
            Custom
          </p>
          <div onFocus={() => (isEditingPicker.current = true)}>
            <ColorPickerPanel
              value={pickerColor}
              onChange={onPickerInput}
              compact
              hideContrastRatio
              hideDefaultSwatches
            />
          </div>
        </div>

        {activeTextColor && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-full text-xs text-gray-500"
            onClick={resetCurrent}
          >
            Reset text color
          </Button>
        )}
      </TabsContent>

      <TabsContent value="highlight" className="mt-0 space-y-3">
        <div className="grid grid-cols-4 gap-1.5">
          {HIGHLIGHT_PRESETS.map((color) => (
            <button
              key={color}
              type="button"
              className={`relative size-7 rounded-md border border-black/10 transition-transform hover:scale-105 ${isPresetActive(color, activeHighlight) ? 'ring-2 ring-indigo-500 ring-offset-1' : ''}`}
              style={{ backgroundColor: color }}
              title={color}
              onClick={() => selectHighlight(color)}
            >
              {isPresetActive(color, activeHighlight) && (
                <Check className="absolute -top-1 -right-1 size-3 rounded-full bg-indigo-500 p-0.5 text-white" />
              )}
            </button>
          ))}
        </div>

        <div className="border-t border-gray-100 pt-3">
          <p className="mb-2 text-[10px] font-semibold tracking-wider text-gray-400 uppercase">
            Custom
          </p>
          <div onFocus={() => (isEditingPicker.current = true)}>
            <ColorPickerPanel
              value={pickerColor}
              onChange={onPickerInput}
              compact
              hideContrastRatio
              hideDefaultSwatches
            />
          </div>
        </div>

        {activeHighlight && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-full text-xs text-gray-500"
            onClick={resetCurrent}
          >
            <Highlighter className="mr-1.5 size-3" />
            Remove highlight
          </Button>
        )}
      </TabsContent>
    </Tabs>
  )
}
