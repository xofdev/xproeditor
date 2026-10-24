import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Copy, ListOrdered, WrapText } from 'lucide-react'
import {
  CODE_LANGUAGES,
  codeLanguageLabel,
  indentCode,
  newlineInCode,
  normalizeCodeLanguage,
  splitHighlightedLines,
  toggleCodeComment,
  type CodeEdit,
} from '@xproeditor/core'
import type { Block } from '@xproeditor/core'
import { useEditorDictionary } from '../i18n'
import { modKeyLabel } from '../utils/shortcut'
import { detectLanguage, highlightCode, isHighlighterReady, loadHighlighter } from '../utils/highlight'

export interface CodeBlockHandle {
  focusAt: (pos: number | 'start' | 'end') => void
}

export interface CodeBlockProps {
  block: Block
  readonly?: boolean
  onPatch: (patch: Record<string, unknown>) => void
  onArrowUp: () => void
  onArrowDown: () => void
  onRemoveSelf: () => void
  onExitBelow: () => void
}

const LANGUAGE_IDS = CODE_LANGUAGES.map((lang) => lang.id)

/**
 * Code block: a transparent `<textarea>` over a syntax-highlighted `<pre>`
 * with identical metrics, so you type into a native, accessible field while
 * seeing live colours. Line numbers come from CSS counters on the
 * highlighted lines, so they stay aligned in wrap mode too.
 */
export const CodeBlock = forwardRef<CodeBlockHandle, CodeBlockProps>(function CodeBlock(
  { block, readonly, onPatch, onArrowUp, onArrowDown, onRemoveSelf, onExitBelow },
  ref,
) {
  const t = useEditorDictionary().code
  const textarea = useRef<HTMLTextAreaElement | null>(null)
  const code = block.props.code ?? ''
  const wrap = Boolean(block.props.wrap)
  const lineNumbers = Boolean(block.props.lineNumbers)
  const language = normalizeCodeLanguage(block.props.language)
  const fileName = block.props.caption ?? ''
  const [copied, setCopied] = useState(false)
  const [detected, setDetected] = useState<string | null>(null)
  const [highlighterReady, setHighlighterReady] = useState(isHighlighterReady)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    if (highlighterReady) return
    let alive = true
    void loadHighlighter().then((hl) => alive && hl && setHighlighterReady(true))
    return () => {
      alive = false
    }
  }, [highlighterReady])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const lines = useMemo(
    () => splitHighlightedLines(highlightCode(code, language)),
    // highlighterReady: re-highlight once the lazy chunk has loaded
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [code, language, highlighterReady],
  )
  const linesHtml = useMemo(
    () => lines.map((line) => `<span class="ecb-line">${line || '<br>'}</span>`).join(''),
    [lines],
  )

  function later(fn: () => void, ms: number) {
    timers.current.push(setTimeout(fn, ms))
  }

  /**
   * Write the edit to the textarea synchronously, then sync the block. Going
   * through state first and restoring the selection a frame later would let
   * keys typed in that frame land on the old value and be overwritten.
   */
  function apply(edit: CodeEdit) {
    const ta = textarea.current
    if (!ta) return
    ta.value = edit.value
    ta.setSelectionRange(edit.selectionStart, edit.selectionEnd)
    onPatch({ code: edit.value })
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const ta = textarea.current
    if (readonly || !ta || e.nativeEvent.isComposing) return

    const { selectionStart: start, selectionEnd: end, value } = ta
    const mod = e.metaKey || e.ctrlKey

    if (e.key === 'Tab') {
      e.preventDefault()
      apply(indentCode(value, start, end, e.shiftKey))
      return
    }

    if (e.key === 'Enter' && mod) {
      e.preventDefault()
      onExitBelow()
      return
    }

    if (e.key === 'Enter' && !e.shiftKey && !e.altKey) {
      e.preventDefault()
      apply(newlineInCode(value, start, end))
      return
    }

    if (mod && e.key === '/') {
      const edit = toggleCodeComment(value, start, end, language)
      if (edit) {
        e.preventDefault()
        apply(edit)
      }
      return
    }

    if (e.key === 'Backspace' && value === '') {
      e.preventDefault()
      onRemoveSelf()
      return
    }

    if (e.key === 'ArrowUp' && start === 0 && end === 0) {
      e.preventDefault()
      onArrowUp()
      return
    }

    if (e.key === 'ArrowDown' && start === value.length && end === value.length) {
      e.preventDefault()
      onArrowDown()
    }
  }

  function onPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    if (readonly || language !== 'plaintext' || code.trim() !== '') return

    // Pasting into an empty plain-text block: guess the language.
    const text = e.clipboardData.getData('text/plain')
    void loadHighlighter().then(() => {
      const guess = detectLanguage(text, LANGUAGE_IDS)
      if (!guess) return
      onPatch({ language: guess })
      setDetected(codeLanguageLabel(guess))
      later(() => setDetected(null), 2400)
    })
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code)
    } catch {
      const ta = textarea.current
      if (ta) {
        ta.focus()
        ta.select()
        document.execCommand('copy')
        ta.selectionStart = ta.selectionEnd = ta.value.length
      }
    }
    setCopied(true)
    later(() => setCopied(false), 1600)
  }

  useImperativeHandle(ref, () => ({
    focusAt: (pos = 'end') => {
      const ta = textarea.current
      if (!ta) return
      ta.focus({ preventScroll: true })
      const offset = pos === 'start' ? 0 : pos === 'end' ? ta.value.length : pos
      ta.selectionStart = ta.selectionEnd = offset
      ta.scrollIntoView({ block: 'nearest' })
    },
  }))

  const known = CODE_LANGUAGES.some((lang) => lang.id === language)
  const gutterChars = String(lines.length).length

  return (
    <div
      className={`ecb${wrap ? ' ecb--wrap' : ''}${lineNumbers ? ' ecb--numbered' : ''}`}
      dir="ltr"
      style={{ ['--ecb-gutter' as string]: `${Math.max(2, gutterChars)}ch` }}
    >
      <div className="ecb-header">
        <label className="ecb-lang" title={t.language}>
          <span>{language === 'plaintext' ? t.plainText : codeLanguageLabel(language)}</span>
          {!readonly && <ChevronDown aria-hidden />}
          <select
            value={language}
            disabled={readonly}
            aria-label={t.language}
            onChange={(e) => onPatch({ language: e.target.value })}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* Keep languages from imported Markdown/HTML selectable even if not in the list. */}
            {!known && <option value={language}>{language}</option>}
            {CODE_LANGUAGES.map((lang) => (
              <option key={lang.id} value={lang.id}>
                {lang.id === 'plaintext' ? t.plainText : lang.label}
              </option>
            ))}
          </select>
        </label>

        {detected && (
          <span className="ecb-detected" role="status">
            {t.detected}: {detected}
          </span>
        )}

        {readonly ? (
          fileName && <span className="ecb-filename">{fileName}</span>
        ) : (
          <input
            className="ecb-filename"
            value={fileName}
            placeholder={t.fileName}
            aria-label={t.fileName}
            spellCheck={false}
            size={Math.max(8, fileName.length + 1)}
            onChange={(e) => onPatch({ caption: e.target.value || undefined })}
            onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'ArrowDown') {
                e.preventDefault()
                textarea.current?.focus()
              }
            }}
          />
        )}

        <div className="ecb-actions">
          {!readonly && (
            <>
              <button
                type="button"
                className={`ecb-action${lineNumbers ? ' ecb-action--active' : ''}`}
                title={lineNumbers ? t.hideLineNumbers : t.lineNumbers}
                aria-label={lineNumbers ? t.hideLineNumbers : t.lineNumbers}
                aria-pressed={lineNumbers}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onPatch({ lineNumbers: !lineNumbers || undefined })}
              >
                <ListOrdered />
              </button>
              <button
                type="button"
                className={`ecb-action${wrap ? ' ecb-action--active' : ''}`}
                title={wrap ? t.disableWrap : t.wrap}
                aria-label={wrap ? t.disableWrap : t.wrap}
                aria-pressed={wrap}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onPatch({ wrap: !wrap })}
              >
                <WrapText />
              </button>
            </>
          )}
          <button
            type="button"
            className={`ecb-action ecb-action--copy${copied ? ' ecb-action--ok' : ''}`}
            title={copied ? t.copied : t.copy}
            aria-label={copied ? t.copied : t.copy}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => void copyCode()}
          >
            {copied ? <Check /> : <Copy />}
            {copied && <span>{t.copied}</span>}
          </button>
        </div>
      </div>

      <div className="ecb-body xpe-scroll">
        <div className="ecb-layer">
          <pre className="ecb-highlight hljs" aria-hidden="true">
            <code dangerouslySetInnerHTML={{ __html: linesHtml }} />
          </pre>
          <textarea
            ref={textarea}
            value={code}
            readOnly={readonly}
            className="ecb-input"
            rows={1}
            wrap={wrap ? 'soft' : 'off'}
            placeholder={t.placeholder}
            aria-label={`${t.language}: ${codeLanguageLabel(language)}`}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            onChange={(e) => !readonly && onPatch({ code: e.target.value })}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
          />
        </div>
      </div>
      {!readonly && <span className="ecb-hint">{t.exitHint.replace(/^Ctrl\+/, modKeyLabel())}</span>}
    </div>
  )
})
