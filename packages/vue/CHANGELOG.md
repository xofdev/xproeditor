# @xproeditor/vue

## 0.6.0

### Minor Changes

- 8636314: A document API on the editor ref (`ProEditor` and `BlockEditor` in both adapters): `getBlocks`, `setBlocks` (with `history: 'reset'` for loading another document), `insertBlocks`, `updateBlock`, `removeBlocks`, `focus`, `getMarkdown`, `getHTML`, `getText` and `getStats` (words, characters, reading time — Unicode-aware). New options: `placeholder`, `spellCheck` (React) / `spellcheck` (Vue) — browser spellcheck is now on by default — and `autofocus`. Core exports the `EditorDocumentApi` type and `getDocumentStats`.
- 8636314: Two new blocks. **Embed** (`/embed`) shows allow-listed iframes for YouTube, Vimeo, Loom, Figma, CodePen, CodeSandbox, Spotify, SoundCloud and Google Maps — paste a link or an `<iframe>` snippet; the frame source is always re-derived from the URL so stored documents can't point it anywhere else. **Table of contents** (`/toc`) lists the document's headings live and links to them in the editor and in `DocRenderer`. Core exports `EMBED_PROVIDERS`, `resolveEmbed`, `extractEmbedSource`, `embedFrameHeight` and `BLOCK_TYPES`; `DocHeading` gains `blockId`. Bookmark, embed and table-of-contents slash items now insert a new block instead of converting a line that already has text.
- 8636314: Localization. Every label, tooltip, placeholder and message now comes from a typed dictionary: pass `locale="fa"` for the built-in Persian UI (English stays the default) or `dictionary={{ … }}` to override any string or ship another language. Works on `ProEditor`, `BlockEditor` and `DocRenderer`, including portaled menus. Core exports `EN_DICTIONARY`, `FA_DICTIONARY`, `resolveEditorDictionary` and `localeDirection`; React exports `EditorI18nProvider` / `useEditorDictionary`, Vue exports `provideEditorI18n` / `useEditorDictionary`.
- 8636314: Markdown and keyboard shortcuts. Type `**bold**`, `*italic*` / `_italic_`, `` `code` `` or `~~strike~~` and the formatting is applied as you close it; block prefixes now include `[x] ` (checked to-do), any `N. ` / `N) `, `+ `, `" ` (quote) and `>> ` (toggle), and `[ ] ` turns a bullet into a to-do. New block shortcuts: `Mod+Alt+0…3` (text / headings), `Mod+Shift+7/8/9` (numbered / bulleted / to-do), `Mod+Shift+↑/↓` (move block with its children), `Mod+D` (duplicate), `Mod+Enter` (check a to-do / open a toggle) and `Mod+K` (link). Tooltips show `⌘` on macOS. Core exports `matchBlockShortcut`, `applyInlineMarkdownShortcut`, `resolveBlockKeyboardShortcut`, `moveBlockSubtree` and `BLOCK_KEYBOARD_SHORTCUTS`.

### Patch Changes

- 8636314: Fix pasting into the middle of a block: the text after the caret now stays after the pasted content (`X|Y` + `a⏎b` gives `Xa` / `bY`, not `XaY` / `b`), pasting an image or table into an empty line no longer leaves a stray empty paragraph, and a failed `upload()` for a pasted or dropped file is reported (`onUploadError` in React, `@upload-error` in Vue, plus an inline message in media blocks) instead of being an unhandled rejection. Core exports the shared `pasteBlocksIntoTextBlock` and `plainTextToBlocks` helpers.
- 8636314: Faster and lighter. Typing in a long document no longer re-renders every block (React rows are memoised; multi-block highlight is computed once per render in both adapters), `DocRenderer` loads highlight.js on demand as a separate chunk instead of eagerly, and the Vue build no longer inlines highlight.js and the icon set (its ESM bundle drops from ~666 KB to ~360 KB, and apps can now dedupe and tree-shake those dependencies).
- 8636314: Polish and accessibility: icon-only toolbar and gutter buttons now have accessible names, the button block's "Open in new tab" is a real switch, the image lightbox closes with Escape and has a labelled close button, code blocks keep (and show) languages that aren't in the picker list, and `BlockContextMenu` / `EmojiTriggerMenu` (React) and `EditorBlockContextMenu` / `EditorEmojiTriggerMenu` (Vue) are now exported.
- 8636314: **Security:** links, media sources and colours are now sanitized everywhere content is rendered, imported or exported. `javascript:` / `data:` links pasted from a web page, loaded from storage, pasted as clipboard JSON or returned by an AI model no longer become live links in the editor or in `DocRenderer`, and colour values can no longer break out of a `style` attribute. Unknown block types in stored or pasted documents now degrade to paragraphs instead of breaking the renderer. New core helpers: `sanitizeUrl`, `sanitizeLinkUrl`, `sanitizeMediaUrl`, `sanitizeCssColor`, `sanitizeBlock`, `sanitizeBlocks`.
- Updated dependencies [8636314]
- Updated dependencies [8636314]
- Updated dependencies [8636314]
- Updated dependencies [8636314]
- Updated dependencies [8636314]
- Updated dependencies [8636314]
- Updated dependencies [8636314]
  - @xproeditor/core@0.5.0

## 0.5.0

### Minor Changes

- 77f7845: Polish code-block chrome (language control, soft-wrap via a `wrap` prop) and table editing UX (sizing, cell controls, style panel), with matching styles in both adapters.
- 77f7845: Improve multi-block selection: a shared formatting popover when several blocks are selected, richer block context menus, and core helpers for cross-block text ranges, marks, staged Select All, and document-level undo/redo shortcuts.
- 77f7845: Add collapsible **toggle headings** (`toggle_heading_1`–`3`) alongside toggle lists, with slash / turn-into support and helpers for subtree clone, remove, and collapsed visibility filtering.
- 77f7845: Add a **web bookmark** block with link-preview cards (title, description, favicon, image). Hosts can optionally pass `fetchBookmarkMeta` to hydrate Open Graph metadata when a URL is pasted or edited.

### Patch Changes

- 77f7845: Fix undo/redo when focus is inside a contenteditable or field, Select All staging across blocks, applying marks over a multi-block selection, link editing edge cases, bookmark URL re-edit, table width persistence, and dark-mode token gaps in editor chrome.
- Updated dependencies [77f7845]
- Updated dependencies [77f7845]
- Updated dependencies [77f7845]
- Updated dependencies [77f7845]
- Updated dependencies [77f7845]
  - @xproeditor/core@0.4.0

## 0.4.0

### Minor Changes

- f79a611: Improve button block UX with label/URL/color controls, include non-text blocks in multi-block copy/cut/delete, add Markdown paste plus lossy import/export APIs, and ship a pluggable Ask AI agent (slash `/ai`, toolbar, Accept/Reject).

### Patch Changes

- Updated dependencies [f79a611]
  - @xproeditor/core@0.3.0

## 0.3.0

### Minor Changes

- 8877759: The turn-into menu now offers **Toggle list**, alongside the paragraph, heading, list, to-do, quote and callout conversions it already supported.
- 8877759: Export `EditorAudioBlock`, `EditorFileBlock` and `EditorButtonBlock`, matching the `AudioBlock`, `FileBlock` and `ButtonBlock` components `@xproeditor/react` already exported. Useful when composing custom chrome with `toolbar="none"`.

### Patch Changes

- 8877759: Screen readers now announce the to-do checkbox and its checked state, and the callout icon button is labelled — both previously had no accessible name. The callout's "Color" control now fades in on hover or keyboard focus instead of sitting permanently inside every callout.
- 8877759: Fix dark mode across the editor. Table borders now follow the `--xpe-border` token instead of a hardcoded light grey baked into an inline style, table header backgrounds and table control hover tints now render at all (they were written with Tailwind opacity modifiers on `var()` colours, which silently produce no CSS), and the browser's default button chrome no longer shows through as light-grey chips on editor controls — most visibly on every row of the slash menu. Adds a `--xpe-danger-muted` token for destructive hover states.
- Updated dependencies [8877759]
- Updated dependencies [8877759]
  - @xproeditor/core@0.2.1

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
