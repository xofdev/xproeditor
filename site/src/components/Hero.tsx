const REPO_URL = 'https://github.com/xofdev/xproeditor'

export function Hero() {
  return (
    <section className="hero" id="top" aria-labelledby="hero-heading">
      <div className="hero-glow" aria-hidden />
      <div className="hero-inner">
        <p className="hero-brand">XProEditor</p>
        <h1 id="hero-heading">
          A <span className="grad">Notion-like</span> block editor
          <br />
          for Vue &amp; React
        </h1>
        <p className="lede">
          Shared TypeScript core, floating or fixed toolbars, and DocRenderer for publish.
          Tables, toggles, bookmarks, Markdown paste, multi-select, and pluggable Ask AI —
          without Tailwind lock-in.
        </p>
        <div className="hero-actions">
          <a className="btn btn-primary" href="#demo">
            Try the live demo
          </a>
          <a className="btn btn-outline" href="#install">
            Install
          </a>
          <a className="btn btn-outline" href={REPO_URL} target="_blank" rel="noreferrer">
            GitHub
          </a>
        </div>
        <ul className="hero-proof" aria-label="Highlights">
          <li>@xproeditor/core · vue · react</li>
          <li>18 blocks · Ask AI · Markdown</li>
          <li>MIT · themeable CSS vars</li>
        </ul>
      </div>
    </section>
  )
}
