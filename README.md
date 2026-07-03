# XProEditor

A Notion-like block editor, built as a framework-agnostic core with adapters
for **Vue 3** and **React**. Two editing styles come built in — a classic
**sticky format toolbar**, or a **Notion-like** floating bubble toolbar with a
`/` slash-command menu — switchable with a single prop.

```
paragraphs · headings · bulleted & numbered lists · to-dos · toggles
quotes · callouts · code (with syntax highlighting) · images · video · tables
undo/redo · markdown shortcuts · multi-block selection · rich clipboard
```

## Packages

| Package | Description |
| --- | --- |
| [`@xproeditor/core`](packages/core) | Framework-agnostic engine: block model, selection, clipboard, HTML/table ops |
| [`@xproeditor/vue`](packages/vue) | Vue 3 components |
| [`@xproeditor/react`](packages/react) | React components |

No Tailwind/Radix/shadcn dependency leaks into your app — each adapter ships
its own precompiled stylesheet, themeable via CSS variables.

## Quick start

**Vue**

```bash
npm install @xproeditor/vue
```

```vue
<script setup lang="ts">
import { ProEditor, createBlock } from '@xproeditor/vue'
import '@xproeditor/vue/style.css'

const blocks = ref([createBlock('paragraph', { content: [{ text: 'Hello!' }] })])
</script>

<template>
  <ProEditor :model-value="blocks" toolbar="floating" />
</template>
```

**React**

```bash
npm install @xproeditor/react
```

```tsx
import { ProEditor, createBlock } from '@xproeditor/react'
import '@xproeditor/react/style.css'

const initialBlocks = [createBlock('paragraph', { content: [{ text: 'Hello!' }] })]

export default () => <ProEditor defaultValue={initialBlocks} toolbar="floating" />
```

See each package's README for the full API, and [`examples/`](examples) for
runnable demo apps (toggle between fixed-toolbar and Notion-like modes).

## Repo layout

```
xproeditor/
├── packages/
│   ├── core/    @xproeditor/core   — block model, ops, selection, clipboard, table, html (pure TS)
│   ├── vue/     @xproeditor/vue    — Vue 3 adapter
│   └── react/   @xproeditor/react  — React adapter
├── examples/
│   ├── vue-demo/    runnable Vite + Vue demo
│   └── react-demo/  runnable Vite + React demo
└── docs/        architecture, theming, block model, releasing
```

The Vue and React adapters share zero UI code but implement the same
behavior on top of `@xproeditor/core` — see [`docs/architecture.md`](docs/architecture.md)
for why, and what a future Svelte (or other) adapter would need.

## Documentation

- [Getting started](docs/getting-started.md)
- [Block model](docs/block-model.md) — the persisted JSON shape
- [Theming](docs/theming.md)
- [Architecture](docs/architecture.md)
- [Releasing](docs/releasing.md)

## Development

```bash
npm install
npm run build        # builds core → vue → react in order
npm run dev:vue       # run the Vue demo
npm run dev:react     # run the React demo
npm test
```

## License

MIT © [XofDev](https://github.com/xofdev)
