/**
 * @xproeditor/vue
 *
 * Vue 3 adapter for the XProEditor Notion-like block editor.
 * Re-exports the framework-agnostic block model from `@xproeditor/core`
 * alongside the Vue components. Remember to import the stylesheet once:
 *
 * ```ts
 * import '@xproeditor/vue/style.css'
 * ```
 */

import './styles/tailwind-entry.css'

export { default as ProEditor } from './components/ProEditor.vue'
export { default as BlockEditor } from './components/BlockEditor.vue'
export { default as EditorBlockItem } from './components/EditorBlockItem.vue'
export { default as EditorTextBlock } from './components/EditorTextBlock.vue'
export { default as EditorCodeBlock } from './components/EditorCodeBlock.vue'
export { default as EditorImageBlock } from './components/EditorImageBlock.vue'
export { default as EditorVideoBlock } from './components/EditorVideoBlock.vue'
export { default as EditorTableBlock } from './components/EditorTableBlock.vue'
export { default as EditorTableCell } from './components/EditorTableCell.vue'
export { default as EditorSelectionHighlight } from './components/EditorSelectionHighlight.vue'
export { default as EditorBubbleToolbar } from './components/EditorBubbleToolbar.vue'
export { default as EditorFormatToolbar } from './components/EditorFormatToolbar.vue'
export { default as EditorSlashMenu } from './components/EditorSlashMenu.vue'
export { default as DocRenderer } from './components/DocRenderer.vue'

export { default as EditorTableStylePanel } from './components/toolbar/EditorTableStylePanel.vue'
export { default as EditorToolbarButton } from './components/toolbar/EditorToolbarButton.vue'
export { default as EditorToolbarColorPanel } from './components/toolbar/EditorToolbarColorPanel.vue'
export { default as EditorToolbarPopover } from './components/toolbar/EditorToolbarPopover.vue'
export { default as EditorToolbarSeparator } from './components/toolbar/EditorToolbarSeparator.vue'

export type { FormatToolbarAlign, FormatToolbarState } from './components/EditorFormatToolbar.vue'
export type { SlashItem } from './components/EditorSlashMenu.vue'

export * from './ui'

export * from '@xproeditor/core'
