# Stable-release audit — XProEditor

Audit against `docs/stable-release-agent-brief.md`, run on `main` @ `d8988ff`
(published `0.2.0`), working branch `chore/stable-release-hardening`.

Method matters for how much each row is worth:

- **Static** — verified by reading/diffing source across both adapters. Reliable
  for coverage and parity questions ("does React have this too?").
- **Live** — exercised in `npm run dev:vue` / `npm run dev:react` with DOM and
  computed-style assertions, not just eyeballing.

Anything not marked below was **not** verified; it is listed under
[Not yet verified](#not-yet-verified) rather than being assumed to pass.

---

## Phase 0 — baseline

All four gates were green *before* any change, on Node 22:

| Gate | Result |
| --- | --- |
| `npm run build` | pass (core → vue → react) |
| `npm run typecheck` | pass (4 workspaces) |
| `npm test` | pass — 19 tests, 3 files (`button`, `selection`, `media`) |
| `npm run lint` | pass, no warnings |

The local checkout was 2 commits behind `origin/main` (missing the
`chore: version packages` release commit); synced before starting. The
`package-lock.json` in the repo was still pinning `0.1.0` for the demos — the
sync corrected it to `0.2.0`.

---

## Phase 1 — coverage matrix

### Block-type coverage (static)

All 17 `BlockType`s, checked in four places per adapter:

| Surface | Vue | React | Notes |
| --- | --- | --- | --- |
| Slash menu insert | 17/17 | 17/17 | Item lists are **identical** between adapters |
| `BlockItem` (editing) | 17/17 | 17/17 | Symmetric |
| `DocRenderer` (read-only) | 17/17 | 17/17 | Symmetric |
| Turn-into menu | 9/17 | 9/17 | Symmetric — see P2-1 |

No block type is missing from either adapter in any surface. The only
asymmetry found anywhere in block handling was in **exports**, not behaviour
(see P2-3).

### Adapter parity (static)

Per the `adapter-parity` skill, I diffed the two state machines'
top-level declaration sets:

- `BlockEditor.vue` `<script setup>`: 128 top-level declarations
- `useBlockEditor.ts`: 121 top-level declarations
- **106 shared function names**

Every name that appeared in only one list was checked individually and is a
framework idiom, not a behaviour gap:

- Vue-only (`blocks`, `history`, `slashState`, `emojiTriggerState`,
  `tableSelectedCells`, `focusedBlockId`, …) — all exist in React as
  `const [x, setX] = useState(...)`, which the declaration regex doesn't match.
- React-only (`blocksRef`, `historyRef`, `rerender`, `afterRender`,
  `onChangeRef`, …) — React-specific ref/render plumbing with no Vue analogue.
- `MD_PATTERNS` exists in both (module scope in React, `<script setup>` scope
  in Vue).

**Conclusion: no genuine parity gap in the editor state machines.** Popover
viewport-flip logic is also present in both (`SlashMenu`, `EmojiTriggerMenu`,
`BlockContextMenu` all clamp against `window.innerHeight` in each adapter).

---

## Findings

### Fixed in this branch

| # | Sev | Finding |
| --- | --- | --- |
| P1-1 | **P1** | **Table borders ignored the theme.** `DEFAULT_TABLE_BORDER.color` was a hardcoded `#eceef1` in core, emitted as an *inline* style — so no stylesheet could override it and dark mode showed harsh near-white gridlines. Now `var(--xpe-border, #eceef1)`. **Live-verified**: light `#e5e7eb`, dark `#374151`. |
| P1-2 | **P1** | **Opacity modifiers on `var()` colours silently shipped nothing.** Tailwind drops `bg-[var(--xpe-muted)]/80` etc., emitting no matching rule — so the table **header background and every table-control hover tint had never rendered at all**, in either adapter, in either theme. Replaced with solid token classes; added `--xpe-danger-muted` for destructive hovers. |
| P1-3 | **P1** | **User-agent button styling leaked into dark mode.** Tailwind preflight is deliberately off, so every `<button>` without its own background rendered with the UA's light `buttonface` — including *every row of the slash menu*, which was unreadable in dark mode. Added a zero-specificity (`:where`) reset scoped to the editor roots; portaled menus now carry `.xpe-menu`. |
| P2-4 | P2 | Hardcoded greys (`border-gray-150/200`, `text-gray-300`, `hover:bg-red-50`) replaced with tokens in both adapters. React's table-cell link colour was hardcoded where Vue used the token — a real drift, now aligned. |

All four were symmetric across adapters (same site count in each), so each fix
landed in both. Gates re-run green after the change; both demos re-verified in
light and dark.

### Open — need a scope decision

| # | Sev | Finding |
| --- | --- | --- |
| P2-1 | P2 | **Turn-into covers 9 of 17 types.** Omits `toggle`, which *is* a `TEXT_BLOCK_TYPE` with the same content shape as `quote`/`callout` that are included — so its absence looks accidental. `code`/media/`table` are reasonable omissions (different content model). Symmetric, so not a parity bug. Suggest adding `toggle` only. |
| P2-2 | P2 | **Callout "Color" control is a permanently visible text button** inside every callout, in both adapters. Notion-like products put this behind hover/context. Cosmetic but it's the first thing you notice on the demo. |
| P2-3 | P2 | **Export asymmetry.** React exports `AudioBlock`, `FileBlock`, `ButtonBlock`; Vue exports no `EditorAudioBlock`/`EditorFileBlock`/`EditorButtonBlock`. Neither exports its context-menu or emoji-trigger component. Needs a decision: align, or document as intentional. |
| P2-5 | P2 | **A11y: unlabelled controls.** The to-do checkbox and the callout icon button expose no accessible name in either adapter (confirmed via the accessibility tree). Gutter buttons *are* labelled, so the pattern exists. |
| P2-6 | P2 | **Editor headings are not semantic.** In-editor blocks render as `div[contenteditable]`; `DocRenderer` should be checked separately for real `h1`/`h2`/`h3` (not yet verified). |
| P2-7 | P2 | **Demos don't exercise the full API.** Neither demo has a dark-mode toggle or the `toolbar="none"` mode, so the two things most likely to regress are the two things QA can't see. Adding both would pay for itself.  |

### Not yet verified

Being explicit, since the brief's matrix is large and I have not walked all of
it. None of these are known-broken; they are simply unproven:

- Markdown shortcuts, copy/cut/paste (internal + from HTML), drag reorder,
  undo/redo, multi-block selection, indent/outdent, file-drop → MIME routing.
- Per-block editing of media blocks (empty/error/loading states, caption UX,
  width resize), code-block language switching and `Mod+Enter` exit.
- Table row/col add-remove, merge/unmerge, cell background/align.
- Toolbar modes `fixed` / `both` / `none`; RTL; mobile/narrow viewport.
- `DocRenderer` read-only output for each block type.

Core-side, `table.ts`, `clipboard.ts` and `normalize.ts` remain **untested** —
they are the largest untested surface in the repo and the brief's stated
minimum bar for the stable cut.
