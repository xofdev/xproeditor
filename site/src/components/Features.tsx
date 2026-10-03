import {
  AppWindow,
  Blocks,
  ClipboardPaste,
  Gauge,
  Keyboard,
  Languages,
  Layers,
  MousePointerClick,
  Palette,
  ShieldCheck,
  Sparkles,
  Table2,
  Zap,
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
    icon: Zap,
    title: 'Markdown & keyboard shortcuts',
    desc: 'Type **bold**, `code`, # headings, - lists or [x] to-dos and they convert as you type. Turn into, move and duplicate blocks from the keyboard.',
    points: ['**bold** / `code`', '⌘⌥1 heading', '⌘⇧↑ move block'],
  },
  {
    icon: Languages,
    title: 'Any language, RTL first-class',
    desc: 'Every label, tooltip and placeholder comes from one dictionary. English and Persian ship built in; override any string or add a language.',
    points: ['locale="fa"', 'dictionary={{ … }}', 'Per-block auto direction'],
  },
  {
    icon: AppWindow,
    title: 'Embeds & table of contents',
    desc: 'Allow-listed embeds for YouTube, Vimeo, Loom, Figma, CodePen, CodeSandbox, Spotify, SoundCloud and Maps — plus a live, linked table of contents.',
    points: ['/embed', '/table of contents', 'Anchored headings'],
  },
  {
    icon: ShieldCheck,
    title: 'Secure by default',
    desc: 'Links, media sources, colours and pasted HTML/JSON are sanitized in core, so stored or pasted content can’t inject script — in the editor or the renderer.',
    points: ['javascript: blocked', 'Sanitized HTML export', 'Validated clipboard'],
  },
  {
    icon: Gauge,
    title: 'Fast on long documents',
    desc: 'Only the block you type in re-renders, the highlighter loads on demand, and a full document API (getBlocks, setBlocks, getMarkdown, getStats…) is on the ref.',
    points: ['Memoised rows', 'Lazy highlight.js', 'ref.getMarkdown()'],
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
          <span>24 blocks</span>
          <span>English + فارسی</span>
          <span>Markdown shortcuts</span>
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
