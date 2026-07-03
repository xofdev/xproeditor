import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import {
  elementToSpans,
  focusEnd,
  focusStart,
  getSelectionOffsets,
  isCaretOnFirstLine,
  isCaretOnLastLine,
  setSelectionOffsets,
  spansToHtml,
} from '@xproeditor/core'
import type { Block, InlineSpan, MarkName } from '@xproeditor/core'
import { cn } from '../utils/cn'

export interface TextBlockHandle {
  focusAt: (pos: number | 'start' | 'end') => void
  getSelection: () => { start: number; end: number } | null
  setSelection: (start: number, end?: number) => void
  el: HTMLDivElement | null
}

export interface TextBlockProps {
  block: Block
  placeholder?: string
  readonly?: boolean
  className?: string
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
}

export const TextBlock = forwardRef<TextBlockHandle, TextBlockProps>(function TextBlock(
  {
    block,
    placeholder,
    readonly,
    className,
    onInput,
    onEnter,
    onBackspaceStart,
    onDeleteEnd,
    onArrowUp,
    onArrowDown,
    onTab,
    onFormat,
    onPasted,
    onFocus,
    onSelectionPointerDown,
  },
  ref,
) {
  const el = useRef<HTMLDivElement | null>(null)
  const lastJson = useRef('')

  function render() {
    if (!el.current) return

    const html = spansToHtml(block.content)
    if (el.current.innerHTML !== html) el.current.innerHTML = html

    lastJson.current = JSON.stringify(block.content)
  }

  useEffect(() => {
    const json = JSON.stringify(block.content)
    if (json === lastJson.current) return

    const focused = el.current && document.activeElement === el.current
    const offsets = focused && el.current ? getSelectionOffsets(el.current) : null
    render()

    if (focused && offsets && el.current) {
      setSelectionOffsets(el.current, offsets.start, offsets.end)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block.content])

  function readSpans(): InlineSpan[] {
    if (!el.current) return []

    let spans = elementToSpans(el.current)
    if (spans.length === 1 && spans[0].text === '\n' && !spans[0].marks) spans = []

    return spans
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (readonly || !el.current || e.button !== 0) return

    onSelectionPointerDown({ shiftKey: e.shiftKey, clientX: e.clientX, clientY: e.clientY })
  }

  function handleInputEvent() {
    if (readonly || !el.current) return

    const spans = readSpans()
    lastJson.current = JSON.stringify(spans)
    const caret = getSelectionOffsets(el.current)?.start ?? null
    onInput(spans, caret)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
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

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      const offsets = getSelectionOffsets(el.current) ?? { start: 0, end: 0 }
      onEnter(offsets)
      return
    }

    if (e.key === 'Backspace') {
      const offsets = getSelectionOffsets(el.current)
      if (offsets && offsets.start === 0 && offsets.end === 0) {
        e.preventDefault()
        onBackspaceStart()
      }
      return
    }

    if (e.key === 'Delete') {
      const offsets = getSelectionOffsets(el.current)
      const len = el.current.textContent?.length ?? 0
      if (offsets && offsets.start === offsets.end && offsets.start >= len) {
        e.preventDefault()
        onDeleteEnd()
      }
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

    if (e.key === 'Tab') {
      e.preventDefault()
      onTab(e.shiftKey)
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    if (readonly || !el.current || !e.clipboardData) return

    e.preventDefault()
    const offsets = getSelectionOffsets(el.current) ?? { start: 0, end: 0 }
    onPasted({
      html: e.clipboardData.getData('text/html'),
      text: e.clipboardData.getData('text/plain'),
      files: Array.from(e.clipboardData.files ?? []),
      offsets,
    })
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

  return (
    <div
      ref={el}
      contentEditable={!readonly}
      suppressContentEditableWarning
      className={cn(
        'etb',
        `etb-${block.type}`,
        readonly && 'etb-readonly',
        'outline-none w-full',
        className,
      )}
      dir={block.props.dir === 'ltr' || block.props.dir === 'rtl' ? block.props.dir : undefined}
      style={block.props.align ? { textAlign: block.props.align } : undefined}
      data-placeholder={placeholder}
      spellCheck={false}
      onInput={handleInputEvent}
      onPointerDown={handlePointerDown}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      onFocus={onFocus}
    />
  )
})
