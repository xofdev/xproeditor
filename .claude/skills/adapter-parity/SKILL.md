---
name: adapter-parity
description: Use whenever you change editor *behavior* (keyboard shortcuts, markdown shortcuts, selection handling, table operations, drag/drop, paste handling) in either the Vue or React adapter, or when auditing whether the two adapters have drifted apart. Ports the change to the sibling adapter and verifies the two state machines still mirror each other function-for-function.
---

# Keeping the Vue and React adapters in sync

xproeditor intentionally keeps two state machines — `BlockEditor.vue`'s
`<script setup>` (Vue) and `useBlockEditor` in
`packages/react/src/hooks/useBlockEditor.ts` (React) — structurally
near-identical: same function names, same call sites into
`@xproeditor/core`. See [docs/architecture.md](../../docs/architecture.md).
This lets a behavior change be ported by shape-matching instead of
re-deriving the logic from scratch.

## When you change one adapter

1. Identify the exact function(s) touched in
   `packages/vue/src/components/BlockEditor.vue` or
   `packages/react/src/hooks/useBlockEditor.ts`.
2. Find the same-named function/handler in the sibling file. If none exists
   yet, that's the drift to fix, not a sign the other adapter doesn't need it.
3. Port the change preserving the same control flow and the same
   `@xproeditor/core` calls (same function name, same argument shape) — do
   not "improve" the logic differently per framework; behavioral differences
   between adapters are bugs users will file.
4. If the change touches the toolbar surfaces, update both pairs:
   - `EditorFormatToolbar.vue` ↔ `FormatToolbar.tsx`
   - `EditorBubbleToolbar.vue` ↔ `BubbleToolbar.tsx`
   - `EditorSlashMenu.vue` ↔ `SlashMenu.tsx`
5. If the change touches read-only rendering, update
   `DocRenderer.vue` ↔ `DocRenderer.tsx`.

## Auditing for existing drift

When asked to check whether the adapters have drifted:

1. List the exported/internal function names in `BlockEditor.vue`'s
   `<script setup>` and in `useBlockEditor.ts`.
2. Diff the two name sets — anything present in one but not the other is a
   parity gap. Flag it; don't assume it's intentional.
3. For functions present in both, skim for behavioral divergence (different
   keyboard shortcut, different core function called, different edge-case
   handling) rather than just name matching.
4. Report gaps with file:line references rather than silently fixing large
   amounts of behavior — parity fixes can be subtle and are worth a
   confirmation before landing.

## Verifying

- `npm run dev:vue` and `npm run dev:react` (ports 5173/5174 per
  `.claude/launch.json`) — exercise the same interaction in both demos.
- `npm run typecheck && npm test` from the repo root.
- Public API shape should stay symmetric between packages "where the
  framework allows it" (CONTRIBUTING.md) — same prop/option names, same
  `toolbar` prop semantics on `<ProEditor>`.
