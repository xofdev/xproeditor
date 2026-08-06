const PACKAGES = [
  {
    name: '@xproeditor/core',
    desc: 'Block model, selection, Markdown, clipboard, tables, and pluggable AI helpers — zero UI.',
    href: 'https://github.com/xofdev/xproeditor/tree/main/packages/core',
  },
  {
    name: '@xproeditor/vue',
    desc: 'Vue 3 ProEditor, slash menu, toolbars, Ask AI menu, DocRenderer.',
    href: 'https://github.com/xofdev/xproeditor/tree/main/packages/vue',
  },
  {
    name: '@xproeditor/react',
    desc: 'React ProEditor with the same behavior as Vue — including AI transport.',
    href: 'https://github.com/xofdev/xproeditor/tree/main/packages/react',
  },
]

export function Packages() {
  return (
    <section id="packages">
      <div className="container">
        <div className="section-head">
          <span className="eyebrow">Packages</span>
          <h2>One repo, three packages</h2>
          <p>Install only what you need — adapters share behavior through @xproeditor/core.</p>
        </div>
        <div className="package-grid">
          {PACKAGES.map((pkg) => (
            <a className="package-card" key={pkg.name} href={pkg.href} target="_blank" rel="noreferrer">
              <span className="name">{pkg.name}</span>
              <span className="desc">{pkg.desc}</span>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}
