import {
  Blocks,
  Keyboard,
  Layers,
  Palette,
  Table2,
  Undo2,
  type LucideIcon,
} from 'lucide-react'

const FEATURES: { icon: LucideIcon; title: string; desc: string }[] = [
  {
    icon: Layers,
    title: 'Framework-agnostic core',
    desc: '@xproeditor/core owns the block model, selection math, and clipboard logic — zero UI, zero framework dependency.',
  },
  {
    icon: Blocks,
    title: 'Every block you expect',
    desc: 'Headings, lists, to-dos, toggles, quotes, callouts, code with syntax highlighting, images, video, and tables.',
  },
  {
    icon: Keyboard,
    title: 'Two editing styles',
    desc: 'A classic sticky toolbar, or a Notion-like floating bubble toolbar with a / slash menu — one prop switches between them.',
  },
  {
    icon: Table2,
    title: 'Real tables',
    desc: 'Merge and unmerge cells, resize, per-cell backgrounds and borders — not just a placeholder block.',
  },
  {
    icon: Undo2,
    title: 'Undo/redo that just works',
    desc: 'Debounced history, markdown shortcuts, rich multi-block clipboard, cross-block text selection.',
  },
  {
    icon: Palette,
    title: 'Themeable, not opinionated',
    desc: 'Ships a precompiled stylesheet themeable via CSS variables — no Tailwind or Radix required downstream.',
  },
]

export function Features() {
  return (
    <section>
      <div className="container">
        <div className="section-head">
          <span className="eyebrow">Why XProEditor</span>
          <h2>Built for real documents</h2>
          <p>Everything a content-heavy app needs, out of the box.</p>
        </div>
        <div className="feature-grid">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div className="feature-card" key={title}>
              <span className="feature-icon">
                <Icon size={18} />
              </span>
              <h3>{title}</h3>
              <p>{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
