# Releasing

`@xproeditor/core`, `@xproeditor/vue` and `@xproeditor/react` are versioned
independently with [Changesets](https://github.com/changesets/changesets) and
published **automatically** by
[`.github/workflows/release.yml`](../.github/workflows/release.yml) using
**npm trusted publishing** (OIDC). There is no npm token anywhere: GitHub
proves to npm which repository and workflow is publishing, npm issues a
short-lived credential for that one run, and every release gets a signed
[provenance](https://docs.npmjs.com/generating-provenance-statements)
attestation.

## Day to day

When a PR changes the behavior of a published package, add a changeset:

```bash
npx changeset
```

Pick the package(s), the semver bump and a one-line, user-facing summary.
Commit the generated `.changeset/*.md` with the PR.

## The automated loop

On every push to `main` (and on manual **Run workflow**), `Release`:

1. installs, builds, lints, typechecks and tests;
2. if changesets are pending → opens/updates the **"chore: version packages"**
   PR (bumped versions + `CHANGELOG.md`s);
3. if none are pending (that PR was just merged) → `npm run release`
   publishes every package whose version is not on npm yet, then creates git
   tags and GitHub releases.

So: **merge feature PRs with changesets → merge the bot's version PR when you
want to ship → packages publish themselves.**

## One-time setup (required)

Without these three settings the workflow fails exactly the way it did on
2026-10-03 (`E404`/`ENEEDAUTH` on publish, or "GitHub Actions is not
permitted to create or approve pull requests").

1. **npm — trusted publisher, for each package.** On npmjs.com open
   `@xproeditor/core` → **Settings** → **Trusted publishing** → **GitHub
   Actions** and enter:

   | Field | Value |
   | --- | --- |
   | Organization or user | `xofdev` |
   | Repository | `xproeditor` |
   | Workflow filename | `release.yml` |
   | Environment name | `npm` |

   Repeat for `@xproeditor/vue` and `@xproeditor/react`. Then, under
   **Settings → Publishing access**, choose *"Require two-factor
   authentication and disallow tokens"* — trusted publishing keeps working
   and no leaked token can ever publish.
2. **GitHub — environment.** Settings → Environments → **New environment**
   `npm`. Optionally restrict deployment branches to `main` and add required
   reviewers for a manual "approve release" gate. (GitHub creates it on the
   first run if missing, but without restrictions.)
3. **GitHub — Actions permissions.** Settings → Actions → General →
   Workflow permissions → enable **"Allow GitHub Actions to create and
   approve pull requests"** (needed for the version PR).

Delete any old `NPM_TOKEN` repository secret — it is no longer read.

## Retrying a failed release

Fix the cause, then Actions → **Release** → **Run workflow** on `main` (or
"Re-run all jobs" on the failed run). Publishing is idempotent: versions
already on npm are skipped.

## Hardening already in place

- Actions are pinned to commit SHAs (Dependabot keeps them current).
- Least-privilege `permissions`; `id-token: write` only on the release job.
- Releases run only from `xofdev/xproeditor` (never from forks), never
  cancel mid-publish, and use npm 11 (trusted publishing needs ≥ 11.5.1).
- CI runs on Node 20, 22 and 24, builds the prerendered site and dry-runs
  `npm pack` for each package.

## Manual release (emergency only)

```bash
npm run version-packages   # bump versions + CHANGELOGs
npm run build
npm run release            # needs `npm login` with publish rights + 2FA
```

Prefer fixing the workflow: a manual publish has no provenance.
