# @xproeditor/vue

A Notion-like block editor for Vue 3 — contentEditable-based, with a flat
block model (paragraphs, headings, lists, to-dos, toggles, quotes, callouts,
code, images, video, tables) and two editing styles built in:

- **Fixed toolbar** — a sticky top toolbar, classic WYSIWYG feel.
- **Floating (Notion-like)** — a bubble toolbar on text selection plus a `/`
  slash command menu.

No Tailwind, shadcn, or Radix required in your app — styles ship as a single
precompiled stylesheet, themeable via CSS variables.

## Install

```bash
npm install @xproeditor/vue
```

```ts
// once, anywhere in your app entry
import '@xproeditor/vue/style.css'
```

## Quick start

The easiest way in is `<ProEditor>`, which wires the editor together with
whichever toolbar style you want:

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { ProEditor, createBlock, type Block } from '@xproeditor/vue'

const blocks = ref<Block[]>([
  createBlock('heading_1', { content: [{ text: 'Hello world' }] }),
  createBlock('paragraph', { content: [{ text: 'Start typing, or press / for commands.' }] }),
])
</script>

<template>
  <!-- toolbar: 'fixed' | 'floating' | 'both' | 'none' (default: 'floating') -->
  <ProEditor :model-value="blocks" toolbar="floating" @change="() => save(blocks)" />
</template>
```

`<ProEditor>` mutates the array you pass to `model-value` in place and emits
`change` (no payload) whenever it does — read `blocks.value` in the handler.

### Composing it yourself

Everything `<ProEditor>` wires up is individually exported, so you can build
custom chrome:

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { BlockEditor, EditorFormatToolbar, type FormatToolbarState } from '@xproeditor/vue'

const editorRef = ref<InstanceType<typeof BlockEditor> | null>(null)
const formatState = ref<FormatToolbarState | null>(null)
</script>

<template>
  <EditorFormatToolbar
    :state="formatState"
    @mark="(mark, value) => editorRef?.applyToolbarMark(mark, value)"
    @turn-into="(type) => editorRef?.turnIntoBlock(type)"
  />
  <BlockEditor ref="editorRef" :model-value="blocks" @format-state="formatState = $event" />
</template>
```

## `<ProEditor>` props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `modelValue` | `Block[]` | — | Live block array; mutated in place |
| `toolbar` | `'fixed' \| 'floating' \| 'both' \| 'none'` | `'floating'` | Which toolbar UI to render |
| `upload` | `(file: File) => Promise<string>` | — | Called for drag/drop/paste of images & video |
| `pickMedia` | `(opts: { accept: string[]; title?: string }) => Promise<{url, alt?, caption?} \| null>` | — | Hook up your media library picker |
| `editorDir` | `'ltr' \| 'rtl'` | `'ltr'` | Default direction for new blocks |
| `readonly` | `boolean` | `false` | Disable editing |

Emits: `change` (no payload — read the mutated array).

## `<BlockEditor>` (lower-level)

Same props as above (minus `toolbar`) plus `showBubbleToolbar?: boolean`.
Emits `change` and `format-state` (`FormatToolbarState | null`). Exposes via
template ref: `undo`, `redo`, `canUndo`, `canRedo`, `applyToolbarMark`,
`turnIntoBlock`, `indentFocusedBlock`, `outdentFocusedBlock`, `setFocusedAlign`,
`setFocusedDir`, `setFocusedCalloutIcon`, `patchTableStyle`,
`patchTableCellBackground`, `focusFirst`, `focusEnd`.

## Read-only rendering

Use `<DocRenderer>` to render stored `Block[]` as static HTML (blog posts,
docs pages, previews) — no contentEditable, no editor JS:

```vue
<script setup lang="ts">
import { DocRenderer } from '@xproeditor/vue'
</script>

<template>
  <DocRenderer :blocks="post.content.blocks" editor-dir="ltr" />
</template>
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

See [`docs/theming.md`](../../docs/theming.md) for the full list and more on
how the stylesheet is built (it's compiled from Tailwind utility classes at
build time — you don't need Tailwind in your app).

## Peer dependencies

- `vue` `^3.4.0`

## License

MIT © XofDev
