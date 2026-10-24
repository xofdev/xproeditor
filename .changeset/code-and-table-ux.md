---
'@xproeditor/core': minor
'@xproeditor/vue': minor
'@xproeditor/react': minor
---

Code blocks: live syntax highlighting while you type, optional line numbers, a file name in the header, smart Enter (keeps indentation, indents after brackets), `Mod+/` to toggle comments, and language detection when pasting into an empty block — shared core logic in `CODE_LANGUAGES`, `indentCode`, `newlineInCode`, `toggleCodeComment` and `splitHighlightedLines`. Tables: row and column handles (insert, move, duplicate, sort, align, clear, delete), drag-to-resize columns (`colWidths`), a header column (`hasHeaderColumn`), spreadsheet paste from Excel/Google Sheets, `Tab` in the last cell adds a row, and a cleaner floating toolbar instead of always-visible controls. `DocRenderer` and HTML export honour column widths, header columns, code file names and line numbers. Syntax colours are themeable through `--xpe-syntax-*` variables.
