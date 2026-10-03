/**
 * Block-based document model (Notion-style) used by the custom ProEditor
 * and the public docs renderer. Stored in `document.content` as:
 * { format: 'blocks', version: 1, blocks: Block[], text: string }
 */

export type BlockType =
  | 'paragraph'
  | 'heading_1'
  | 'heading_2'
  | 'heading_3'
  | 'bulleted_list_item'
  | 'numbered_list_item'
  | 'to_do'
  | 'toggle'
  | 'toggle_heading_1'
  | 'toggle_heading_2'
  | 'toggle_heading_3'
  | 'quote'
  | 'callout'
  | 'code'
  | 'divider'
  | 'image'
  | 'video'
  | 'audio'
  | 'file'
  | 'table'
  | 'button'
  | 'bookmark'
  | 'embed'
  | 'table_of_contents'

/** Every block type this version of the editor can render, in slash-menu order. */
export const BLOCK_TYPES: readonly BlockType[] = [
  'paragraph',
  'heading_1',
  'heading_2',
  'heading_3',
  'bulleted_list_item',
  'numbered_list_item',
  'to_do',
  'toggle',
  'toggle_heading_1',
  'toggle_heading_2',
  'toggle_heading_3',
  'quote',
  'callout',
  'code',
  'divider',
  'image',
  'video',
  'audio',
  'file',
  'table',
  'button',
  'bookmark',
  'embed',
  'table_of_contents',
]

export interface InlineMarks {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strikethrough?: boolean
  code?: boolean
  link?: string
  color?: string
  highlight?: string
}

export type MarkName = keyof InlineMarks

/** A run of text sharing the same marks. */
export interface InlineSpan {
  text: string
  marks?: InlineMarks
}

export type TableCellAlign = 'left' | 'center' | 'right' | 'justify'

export type TableBorderWidth = 0 | 1 | 2 | 3 | 4

export type TableBorderStyleKind = 'solid' | 'dashed' | 'dotted' | 'none'

export interface TableBorderStyle {
  color?: string
  width?: TableBorderWidth
  style?: TableBorderStyleKind
}

export interface TableStyle {
  background?: string
  headerBackground?: string
  border?: TableBorderStyle
}

export interface TableCell {
  content: InlineSpan[]
  colspan?: number
  rowspan?: number
  align?: TableCellAlign
  background?: string
  hidden?: boolean
}

export interface TableWidth {
  mode: 'percent' | 'pixel'
  value: number
}

export interface TableData {
  hasHeader: boolean
  rows: TableCell[][]
  width?: TableWidth
  style?: TableStyle
}

export interface TableCellCoord {
  row: number
  col: number
}

export interface BlockProps {
  /** list / to_do / toggle nesting depth (flat model, Notion-like rendering) */
  indent?: number
  /** to_do */
  checked?: boolean
  /** toggle / toggle_heading_* */
  collapsed?: boolean
  /** code */
  language?: string
  code?: string
  /** code: soft-wrap long lines */
  wrap?: boolean
  /** image / video / audio / file / button / bookmark / embed */
  url?: string
  caption?: string
  /** audio / file: original file name */
  name?: string
  /** audio / file: size in bytes */
  size?: number
  /** audio / file: MIME type */
  mime?: string
  /** image width percent (10-100) */
  width?: number
  /** video: source kind. embed: detected provider id (see `EMBED_PROVIDERS`). */
  provider?: 'file' | 'youtube' | 'vimeo' | (string & {})
  /** embed: frame height in px (default per provider) */
  height?: number
  /** callout icon */
  icon?: string
  /** callout background, or button accent/background color */
  color?: string
  /** table */
  table?: TableData
  /** button: visual style */
  buttonStyle?: 'primary' | 'outline' | 'ghost'
  /** button: open url in a new tab */
  openInNewTab?: boolean
  /** bookmark: page title (OG / meta) */
  title?: string
  /** bookmark: page description (OG / meta) */
  description?: string
  /** bookmark: favicon URL */
  favicon?: string
  /** bookmark: Open Graph / preview image URL */
  image?: string
  /** text direction */
  dir?: 'auto' | 'ltr' | 'rtl'
  align?: 'left' | 'center' | 'right'
}

/** Preset accent colors for button blocks (adapters may show swatches). */
export const BUTTON_COLOR_PRESETS = [
  '#4f46e5',
  '#2563eb',
  '#0891b2',
  '#16a34a',
  '#ca8a04',
  '#ea580c',
  '#dc2626',
  '#db2777',
  '#9333ea',
  '#111827',
] as const

/** Visual style options for button blocks (adapters render as segmented controls). */
export const BUTTON_STYLE_OPTIONS = [
  { id: 'primary', label: 'Fill' },
  { id: 'outline', label: 'Outline' },
  { id: 'ghost', label: 'Ghost' },
] as const

export type ButtonStyleId = (typeof BUTTON_STYLE_OPTIONS)[number]['id']

/** Horizontal alignment options for button blocks. */
export const BUTTON_ALIGN_OPTIONS = ['left', 'center', 'right'] as const

export type ButtonAlignId = (typeof BUTTON_ALIGN_OPTIONS)[number]

/** Readable foreground color for a solid button fill (hex `#rrggbb`). */
export function buttonContrastForeground(hex: string): string {
  const raw = hex.replace('#', '')
  if (raw.length !== 6) return '#ffffff'
  const r = parseInt(raw.slice(0, 2), 16)
  const g = parseInt(raw.slice(2, 4), 16)
  const b = parseInt(raw.slice(4, 6), 16)
  const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luma > 0.62 ? '#111827' : '#ffffff'
}

export interface Block {
  id: string
  type: BlockType
  content: InlineSpan[]
  props: BlockProps
}

export interface BlocksContent {
  format: 'blocks'
  version: 1
  blocks: Block[]
  /** derived plain text for backend full-text search (content->>'text') */
  text: string
}

/** Block types whose main body is editable rich text. */
export const TEXT_BLOCK_TYPES: BlockType[] = [
  'paragraph',
  'heading_1',
  'heading_2',
  'heading_3',
  'bulleted_list_item',
  'numbered_list_item',
  'to_do',
  'toggle',
  'toggle_heading_1',
  'toggle_heading_2',
  'toggle_heading_3',
  'quote',
  'callout',
  'button',
]

/** Collapsible toggle list + toggle headings (Notion / BlockNote family). */
export const TOGGLE_BLOCK_TYPES: BlockType[] = [
  'toggle',
  'toggle_heading_1',
  'toggle_heading_2',
  'toggle_heading_3',
]

/** Block types that participate in flat indent nesting. */
export const INDENTABLE_TYPES: BlockType[] = [
  'paragraph',
  'bulleted_list_item',
  'numbered_list_item',
  'to_do',
  'toggle',
  'toggle_heading_1',
  'toggle_heading_2',
  'toggle_heading_3',
  'quote',
  'callout',
]

export function isTextBlock(type: BlockType): boolean {
  return TEXT_BLOCK_TYPES.includes(type)
}

export function isToggleBlock(type: BlockType): boolean {
  return TOGGLE_BLOCK_TYPES.includes(type)
}

/** Heading level for `toggle_heading_*`, otherwise null. */
export function toggleHeadingLevel(type: BlockType): 1 | 2 | 3 | null {
  if (type === 'toggle_heading_1') return 1
  if (type === 'toggle_heading_2') return 2
  if (type === 'toggle_heading_3') return 3
  return null
}

/** Plain heading type paired with a toggle heading, or null. */
export function plainHeadingFromToggle(type: BlockType): BlockType | null {
  const level = toggleHeadingLevel(type)
  return level ? (`heading_${level}` as BlockType) : null
}

export function isBlocksContent(content: unknown): content is BlocksContent {
  return (
    !!content &&
    typeof content === 'object' &&
    (content as Record<string, unknown>).format === 'blocks' &&
    Array.isArray((content as Record<string, unknown>).blocks)
  )
}
