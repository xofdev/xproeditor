/**
 * Code block editing shared by both adapters: the language list and the
 * text operations behind Tab / Shift+Tab, Enter (auto-indent) and
 * Mod+/ (toggle line comment). All functions are pure — they take the
 * textarea value and selection and return the next value and selection.
 */

export interface CodeLanguage {
  id: string
  label: string
  /** Line-comment token, when the language has one. */
  comment?: string
}

export const CODE_LANGUAGES: readonly CodeLanguage[] = [
  { id: 'plaintext', label: 'Plain text' },
  { id: 'javascript', label: 'JavaScript', comment: '//' },
  { id: 'typescript', label: 'TypeScript', comment: '//' },
  { id: 'jsx', label: 'JSX', comment: '//' },
  { id: 'tsx', label: 'TSX', comment: '//' },
  { id: 'python', label: 'Python', comment: '#' },
  { id: 'bash', label: 'Bash', comment: '#' },
  { id: 'json', label: 'JSON' },
  { id: 'yaml', label: 'YAML', comment: '#' },
  { id: 'html', label: 'HTML' },
  { id: 'css', label: 'CSS' },
  { id: 'scss', label: 'SCSS', comment: '//' },
  { id: 'sql', label: 'SQL', comment: '--' },
  { id: 'go', label: 'Go', comment: '//' },
  { id: 'rust', label: 'Rust', comment: '//' },
  { id: 'java', label: 'Java', comment: '//' },
  { id: 'kotlin', label: 'Kotlin', comment: '//' },
  { id: 'swift', label: 'Swift', comment: '//' },
  { id: 'c', label: 'C', comment: '//' },
  { id: 'cpp', label: 'C++', comment: '//' },
  { id: 'csharp', label: 'C#', comment: '//' },
  { id: 'php', label: 'PHP', comment: '//' },
  { id: 'ruby', label: 'Ruby', comment: '#' },
  { id: 'dockerfile', label: 'Dockerfile', comment: '#' },
  { id: 'graphql', label: 'GraphQL', comment: '#' },
  { id: 'markdown', label: 'Markdown' },
  { id: 'xml', label: 'XML' },
  { id: 'diff', label: 'Diff' },
]

const LANGUAGE_ALIASES: Record<string, string> = {
  js: 'javascript',
  ts: 'typescript',
  py: 'python',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  yml: 'yaml',
  md: 'markdown',
  rs: 'rust',
  'c++': 'cpp',
  cs: 'csharp',
  rb: 'ruby',
  text: 'plaintext',
  txt: 'plaintext',
  plain: 'plaintext',
}

/** Canonical language id for an alias or Markdown fence tag (`ts` → `typescript`). */
export function normalizeCodeLanguage(language: string | undefined | null): string {
  const id = (language ?? '').trim().toLowerCase()
  return LANGUAGE_ALIASES[id] ?? (id || 'plaintext')
}

/** Display label for a language id (unknown ids are shown as-is). */
export function codeLanguageLabel(language: string | undefined | null): string {
  const id = normalizeCodeLanguage(language)
  return CODE_LANGUAGES.find(l => l.id === id)?.label ?? id
}

export const CODE_INDENT = '  '

export interface CodeEdit {
  value: string
  selectionStart: number
  selectionEnd: number
}

function lineRange(value: string, start: number, end: number): { from: number; to: number } {
  const from = value.lastIndexOf('\n', start - 1) + 1
  // A selection ending right after a newline does not include the next line.
  const effectiveEnd = end > start && value[end - 1] === '\n' ? end - 1 : end
  const nl = value.indexOf('\n', effectiveEnd)
  return { from, to: nl === -1 ? value.length : nl }
}

function outdentLine(line: string): { text: string; removed: number } {
  if (line.startsWith('\t')) {
    return { text: line.slice(1), removed: 1 }
  }

  const spaces = /^ {1,2}/.exec(line)?.[0].length ?? 0
  return { text: line.slice(spaces), removed: spaces }
}

/** Tab / Shift+Tab: insert an indent at a caret, or (out)dent every selected line. */
export function indentCode(value: string, start: number, end: number, outdent = false): CodeEdit {
  if (!outdent && start === end) {
    return {
      value: value.slice(0, start) + CODE_INDENT + value.slice(end),
      selectionStart: start + CODE_INDENT.length,
      selectionEnd: start + CODE_INDENT.length,
    }
  }

  const { from, to } = lineRange(value, start, end)
  const lines = value.slice(from, to).split('\n')
  let firstDelta = 0
  let total = 0

  const next = lines.map((line, i) => {
    if (outdent) {
      const { text, removed } = outdentLine(line)

      if (i === 0) {
        firstDelta = -Math.min(removed, start - from)
      }

      total -= removed
      return text
    }

    if (i === 0) {
      firstDelta = CODE_INDENT.length
    }

    total += CODE_INDENT.length
    return CODE_INDENT + line
  })

  const selectionStart = Math.max(from, start + firstDelta)

  return {
    value: value.slice(0, from) + next.join('\n') + value.slice(to),
    selectionStart,
    selectionEnd: Math.max(selectionStart, end + total),
  }
}

const OPENERS: Record<string, string> = { '{': '}', '[': ']', '(': ')' }

/**
 * Enter: keep the current line's indentation, indent one more level after an
 * opening bracket or a trailing `:` (Python, YAML), and when the caret sits
 * between a bracket pair, put the closer on its own line.
 */
export function newlineInCode(value: string, start: number, end: number): CodeEdit {
  const from = value.lastIndexOf('\n', start - 1) + 1
  const line = value.slice(from, start)
  const indent = /^[ \t]*/.exec(line)?.[0] ?? ''
  const before = line.trimEnd()
  const last = before[before.length - 1] ?? ''
  const after = value.slice(end)
  const opens = last in OPENERS || (last === ':' && !before.trimStart().startsWith('//'))
  const inner = opens ? indent + CODE_INDENT : indent

  if (last in OPENERS && after.trimStart().startsWith(OPENERS[last]) && /^[ \t]*[}\])]/.test(after)) {
    const insert = `\n${inner}\n${indent}`
    const caret = start + 1 + inner.length
    return {
      value: value.slice(0, start) + insert + after.replace(/^[ \t]*/, ''),
      selectionStart: caret,
      selectionEnd: caret,
    }
  }

  const insert = `\n${inner}`
  const caret = start + insert.length
  return { value: value.slice(0, start) + insert + after, selectionStart: caret, selectionEnd: caret }
}

/**
 * Mod+/: comment or uncomment the selected lines with the language's line
 * comment token. `null` when the language has none (JSON, HTML, CSS…).
 */
export function toggleCodeComment(
  value: string,
  start: number,
  end: number,
  language: string | undefined,
): CodeEdit | null {
  const token = CODE_LANGUAGES.find(l => l.id === normalizeCodeLanguage(language))?.comment

  if (!token) {
    return null
  }

  const { from, to } = lineRange(value, start, end)
  const lines = value.slice(from, to).split('\n')
  const content = lines.filter(l => l.trim() !== '')
  const commented = content.length > 0 && content.every(l => l.trimStart().startsWith(token))
  // Insert at the shallowest indentation so the block stays aligned.
  const column = Math.min(...content.map(l => /^[ \t]*/.exec(l)?.[0].length ?? 0), Infinity)
  let firstDelta = 0
  let total = 0

  const next = lines.map((line, i) => {
    if (line.trim() === '') {
      return line
    }

    if (commented) {
      const at = line.indexOf(token)
      const len = token.length + (line[at + token.length] === ' ' ? 1 : 0)

      if (i === 0) {
        firstDelta = -Math.min(len, Math.max(0, start - from - at))
      }

      total -= len
      return line.slice(0, at) + line.slice(at + len)
    }

    const insert = `${token} `

    if (i === 0) {
      firstDelta = start - from >= column ? insert.length : 0
    }

    total += insert.length
    return line.slice(0, column) + insert + line.slice(column)
  })

  const selectionStart = Math.max(from, start + firstDelta)

  return {
    value: value.slice(0, from) + next.join('\n') + value.slice(to),
    selectionStart,
    selectionEnd: Math.max(selectionStart, end + total),
  }
}

/** Number of lines (an empty block counts as one). */
export function codeLineCount(code: string): number {
  let count = 1

  for (let i = 0; i < code.length; i++) {
    if (code.charCodeAt(i) === 10) {
      count++
    }
  }

  return count
}

/**
 * Split highlighter HTML (escaped text + `<span class="…">` / `</span>`)
 * into one HTML string per source line. Spans that continue across a line
 * break (block comments, template strings) are closed at the end of the line
 * and reopened on the next, so every line is self-contained — needed for
 * per-line rendering such as line numbers and wrapped lines.
 */
export function splitHighlightedLines(html: string): string[] {
  const lines: string[] = []
  const open: string[] = []
  let line = ''
  const token = /(<span\b[^>]*>)|(<\/span>)|(\n)|([^<\n]+|<)/g
  let match: RegExpExecArray | null

  while ((match = token.exec(html))) {
    if (match[1]) {
      open.push(match[1])
      line += match[1]
    } else if (match[2]) {
      open.pop()
      line += match[2]
    } else if (match[3]) {
      lines.push(line + '</span>'.repeat(open.length))
      line = open.join('')
    } else {
      line += match[4]
    }
  }

  lines.push(line + '</span>'.repeat(open.length))

  return lines
}
