import {
  Blocks,
  ClipboardPaste,
  Keyboard,
  Layers,
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
    icon: ClipboardPaste,
    title: 'Clipboard & Markdown',
    desc: 'Drag or shift-select across blocks — including images and tables — then copy, cut, delete, or paste Markdown.',
    points: ['Multi-block copy/cut', 'Markdown paste', 'HTML + JSON clipboard'],
  },
  {
    icon: Sparkles,
    title: 'Ask AI (pluggable)',
    desc: 'Host supplies any LLM transport. Users get /ai, toolbar entry, streaming drafts, and Accept / Reject.',
    points: ['ai={{ transport }}', 'Improve / continue', 'No API keys in the package'],
  },
  {
    icon: Table2,
    title: 'Tables & media that work',
    desc: 'Merge cells, borders, fills — plus image, video, audio, file, and CTA buttons with real settings UX.',
    points: ['Cell merge', 'Embeds', 'Button color & link'],
  },
  {
    icon: Palette,
    title: 'Themeable CSS vars',
    desc: 'Precompiled stylesheet. Restyle with --xpe-* variables — no Tailwind or Radix lock-in for consumers.',
    points: ['--xpe-primary', 'Dark via .xpe-dark', 'RTL ready'],
  },
]

export function Features() {
  return (
    <section id="features">
      <div className="container">
        <div className="section-head">
          <span className="eyebrow">Capabilities</span>
          <h2>Built for product teams shipping docs</h2>
          <p>Not a toy demo editor — selection, paste, AI, and theming are first-class.</p>
        </div>

        <div className="capability-strip" aria-label="Quick capabilities">
          <span>17 blocks</span>
          <span>Ask AI</span>
          <span>Markdown paste</span>
          <span>Multi-block select</span>
          <span>Vue + React</span>
          <span>MIT</span>
        </div>

        <div className="feature-grid feature-grid--rich">
          {FEATURES.map(({ icon: Icon, title, desc, points }) => (
            <div className="feature-card feature-card--rich" key={title}>
              <span className="feature-icon">
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
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
