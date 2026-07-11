---
name: theming
description: Use when styling anything inside packages/vue or packages/react — new components, visual tweaks, dark-mode support, or CSS variable additions. Keeps the zero-Tailwind-dependency build intact and decides whether a value belongs in a CSS variable (user-themeable) or plain scoped CSS (internal chrome).
---

# Styling inside the adapters

Full background: [docs/theming.md](../../docs/theming.md).

## The constraint

`@xproeditor/vue` and `@xproeditor/react` are authored with Tailwind utility
classes, but consumers never install Tailwind. Each package runs the
Tailwind CLI over its own `src` at build time (`corePlugins.preflight`
disabled) and ships one `dist/style.css`. This means:

- Only use Tailwind utility classes that exist in each package's own
  `tailwind.config.js` content globs — classes assembled dynamically at
  runtime via string concatenation (`` `text-${color}-500` ``) won't be
  picked up by the Tailwind CLI's static scan and will silently not ship.
  Use the full class name literally, or a lookup table of full class names.
- Don't add a runtime dependency on Tailwind, PostCSS plugins, or any CSS
  framework that isn't already bundled into `dist/style.css` — it would
  leak a peer dependency onto every consumer.
- Global element selectors are off-limits (`corePlugins.preflight: false`
  is deliberate) — never reset margins/box-sizing/etc. globally; scope
  everything to `.ebi-*` / `.etb-*` / `.xpe-*`-prefixed classes or the
  component's own root class.

## CSS variable vs. plain scoped CSS

Ask: would a consuming app plausibly want to override this without
forking the stylesheet?

- **Yes → CSS variable** on `:root`, following the existing
  `--xpe-*` naming (`--xpe-background`, `--xpe-foreground`,
  `--xpe-muted-foreground`, `--xpe-muted`, `--xpe-border`, `--xpe-primary`,
  `--xpe-font-mono`). Define both packages' `styles/theme.css` in lockstep —
  a variable added to one adapter should exist in the other too, since apps
  often use both.
- **No (internal chrome: toolbar/popover/table-gutter/syntax palette/etc.)
  → plain scoped CSS** with an `.ebi-*`/`.etb-*`/`.xpe-*` class, no
  `!important` (consumers rely on being able to override these by loading
  their own stylesheet after `style.css`).

## Dark mode

Dark mode is just a second set of `--xpe-*` values scoped under whatever
selector the consuming app uses (commonly `.dark`) — don't build a
dark-mode switch into the package itself; document the override in
`docs/theming.md` if you add new variables.

## Verifying

- Rebuild the affected package(s) so `dist/style.css` regenerates:
  `npm run build -w @xproeditor/vue` / `-w @xproeditor/react`.
- Check both demos (`npm run dev:vue`, `npm run dev:react`) since Tailwind's
  static class scanning can behave differently per package's `tailwind.config.js`
  content globs — a class that resolves in one adapter's demo can be missing
  from the other's `dist/style.css` if its config wasn't updated too.
- If you added/changed a `--xpe-*` variable, update
  [docs/theming.md](../../docs/theming.md)'s reference table for both light
  and dark examples.
