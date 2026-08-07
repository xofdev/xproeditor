# XProEditor

[![npm @xproeditor/core](https://img.shields.io/npm/v/@xproeditor/core?label=%40xproeditor%2Fcore)](https://www.npmjs.com/package/@xproeditor/core)
[![npm @xproeditor/vue](https://img.shields.io/npm/v/@xproeditor/vue?label=%40xproeditor%2Fvue)](https://www.npmjs.com/package/@xproeditor/vue)
[![npm @xproeditor/react](https://img.shields.io/npm/v/@xproeditor/react?label=%40xproeditor%2Freact)](https://www.npmjs.com/package/@xproeditor/react)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Live demo](https://img.shields.io/badge/demo-GitHub%20Pages-111111)](https://xofdev.github.io/xproeditor/)

**[Live demo →](https://xofdev.github.io/xproeditor/)** · **[Docs](docs/)** · npm: [core](https://www.npmjs.com/package/@xproeditor/core) · [vue](https://www.npmjs.com/package/@xproeditor/vue) · [react](https://www.npmjs.com/package/@xproeditor/react)

A Notion-like block editor with a framework-agnostic core and adapters for
**Vue 3** and **React**. Two editing styles ship built-in — a classic **sticky
format toolbar**, or a **Notion-like** floating bubble toolbar with a `/` slash
menu — switchable with a single prop.

## Features

- **18 block types** — paragraphs, headings, lists, to-dos, toggles & toggle headings, quotes, callouts, code (language / wrap / copy), dividers, buttons, images, video, audio, files, tables, web bookmarks
- **Notion-like chrome** — block context menu, multi-select with floating edit popover, two-stage Ctrl/⌘+A
- **Clipboard** — multi-block copy/cut, Markdown paste, rich HTML/JSON clipboard
- **Tables** — width, drag cell select, merge, borders, fills, add row/column
- **Ask AI** — pluggable transport (`/ai`, toolbar, Accept / Reject); no API keys in the package
- **DocRenderer** — publish the same `Block[]` as a read-only page
- **Theming** — precompiled CSS, `--xpe-*` variables, light/dark (`.xpe-dark`), RTL
- **Zero Tailwind lock-in** — no Tailwind/Radix/shadcn required in consumer apps

## Packages

| Package | Description | Links |
| --- | --- | --- |
| [`@xproeditor/core`](packages/core) | Framework-agnostic engine: block model, selection, clipboard, tables, bookmarks | [npm](https://www.npmjs.com/package/@xproeditor/core) |
| [`@xproeditor/vue`](packages/vue) | Vue 3 components (`ProEditor`, `DocRenderer`, …) | [npm](https://www.npmjs.com/package/@xproeditor/vue) |
| [`@xproeditor/react`](packages/react) | React components (same behavior as Vue) | [npm](https://www.npmjs.com/package/@xproeditor/react) |

## Quick start

**Vue**

```bash
npm install @xproeditor/vue
```

```vue
<script setup lang="ts">
import { ref } from 'vue'
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

See each package’s README for the full API, and [`examples/`](examples) for
runnable demos (toggle between fixed-toolbar and Notion-like modes).

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
├── site/        marketing page + live embedded demo (GitHub Pages)
└── docs/        architecture, theming, block model, releasing
```

The Vue and React adapters share zero UI code but implement the same behavior on
top of `@xproeditor/core` — see [`docs/architecture.md`](docs/architecture.md).

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
npm run dev:vue       # Vue demo
npm run dev:react     # React demo
npm run dev:site      # landing page + live demo → http://localhost:5175
npm test
```

Publishing to npm is automated (Changesets bot opens a “Version Packages” PR;
merging it publishes) — see [docs/releasing.md](docs/releasing.md). The
[`site/`](site) page redeploys to GitHub Pages on pushes to `main` that touch
the site or editor packages.

## License

MIT © [XofDev](https://github.com/xofdev)
