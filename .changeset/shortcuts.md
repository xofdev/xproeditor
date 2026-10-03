---
"@xproeditor/core": minor
"@xproeditor/react": minor
"@xproeditor/vue": minor
---

Markdown and keyboard shortcuts. Type `**bold**`, `*italic*` / `_italic_`, `` `code` `` or `~~strike~~` and the formatting is applied as you close it; block prefixes now include `[x] ` (checked to-do), any `N. ` / `N) `, `+ `, `" ` (quote) and `>> ` (toggle), and `[ ] ` turns a bullet into a to-do. New block shortcuts: `Mod+Alt+0…3` (text / headings), `Mod+Shift+7/8/9` (numbered / bulleted / to-do), `Mod+Shift+↑/↓` (move block with its children), `Mod+D` (duplicate), `Mod+Enter` (check a to-do / open a toggle) and `Mod+K` (link). Tooltips show `⌘` on macOS. Core exports `matchBlockShortcut`, `applyInlineMarkdownShortcut`, `resolveBlockKeyboardShortcut`, `moveBlockSubtree` and `BLOCK_KEYBOARD_SHORTCUTS`.
