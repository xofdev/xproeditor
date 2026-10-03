# Getting started

## Install

```bash
# Vue
npm install @xproeditor/vue

# React
npm install @xproeditor/react
```

Both packages depend on `@xproeditor/core` automatically — you don't install
it yourself unless you're doing headless work (see its
[README](../packages/core/README.md)).

Import the stylesheet once, anywhere in your app's entry point:

```ts
import '@xproeditor/vue/style.css'
// or
import '@xproeditor/react/style.css'
```

## The two editing styles

Both adapters expose a `<ProEditor>` convenience component with a `toolbar`
prop:

| `toolbar` value | What you get |
| --- | --- |
| `'floating'` (default) | Notion-like: nothing until you select text (bubble toolbar) or type `/` (slash menu) |
| `'fixed'` | A sticky toolbar above the content, always visible |
| `'both'` | Both the sticky toolbar and the floating bubble/slash menu |
| `'none'` | Neither — compose your own chrome from the exported primitives |

## Vue

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
  <ProEditor :model-value="blocks" toolbar="floating" @change="() => persist(blocks)" />
</template>
```

`<ProEditor>` mutates the array passed to `model-value` in place; `@change`
fires (no payload) whenever it does.

## React

```tsx
import { useState } from 'react'
import { ProEditor, createBlock, type Block } from '@xproeditor/react'

const initialBlocks: Block[] = [
  createBlock('heading_1', { content: [{ text: 'Hello world' }] }),
  createBlock('paragraph', { content: [{ text: 'Start typing, or press / for commands.' }] }),
]

export function Editor() {
  return <ProEditor defaultValue={initialBlocks} toolbar="floating" onChange={(blocks) => persist(blocks)} />
}
```

`<ProEditor>` is uncontrolled (like `<input defaultValue>`) — it owns the
block array and calls `onChange(blocks)` when it changes. To load different
content, call `ref.current.setBlocks(blocks, { history: 'reset' })` (or
remount by changing the component's `key`). See [api.md](api.md) for every
method on the ref.

## Controlled (Vue) vs uncontrolled (React)

This is the one place the two adapters differ on purpose, because each
follows its own framework's convention rather than a shared abstraction:

| | Vue | React |
| --- | --- | --- |
| Prop | `:model-value="blocks"` | `defaultValue={blocks}` |
| Ownership | Your `ref` is the source of truth | The editor owns the array |
| Reading changes | Mutations land on your `ref`; `@change` fires after | `onChange(blocks)` |
| Loading new content | Assign to the `ref` | `ref.setBlocks(blocks, { history: 'reset' })` |

Everything else — block model, keyboard shortcuts, toolbar modes, theming
tokens, the `Block[]` you persist — is identical, so documents move between
the two adapters unchanged.

## Persisting content

Store the `Block[]` array as JSON (e.g. wrapped in the `BlocksContent` shape —
see [block-model.md](block-model.md)). To render it read-only later (a blog
post, a docs page), use `<DocRenderer>` from either adapter — no
contentEditable, no editor JS shipped to that page.

## Options at a glance

| Option | Vue | React | Default |
| --- | --- | --- | --- |
| Toolbar style | `toolbar` | `toolbar` | `'floating'` |
| UI language | `locale` / `dictionary` | `locale` / `dictionary` | `'en'` — see [i18n.md](i18n.md) |
| Default text direction | `editor-dir` | `editorDir` | `'ltr'` |
| Read-only | `readonly` | `readonly` | `false` |
| Empty-line placeholder | `placeholder` | `placeholder` | localized “Type '/' for commands…” |
| Browser spellcheck | `spellcheck` | `spellCheck` | `true` |
| Focus on mount | `autofocus` | `autofocus` | `false` (`true` / `'start'` / `'end'`) |
| Ask AI | `ai` | `ai` | off — see the package READMEs |
| Upload failed | `@upload-error` | `onUploadError` | — |

Keyboard and Markdown shortcuts are listed in
[keyboard-shortcuts.md](keyboard-shortcuts.md).

## Uploads & media picking

Both `<ProEditor>` and `<BlockEditor>` accept:

- `upload?: (file: File) => Promise<string>` — called when a user drops/pastes
  an image or video file; return the hosted URL.
- `pickMedia?: (opts: { accept: string[]; title?: string }) => Promise<{ url, alt?, caption? } | null>` —
  hook up your own media library / asset picker.
- `fetchBookmarkMeta?: (url: string) => Promise<{ title?, description?, favicon?, image? } | null>` —
  optional helper for `/bookmark` cards (OG/title/favicon). Without it, users
  can still paste a URL; the card just won’t auto-fill metadata.

If `upload` rejects, the file is skipped and `onUploadError(error, file)` /
`@upload-error` fires; media blocks also show an inline “Upload failed”.

## Next

- [Editor API](api.md) — ref methods, events and core helpers
- [Keyboard & Markdown shortcuts](keyboard-shortcuts.md)
- [Localization & RTL](i18n.md)
- [Security](security.md)
- [Block model](block-model.md)
- [Theming](theming.md)
- [Architecture](architecture.md)
- [Changelog](changelog.md)
