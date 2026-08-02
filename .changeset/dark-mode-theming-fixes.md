---
"@xproeditor/core": patch
"@xproeditor/vue": patch
"@xproeditor/react": patch
---

Fix dark mode across the editor. Table borders now follow the `--xpe-border` token instead of a hardcoded light grey baked into an inline style, table header backgrounds and table control hover tints now render at all (they were written with Tailwind opacity modifiers on `var()` colours, which silently produce no CSS), and the browser's default button chrome no longer shows through as light-grey chips on editor controls — most visibly on every row of the slash menu. Adds a `--xpe-danger-muted` token for destructive hover states.
