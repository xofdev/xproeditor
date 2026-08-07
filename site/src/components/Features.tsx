import {
  Blocks,
  ClipboardPaste,
  Keyboard,
  Layers,
  MousePointerClick,
  Palette,
  Sparkles,
  Table2,
  type LucideIcon,
} from 'lucide-react'

const FEATURES: { icon: LucideIcon; title: string; desc: string; points: string[] }[] = [
  {
    icon: Layers,
    title: 'One core, two adapters',
    desc: 'Shared block model, selection, and clipboard in @xproeditor/core — Vue and React stay behavior-identical.',
    points: ['@xproeditor/core', '@xproeditor/vue', '@xproeditor/react'],
  },
  {
    icon: Keyboard,
    title: 'Two toolbar modes',
    desc: 'Sticky format toolbar, Notion-like floating bubble, both, or none — switch with one prop.',
    points: ['toolbar="floating"', 'toolbar="fixed"', '/ slash menu'],
  },
  {
    icon: MousePointerClick,
    title: 'Notion-like block chrome',
    desc: 'Richer block context menu, multi-select with a floating edit popover, and two-stage Ctrl/⌘+A.',
    points: ['Block ··· menu', 'Multi-select popover', 'Reliable undo'],
  },
  {
    icon: ClipboardPaste,
    title: 'Clipboard & Markdown',
    desc: 'Drag or shift-select across blocks — including images and tables — then copy, cut, delete, or paste Markdown.',
    points: ['Multi-block copy/cut', 'Markdown paste', 'HTML + JSON clipboard'],
  },
  {
    icon: Table2,
    title: 'Tables, code & media',
    desc: 'Table width, drag cell select, merge and style — plus code language/wrap/copy chrome, buttons, and web bookmarks.',
    points: ['Width + cell drag', 'Code wrap & copy', 'Bookmark links'],
  },
  {
    icon: Sparkles,
    title: 'Ask AI (pluggable)',
    desc: 'Host supplies any LLM transport. Users get /ai, toolbar entry, streaming drafts, and Accept / Reject.',
    points: ['ai={{ transport }}', 'Improve / continue', 'No API keys in the package'],
  },
  {
    icon: Palette,
    title: 'Themeable CSS vars',
    desc: 'Precompiled stylesheet. Restyle with --xpe-* variables — no Tailwind or Radix lock-in for consumers.',
    points: ['--xpe-primary', 'Dark via .xpe-dark', 'RTL ready'],
  },
  {
    icon: Blocks,
    title: 'Toggles & structure',
    desc: 'Collapsible toggles and toggle headings (H1–H3) nest content cleanly for docs, FAQs, and long posts.',
    points: ['/toggle', '/toggle heading', 'Nested children'],
  },
]

export function Features() {
  return (
    <section id="features" aria-labelledby="features-heading">
      <div className="container">
        <div className="section-head">
          <span className="eyebrow">Capabilities</span>
          <h2 id="features-heading">Built for product teams shipping docs</h2>
          <p>
            Selection, paste, tables, AI, and theming are first-class — not bolted-on demos.
          </p>
        </div>

        <div className="capability-strip" aria-label="Quick capabilities">
          <span>18 blocks</span>
          <span>Context menu</span>
          <span>Multi-select</span>
          <span>Tables &amp; bookmarks</span>
          <span>Ask AI</span>
          <span>Vue + React</span>
        </div>

        <div className="feature-grid feature-grid--rich">
          {FEATURES.map(({ icon: Icon, title, desc, points }) => (
            <article className="feature-card feature-card--rich" key={title}>
              <span className="feature-icon" aria-hidden>
                <Icon size={18} />
              </span>
              <h3>{title}</h3>
              <p>{desc}</p>
              <ul className="feature-points">
                {points.map((p) => (
                  <li key={p}>
                    <Blocks size={12} aria-hidden />
                    <code>{p}</code>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
