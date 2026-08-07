import {
  Bookmark,
  CheckSquare,
  Code2,
  FileText,
  Heading1,
  Image as ImageIcon,
  List,
  ListOrdered,
  Minus,
  Music,
  Quote,
  SquareMousePointer,
  Table2,
  Lightbulb,
  ChevronRight,
  Video,
  Type,
  Paperclip,
} from 'lucide-react'

type BlockInfo = {
  icon: typeof Type
  name: string
  slash: string
  tip: string
  group: 'Text' | 'Lists' | 'Media' | 'Advanced'
}

const BLOCKS: BlockInfo[] = [
  { icon: Type, name: 'Paragraph', slash: '/text', tip: 'Plain rich text with marks', group: 'Text' },
  { icon: Heading1, name: 'Headings', slash: '/h1 · /h2 · /h3', tip: 'Or type # then space', group: 'Text' },
  { icon: Quote, name: 'Quote', slash: '/quote', tip: 'Or type > then space', group: 'Text' },
  { icon: Lightbulb, name: 'Callout', slash: '/callout', tip: 'Icon + color presets', group: 'Text' },
  { icon: List, name: 'Bulleted list', slash: '/bullet', tip: 'Or - then space', group: 'Lists' },
  { icon: ListOrdered, name: 'Numbered list', slash: '/number', tip: 'Or 1. then space', group: 'Lists' },
  { icon: CheckSquare, name: 'To-do', slash: '/todo', tip: 'Or [] then space', group: 'Lists' },
  { icon: ChevronRight, name: 'Toggle', slash: '/toggle', tip: 'Collapsible list item', group: 'Lists' },
  { icon: Heading1, name: 'Toggle heading', slash: '/toggle heading', tip: 'H1–H3 collapsible sections', group: 'Lists' },
  { icon: ImageIcon, name: 'Image', slash: '/image', tip: 'Upload, library, or URL', group: 'Media' },
  { icon: Video, name: 'Video', slash: '/video', tip: 'File or YouTube / Vimeo', group: 'Media' },
  { icon: Music, name: 'Audio', slash: '/audio', tip: 'Upload or link', group: 'Media' },
  { icon: Paperclip, name: 'File', slash: '/file', tip: 'Downloadable attachment', group: 'Media' },
  { icon: Bookmark, name: 'Web bookmark', slash: '/bookmark', tip: 'Link card with title & preview', group: 'Media' },
  { icon: Code2, name: 'Code', slash: '/code', tip: 'Language, wrap, and copy', group: 'Advanced' },
  { icon: Table2, name: 'Table', slash: '/table', tip: 'Width, drag-select cells, merge', group: 'Advanced' },
  { icon: SquareMousePointer, name: 'Button', slash: '/button', tip: 'Label, link, color, style', group: 'Advanced' },
  { icon: Minus, name: 'Divider', slash: '/divider', tip: 'Or type ---', group: 'Advanced' },
  { icon: FileText, name: 'Ask AI', slash: '/ai', tip: 'Generate or rewrite — Accept / Reject', group: 'Advanced' },
]

const GROUPS = ['Text', 'Lists', 'Media', 'Advanced'] as const

export function BlocksShowcase() {
  return (
    <section id="blocks" aria-labelledby="blocks-heading">
      <div className="container">
        <div className="section-head">
          <span className="eyebrow">Block types</span>
          <h2 id="blocks-heading">Everything you can insert with /</h2>
          <p>
            Eighteen block types in the document model — plus Ask AI as an agent overlay, not a
            block. Open the demo and type <code>/</code> to try any of these.
          </p>
        </div>

        {GROUPS.map((group) => (
          <div className="blocks-group" key={group}>
            <h3 className="blocks-group-title">{group}</h3>
            <div className="blocks-grid">
              {BLOCKS.filter((b) => b.group === group).map(({ icon: Icon, name, slash, tip }) => (
                <a className="block-chip" href="#demo" key={name}>
                  <span className="block-chip-icon" aria-hidden>
                    <Icon size={16} strokeWidth={2} />
                  </span>
                  <span className="block-chip-body">
                    <span className="block-chip-name">{name}</span>
                    <span className="block-chip-tip">{tip}</span>
                  </span>
                  <code className="block-chip-slash">{slash}</code>
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
