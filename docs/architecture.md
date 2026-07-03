# Architecture

## Core / adapter split

```
┌─────────────────────────────┐
│        @xproeditor/core      │  block model, span ops, selection,
│      (framework-agnostic)     │  clipboard, HTML/table ops — pure TS,
│                              │  zero UI, zero DOM framework
└──────────────┬───────────────┘
               │
     ┌─────────┴─────────┐
     │                   │
┌────▼─────┐       ┌─────▼────┐
│  @xproeditor/vue  │       │ @xproeditor/react │
│  Vue 3 components │       │  React components  │
└──────────┘       └──────────┘
```

`@xproeditor/core` owns every algorithm that doesn't need a rendering
framework: the block/span data model, contentEditable caret & selection math
(`getSelectionOffsets`, `getRangeClientRects`, `caretPointFromClient`, ...),
cross-block text-range selection, clipboard (de)serialization, HTML
conversion, and table operations (merge/unmerge/resize/style). None of it
imports Vue or React.

Each adapter package owns only:
1. **Rendering** — turning a `Block` into DOM (contentEditable divs for text
   blocks, a `<textarea>` for code, `<table>` for tables, ...).
2. **A state machine** wiring user input (keydown, paste, drag, pointer
   events) to `@xproeditor/core` functions and back into re-rendered state —
   `BlockEditor.vue`'s `<script setup>` in Vue, `useBlockEditor` in React.
3. **A small internal UI kit** (button, input, tabs, popover, dropdown menu,
   color picker, emoji picker) so neither package depends on Tailwind,
   Radix, or shadcn at runtime.

The two state machines are intentionally near-identical in structure and
naming (same function names, same call sites into `@xproeditor/core`) so a
change in editor *behavior* (a new markdown shortcut, a keyboard shortcut
tweak, a selection edge case) can be ported from one adapter to the other by
following the same shape, rather than re-deriving it.

## Why this split makes another adapter cheap

A future Svelte (or Solid, or vanilla) adapter only needs to write layer 1–3
above — the hard parts (selection math, clipboard, table algebra, the block
model itself) are already done and tested in `@xproeditor/core`, and the
existing two adapters are a working reference for how the state machine
should behave.

## The two editing UX styles

`BlockEditor` (Vue) / `useBlockEditor` (React) know how to run in two modes,
controlled by one flag:

- `showBubbleToolbar: false` → pair the editor with a sticky `EditorFormatToolbar`
  / `<FormatToolbar>` that reads `format-state` / `onFormatState` and drives
  the editor's exposed `applyToolbarMark`/`turnIntoBlock`/... methods.
- `showBubbleToolbar: true` → the editor renders its own floating
  `EditorBubbleToolbar` / `<BubbleToolbar>` on text selection, plus a `/`
  slash-command menu (`EditorSlashMenu` / `<SlashMenu>`), with no external
  toolbar needed.

`<ProEditor>` (in both adapters) is a thin convenience wrapper that picks one
or both based on a single `toolbar` prop — see each package's README.

## Styling

Both adapters are authored with Tailwind utility classes for speed and visual
consistency, but neither requires the consuming app to have Tailwind
installed — see [theming.md](theming.md) for how the stylesheet is built and
themed.
