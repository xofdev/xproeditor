const REPO_URL = 'https://github.com/xofdev/xproeditor'

export function Hero() {
  return (
    <section className="hero" id="top">
      <div className="hero-glow" />
      <div className="hero-inner">
        <p className="hero-brand">XProEditor</p>
        <h1>
          A <span className="grad">Notion-like</span> block editor
          <br />
          for Vue &amp; React
        </h1>
        <p className="lede">
          Seventeen blocks, Markdown paste, multi-block clipboard, and a pluggable Ask AI agent —
          draft in the editor, publish with DocRenderer.
        </p>
        <div className="hero-actions">
          <a className="btn btn-primary" href="#demo">
            Try the live demo
          </a>
          <a className="btn btn-outline" href="#use-cases">
            See use cases
          </a>
          <a className="btn btn-outline" href={REPO_URL} target="_blank" rel="noreferrer">
            GitHub
          </a>
        </div>
        <ul className="hero-proof" aria-label="Highlights">
          <li>Vue 3 &amp; React 18+</li>
          <li>Ask AI · Markdown · Tables</li>
          <li>Zero Tailwind lock-in</li>
        </ul>
      </div>
    </section>
  )
}
