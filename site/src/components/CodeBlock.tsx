import { useState } from 'react'

export function CodeBlock({
  code,
  variant = 'code',
}: {
  code: string
  /** 'command' renders a single shell line with a non-copyable `$` prompt. */
  variant?: 'code' | 'command'
}) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable, ignore */
    }
  }

  return (
    <div className={variant === 'command' ? 'code-block code-block--command' : 'code-block'}>
      <button
        className="copy-btn"
        onClick={copy}
        type="button"
        aria-label={variant === 'command' ? `Copy install command: ${code}` : 'Copy code'}
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  )
}
