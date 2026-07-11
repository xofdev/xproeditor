---
name: release-check
description: Use before merging a PR into main, before merging the bot-generated "Version Packages" PR, or when explicitly asked to prepare/verify a release of xproeditor's packages. Runs the same gates CI runs plus the repo-specific checks CI can't (adapter parity, changeset correctness) so nothing broken reaches npm.
---

# Pre-release / pre-merge checklist

xproeditor auto-publishes on merge to `main` once a "Version Packages" PR is
merged (see [docs/releasing.md](../../docs/releasing.md)). Because publishing
is automatic, catch problems *before* merge — there's no manual publish gate
after.

## Build order matters

`@xproeditor/vue` and `@xproeditor/react` import `@xproeditor/core`'s
compiled `dist/`, not its source. Always:

```bash
npm run build      # builds core, then vue, then react, in that order
npm run typecheck
npm test
npm run lint
```

Running `typecheck`/`test` without building core first can pass locally on
stale `dist/` output and still fail in CI — don't skip the build step even
for a "small" change.

## Repo-specific checks CI doesn't fully cover

1. **Changeset correctness** — every PR that changes published behavior has
   a `.changeset/*.md` file naming the right package(s) and a semver bump
   that matches the change (see the `changeset` skill). A missing changeset
   means the fix ships silently with no changelog entry on the next release.
2. **Adapter parity** — if the PR touched `BlockEditor.vue` or
   `useBlockEditor.ts`, confirm the sibling adapter got the equivalent change
   (see the `adapter-parity` skill). CI's typecheck/test/lint will not catch
   a Vue-only fix that should also apply to React.
3. **Demo apps still work** — `npm run dev:vue` / `npm run dev:react` /
   `npm run dev:site` and manually exercise the changed behavior; these
   import the workspace packages directly and are the fastest way to catch a
   broken build before it's live.

## Reviewing the bot's "Version Packages" PR

Before merging it:

- Confirm the version bumps match what you'd expect from the changesets
  that went in (no unexpected `major`).
- Skim the generated `CHANGELOG.md` entries for clarity — they're copied
  verbatim from changeset summaries, so a vague summary written earlier
  becomes a vague changelog entry now; fix it in the changeset source if
  still possible, otherwise flag it.
- Merging this PR triggers the actual `npm publish` on the next workflow
  run — treat the merge itself as the release action and confirm with the
  user first if there's any doubt about timing.

## First-time / infra checks (rarely needed)

If publishing fails, check the `NPM_TOKEN` repo secret (Settings → Secrets
and variables → Actions) has publish rights to the `@xproeditor` npm org
before assuming a code problem.
