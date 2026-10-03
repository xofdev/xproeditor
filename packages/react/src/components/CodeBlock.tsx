import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Check, Copy, WrapText } from 'lucide-react'
import type { Block } from '@xproeditor/core'
import { useEditorDictionary } from '../i18n'
import { modKeyLabel } from '../utils/shortcut'

export interface CodeBlockHandle {
  focusAt: (pos: number | 'start' | 'end') => void
}

const INDENT = '  '

const LANGUAGES: { id: string; label: string }[] = [
  { id: 'plaintext', label: 'Plain text' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'typescript', label: 'TypeScript' },
  { id: 'python', label: 'Python' },
  { id: 'bash', label: 'Bash' },
  { id: 'json', label: 'JSON' },
  { id: 'yaml', label: 'YAML' },
  { id: 'html', label: 'HTML' },
  { id: 'css', label: 'CSS' },
  { id: 'sql', label: 'SQL' },
  { id: 'go', label: 'Go' },
  { id: 'rust', label: 'Rust' },
  { id: 'java', label: 'Java' },
  { id: 'c', label: 'C' },
  { id: 'cpp', label: 'C++' },
  { id: 'csharp', label: 'C#' },
  { id: 'php', label: 'PHP' },
  { id: 'ruby', label: 'Ruby' },
  { id: 'swift', label: 'Swift' },
  { id: 'kotlin', label: 'Kotlin' },
  { id: 'dockerfile', label: 'Dockerfile' },
  { id: 'markdown', label: 'Markdown' },
  { id: 'xml', label: 'XML' },
  { id: 'diff', label: 'Diff' },
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

function outdentLine(line: string): { text: string; removed: number } {
  if (line.startsWith('\t')) return { text: line.slice(1), removed: 1 }
  if (line.startsWith(INDENT)) return { text: line.slice(INDENT.length), removed: INDENT.length }
  if (line.startsWith(' ')) return { text: line.slice(1), removed: 1 }
  return { text: line, removed: 0 }
}

export const CodeBlock = forwardRef<CodeBlockHandle, CodeBlockProps>(function CodeBlock(
  { block, readonly, onPatch, onArrowUp, onArrowDown, onRemoveSelf, onExitBelow },
  ref,
) {
  const t = useEditorDictionary().code
  const textarea = useRef<HTMLTextAreaElement | null>(null)
  const code = block.props.code ?? ''
  const wrap = Boolean(block.props.wrap)
  const language = block.props.language ?? 'plaintext'
  const [copied, setCopied] = useState(false)
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function autoresize() {
    const ta = textarea.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${ta.scrollHeight}px`
  }

  useEffect(() => {
    autoresize()
  }, [code, wrap])

  useEffect(
    () => () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current)
    },
    [],
  )

  function onInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    if (readonly) return
    onPatch({ code: e.target.value })
  }

  function applyTab(shift: boolean) {
    const ta = textarea.current
    if (!ta) return

    const start = ta.selectionStart
    const end = ta.selectionEnd
    const value = ta.value

    if (!shift && start === end) {
      const next = value.slice(0, start) + INDENT + value.slice(end)
      onPatch({ code: next })
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + INDENT.length
        autoresize()
      })
      return
    }

    const lineStart = value.lastIndexOf('\n', start - 1) + 1
    let lineEnd = end
    if (end === start || value[end - 1] !== '\n') {
      const nextNl = value.indexOf('\n', end)
      lineEnd = nextNl === -1 ? value.length : nextNl
    } else {
      lineEnd = end - 1
    }

    const blockText = value.slice(lineStart, lineEnd)
    const lines = blockText.split('\n')
    let startDelta = 0
    let totalDelta = 0

    const nextLines = lines.map((line, i) => {
      if (shift) {
        const { text, removed } = outdentLine(line)
        if (i === 0) startDelta = -Math.min(removed, Math.max(0, start - lineStart))
        totalDelta -= removed
        return text
      }
      if (i === 0) startDelta = INDENT.length
      totalDelta += INDENT.length
      return INDENT + line
    })

    const next = value.slice(0, lineStart) + nextLines.join('\n') + value.slice(lineEnd)
    onPatch({ code: next })
    requestAnimationFrame(() => {
      ta.selectionStart = Math.max(lineStart, start + startDelta)
      ta.selectionEnd = Math.max(ta.selectionStart, end + totalDelta)
      autoresize()
    })
  }

  function onKeydown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (readonly) return

    const ta = textarea.current
    if (!ta) return

    if (e.key === 'Tab') {
      e.preventDefault()
      applyTab(e.shiftKey)
      return
    }

    if (e.key === 'Backspace' && ta.value === '') {
      e.preventDefault()
      onRemoveSelf()
      return
    }

    if (e.key === 'ArrowUp' && ta.selectionStart === 0 && ta.selectionEnd === 0) {
      const beforeCaret = ta.value.slice(0, ta.selectionStart)
      if (!beforeCaret.includes('\n')) {
        e.preventDefault()
        onArrowUp()
      }
      return
    }

    if (e.key === 'ArrowDown' && ta.selectionStart === ta.value.length && ta.selectionEnd === ta.value.length) {
      e.preventDefault()
      onArrowDown()
      return
    }

    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      onExitBelow()
    }
  }

  async function copyCode() {
    const text = code
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const ta = textarea.current
      if (ta) {
        ta.focus()
        ta.select()
        document.execCommand('copy')
        const len = ta.value.length
        ta.selectionStart = ta.selectionEnd = len
      }
    }
    setCopied(true)
    if (copiedTimer.current) clearTimeout(copiedTimer.current)
    copiedTimer.current = setTimeout(() => setCopied(false), 1600)
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
    <div className={`ecb${wrap ? ' ecb--wrap' : ''}`} dir="ltr">
      <div className="ecb-toolbar">
        <select
          className="ecb-lang"
          value={language}
          disabled={readonly}
          aria-label={t.language}
          onChange={(e) => onPatch({ language: e.target.value })}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Keep languages from imported Markdown/HTML selectable even if not in the list. */}
          {!LANGUAGES.some((lang) => lang.id === language) && (
            <option value={language}>{language}</option>
          )}
          {LANGUAGES.map((lang) => (
            <option key={lang.id} value={lang.id}>
              {lang.id === 'plaintext' ? t.plainText : lang.label}
            </option>
          ))}
        </select>
        <div className="ecb-actions">
          <button
            type="button"
            className={`ecb-action${wrap ? ' ecb-action--active' : ''}`}
            title={wrap ? t.disableWrap : t.wrap}
            aria-label={wrap ? t.disableWrap : t.wrap}
            aria-pressed={wrap}
            disabled={readonly}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPatch({ wrap: !wrap })}
          >
            <WrapText />
          </button>
          <button
            type="button"
            className={`ecb-action${copied ? ' ecb-action--ok' : ''}`}
            title={copied ? t.copied : t.copy}
            aria-label={copied ? t.copied : t.copy}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => void copyCode()}
          >
            {copied ? <Check /> : <Copy />}
          </button>
          <span className="ecb-hint">{t.exitHint.replace(/^Ctrl\+/, modKeyLabel())}</span>
        </div>
      </div>
      <textarea
        ref={textarea}
        value={code}
        readOnly={readonly}
        className="ecb-input"
        rows={1}
        placeholder={t.placeholder}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        onChange={onInput}
        onKeyDown={onKeydown}
      />
    </div>
  )
})
