# @xproeditor/react

A Notion-like block editor for React — contentEditable-based, with a flat
block model (paragraphs, headings, lists, to-dos, toggles, quotes, callouts,
code, images, video, tables) and two editing styles built in:

- **Fixed toolbar** — a sticky top toolbar, classic WYSIWYG feel.
- **Floating (Notion-like)** — a bubble toolbar on text selection plus a `/`
  slash command menu.

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
change the component's `key` to remount it.

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
| `upload` | `(file: File) => Promise<string>` | — | Called for drag/drop/paste of images & video |
| `pickMedia` | `(opts: { accept: string[]; title?: string }) => Promise<{url, alt?, caption?} \| null>` | — | Hook up your media library picker |
| `editorDir` | `'ltr' \| 'rtl'` | `'ltr'` | Default direction for new blocks |
| `readonly` | `boolean` | `false` | Disable editing |
| `onChange` | `(blocks: Block[]) => void` | — | Called on every persisted change |

`ref` exposes: `undo`, `redo`, `focusFirst`, `focusEnd`.

## `<BlockEditor>` (lower-level)

Same props as above (minus `toolbar`) plus `showBubbleToolbar?: boolean` and
`onFormatState?: (state: FormatToolbarState | null) => void`. `ref` exposes
`undo`, `redo`, `canUndo`, `canRedo`, `applyToolbarMark`, `turnIntoBlock`,
`indentFocusedBlock`, `outdentFocusedBlock`, `setFocusedAlign`, `setFocusedDir`,
`setFocusedCalloutIcon`, `patchTableStyle`, `patchTableCellBackground`,
`focusFirst`, `focusEnd`.

## Read-only rendering

Use `<DocRenderer>` to render stored `Block[]` as static HTML (blog posts,
docs pages, previews) — no contentEditable, no editor JS:

```tsx
import { DocRenderer } from '@xproeditor/react'

<DocRenderer blocks={post.content.blocks} editorDir="ltr" />
```

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
