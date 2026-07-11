import type { BlockType, MarkName, TableStyle } from '@xproeditor/core'

export type FormatToolbarAlign = 'left' | 'center' | 'right' | 'justify'

export interface FormatToolbarState {
  blockId: string
  blockType: BlockType
  activeMarks: Partial<Record<MarkName, boolean>>
  currentLink: string | null
  currentColor?: string | null
  currentHighlight?: string | null
  hasSelection: boolean
  multiBlock?: boolean
  align: FormatToolbarAlign
  indent: number
  dir: 'auto' | 'ltr' | 'rtl'
  calloutIcon?: string | null
  tableStyle?: TableStyle
  cellBackground?: string | null
}

export type SlashGroup = 'basic' | 'lists' | 'media' | 'advanced'

export interface SlashItem {
  id: string
  type: BlockType
  label: string
  description: string
  keywords: string[]
  icon: React.ComponentType<{ className?: string }>
  group: SlashGroup
  /** After applying the block, open the icon picker on this tab. */
  pickIcon?: 'emoji' | 'icon'
}

export interface BlockItemHandle {
  focusAt: (pos: number | 'start' | 'end') => void
  getSelection: () => { start: number; end: number } | null
  setSelection: (start: number, end?: number) => void
  textual: boolean
  getTableSelectedCells?: () => import('@xproeditor/core').TableCellCoord[]
  setTableSelectedCells?: (cells: import('@xproeditor/core').TableCellCoord[]) => void
  focusTableCell?: (row: number, col: number, pos?: number | 'start' | 'end') => void
  getTableCellSelection?: (row: number, col: number) => { start: number; end: number } | null
  setTableCellSelection?: (row: number, col: number, start: number, end?: number) => void
}

export interface MediaPickResult {
  url: string
  alt?: string
  caption?: string
}

export type PickMediaFn = (options: {
  accept: string[]
  title?: string
}) => Promise<MediaPickResult | null>
export type UploadFn = (file: File) => Promise<string>
