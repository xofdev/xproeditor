---
"@xproeditor/core": minor
"@xproeditor/react": minor
"@xproeditor/vue": minor
---

A document API on the editor ref (`ProEditor` and `BlockEditor` in both adapters): `getBlocks`, `setBlocks` (with `history: 'reset'` for loading another document), `insertBlocks`, `updateBlock`, `removeBlocks`, `focus`, `getMarkdown`, `getHTML`, `getText` and `getStats` (words, characters, reading time — Unicode-aware). New options: `placeholder`, `spellCheck` (React) / `spellcheck` (Vue) — browser spellcheck is now on by default — and `autofocus`. Core exports the `EditorDocumentApi` type and `getDocumentStats`.
