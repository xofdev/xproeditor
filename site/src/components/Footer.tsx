const REPO = 'https://github.com/xofdev/xproeditor'

export function Footer() {
  return (
    <footer>
      <div className="footer-inner">
        <div className="footer-brand">
          <span className="footer-mark" aria-hidden>
            X
          </span>
          <div>
            <strong>XProEditor</strong>
            <p>MIT © XofDev — Notion-like blocks for Vue &amp; React.</p>
          </div>
        </div>
        <nav className="footer-links" aria-label="Footer">
          <a href="#demo">Demo</a>
          <a href="#install">Install</a>
          <a href={`${REPO}/tree/main/docs`} target="_blank" rel="noreferrer">
            Docs
          </a>
          <a href="https://www.npmjs.com/package/@xproeditor/react" target="_blank" rel="noreferrer">
            npm
          </a>
          <a href={REPO} target="_blank" rel="noreferrer">
            GitHub
          </a>
          <a href={`${REPO}/blob/main/LICENSE`} target="_blank" rel="noreferrer">
            License
          </a>
        </nav>
      </div>
    </footer>
  )
}
