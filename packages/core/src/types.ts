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
  | 'quote'
  | 'callout'
  | 'code'
  | 'divider'
  | 'image'
  | 'video'
  | 'table'

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
  /** toggle */
  collapsed?: boolean
  /** code */
  language?: string
  code?: string
  /** image */
  url?: string
  caption?: string
  /** image width percent (10-100) */
  width?: number
  /** video */
  provider?: 'file' | 'youtube' | 'vimeo'
  /** callout */
  icon?: string
  color?: string
  /** table */
  table?: TableData
  /** text direction */
  dir?: 'auto' | 'ltr' | 'rtl'
  align?: 'left' | 'center' | 'right'
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
  'quote',
  'callout',
]

/** Block types that participate in flat indent nesting. */
export const INDENTABLE_TYPES: BlockType[] = [
  'paragraph',
  'bulleted_list_item',
  'numbered_list_item',
  'to_do',
  'toggle',
  'quote',
  'callout',
]

export function isTextBlock(type: BlockType): boolean {
  return TEXT_BLOCK_TYPES.includes(type)
}

export function isBlocksContent(content: unknown): content is BlocksContent {
  return (
    !!content &&
    typeof content === 'object' &&
    (content as Record<string, unknown>).format === 'blocks' &&
    Array.isArray((content as Record<string, unknown>).blocks)
  )
}
