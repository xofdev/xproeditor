---
name: new-block-type
description: Use when adding a brand-new block type (like a new BlockType such as "callout" or "table") to xproeditor. Walks through every layer that must change — core model/serialization, Vue adapter, React adapter, toolbar and slash menu — so no adapter is left half-implemented.
---

# Adding a new block type

xproeditor stores documents as a flat `Block[]` (see [docs/block-model.md](../../docs/block-model.md)).
A new `BlockType` touches four layers, in this order. Do not skip a layer —
a block type that only exists in `core` renders nowhere, and a block type
that only exists in one adapter breaks parity (see the `adapter-parity` skill).

## 1. `@xproeditor/core` (framework-agnostic)

- `packages/core/src/types.ts` — add the new literal to the `BlockType` union
  and any new fields to `BlockProps`.
- `packages/core/src/normalize.ts` — default/normalize the new props when a
  block is created or loaded (e.g. defaults for `checked`, `collapsed`, `width`).
- `packages/core/src/serialize.ts` and `packages/core/src/html.ts` — how the
  block round-trips to/from `BlocksContent` and HTML (`blocksToHtmlContent`,
  `htmlToBlocks`).
- `packages/core/src/clipboard.ts` — copy/paste (de)serialization if the
  block carries non-text data.
- Add/extend a test in `packages/core/src/*.test.ts` covering
  normalize → serialize → round-trip for the new type.
- Rebuild core before touching adapters: `npm run build -w @xproeditor/core`
  (adapters import core's compiled `dist/`, not its source).

## 2. Vue adapter (`packages/vue/src`)

- Rendering: add a new block component under `components/` (pattern:
  `EditorImageBlock.vue`, `EditorTableBlock.vue`) or extend
  `EditorTextBlock.vue` if it's a text-like block, and wire it into
  `EditorBlockItem.vue`'s type switch.
- Behavior: extend `BlockEditor.vue`'s `<script setup>` state machine —
  keydown/markdown-shortcut handling, `turnIntoBlock`, table-style ops as
  precedent.
- Discoverability: add a slash-menu entry in `EditorSlashMenu.vue` and, if the
  block has a distinct toolbar action, a control in
  `components/toolbar/` / `EditorFormatToolbar.vue` / `EditorBubbleToolbar.vue`.

## 3. React adapter (`packages/react/src`)

Mirror step 2 exactly, function-for-function:

- Rendering: a new component under `components/` (pattern: `ImageBlock.tsx`,
  `TableBlock.tsx`), wired into `BlockItem.tsx`'s type switch.
- Behavior: the equivalent addition in `hooks/useBlockEditor.ts` — same
  function names and call sites into `@xproeditor/core` as the Vue version.
- Discoverability: `SlashMenu.tsx` and, if applicable,
  `components/toolbar/` / `FormatToolbar.tsx` / `BubbleToolbar.tsx`.

## 4. Cross-cutting

- `DocRenderer.vue` / `DocRenderer.tsx` — the read-only renderer needs to know
  how to display the new block type too.
- Styling: if the block needs new visual chrome, follow
  [docs/theming.md](../../docs/theming.md) — Tailwind utility classes authored
  in each package's own `src`, no new CSS variables unless the value is meant
  to be end-user themeable (background/foreground/border/primary/mono font).
- Update [docs/block-model.md](../../docs/block-model.md) with the new
  `BlockType`/`BlockProps` fields.
- Run `npm run lint && npm run typecheck && npm test` from the repo root
  before considering the change done.
- Add a changeset (see the `changeset` skill) — a new block type is a
  user-visible feature in all three published packages.
