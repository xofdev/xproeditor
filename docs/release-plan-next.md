# Next release — QA findings and plan

Working branch: `release/next-qa-and-features` (from `main` @ `46fa8b5`,
published `core 0.4.0` / `vue 0.5.0` / `react 0.5.0`).

Benchmarked against BlockNote, Tiptap, Lexical, Editor.js, Yoopta, Novel and
the Liveblocks collaboration stack. The goal for this release is a stable,
safe, fast editor that drops into docs sites, blogs and general apps without
surprises — **no breaking changes** to the persisted `Block[]` shape or to
existing props.

Severity: **P0** security / data loss · **P1** wrong behaviour users will hit ·
**P2** polish / missing expected feature.

---

## 1. QA findings

Method: source review of core + both state machines, plus live checks in
`react-demo` (scripted DOM events and real keyboard input).

### Security

| # | Sev | Finding | Verified |
| --- | --- | --- | --- |
| S1 | P0 | `spansToHtml` writes `link` marks into `href` unchecked — `javascript:` links survive paste and render as live links in the editor and `DocRenderer`. | Live: pasted `<a href="javascript:…">` lands in the DOM |
| S2 | P0 | `color` / `highlight` marks are concatenated into a `style="…"` attribute without escaping; a stored value containing `"` breaks out of the attribute (attribute injection → XSS in `DocRenderer`). | Source |
| S3 | P0 | Button / file / bookmark / image / audio / video URLs are bound to `href` / `src` without a scheme check in both adapters. | Source |
| S4 | P1 | Clipboard JSON and AI `blocks` are trusted as-is (unknown block types, non-string span text, non-object props). | Source |

### Correctness

| # | Sev | Finding | Verified |
| --- | --- | --- | --- |
| C1 | P1 | Multi-line plain-text paste into the middle of a block keeps the text after the caret in the **first** block (`X|Y` + `a\nb` → `XaY`, `b`; expected `Xa`, `bY`). Same for HTML paste. Both adapters. | Live |
| C2 | P1 | Pasting a non-paragraph block into an empty block leaves a stray empty paragraph above it. | Source |
| C3 | P1 | Heading anchors use `\w`, so non-Latin headings (Persian, Arabic, CJK, …) all collapse to `heading`, `heading-1`, … | Source |
| C4 | P1 | Markdown import italicises inside identifiers (`foo_bar_baz` → *bar*), drops list nesting, ignores ordered-list start / `1)` markers. | Source |
| C5 | P1 | `blocksToHtmlContent` drops video blocks entirely, flattens nested lists, renders to-dos and callouts as plain `<p>`, drops the code language. | Source |
| C6 | P1 | HTML import ignores `language-*` classes on code, GitHub task-list checkboxes, `<figure>/<figcaption>`, and `<video>`. | Source |
| C7 | P1 | A failed `upload()` during paste/drop is an unhandled rejection; nothing is inserted and the host is never told. | Source |
| C8 | — | ~~`Tab` indents headings.~~ Not a bug: headings must stay indentable so they can nest inside toggles (Notion behaviour). Dropped. | Source |
| C10 | P1 | An empty paragraph in an RTL document flipped to LTR as soon as a neutral character (`/`, digits, emoji) was typed — caret, gutter and slash menu jumped to the wrong side. | Live (Persian demo) |
| C11 | P1 | `setBlocks` on a read-only editor didn't re-render. | Source (found while documenting the API) |
| C9 | P2 | Spellcheck is hard-disabled on every text block — bad default for prose. | Source |

### Performance

| # | Sev | Finding |
| --- | --- | --- |
| P1 | P1 | `highlight.js` (common bundle) and the icon sets are **bundled into** each adapter's `dist` instead of being external dependencies: React ESM ≈ 366 KB, Vue ESM ≈ 666 KB. Consumers can't dedupe or tree-shake them. |
| P2 | P1 | React: every keystroke re-renders every `BlockItem` (inline closures defeat memoisation). |
| P3 | P2 | Text-range highlight is computed per block per render (O(n²) while a multi-block selection is active). |

### Missing features users expect (vs. BlockNote / Notion / Tiptap)

| # | Feature |
| --- | --- |
| F1 | Inline Markdown shortcuts (`**bold**`, `*italic*`, `` `code` ``, `~~strike~~`) and more block shortcuts (`[x] `, any `N. ` / `N) `, `+ `). |
| F2 | Keyboard shortcuts for block types (`Mod+Alt+0…3`, `Mod+Shift+7/8/9`), move block (`Mod+Shift+↑/↓`), duplicate (`Mod+D`), link (`Mod+K`). |
| F3 | A real editor API on the component ref: `getBlocks`, `setBlocks`, `insertBlocks`, `updateBlock`, `removeBlocks`, `focus`, `getMarkdown`, `getHTML`, `getText`, `getStats`. |
| F4 | Localisation: every UI string behind a dictionary, built-in English and Persian (فارسی). |
| F5 | Table-of-contents block and a generic, allow-listed embed block (YouTube, Vimeo, Loom, Figma, CodePen, CodeSandbox, Spotify, Google Maps). |
| F6 | Document stats (words, characters, reading time) in core. |
| F7 | `placeholder`, `spellCheck`, `autofocus` and `onUploadError` options. |

### Out of scope for this release (roadmap)

Real-time collaboration (Yjs binding, presence/cursors), comments & threads,
version history — the Liveblocks feature set. These need a CRDT document
binding and are tracked separately; the editor API in F3 (stable block ids,
`setBlocks` without losing focus) is the groundwork.

---

## 2. Plan

| Phase | Work | Packages |
| --- | --- | --- |
| A | Security & correctness: S1–S4, C1–C9, with core unit tests for each | core, vue, react |
| B | Performance: P1–P3 | vue, react |
| C | Features: F1–F7, ported to both adapters with parity | core, vue, react |
| D | Docs & site: API / shortcuts / i18n / security docs, a changelog page on the site fed from the packages' `CHANGELOG.md`, changesets | docs, site |
| E | Verification: build, typecheck, tests, lint, live re-QA of both demos; loop until clean | all |

## 3. Status

| Item | Status | Where |
| --- | --- | --- |
| S1–S3 URL / colour sanitization | Done | `core/src/sanitize.ts`, `html.ts`, every `href`/`src` in both adapters |
| S4 untrusted block JSON | Done | `sanitizeBlocks` in `normalizeContent`, clipboard, AI, `setBlocks`/`insertBlocks` |
| C1–C2 paste | Done | `core/src/paste.ts`, both state machines — verified live in both demos |
| C3 non-Latin anchors | Done | `doc-heading-id.ts` |
| C4 Markdown | Done | `markdown.ts` (nesting, escapes, emphasis, ordered markers) |
| C5–C6 HTML export/import | Done | `clipboard.ts`, `normalize.ts` |
| C7 upload errors | Done | `onUploadError` / `@upload-error`, inline message in media blocks |
| C9 spellcheck | Done | `spellCheck` / `spellcheck`, default on |
| C10 neutral-text direction | Done | `detectStrongDir`, verified live in Persian |
| C11 read-only `setBlocks` | Done | both adapters |
| P1 bundles | Done | Vue ESM 666 KB → ~360 KB; highlight.js is a lazy chunk in both renderers |
| P2 React re-renders | Done | memoised rows; 600-block doc: ~18 ms → 2–7 ms per keystroke (dev build) |
| P3 O(n²) highlight | Done | both adapters |
| F1 Markdown shortcuts | Done | `core/src/shortcuts.ts`, both adapters — verified live |
| F2 keyboard shortcuts | Done | `core/src/keyboard.ts`, both adapters — verified with real keystrokes |
| F3 document API | Done | `EditorDocumentApi`, both adapters |
| F4 localization | Done | `core/src/i18n.ts` (en, fa), every component in both adapters |
| F5 embed + table of contents | Done | new blocks in core, both adapters, both renderers, HTML/MD export |
| F6 document stats | Done | `getDocumentStats` |
| F7 options | Done | `placeholder`, `spellCheck`, `autofocus`, `onUploadError` |
| D docs & site | Done | `docs/api.md`, `keyboard-shortcuts.md`, `i18n.md`, `security.md`, `changelog.md`; site changelog section, language switch, feature cards; 9 changesets |

Gates at the end of the work: `npm run build`, `npm run typecheck`,
`npm test` (core unit tests), `npm run lint`, site build — all green.
