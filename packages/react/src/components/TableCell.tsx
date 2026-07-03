import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import {
  elementToSpans,
  focusEnd,
  focusStart,
  getSelectionOffsets,
  isCaretOnFirstLine,
  isCaretOnLastLine,
  normalizeSpans,
  setSelectionOffsets,
  spansToHtml,
} from '@xproeditor/core'
import type {
  InlineSpan,
  MarkName,
  TableCell as TableCellData,
  TableCellAlign,
} from '@xproeditor/core'

export interface TableCellHandle {
  focusAt: (pos: number | 'start' | 'end') => void
  getSelection: () => { start: number; end: number } | null
  setSelection: (start: number, end?: number) => void
  el: HTMLDivElement | null
}

export interface TableCellProps {
  cell: TableCellData
  rowIdx: number
  colIdx: number
  isHeader?: boolean
  selected?: boolean
  readonly?: boolean
  cellStyle?: Record<string, string>
  onInput: (spans: InlineSpan[], caret: number | null) => void
  onCellFocus: (payload: { row: number; col: number; shiftKey: boolean }) => void
  onFormat: (mark: MarkName) => void
  onTab: (shift: boolean) => void
  onArrowUp: () => void
  onArrowDown: () => void
  onArrowLeft: () => void
  onArrowRight: () => void
  onCellClick: (payload: { row: number; col: number; shiftKey: boolean }) => void
}

export const TableCell = forwardRef<TableCellHandle, TableCellProps>(function TableCell(
  {
    cell,
    rowIdx,
    colIdx,
    isHeader,
    selected,
    readonly,
    cellStyle,
    onInput,
    onCellFocus,
    onFormat,
    onTab,
    onArrowUp,
    onArrowDown,
    onArrowLeft,
    onArrowRight,
    onCellClick,
  },
  ref,
) {
  const el = useRef<HTMLDivElement | null>(null)
  const lastJson = useRef('')

  function render() {
    if (!el.current) return

    const html = spansToHtml(normalizeSpans(cell.content))
    if (el.current.innerHTML !== html) el.current.innerHTML = html || ''

    lastJson.current = JSON.stringify(cell.content)
  }

  useEffect(() => {
    const json = JSON.stringify(cell.content)
    if (json === lastJson.current) return

    const focused = el.current && document.activeElement === el.current
    const offsets = focused && el.current ? getSelectionOffsets(el.current) : null
    render()

    if (focused && offsets && el.current)
      setSelectionOffsets(el.current, offsets.start, offsets.end)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cell.content])

  function readSpans(): InlineSpan[] {
    if (!el.current) return []

    let spans = elementToSpans(el.current)
    if (spans.length === 1 && spans[0].text === '\n' && !spans[0].marks) spans = []

    return spans
  }

  function handleInputEvent() {
    if (readonly || !el.current) return

    const spans = readSpans()
    lastJson.current = JSON.stringify(spans)
    const caret = getSelectionOffsets(el.current)?.start ?? null
    onInput(spans, caret)
  }

  function onPointerDown(e: React.PointerEvent) {
    if (readonly || e.button !== 0) return
    onCellClick({ row: rowIdx, col: colIdx, shiftKey: e.shiftKey })
  }

  function onFocus(e: React.FocusEvent) {
    onCellFocus({
      row: rowIdx,
      col: colIdx,
      shiftKey: (e.nativeEvent as FocusEvent & { shiftKey?: boolean }).shiftKey ?? false,
    })
  }

  function onKeydown(e: React.KeyboardEvent) {
    if (readonly || !el.current || e.nativeEvent.isComposing) return

    const mod = e.ctrlKey || e.metaKey

    if (mod && !e.altKey) {
      const key = e.key.toLowerCase()

      if (key === 'b') {
        e.preventDefault()
        onFormat('bold')
        return
      }
      if (key === 'i') {
        e.preventDefault()
        onFormat('italic')
        return
      }
      if (key === 'u') {
        e.preventDefault()
        onFormat('underline')
        return
      }
      if (key === 'e') {
        e.preventDefault()
        onFormat('code')
        return
      }
      if (key === 's' && e.shiftKey) {
        e.preventDefault()
        onFormat('strikethrough')
        return
      }
    }

    if (e.key === 'Tab') {
      e.preventDefault()
      onTab(e.shiftKey)
      return
    }

    if (e.key === 'ArrowUp' && !e.shiftKey && isCaretOnFirstLine(el.current)) {
      e.preventDefault()
      onArrowUp()
      return
    }
    if (e.key === 'ArrowDown' && !e.shiftKey && isCaretOnLastLine(el.current)) {
      e.preventDefault()
      onArrowDown()
      return
    }

    const offsets = getSelectionOffsets(el.current)
    const len = el.current.textContent?.length ?? 0

    if (
      e.key === 'ArrowLeft' &&
      !e.shiftKey &&
      offsets &&
      offsets.start === 0 &&
      offsets.end === 0
    ) {
      e.preventDefault()
      onArrowLeft()
      return
    }
    if (
      e.key === 'ArrowRight' &&
      !e.shiftKey &&
      offsets &&
      offsets.start === len &&
      offsets.end === len
    ) {
      e.preventDefault()
      onArrowRight()
    }
  }

  useImperativeHandle(ref, () => ({
    focusAt: (pos) => {
      if (!el.current) return
      if (pos === 'start') focusStart(el.current)
      else if (pos === 'end') focusEnd(el.current)
      else {
        el.current.focus()
        setSelectionOffsets(el.current, pos)
      }
    },
    getSelection: () => (el.current ? getSelectionOffsets(el.current) : null),
    setSelection: (start, end = start) => {
      if (!el.current) return
      el.current.focus()
      setSelectionOffsets(el.current, start, end)
    },
    el: el.current,
  }))

  const Tag = isHeader ? 'th' : 'td'

  return (
    <Tag
      className={`etc-cell border border-gray-150 p-0 relative min-w-[100px] align-top ${isHeader ? 'bg-gray-50/80' : ''} ${selected ? 'ring-2 ring-indigo-400 ring-inset' : ''}`}
      style={cellStyle}
      colSpan={cell.colspan && cell.colspan > 1 ? cell.colspan : undefined}
      rowSpan={cell.rowspan && cell.rowspan > 1 ? cell.rowspan : undefined}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        ref={el}
        contentEditable={!readonly}
        suppressContentEditableWarning
        className={`etc-editor outline-none w-full px-3 py-2 text-sm text-gray-700 min-h-[2.25rem] ${isHeader ? 'font-semibold text-gray-800' : ''}`}
        style={cell.align ? { textAlign: cell.align as TableCellAlign } : undefined}
        dir="auto"
        spellCheck={false}
        onInput={handleInputEvent}
        onPointerDown={onPointerDown}
        onFocus={onFocus}
        onKeyDown={onKeydown}
      />
    </Tag>
  )
})
