---
'@xproeditor/core': patch
'@xproeditor/vue': patch
'@xproeditor/react': patch
---

Columns: blocks no longer fall out of their column, and moving around a group follows the layout.

- An image, video, table or any block added from the slash menu in a column stays in it, and so does a block whose type changes (slash menu, markdown shortcuts like `# `, code fence, `---`, Turn into, the bubble toolbar, keyboard shortcuts): every path now keeps the block's indent, direction and column (`placementProps`).
- ArrowUp/ArrowDown move within a column and leave the group at its edges; from above, ArrowDown enters the first column instead of selecting the group's header (`columnArrowTarget`).
- An empty column shows "Column N: type, or press / for any block" (English and Persian), so a new group never looks like a gap.
- Clicking below a document that ends with a group starts a new paragraph under the group instead of reusing the last column's placeholder.
