# Releasing

This repo uses [Changesets](https://github.com/changesets/changesets) for
independent versioning of `@xproeditor/core`, `@xproeditor/vue`, and
`@xproeditor/react`, and publishes **automatically** via
[`.github/workflows/release.yml`](../.github/workflows/release.yml) — you
should rarely need to publish by hand.

## Day to day

When a PR changes the behavior of a published package, add a changeset:

```bash
npx changeset
```

Pick the affected package(s), a semver bump (patch/minor/major), and write a
one-line summary — this becomes the changelog entry. Commit the generated
file under `.changeset/` and include it in your PR.

## How the automated release works

On every push to `main`, the `Release` workflow:

1. Builds and tests the repo.
2. If there are changeset files pending, it opens (or updates) a **"Version
   Packages"** pull request — this PR bumps versions and writes each
   package's `CHANGELOG.md`, generated automatically by
   [`changesets/action`](https://github.com/changesets/action). You don't
   write this PR yourself; just review and merge it.
3. Once that PR is merged, the next run of the workflow finds no pending
   changesets and instead runs `npm run release`, which builds and
   publishes every package whose version changed to npm.

So the loop is: **merge a feature PR with a changeset → merge the bot's
"Version Packages" PR whenever you're ready to ship → packages publish
themselves.**

## Manual release (fallback)

If you ever need to publish outside the automated flow:

```bash
npm run version-packages   # bumps versions + writes CHANGELOG.md per package
npm run build
npm run release             # publishes changed packages to npm
```

`npm run release` runs `changeset publish`, which only publishes packages
whose version was actually bumped. Each package's `package.json` has
`publishConfig.access: "public"` set since they're scoped (`@xproeditor/*`).

## First-time setup

The automated workflow needs one repository secret:

- **`NPM_TOKEN`** — an npm [automation access
  token](https://docs.npmjs.com/creating-and-viewing-access-tokens) with
  publish rights to the `@xproeditor` org. Add it under repo **Settings →
  Secrets and variables → Actions**.

No other setup is needed — `GITHUB_TOKEN` is provided automatically by
Actions and is used to open/update the version PR.

For manual releases, you'll need publish access to the `@xproeditor` npm org
and to be logged in (`npm login`) locally instead.
