import { useState } from 'react'

export function CodeBlock({ code }: { code: string }) {
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
    <div className="code-block">
      <button className="copy-btn" onClick={copy} type="button">
        {copied ? 'Copied!' : 'Copy'}
      </button>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  )
}
