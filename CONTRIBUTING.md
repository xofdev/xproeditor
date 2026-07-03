# Contributing

## Setup

```bash
npm install
npm run build
```

This builds `@xproeditor/core` first, then `@xproeditor/vue` and
`@xproeditor/react`, since both adapters depend on the core package's
`dist/` output.

## Working on an adapter

```bash
npm run dev:vue     # Vite dev server for examples/vue-demo
npm run dev:react   # Vite dev server for examples/react-demo
```

Both demo apps import from the workspace packages directly, so changes to
`packages/vue/src` or `packages/react/src` show up on save. If you change
`packages/core/src`, rebuild it once (`npm run build -w @xproeditor/core`)
before the adapters pick up the change (core is precompiled, not source
mapped into the demos).

## Checks

```bash
npm run lint
npm run typecheck
npm test
```

## Adding a feature to both adapters

Editor *behavior* (keyboard shortcuts, markdown shortcuts, selection
handling, table operations, ...) lives in `@xproeditor/core` plus each
adapter's state machine (`BlockEditor.vue`'s `<script setup>` in Vue,
`useBlockEditor` in React). These two state machines are written to mirror
each other function-for-function — when you change one, make the equivalent
change in the other so behavior doesn't drift. See
[docs/architecture.md](docs/architecture.md).

## Changesets

If your change affects a published package's behavior, add a changeset
(`npx changeset`) describing it — see [docs/releasing.md](docs/releasing.md).

## Code style

- No semicolons, single quotes (Prettier config at the repo root).
- Prefer editing existing files/patterns over introducing new ones.
- Keep the Vue and React adapters' public APIs symmetric where the framework
  allows it.
