import type { DocumentStats } from './serialize'
import type { Block, BlockProps, BlockType, InlineSpan } from './types'

export interface BlockPatch {
  type?: BlockType
  content?: InlineSpan[]
  /** Merged into the block's existing props. */
  props?: Partial<BlockProps>
}

export type EditorFocusTarget = 'start' | 'end' | { blockId: string; offset?: number }

/**
 * Document API exposed on the editor component ref by both adapters
 * (`ref.current` in React, the template ref in Vue). Every input is
 * sanitized; every output is a copy you can keep.
 */
export interface EditorDocumentApi {
  /** Deep copy of the current document. */
  getBlocks(): Block[]
  /**
   * Replace the document. `history: 'reset'` (loading another document)
   * clears undo history without firing change events; the default `'push'`
   * records an undo step and fires them.
   */
  setBlocks(blocks: Block[], options?: { history?: 'push' | 'reset' }): void
  /** Insert after/before a block (default: after the focused block, else at the end). Returns the new ids. */
  insertBlocks(blocks: Block[], position?: { after?: string; before?: string }): string[]
  /** Change a block's type, content and/or props. Returns false if the id is unknown. */
  updateBlock(id: string, patch: BlockPatch): boolean
  /** Remove blocks (a toggle takes its children with it). */
  removeBlocks(ids: string[]): void
  focus(target?: EditorFocusTarget): void
  /** Lossy Markdown export. */
  getMarkdown(): string
  /** Sanitized HTML export (nested lists, anchors, embeds). */
  getHTML(): string
  getText(): string
  getStats(): DocumentStats
}
