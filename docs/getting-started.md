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
content, remount by changing the component's `key`.

## Persisting content

Store the `Block[]` array as JSON (e.g. wrapped in the `BlocksContent` shape —
see [block-model.md](block-model.md)). To render it read-only later (a blog
post, a docs page), use `<DocRenderer>` from either adapter — no
contentEditable, no editor JS shipped to that page.

## Uploads & media picking

Both `<ProEditor>` and `<BlockEditor>` accept:

- `upload?: (file: File) => Promise<string>` — called when a user drops/pastes
  an image or video file; return the hosted URL.
- `pickMedia?: (opts: { accept: string[]; title?: string }) => Promise<{ url, alt?, caption? } | null>` —
  hook up your own media library / asset picker.

## Next

- [Block model](block-model.md)
- [Theming](theming.md)
- [Architecture](architecture.md)
