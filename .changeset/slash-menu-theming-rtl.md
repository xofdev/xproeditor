---
'@xproeditor/vue': minor
'@xproeditor/react': minor
---

Slash-command menu now measures itself and positions precisely at the caret — flipping above when near the viewport bottom, clamping to the viewport edges, staying aligned in RTL, and showing a "No results" state instead of abruptly closing. Theming: a richer minimal token set (`--xpe-surface`, `--xpe-surface-hover`, `--xpe-primary-muted`, `--xpe-primary-foreground`, `--xpe-ring`, `--xpe-danger`, `--xpe-radius`, `--xpe-shadow`) plus a built-in dark theme via the `xpe-dark` class or `data-xpe-theme="dark"`; the slash menu, media blocks, and all editor chrome (toolbars, popovers, dropdown menus, inputs, tabs, table controls, gutter, text blocks) are fully token-driven, so the built-in dark theme and custom themes restyle the entire editor. Remaining physical CSS (left/right) converted to logical properties for correct RTL layout.
