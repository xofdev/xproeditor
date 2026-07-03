# Releasing

This repo uses [Changesets](https://github.com/changesets/changesets) for
independent versioning of `@xproeditor/core`, `@xproeditor/vue`, and
`@xproeditor/react`.

## Day to day

When a PR changes the behavior of a published package, add a changeset:

```bash
npx changeset
```

Pick the affected package(s), a semver bump (patch/minor/major), and write a
one-line summary — this becomes the changelog entry. Commit the generated
file under `.changeset/`.

## Cutting a release

```bash
npm run version-packages   # bumps versions + writes CHANGELOG.md per package
npm run build
npm run release             # publishes changed packages to npm
```

`npm run release` runs `changeset publish`, which only publishes packages
whose version was actually bumped. Each package's `package.json` has
`publishConfig.access: "public"` set since they're scoped (`@xproeditor/*`).

## First-time setup

You'll need publish access to the `@xproeditor` npm org and to be logged in
(`npm login`) before running `npm run release`.
