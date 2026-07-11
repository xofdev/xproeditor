---
'@xproeditor/core': minor
'@xproeditor/vue': minor
'@xproeditor/react': minor
---

Add a right-click context menu on blocks (Notion-style): Duplicate, Delete, and — for callout blocks — a Color flyout with the existing background presets, all in a clean two-level menu with no extra clutter.

Add slim, theme-token-driven custom scrollbars across every scrollable surface (popovers, dropdowns, the slash/emoji menus, tables, code blocks, the editor root, and the doc renderer) instead of the browser default — add the `.xpe-scroll` class to any other scrollable container you build to match.

Soften corners across the whole popover/menu/button/input/callout/table/code family to scale off `--xpe-radius` instead of hardcoded pixel values, so a single token change now reshapes the entire editor consistently.

Fix: the text/highlight color popover in the floating bubble toolbar could never actually be used — clicking a swatch immediately closed the panel. The panel's "stay open" effect compared the toolbar's position by object reference, and a same-range `selectionchange` event (fired by clicking inside the toolbar itself) always produces a fresh position object, so the panel closed itself before a color could register. Also fixed a malformed Tailwind class that left the "active color" checkmark badge invisible, and replaced a few remaining hardcoded indigo accents with theme tokens.
