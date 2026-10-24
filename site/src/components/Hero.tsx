import { useState } from 'react'
import { ArrowRight, Bold, Check, Copy, Heading1, Italic, Link2, ListTodo, Sparkles, Table2, Type } from 'lucide-react'

const REPO_URL = 'https://github.com/xofdev/xproeditor'

const INSTALL = {
  react: 'npm i @xproeditor/react',
  vue: 'npm i @xproeditor/vue',
} as const

function InstallPill() {
  const [framework, setFramework] = useState<keyof typeof INSTALL>('react')
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(INSTALL[framework])
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="install-pill">
      <div className="install-pill-switch" role="tablist" aria-label="Framework">
        {(['react', 'vue'] as const).map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={framework === f}
            className={framework === f ? 'active' : ''}
            onClick={() => setFramework(f)}
          >
            {f === 'react' ? 'React' : 'Vue'}
          </button>
        ))}
      </div>
      <code>
        <span className="prompt" aria-hidden>
          $
        </span>
        {INSTALL[framework]}
      </code>
      <button type="button" className="install-pill-copy" onClick={copy} aria-label={`Copy ${INSTALL[framework]}`}>
        {copied ? <Check size={15} /> : <Copy size={15} />}
      </button>
    </div>
  )
}

/** Static product visual — real classes, no JS, so it is part of the prerendered first paint. */
function EditorMock() {
  return (
    <div className="mock" aria-hidden>
      <div className="mock-chrome">
        <span className="window-dots">
          <span />
          <span />
          <span />
        </span>
        <span className="mock-url">acme.app/docs/launch-plan</span>
        <span className="avatar-stack">
          <span className="avatar" style={{ ['--avatar' as string]: '#7c3aed' }}>
            S
          </span>
          <span className="avatar" style={{ ['--avatar' as string]: '#0891b2' }}>
            A
          </span>
          <span className="avatar" style={{ ['--avatar' as string]: '#e11d48' }}>
            M
          </span>
        </span>
      </div>
      <div className="mock-doc">
        <div className="mock-h1">Launch plan</div>
        <p className="mock-p">
          Ship the new editor to <mark className="mock-sel">every workspace</mark> by Friday, then
          publish the changelog.
        </p>

        <div className="mock-bubble">
          <span className="mock-bubble-btn mock-bubble-btn--wide">
            <Type size={13} /> Text
          </span>
          <span className="mock-sep" />
          <span className="mock-bubble-btn is-active">
            <Bold size={13} />
          </span>
          <span className="mock-bubble-btn">
            <Italic size={13} />
          </span>
          <span className="mock-bubble-btn">
            <Link2 size={13} />
          </span>
          <span className="mock-sep" />
          <span className="mock-bubble-btn mock-bubble-btn--ai">
            <Sparkles size={13} /> Ask AI
          </span>
        </div>

        <div className="mock-todo is-done">
          <span className="mock-check">
            <Check size={11} strokeWidth={3} />
          </span>
          Freeze the API
        </div>
        <div className="mock-todo mock-has-peer" style={{ ['--peer' as string]: '#0891b2' }}>
          <span className="mock-check" />
          Record the walkthrough video
          <span className="mock-peer">Ali</span>
          <span className="mock-caret" />
        </div>
        <div className="mock-p mock-slash-line">
          /ta<span className="mock-caret mock-caret--self" />
          <div className="mock-slash">
            <span className="mock-slash-item is-active">
              <Table2 size={14} /> Table
            </span>
            <span className="mock-slash-item">
              <ListTodo size={14} /> To-do list
            </span>
            <span className="mock-slash-item">
              <Heading1 size={14} /> Heading 1
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export function Hero() {
  return (
    <section className="hero" id="top" aria-labelledby="hero-heading">
      <div className="hero-bg" aria-hidden />
      <div className="container hero-grid">
        <div className="hero-copy">
          <a className="hero-badge" href="#collaborate">
            <span className="hero-badge-tag">New</span>
            Real-time collaboration
            <ArrowRight size={14} aria-hidden />
          </a>
          <h1 id="hero-heading">
            The Notion-style block editor for <span className="grad">Vue &amp; React</span>
          </h1>
          <p className="lede">
            Drop a fast, secure editor into your app for docs, knowledge bases, blogs and team notes —
            with slash commands, tables, Markdown, Ask AI and live collaboration. One tiny core, two
            native adapters, MIT licensed.
          </p>
          <div className="hero-actions">
            <a className="btn btn-primary" href="#demo">
              Try the live editor
              <ArrowRight size={16} aria-hidden />
            </a>
            <a className="btn btn-outline" href={`${REPO_URL}/blob/main/docs/getting-started.md`} target="_blank" rel="noreferrer">
              Read the docs
            </a>
          </div>
          <InstallPill />
          <ul className="hero-proof" aria-label="Highlights">
            <li>24 block types</li>
            <li>Live collaboration</li>
            <li>English + فارسی / RTL</li>
            <li>No Tailwind required</li>
          </ul>
        </div>
        <EditorMock />
      </div>
    </section>
  )
}
