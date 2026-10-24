---
'@xproeditor/vue': patch
'@xproeditor/react': patch
---

Fix text selection inside code blocks, table cells and other fields of non-text blocks: dragging across lines no longer turns into a block selection that steals focus, and a drag inside one table cell stays a normal text selection. Pasting into a table cell no longer inserts raw HTML, and header cells are start-aligned. Code-block edits from Tab/Enter are applied synchronously, so fast typing right after them is never lost.
