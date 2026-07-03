/**
 * @xproeditor/react
 *
 * React adapter for the XProEditor Notion-like block editor.
 * Re-exports the framework-agnostic block model from `@xproeditor/core`
 * alongside the React components. Remember to import the stylesheet once:
 *
 * ```ts
 * import '@xproeditor/react/style.css'
 * ```
 */

export { ProEditor } from './components/ProEditor'
export type { ProEditorProps, ProEditorHandle } from './components/ProEditor'
export { BlockEditor } from './components/BlockEditor'
export type { BlockEditorProps, BlockEditorHandle } from './components/BlockEditor'
export { BlockItem } from './components/BlockItem'
export type { BlockItemProps } from './components/BlockItem'
export { TextBlock } from './components/TextBlock'
export type { TextBlockHandle, TextBlockProps } from './components/TextBlock'
export { CodeBlock } from './components/CodeBlock'
export type { CodeBlockHandle, CodeBlockProps } from './components/CodeBlock'
export { ImageBlock } from './components/ImageBlock'
export type { ImageBlockProps } from './components/ImageBlock'
export { VideoBlock } from './components/VideoBlock'
export type { VideoBlockProps } from './components/VideoBlock'
export { TableBlock } from './components/TableBlock'
export type { TableBlockHandle, TableBlockProps } from './components/TableBlock'
export { TableCell } from './components/TableCell'
export type { TableCellHandle, TableCellProps } from './components/TableCell'
export { SelectionHighlight } from './components/SelectionHighlight'
export type { SelectionHighlightProps } from './components/SelectionHighlight'
export { BubbleToolbar } from './components/BubbleToolbar'
export type { BubbleToolbarProps } from './components/BubbleToolbar'
export { FormatToolbar } from './components/FormatToolbar'
export type { FormatToolbarProps } from './components/FormatToolbar'
export { SlashMenu } from './components/SlashMenu'
export type { SlashMenuHandle, SlashMenuProps } from './components/SlashMenu'
export { DocRenderer } from './components/DocRenderer'
export type { DocRendererProps } from './components/DocRenderer'

export * from './components/toolbar'

export { useBlockEditor } from './hooks/useBlockEditor'
export type { UseBlockEditorOptions } from './hooks/useBlockEditor'

export * from './ui'
export * from './types'

export * from '@xproeditor/core'
