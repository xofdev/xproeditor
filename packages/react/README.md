# @xproeditor/react

A Notion-like block editor for React — contentEditable-based, with a flat
block model (paragraphs, headings, lists, to-dos, toggles & toggle headings,
quotes, callouts, code, dividers, buttons, images, video, audio, file
attachments, tables, web bookmarks, embeds, table of contents) and two
editing styles built in:

- **Fixed toolbar** — a sticky top toolbar, classic WYSIWYG feel.
- **Floating (Notion-like)** — a bubble toolbar on text selection plus a `/`
  slash command menu.

Markdown-as-you-type (`**bold**`, `# `, `- [ ] `…), keyboard shortcuts for
every block action, a full document API on the ref, built-in English and
Persian UI (any language via a dictionary), and sanitized rendering of
untrusted content come standard.

No Tailwind or Radix required in your app — styles ship as a single
precompiled stylesheet, themeable via CSS variables. Built on top of
[`@xproeditor/core`](../core), the same framework-agnostic engine that powers
[`@xproeditor/vue`](../vue).

## Install

```bash
npm install @xproeditor/react
```

```ts
// once, anywhere in your app entry
import '@xproeditor/react/style.css'
```

## Quick start

```tsx
import { ProEditor, createBlock, type Block } from '@xproeditor/react'

const initialBlocks: Block[] = [
  createBlock('heading_1', { content: [{ text: 'Hello world' }] }),
  createBlock('paragraph', { content: [{ text: 'Start typing, or press / for commands.' }] }),
]

export function Editor() {
  return (
    // toolbar: 'fixed' | 'floating' | 'both' | 'none' (default: 'floating')
    <ProEditor defaultValue={initialBlocks} toolbar="floating" onChange={(blocks) => save(blocks)} />
  )
}
```

`<ProEditor>` is **uncontrolled**, like `<input defaultValue>` — contentEditable
doesn't play well with React's controlled-value model. It owns the block
array internally and calls `onChange(blocks)` whenever it changes (debounced
while typing, immediate for structural edits). To load different content,
call `ref.current.setBlocks(blocks, { history: 'reset' })` — or change the
component's `key` to remount it.

### The editor ref

```tsx
const editor = useRef<ProEditorHandle>(null)

editor.current?.getMarkdown()        // export
editor.current?.getStats()           // { words, characters, readingTimeMinutes, … }
editor.current?.insertBlocks([createBlock('callout', { content: [{ text: 'Note' }] })])
editor.current?.setBlocks(loaded, { history: 'reset' })
```

Full reference: [`docs/api.md`](../../docs/api.md).

### Composing it yourself

Everything `<ProEditor>` wires up is individually exported:

```tsx
import { useRef, useState } from 'react'
import { BlockEditor, FormatToolbar, type BlockEditorHandle, type FormatToolbarState } from '@xproeditor/react'

export function CustomEditor({ defaultValue }: { defaultValue: Block[] }) {
  const editorRef = useRef<BlockEditorHandle | null>(null)
  const [formatState, setFormatState] = useState<FormatToolbarState | null>(null)

  return (
    <>
      <FormatToolbar
        state={formatState}
        onMark={(mark, value) => editorRef.current?.applyToolbarMark(mark, value)}
        onTurnInto={(type) => editorRef.current?.turnIntoBlock(type)}
        onIndent={() => editorRef.current?.indentFocusedBlock()}
        onOutdent={() => editorRef.current?.outdentFocusedBlock()}
        onAlign={(align) => editorRef.current?.setFocusedAlign(align)}
        onDir={(dir) => editorRef.current?.setFocusedDir(dir)}
        onCalloutIcon={(icon) => editorRef.current?.setFocusedCalloutIcon(icon)}
        onTableStyle={(patch) => editorRef.current?.patchTableStyle(patch)}
        onCellBackground={(color) => editorRef.current?.patchTableCellBackground(color)}
      />
      <BlockEditor ref={editorRef} defaultValue={defaultValue} onFormatState={setFormatState} />
    </>
  )
}
```

Or drop straight to the `useBlockEditor` hook if you want to build your own
block rendering entirely.

## `<ProEditor>` props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `defaultValue` | `Block[]` | — | Seed content (uncontrolled) |
| `toolbar` | `'fixed' \| 'floating' \| 'both' \| 'none'` | `'floating'` | Which toolbar UI to render |
| `upload` | `(file: File) => Promise<string>` | — | Called for drag/drop/paste of images, video, audio & files |
| `pickMedia` | `(opts: { accept: string[]; title?: string }) => Promise<{url, alt?, caption?} \| null>` | — | Hook up your media library picker |
| `fetchBookmarkMeta` | `(url: string) => Promise<BookmarkMeta \| null>` | — | OG metadata for `/bookmark` cards |
| `editorDir` | `'ltr' \| 'rtl'` | `'ltr'` | Default direction for new blocks |
| `readonly` | `boolean` | `false` | Disable editing |
| `locale` | `string` | `'en'` | UI language — `'en'` or `'fa'` built in ([i18n](../../docs/i18n.md)) |
| `dictionary` | `EditorDictionaryOverrides` | — | Override any UI string |
| `placeholder` | `string` | localized | Placeholder of the focused empty line |
| `spellCheck` | `boolean` | `true` | Browser spellcheck in text blocks |
| `autofocus` | `boolean \| 'start' \| 'end'` | `false` | Focus on mount |
| `ai` | `{ transport: AITransport; commands?: AICommand[] }` | — | Pluggable Ask AI |
| `onChange` | `(blocks: Block[]) => void` | — | Called on every persisted change |
| `onUploadError` | `(error: unknown, file: File) => void` | — | `upload` rejected for a pasted/dropped file |

`ref` exposes the [document API](../../docs/api.md) (`getBlocks`,
`setBlocks`, `insertBlocks`, `updateBlock`, `removeBlocks`, `focus`,
`getMarkdown`, `getHTML`, `getText`, `getStats`) plus `undo`, `redo`,
`openAIMenu`, `focusFirst`, `focusEnd`.

## `<BlockEditor>` (lower-level)

Same props as above (minus `toolbar`) plus `showBubbleToolbar?: boolean` and
`onFormatState?: (state: FormatToolbarState | null) => void`. `ref` exposes
`undo`, `redo`, `canUndo`, `canRedo`, `applyToolbarMark`, `turnIntoBlock`,
`indentFocusedBlock`, `outdentFocusedBlock`, `setFocusedAlign`, `setFocusedDir`,
`setFocusedCalloutIcon`, `patchTableStyle`, `patchTableCellBackground`,
`focusFirst`, `focusEnd`, and the same document API.

## Shortcuts

Type `# `, `- `, `1. `, `[x] `, `> ` at the start of a line, or `**bold**`,
`` `code` ``, `~~strike~~` inline. `Mod+Alt+1…3` makes headings,
`Mod+Shift+↑/↓` moves blocks, `Mod+D` duplicates, `Mod+K` links. Full list:
[`docs/keyboard-shortcuts.md`](../../docs/keyboard-shortcuts.md).

## Read-only rendering

Use `<DocRenderer>` to render stored `Block[]` as static HTML (blog posts,
docs pages, previews) — no contentEditable, no editor JS:

```tsx
import { DocRenderer } from '@xproeditor/react'

<DocRenderer blocks={post.content.blocks} editorDir="ltr" locale="en" />
```

Headings get anchor ids, code is highlighted (highlight.js loads on demand),
embeds and the table of contents render, and every link and media URL is
sanitized — see [`docs/security.md`](../../docs/security.md).

## Theming

The stylesheet exposes a handful of CSS variables with sensible defaults;
override them anywhere above the editor in the DOM:

```css
:root {
  --xpe-primary: #4f46e5;
  --xpe-foreground: #1f2937;
  --xpe-muted: #f3f4f6;
  --xpe-muted-foreground: #6b7280;
  --xpe-border: #e5e7eb;
}
```

See [`docs/theming.md`](../../docs/theming.md) for details.

## Peer dependencies

- `react` `^18.0.0 || ^19.0.0`
- `react-dom` `^18.0.0 || ^19.0.0`

## License

MIT © XofDev
