# Keyboard & Markdown shortcuts

`Mod` is `⌘` on macOS and `Ctrl` everywhere else. Both adapters behave
identically — the shortcut tables live in `@xproeditor/core`
(`BLOCK_KEYBOARD_SHORTCUTS`, `matchBlockShortcut`,
`applyInlineMarkdownShortcut`).

## Typing Markdown

At the start of an empty-ish line (the caret right after the prefix):

| Type | Becomes |
| --- | --- |
| `# ` `## ` `### ` | Heading 1 / 2 / 3 |
| `- ` `* ` `+ ` | Bulleted list |
| `1. ` `7) ` (any number) | Numbered list |
| `[] ` `[ ] ` | To-do |
| `[x] ` | Checked to-do |
| `- [ ] ` | To-do (the bullet upgrades) |
| `> ` `" ` | Quote |
| `>> ` | Toggle list |
| ```` ``` ```` | Code block |
| `---` | Divider |

Inline, when you type the closing delimiter:

| Type | Result |
| --- | --- |
| `**bold**` or `__bold__` | **bold** |
| `*italic*` or `_italic_` | *italic* |
| `` `code` `` | `code` |
| `~~strike~~` | ~~strike~~ |

Formatting stops at the closing delimiter, so the next character you type is
plain text. `snake_case` and `2*3*4` are left alone.

## Block shortcuts

| Keys | Action |
| --- | --- |
| `Mod+Alt+0` | Turn into text |
| `Mod+Alt+1` / `2` / `3` | Turn into heading 1 / 2 / 3 (again → text) |
| `Mod+Shift+7` | Numbered list |
| `Mod+Shift+8` | Bulleted list |
| `Mod+Shift+9` | To-do |
| `Mod+Shift+↑` / `↓` | Move the block (with its nested children) |
| `Mod+D` | Duplicate block |
| `Mod+Enter` | Check / uncheck a to-do, open / close a toggle |
| `Mod+K` | Add or edit a link on the selection |
| `Tab` / `Shift+Tab` | Indent / outdent |
| `Enter` on an empty list item | Outdent, then turn into text |
| `Backspace` at the start | Turn into text, outdent, then merge with the block above |

## Text formatting

| Keys | Mark |
| --- | --- |
| `Mod+B` | Bold |
| `Mod+I` | Italic |
| `Mod+U` | Underline |
| `Mod+Shift+S` | Strikethrough |
| `Mod+E` | Inline code |

## Selection & history

| Keys | Action |
| --- | --- |
| `Mod+A` | Select the block's text; press again for the whole document |
| `Shift+↑` / `↓` | Extend the selection across blocks |
| `Mod+Z` / `Mod+Shift+Z` / `Ctrl+Y` | Undo / redo (document history, even inside a field) |
| `Escape` | Clear a multi-block selection / close menus |
| `/` | Slash menu |
| `:` | Inline emoji search |
