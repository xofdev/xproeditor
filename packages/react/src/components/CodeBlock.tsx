import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import type { Block } from '@xproeditor/core'

export interface CodeBlockHandle {
  focusAt: (pos: number | 'start' | 'end') => void
}

const LANGUAGES = [
  'plaintext',
  'javascript',
  'typescript',
  'python',
  'bash',
  'json',
  'yaml',
  'html',
  'css',
  'sql',
  'go',
  'rust',
  'java',
  'c',
  'cpp',
  'csharp',
  'php',
  'ruby',
  'swift',
  'kotlin',
  'dockerfile',
  'markdown',
  'xml',
  'diff',
]

export interface CodeBlockProps {
  block: Block
  readonly?: boolean
  onPatch: (patch: Record<string, unknown>) => void
  onArrowUp: () => void
  onArrowDown: () => void
  onRemoveSelf: () => void
  onExitBelow: () => void
}

export const CodeBlock = forwardRef<CodeBlockHandle, CodeBlockProps>(function CodeBlock(
  { block, readonly, onPatch, onArrowUp, onArrowDown, onRemoveSelf, onExitBelow },
  ref,
) {
  const textarea = useRef<HTMLTextAreaElement | null>(null)
  const code = block.props.code ?? ''

  function autoresize() {
    const ta = textarea.current
    if (!ta) return

    ta.style.height = 'auto'
    ta.style.height = `${ta.scrollHeight}px`
  }

  useEffect(autoresize, [])

  function onInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    if (readonly) return

    onPatch({ code: e.target.value })
    autoresize()
  }

  function onKeydown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (readonly) return

    const ta = textarea.current
    if (!ta) return

    if (e.key === 'Tab') {
      e.preventDefault()
      const start = ta.selectionStart
      const end = ta.selectionEnd
      const value = ta.value.slice(0, start) + '  ' + ta.value.slice(end)
      onPatch({ code: value })
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 2
        autoresize()
      })
      return
    }

    if (e.key === 'Backspace' && ta.value === '') {
      e.preventDefault()
      onRemoveSelf()
      return
    }

    if (
      e.key === 'ArrowUp' &&
      ta.selectionStart === 0 &&
      ta.selectionEnd === 0 &&
      !ta.value.slice(0, 1).includes('\n')
    ) {
      const beforeCaret = ta.value.slice(0, ta.selectionStart)
      if (!beforeCaret.includes('\n')) {
        e.preventDefault()
        onArrowUp()
      }
      return
    }

    if (e.key === 'ArrowDown' && ta.selectionStart === ta.value.length) {
      e.preventDefault()
      onArrowDown()
      return
    }

    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      onExitBelow()
    }
  }

  useImperativeHandle(ref, () => ({
    focusAt: (pos = 'end') => {
      const ta = textarea.current
      if (!ta) return

      ta.focus()
      const offset = pos === 'start' ? 0 : pos === 'end' ? ta.value.length : pos
      ta.selectionStart = ta.selectionEnd = offset
    },
  }))

  return (
    <div className="ecb group/code rounded-xl overflow-hidden border border-gray-200" dir="ltr">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#16182a] border-b border-white/5">
        <select
          className="bg-transparent text-[11px] text-gray-400 outline-none cursor-pointer hover:text-gray-200"
          value={block.props.language ?? 'plaintext'}
          disabled={readonly}
          onChange={(e) => onPatch({ language: e.target.value })}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {LANGUAGES.map((lang) => (
            <option key={lang} value={lang} className="bg-[#16182a]">
              {lang}
            </option>
          ))}
        </select>
        <span className="text-[10px] text-gray-500 opacity-0 group-hover/code:opacity-100 transition-opacity select-none">
          Ctrl+Enter to exit
        </span>
      </div>
      <textarea
        ref={textarea}
        value={code}
        readOnly={readonly}
        className="block w-full resize-none outline-none px-4 py-3 bg-[#1e1e2e] text-[#cdd6f4] font-mono text-[13px] leading-relaxed"
        rows={1}
        placeholder="Write code..."
        spellCheck={false}
        onChange={onInput}
        onKeyDown={onKeydown}
      />
    </div>
  )
})
