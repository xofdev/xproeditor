const REPO_URL = 'https://github.com/xofdev/xproeditor'

export function Hero() {
  return (
    <section className="hero" id="top">
      <div className="hero-glow" />
      <div className="hero-inner">
        <div className="badge-row">
          <span className="pill">MIT licensed</span>
          <span className="pill">Vue 3</span>
          <span className="pill">React 18+</span>
          <span className="pill">Zero Tailwind lock-in</span>
        </div>
        <h1>
          A <span className="grad">Notion-like</span> block editor
          <br />
          for Vue &amp; React
        </h1>
        <p className="lede">
          One framework-agnostic core, two first-class adapters. Ship a sticky format toolbar or a
          floating Notion-style toolbar with a <code>/</code> slash menu — switchable with a single
          prop.
        </p>
        <div className="hero-actions">
          <a className="btn btn-primary" href="#demo">
            Try the live demo
          </a>
          <a className="btn btn-outline" href={REPO_URL} target="_blank" rel="noreferrer">
            View on GitHub
          </a>
        </div>
      </div>
    </section>
  )
}
