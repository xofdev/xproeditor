const REPO = 'https://github.com/xofdev/xproeditor'
const DOCS = `${REPO}/blob/main/docs`

const COLUMNS = [
  {
    title: 'Product',
    links: [
      { label: 'Live demo', href: '#demo' },
      { label: 'Collaboration', href: '#collaborate' },
      { label: 'Block types', href: '#blocks' },
      { label: 'Changelog', href: '#changelog' },
    ],
  },
  {
    title: 'Docs',
    links: [
      { label: 'Getting started', href: `${DOCS}/getting-started.md` },
      { label: 'Editor API', href: `${DOCS}/api.md` },
      { label: 'Collaboration', href: `${DOCS}/collaboration.md` },
      { label: 'Theming', href: `${DOCS}/theming.md` },
    ],
  },
  {
    title: 'Packages',
    links: [
      { label: '@xproeditor/react', href: 'https://www.npmjs.com/package/@xproeditor/react' },
      { label: '@xproeditor/vue', href: 'https://www.npmjs.com/package/@xproeditor/vue' },
      { label: '@xproeditor/core', href: 'https://www.npmjs.com/package/@xproeditor/core' },
    ],
  },
  {
    title: 'Project',
    links: [
      { label: 'GitHub', href: REPO },
      { label: 'Issues', href: `${REPO}/issues` },
      { label: 'Contributing', href: `${REPO}/blob/main/CONTRIBUTING.md` },
      { label: 'MIT License', href: `${REPO}/blob/main/LICENSE` },
    ],
  },
]

export function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div className="footer-brand">
          <span className="nav-brand-mark" aria-hidden>
            X
          </span>
          <div>
            <strong>XProEditor</strong>
            <p>Open-source, Notion-style block editor for Vue &amp; React.</p>
          </div>
        </div>
        <nav className="footer-columns" aria-label="Footer">
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h2>{col.title}</h2>
              <ul>
                {col.links.map((link) => {
                  const external = link.href.startsWith('http')
                  return (
                    <li key={link.label}>
                      <a href={link.href} {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}>
                        {link.label}
                      </a>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>
      </div>
      <div className="container footer-legal">
        <span>MIT © XofDev</span>
        <span>Built with XProEditor’s own DocRenderer.</span>
      </div>
    </footer>
  )
}
