# @xproeditor/vue

## 0.2.0

### Minor Changes

- 12c180b: Add a new `button` block type (label, link URL, open-in-new-tab, primary/outline/ghost style, alignment) with a settings popover in both adapters and read-only rendering in `DocRenderer`.

  Add a standalone, categorized emoji picker (search, 7 categories, recents) usable both from the callout icon button and via a Slack/Discord-style `:` inline trigger that searches and inserts an emoji directly into text.

  Fix several real bugs surfaced while building the Bento showcase theme:
  - Slash-menu arrow-key/Enter navigation was dead on arrival — the root keydown handler bailed out for any key typed inside the contenteditable block the menu lives in, which is the only place slash state ever exists.
  - Floating UI (slash menu, bubble toolbar, popovers, dropdowns) is portaled to `document.body`, which silently escaped any theme class scoped to an ancestor of the editor — these now resync `--xpe-*` variables onto the portaled node so scoped custom themes apply everywhere, not just inline.
  - The to-do checkbox's checkmark and the toggle chevron were sized via Tailwind utility classes that weren't reliably taking effect on raw SVGs — both now use explicit width/height so the checkmark is always visible.
  - Vue's button-block label lost all styling because it reused `ui/Button.vue`'s scoped `.xpe-btn` class names on a plain `<div>` — Vue scoped CSS only applies to elements a component itself renders, so the classes were dead. Replaced with locally-scoped styles.

  Slash menu now groups items into Basic/Lists/Media/Advanced sections, locks page scroll while open (Notion-style), and flips above the caret when there's no room below.

- d987bf0: Add a right-click context menu on blocks (Notion-style): Duplicate, Delete, and — for callout blocks — a Color flyout with the existing background presets, all in a clean two-level menu with no extra clutter.

  Add slim, theme-token-driven custom scrollbars across every scrollable surface (popovers, dropdowns, the slash/emoji menus, tables, code blocks, the editor root, and the doc renderer) instead of the browser default — add the `.xpe-scroll` class to any other scrollable container you build to match.

  Soften corners across the whole popover/menu/button/input/callout/table/code family to scale off `--xpe-radius` instead of hardcoded pixel values, so a single token change now reshapes the entire editor consistently.

  Fix: the text/highlight color popover in the floating bubble toolbar could never actually be used — clicking a swatch immediately closed the panel. The panel's "stay open" effect compared the toolbar's position by object reference, and a same-range `selectionchange` event (fired by clicking inside the toolbar itself) always produces a fresh position object, so the panel closed itself before a color could register. Also fixed a malformed Tailwind class that left the "active color" checkmark badge invisible, and replaced a few remaining hardcoded indigo accents with theme tokens.

- a2089e1: Add `audio` and `file` block types with upload / library / URL insertion, per-file metadata (name, size, MIME), download card UI, and read-only rendering in `DocRenderer`. Media import now works out of the box without an `upload` prop (object-URL fallback), supports pasting files from the clipboard, and dropping OS files directly onto the editor at a precise position. Image blocks gain a paste-URL tab. Core exports new media helpers: `blockTypeForFile`, `formatFileSize`, `mediaPropsFromFile`, `fileToObjectUrl`, `acceptForBlockType`.
- a2089e1: Slash-command menu now measures itself and positions precisely at the caret — flipping above when near the viewport bottom, clamping to the viewport edges, staying aligned in RTL, and showing a "No results" state instead of abruptly closing. Theming: a richer minimal token set (`--xpe-surface`, `--xpe-surface-hover`, `--xpe-primary-muted`, `--xpe-primary-foreground`, `--xpe-ring`, `--xpe-danger`, `--xpe-radius`, `--xpe-shadow`) plus a built-in dark theme via the `xpe-dark` class or `data-xpe-theme="dark"`; the slash menu, media blocks, and all editor chrome (toolbars, popovers, dropdown menus, inputs, tabs, table controls, gutter, text blocks) are fully token-driven, so the built-in dark theme and custom themes restyle the entire editor. Remaining physical CSS (left/right) converted to logical properties for correct RTL layout.

### Patch Changes

- Updated dependencies [12c180b]
- Updated dependencies [d987bf0]
- Updated dependencies [a2089e1]
  - @xproeditor/core@0.2.0
