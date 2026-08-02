# Stable Release Agent Brief — XProEditor

Use this document as the **mission brief + checklist + copy-paste prompt** for an AI coding agent that must audit, harden, polish, test, and prepare `@xproeditor/*` for a professional stable release (target: next minor after current published `0.2.0`, e.g. `0.3.0` or first `1.0.0` when quality bar is met).

---

## Mission (one sentence)

Ship a **stable, professional, usable** open-source Notion-like block editor: Vue + React adapters stay behavior-identical, all blocks work end-to-end, UX/theming/docs match reality, CI gates pass, and a correct Changeset is ready for publish.

---

## Product facts the agent must not invent around

| Fact | Detail |
| --- | --- |
| Packages | `@xproeditor/core`, `@xproeditor/vue`, `@xproeditor/react` |
| Block types | `paragraph`, `heading_1..3`, `bulleted_list_item`, `numbered_list_item`, `to_do`, `toggle`, `quote`, `callout`, `code`, `divider`, `image`, `video`, `audio`, `file`, `table`, `button` |
| Toolbar modes | `fixed` \| `floating` \| `both` \| `none` |
| Marks | bold, italic, underline, strikethrough, code, link, color, highlight |
| Theming | CSS variables only; no Tailwind/Radix leak; dark via `.xpe-dark` or `data-xpe-theme="dark"` |
| Release | Changesets → “Version Packages” PR → auto `npm publish` on merge to `main` |
| Live demo | https://xofdev.github.io/xproeditor/ |

### Repo skills the agent MUST follow

| Skill | When |
| --- | --- |
| `.claude/skills/adapter-parity/SKILL.md` | Any behavior change in Vue or React |
| `.claude/skills/theming/SKILL.md` | Any styling / CSS vars / dark mode |
| `.claude/skills/new-block-type/SKILL.md` | Adding or finishing a block type |
| `.claude/skills/changeset/SKILL.md` | Before finishing published-package work |
| `.claude/skills/release-check/SKILL.md` | Before declaring release-ready |

### Hard constraints

1. **Always** `npm run build` before `typecheck` / `test` (adapters consume core `dist/`).
2. Behavior changes must land in **both** adapters (or be documented as intentional API differences only).
3. Do not leak Tailwind/Radix/shadcn into published CSS.
4. Prefer polish + bugfixes + docs/tests over speculative mega-features for the stable cut.
5. Do not force-push, amend others’ commits, or publish without human confirmation on the Version Packages merge.
6. Sync with `origin/main` first (local may lag behind published `0.2.0`).

---

## Phased checklist

Copy progress into the PR description. Mark `[x]` only when verified.

### Phase 0 — Sync & baseline

- [ ] `git fetch && git pull` (or rebase) so workspace matches `origin/main` / published `0.2.0`
- [ ] `npm install`
- [ ] `npm run build && npm run typecheck && npm test && npm run lint` — record baseline failures
- [ ] Note open gaps from this brief (docs drift, missing tests, export asymmetry)
- [ ] Run `npm run dev:vue`, `npm run dev:react`, `npm run dev:site` once to confirm demos boot

### Phase 1 — Feature & block matrix audit (find, don’t invent)

For **every** `BlockType`, verify in **both** Vue and React demos:

| Check | paragraph / headings / lists / todo / toggle / quote / callout / code / divider / image / video / audio / file / table / button |
| --- | --- |
| Create via slash `/` | |
| Create via markdown shortcut (if any) | |
| Turn-into from toolbar/bubble (if supported) | |
| Edit content / props | |
| Undo / redo | |
| Copy / cut / paste (internal + from HTML) | |
| Drag reorder | |
| Delete / Backspace edge cases | |
| Read-only `DocRenderer` | |
| Dark mode looks correct | |
| RTL (`dir`) where relevant | |

Also verify:

- [ ] Inline marks + link + color + highlight
- [ ] Multi-block selection (Shift+arrows, Mod+A progressive)
- [ ] Indent / outdent / align
- [ ] Emoji `:` trigger
- [ ] Block context menu
- [ ] File drop → correct media block by MIME
- [ ] Table: add/remove row/col, merge/unmerge, header, cell bg/align, style
- [ ] Callout icon + color
- [ ] Button settings (url, style, new tab, align)
- [ ] Toolbar modes: floating, fixed, both, none
- [ ] Empty-doc / last-block-delete / paste into empty editor

**Deliverable:** `docs/ux-block-audit.md` (or PR comment) with PASS / FAIL / N/A per cell + severity.

### Phase 2 — UX / UI polish (stable-quality bar)

Prioritize fixes that make the product feel professional:

- [ ] Slash menu: keyboard nav, filter, positioning (viewport edges), RTL, dark, focus return
- [ ] Bubble vs fixed toolbar: no overlap/clipping; consistent mark toggles
- [ ] Selection chrome: clear multi-block highlight; no “stuck” selection
- [ ] Media blocks: empty/error/loading states; caption UX; width resize sanity
- [ ] Code block: language, focus, Mod+Enter exit, highlight doesn’t break typing
- [ ] Tables: cell focus, selection, toolbar actions discoverable
- [ ] Scrollbars / popovers / portals inherit theme tokens (`syncThemeVars`)
- [ ] Mobile / narrow viewport: usable typing + menus (no broken overlay)
- [ ] Accessibility basics: focusable controls, button labels, Escape closes menus
- [ ] Remove visual jank (flicker, layout jump on toolbar open, z-index wars)

**Out of scope for this stable cut unless trivial:** collaborative editing, comments, databases, AI autocomplete, plugin marketplace.

### Phase 3 — Adapter parity & public API

- [ ] Run adapter-parity audit: `BlockEditor.vue` ↔ `useBlockEditor.ts` function-name sets
- [ ] Toolbar pairs, slash menus, DocRenderers match behavior
- [ ] Align public exports where asymmetry is accidental (e.g. React exports `AudioBlock`/`FileBlock`/`ButtonBlock`; Vue may not — decide and fix or document)
- [ ] Document intentional Vue controlled (`modelValue`) vs React uncontrolled (`defaultValue`) APIs in `docs/getting-started.md`
- [ ] Package READMEs list the **full** current block set and toolbar modes

### Phase 4 — Docs & marketing truthfulness

- [ ] Update `docs/block-model.md` for `button`, `audio`, `file`, and current props
- [ ] Root `README.md` feature line matches real blocks
- [ ] `site` Features / marketing copy matches real blocks
- [ ] `packages/*/README.md` API examples still compile against current exports
- [ ] `docs/theming.md` covers dark + any new tokens added
- [ ] `docs/getting-started.md` covers toolbar modes + persistence differences

### Phase 5 — Tests & quality gates

Minimum bar before calling it stable:

- [ ] Core: add/expand Vitest for **table** ops (`packages/core/src/table.ts`)
- [ ] Core: clipboard / `htmlToBlocks` / normalize smoke tests
- [ ] Core: existing selection / media / button tests still green
- [ ] Prefer a small **adapter smoke** suite if feasible (at least one Vue + one React happy-path); if not, document manual QA matrix as release artifact
- [ ] `npm run build && npm run typecheck && npm test && npm run lint` green on Node matching CI (18/20/22 intent)
- [ ] Manual QA on Vue demo + React demo + site LiveDemo (light + dark)

### Phase 6 — Release packaging

- [ ] Follow `.claude/skills/changeset/SKILL.md` — write accurate `.changeset/*.md` (semver: `minor` for features, `patch` for fixes; avoid surprise `major` unless breaking on purpose)
- [ ] Changelog-quality summaries (user-facing “why”, not file lists)
- [ ] Follow `.claude/skills/release-check/SKILL.md`
- [ ] PR description includes: summary, audit matrix link/section, test plan, risk notes
- [ ] **Stop before merging Version Packages** — human confirms publish timing

---

## Suggested work order for the agent

```
0 sync → 1 audit matrix → 2 fix P0/P1 bugs + UX polish
→ 3 parity + exports → 4 docs sync → 5 tests → 6 changeset + release-check
→ stop for human review / PR
```

Severity guide:

| Severity | Meaning | Stable release rule |
| --- | --- | --- |
| P0 | Crash, data loss, unusable editor, broken build/publish | Must fix |
| P1 | Wrong behavior on common path, parity break, broken block | Must fix |
| P2 | UX polish, docs drift, missing tests | Fix in this cut if time; else track |
| P3 | Nice-to-have features | Defer after stable |

---

## Copy-paste prompt for the AI agent

Paste the block below into a new agent chat (Cursor / Claude Code / etc.) at the repo root.

```text
You are the release engineer + product QA agent for the open-source monorepo **xproeditor** (Notion-like block editor: `@xproeditor/core` + Vue + React adapters).

## Goal
Audit, fix, polish, test, and prepare a **professional stable release** of the published packages. Prefer reliability, adapter parity, truthful docs, and UX polish over new speculative features. Follow every skill under `.claude/skills/` that applies. Read `docs/stable-release-agent-brief.md` and treat its checklist as the source of truth for progress.

## Non-negotiables
1. Sync with `origin/main` first.
2. Always `npm run build` before typecheck/test (adapters use core `dist/`).
3. Any editor *behavior* change must be ported Vue ↔ React (adapter-parity skill).
4. Theming stays CSS-variable based; no Tailwind/Radix leak into published CSS (theming skill).
5. Write a correct Changeset for published behavior changes (changeset skill).
6. Run the full release-check skill before declaring done.
7. Do NOT merge the Changesets “Version Packages” PR or publish without explicit human approval.
8. Do NOT invent APIs, block types, or marketing claims that the code does not support. If docs/marketing disagree with code, fix docs/marketing or implement the missing piece deliberately.

## Current known gaps to investigate (verify, then fix)
- Docs/marketing may omit `audio`, `file`, `button` and lag `docs/block-model.md`.
- Turn-into toolbar covers a subset of slash-insertable blocks — decide if that is intentional; document or extend carefully.
- Core tests are thin (selection/media/button only); table/clipboard/normalize largely untested; no adapter automated tests.
- Public export asymmetry: React may export Audio/File/Button block components while Vue does not.
- Vue is controlled (`modelValue`); React is uncontrolled (`defaultValue`) — document; do not “unify” without a clear migration plan.
- Local checkout may be behind origin where `0.2.0` already published.

## Execution plan
Work in phases from `docs/stable-release-agent-brief.md`:
Phase 0 baseline → Phase 1 block/UX audit matrix (both demos) → Phase 2 P0/P1 UX fixes → Phase 3 parity/API → Phase 4 docs → Phase 5 tests → Phase 6 changeset + release-check.

After the audit, implement fixes in small coherent commits/PR-sized chunks. Keep a running checklist in the PR body.

## Manual QA you must perform
Use `npm run dev:vue`, `npm run dev:react`, and `npm run dev:site`. Exercise every BlockType, both toolbar modes (at least floating + fixed), dark mode, RTL where relevant, paste/DnD, tables, undo/redo. Record PASS/FAIL.

## Definition of Done
- [ ] Audit matrix completed (all blocks, both adapters)
- [ ] All P0/P1 issues fixed with Vue↔React parity
- [ ] Docs + README + site feature lists match real BlockType set
- [ ] `npm run build && npm run typecheck && npm test && npm run lint` green
- [ ] Meaningful new core tests for previously untested critical paths (table and/or clipboard at minimum)
- [ ] Valid `.changeset/*.md` written
- [ ] release-check skill satisfied
- [ ] Clear PR summary + test plan for human review
- [ ] Stopped before publish; ask human before Version Packages merge

Start with Phase 0. Report baseline command results, then proceed.
```

---

## Optional shorter prompt (if token budget is tight)

```text
Follow docs/stable-release-agent-brief.md end-to-end for xproeditor.
Sync origin/main → build/typecheck/test/lint baseline → full Vue+React block/UX audit → fix P0/P1 with adapter parity → sync docs/marketing → add core tests (table/clipboard) → changeset → release-check.
Skills: adapter-parity, theming, changeset, release-check, new-block-type.
No publish without human OK. Start Phase 0 now.
```

---

## How you (human) should use this

1. Open a **new agent chat** in this repo.
2. Paste the **Copy-paste prompt** (full or short).
3. Let the agent finish Phase 0–1 before approving large refactors.
4. Review the audit matrix; tell it which P2 items are in/out of scope.
5. When green + changeset ready: open/merge feature PR, then carefully review the bot’s **Version Packages** PR before merge (that merge publishes to npm).
