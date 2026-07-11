---
name: changeset
description: Use before finishing any PR that changes the behavior of a published package (@xproeditor/core, @xproeditor/vue, or @xproeditor/react) — decide whether a changeset is needed, which packages/semver bump it should declare, and write it correctly. Also use when asked to prepare a release.
---

# Writing a changeset for xproeditor

This repo publishes `@xproeditor/core`, `@xproeditor/vue`, and
`@xproeditor/react` independently via [Changesets](https://github.com/changesets/changesets),
fully automated through `.github/workflows/release.yml`. See
[docs/releasing.md](../../docs/releasing.md) for the full pipeline.

## Decide if a changeset is needed

Needed when the change affects published package *behavior* or public API:
new block type, new prop/option, bug fix in editor behavior, new exported
core function, styling change visible in `dist/style.css`, etc.

Not needed for: internal refactors with no observable behavior change,
`examples/*` or `site/` changes, docs, CI/tooling, test-only changes.

## Which packages to bump

Because `@xproeditor/vue` and `@xproeditor/react` both depend on
`@xproeditor/core`'s compiled `dist/`:

- A change inside `packages/core/src` → bump `@xproeditor/core`, and bump
  whichever adapter(s) actually consume the changed core surface (if the
  change is purely internal to core with no adapter-visible effect, core
  alone is enough).
- A change inside `packages/vue/src` only → bump `@xproeditor/vue` only.
- A change inside `packages/react/src` only → bump `@xproeditor/react` only.
- A behavior change ported to both adapters (see the `adapter-parity`
  skill) → bump `@xproeditor/vue` and `@xproeditor/react` together (and
  `@xproeditor/core` too if the core layer changed).

## Semver bump

- `patch` — bug fix, no API change.
- `minor` — new backward-compatible feature (new block type, new prop, new
  exported function).
- `major` — breaking change to a public export, prop, or persisted
  `BlocksContent`/`Block` shape. Flag this explicitly to the user before
  writing it — a major bump on any of these packages is a deliberate,
  user-facing decision, not a default.

## Writing it

Run `npx changeset`, select the affected package(s) and bump, and write a
one-line, user-facing summary (it becomes the changelog entry verbatim —
write it as "what changed for the consumer," not as an implementation note).
Commit the generated `.changeset/*.md` file as part of the PR.

## What happens next (informational — do not act on this yourself)

On merge to `main`, CI either opens/updates a "Version Packages" PR (bumping
versions + writing `CHANGELOG.md`) or, once that PR is merged, publishes to
npm automatically. Never hand-bump `package.json` versions or hand-edit
`CHANGELOG.md` — that's the bot's job.
