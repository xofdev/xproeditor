---
"@xproeditor/core": minor
"@xproeditor/react": minor
"@xproeditor/vue": minor
---

Two new blocks. **Embed** (`/embed`) shows allow-listed iframes for YouTube, Vimeo, Loom, Figma, CodePen, CodeSandbox, Spotify, SoundCloud and Google Maps — paste a link or an `<iframe>` snippet; the frame source is always re-derived from the URL so stored documents can't point it anywhere else. **Table of contents** (`/toc`) lists the document's headings live and links to them in the editor and in `DocRenderer`. Core exports `EMBED_PROVIDERS`, `resolveEmbed`, `extractEmbedSource`, `embedFrameHeight` and `BLOCK_TYPES`; `DocHeading` gains `blockId`. Bookmark, embed and table-of-contents slash items now insert a new block instead of converting a line that already has text.
