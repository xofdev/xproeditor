# Theming

## Why there's no Tailwind dependency

Both `@xproeditor/vue` and `@xproeditor/react` are *authored* with Tailwind
utility classes internally, but you never need Tailwind installed to use
them. At build time, each package runs the Tailwind CLI over its own source
(with `corePlugins.preflight` disabled, so it never resets your app's base
styles) and ships the result as a single `dist/style.css`. Import it once:

```ts
import '@xproeditor/vue/style.css'
// or
import '@xproeditor/react/style.css'
```

If your app *does* use Tailwind already, nothing conflicts — the generated
classes are just standard Tailwind utilities (`flex`, `rounded-xl`, `text-gray-600`,
...) at the default specificity.

## CSS variables

A small set of design tokens is exposed as CSS custom properties with
sensible defaults, used by the read-only `<DocRenderer>`, the slash-command
menu, media blocks, and other editor surfaces. Override them on `:root` or
any ancestor of the editor:

```css
:root {
  --xpe-background: #ffffff;         /* editor canvas background */
  --xpe-foreground: #1f2937;         /* body text color */
  --xpe-muted-foreground: #6b7280;   /* secondary text */
  --xpe-muted: #f3f4f6;              /* subtle backgrounds (quotes, callouts, media cards) */
  --xpe-border: #e5e7eb;             /* hairline borders */
  --xpe-primary: #4f46e5;            /* links, active states, quote bar */
  --xpe-primary-foreground: #ffffff; /* text on primary buttons */
  --xpe-primary-muted: #eef2ff;      /* tint behind active menu rows / drop zones */
  --xpe-surface: #ffffff;            /* elevated surfaces: popovers, menus */
  --xpe-surface-hover: #f9fafb;      /* hover rows inside menus */
  --xpe-ring: #818cf8;               /* focus/selection ring around media blocks */
  --xpe-danger: #ef4444;             /* validation errors */
  --xpe-radius: 12px;                /* corner radius of cards, menus, media */
  --xpe-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.05);
  --xpe-font-mono: ui-monospace, SFMono-Regular, Menlo, monospace;
}
```

## Dark mode (built in)

A complete dark theme ships in `style.css`. Add the `xpe-dark` class — or
`data-xpe-theme="dark"` — to any ancestor of the editor, typically alongside
your app's own dark-mode toggle:

```html
<body class="dark xpe-dark">
  <!-- editor renders dark -->
</body>
```

## Making your own theme

A theme is just a scoped set of the same variables — no build step needed:

```css
.theme-forest {
  --xpe-primary: #059669;
  --xpe-primary-muted: #ecfdf5;
  --xpe-ring: #34d399;
  --xpe-radius: 6px;
}
```

Any variable you don't set falls back to the default (or to `.xpe-dark`'s
value if that scope is also active).

## Everything else

The bulk of the editor's visual design (buttons, popovers, block gutter,
table borders, syntax-highlighting palette, ...) is plain CSS scoped to
specific class names (`.ebi-*`, `.etb-*`, `.xpe-*`, ...) rather than CSS
variables, since it's internal chrome rather than something most apps need to
re-skin. If you need a different look entirely, the components are unstyled
enough at the DOM level that overriding these classes in your own stylesheet
(loaded after `style.css`) works fine — nothing uses `!important`.
