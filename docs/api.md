# Editor API

Everything here is identical in `@xproeditor/vue` and `@xproeditor/react`
unless a row says otherwise. Types come from `@xproeditor/core` (re-exported
by both adapters).

## Getting the ref

```tsx
// React
import { useRef } from 'react'
import { ProEditor, type ProEditorHandle } from '@xproeditor/react'

const editor = useRef<ProEditorHandle>(null)
<ProEditor ref={editor} defaultValue={blocks} />
```

```vue
<!-- Vue -->
<script setup lang="ts">
import { ref } from 'vue'
import { ProEditor } from '@xproeditor/vue'

const editor = ref<InstanceType<typeof ProEditor> | null>(null)
</script>

<template>
  <ProEditor ref="editor" :model-value="blocks" />
</template>
```

`BlockEditor` exposes the same methods plus the lower-level toolbar actions
(`applyToolbarMark`, `turnIntoBlock`, `indentFocusedBlock`, …) used to build
custom chrome.

## Document methods (`EditorDocumentApi`)

| Method | Description |
| --- | --- |
| `getBlocks(): Block[]` | Deep copy of the current document. |
| `setBlocks(blocks, { history? })` | Replace the document. `history: 'reset'` (loading another document) clears undo history and does **not** fire change events; the default `'push'` records an undo step and fires them. Input is sanitized. |
| `insertBlocks(blocks, { after?, before? }): string[]` | Insert blocks after/before a block id (default: after the focused or selected block, else at the end). Returns the new ids. |
| `updateBlock(id, { type?, content?, props? }): boolean` | Change a block's type, replace its content, and/or merge props. `false` if the id is unknown. |
| `removeBlocks(ids)` | Remove blocks; a toggle takes its children with it. |
| `focus(target?)` | `'start'`, `'end'` (default) or `{ blockId, offset? }`. |
| `getMarkdown(): string` | Lossy Markdown export (`blocksToMarkdownLossy`). |
| `getHTML(): string` | Sanitized HTML export (`blocksToHtmlContent`). |
| `getText(): string` | Plain text (`blocksToPlainText`). |
| `getStats(): DocumentStats` | `{ blocks, words, characters, charactersNoSpaces, readingTimeMinutes }` — Unicode-aware (Persian/Arabic/CJK). |
| `undo()` / `redo()` | Document history. |
| `focusFirst()` / `focusEnd()` | Shorthands for `focus('start')` / `focus('end')`. |
| `openAIMenu()` | Open Ask AI at the caret (requires `ai`). |

`insertBlocks`, `updateBlock` and `removeBlocks` are no-ops while `readonly`;
`setBlocks` always works, so a read-only viewer can still load documents.

## Props

| Prop (React / Vue) | Type | Notes |
| --- | --- | --- |
| `defaultValue` / `model-value` | `Block[]` | React is uncontrolled; Vue mutates the bound array in place. |
| `toolbar` | `'floating' \| 'fixed' \| 'both' \| 'none'` | `ProEditor` only. |
| `locale` | `string` | `'en'` (default) or `'fa'`; see [i18n.md](i18n.md). |
| `dictionary` | `EditorDictionaryOverrides` | Override any UI string. |
| `editorDir` / `editor-dir` | `'ltr' \| 'rtl'` | Default direction for new blocks and empty lines. |
| `readonly` | `boolean` | |
| `placeholder` | `string` | Focused empty paragraph. |
| `spellCheck` / `spellcheck` | `boolean` | Default `true`. |
| `autofocus` | `boolean \| 'start' \| 'end'` | |
| `upload` | `(file) => Promise<string>` | Defaults to an object URL (session only). |
| `pickMedia` | `(opts) => Promise<{ url, alt?, caption? } \| null>` | Your media library. |
| `fetchBookmarkMeta` | `(url) => Promise<BookmarkMeta \| null>` | OG metadata for bookmark cards. |
| `ai` | `{ transport: AITransport; commands?: AICommand[] }` | Pluggable Ask AI. |

## Events

| React | Vue | Payload |
| --- | --- | --- |
| `onChange` | `@change` | React: `(blocks: Block[])`; Vue: none (read your bound array). |
| `onUploadError` | `@upload-error` | `(error: unknown, file: File)` |
| `onFormatState` | `@format-state` | `BlockEditor` only — drives a custom toolbar. |

## `DocRenderer`

```tsx
<DocRenderer blocks={blocks} editorDir="rtl" locale="fa" />
```

Read-only rendering for blog posts and docs pages: headings get anchor ids
(matching `extractHeadings`), code is highlighted with a lazily loaded
highlight.js, embeds and the table of contents render, every URL is
sanitized.

## Core helpers you'll reach for

| Helper | Use |
| --- | --- |
| `createBlock(type, partial?)` | Build a block with sensible default props. |
| `buildBlocksContent(blocks)` | The `{ format: 'blocks', version: 1, blocks, text }` payload to persist. |
| `normalizeContent(stored)` | Load blocks / legacy Tiptap JSON / HTML — sanitized. |
| `htmlToBlocks(html)` / `blocksToHtmlContent(blocks)` | HTML import / export. |
| `markdownToBlocks(md)` / `blocksToMarkdownLossy(blocks)` | Markdown import / export. |
| `extractHeadings(blocks)` | Headings with anchor ids (for your own TOC / sidebar). |
| `getDocumentStats(blocks)` | Word count and reading time on the server. |
| `sanitizeBlocks(raw)` | Validate untrusted block JSON (see [security.md](security.md)). |
| `resolveEmbed(url)` | Check whether a link can be embedded. |
| `resolveEditorDictionary(locale, overrides)` | Build a UI dictionary outside the editor. |
