const PACKAGES = [
  {
    name: '@xproeditor/core',
    desc: 'The framework-agnostic engine: block model, selection, clipboard, table ops.',
    href: 'https://github.com/xofdev/xproeditor/tree/main/packages/core',
  },
  {
    name: '@xproeditor/vue',
    desc: 'Vue 3 components, built on @xproeditor/core.',
    href: 'https://github.com/xofdev/xproeditor/tree/main/packages/vue',
  },
  {
    name: '@xproeditor/react',
    desc: 'React components, built on @xproeditor/core.',
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
          <p>Install only what you need — the adapters share zero UI code but the same behavior.</p>
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
