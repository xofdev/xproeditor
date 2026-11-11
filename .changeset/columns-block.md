---
'@xproeditor/core': minor
'@xproeditor/vue': minor
'@xproeditor/react': minor
---

Add a columns block: 2 or 3 side-by-side columns of any blocks.

- `/2 columns` and `/3 columns` in the slash menu; the group's bar sets the count, width presets, gap, vertical alignment and stacking on small screens, or removes the columns and keeps their content.
- Enter keeps the column; Backspace and Delete never merge across a column edge; paste, drag and drop and `insertBlocks` fit blocks to the column they land in; the block menu moves a block to another column.
- `DocRenderer` renders a grid that stacks on narrow containers; HTML export renders a CSS grid; Markdown and plain text flatten in reading order.
- Core: the flat-model helpers in `columns.ts` (`createColumnsGroup`, `normalizeColumns`, `fitInsertedBlocks`, `setColumnCount`, `moveBlockToColumn`, `unwrapColumns`, `wrapInColumns`, …), column-aware subtrees, collapsed toggles and list numbering, and dictionary strings in English and Persian.
