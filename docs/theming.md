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

A handful of design tokens are exposed as CSS custom properties with sensible
defaults, used by the read-only `<DocRenderer>` and a couple of editor
surfaces. Override them on `:root` or any ancestor of the editor:

```css
:root {
  --xpe-background: #ffffff;       /* editor canvas background */
  --xpe-foreground: #1f2937;       /* body text color */
  --xpe-muted-foreground: #6b7280; /* secondary text */
  --xpe-muted: #f3f4f6;            /* subtle backgrounds (quotes, callouts) */
  --xpe-border: #e5e7eb;           /* hairline borders */
  --xpe-primary: #4f46e5;          /* links, active states, quote bar */
  --xpe-font-mono: ui-monospace, SFMono-Regular, Menlo, monospace;
}
```

For dark mode, scope an override under whatever selector your app uses to
toggle themes:

```css
.dark {
  --xpe-background: #111827;
  --xpe-foreground: #e5e7eb;
  --xpe-muted-foreground: #9ca3af;
  --xpe-muted: #1f2937;
  --xpe-border: #374151;
  --xpe-primary: #818cf8;
}
```

## Everything else

The bulk of the editor's visual design (buttons, popovers, block gutter,
table borders, syntax-highlighting palette, ...) is plain CSS scoped to
specific class names (`.ebi-*`, `.etb-*`, `.xpe-*`, ...) rather than CSS
variables, since it's internal chrome rather than something most apps need to
re-skin. If you need a different look entirely, the components are unstyled
enough at the DOM level that overriding these classes in your own stylesheet
(loaded after `style.css`) works fine — nothing uses `!important`.
