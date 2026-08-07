const PACKAGES = [
  {
    name: '@xproeditor/core',
    desc: 'Block model, selection, Markdown, clipboard, tables, bookmarks, and AI helpers — zero UI.',
    href: 'https://github.com/xofdev/xproeditor/tree/main/packages/core',
    npm: 'https://www.npmjs.com/package/@xproeditor/core',
  },
  {
    name: '@xproeditor/vue',
    desc: 'Vue 3 ProEditor, slash menu, toolbars, context menu, Ask AI, DocRenderer.',
    href: 'https://github.com/xofdev/xproeditor/tree/main/packages/vue',
    npm: 'https://www.npmjs.com/package/@xproeditor/vue',
  },
  {
    name: '@xproeditor/react',
    desc: 'React ProEditor with the same behavior as Vue — including AI transport.',
    href: 'https://github.com/xofdev/xproeditor/tree/main/packages/react',
    npm: 'https://www.npmjs.com/package/@xproeditor/react',
  },
]

export function Packages() {
  return (
    <section id="packages" aria-labelledby="packages-heading">
      <div className="container">
        <div className="section-head">
          <span className="eyebrow">Packages</span>
          <h2 id="packages-heading">One repo, three packages</h2>
          <p>Install only what you need — adapters share behavior through @xproeditor/core.</p>
        </div>
        <div className="package-grid">
          {PACKAGES.map((pkg) => (
            <div className="package-card" key={pkg.name}>
              <a className="package-card-main" href={pkg.href} target="_blank" rel="noreferrer">
                <span className="name">{pkg.name}</span>
                <span className="desc">{pkg.desc}</span>
              </a>
              <div className="package-card-links">
                <a href={pkg.npm} target="_blank" rel="noreferrer">
                  npm
                </a>
                <a href={pkg.href} target="_blank" rel="noreferrer">
                  Source
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
