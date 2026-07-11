/**
 * @xproeditor/core
 *
 * Framework-agnostic engine for the Notion-like block editor: the block
 * document model, span/mark operations, contentEditable selection helpers,
 * clipboard (de)serialization, HTML <-> span conversion, table operations,
 * and plain-text/HTML export. No DOM framework dependency — consumed by
 * `@xproeditor/vue` and `@xproeditor/react` (and usable directly for
 * headless rendering, e.g. server-side HTML export).
 */

export * from './types'
export * from './ops'
export * from './dom'
export * from './selection'
export * from './clipboard'
export * from './normalize'
export * from './html'
export * from './serialize'
export * from './table'
export * from './video-embed'
export * from './media'
export * from './doc-heading-id'
