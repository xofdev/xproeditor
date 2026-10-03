---
"@xproeditor/core": minor
"@xproeditor/react": patch
"@xproeditor/vue": patch
---

Fix pasting into the middle of a block: the text after the caret now stays after the pasted content (`X|Y` + `a⏎b` gives `Xa` / `bY`, not `XaY` / `b`), pasting an image or table into an empty line no longer leaves a stray empty paragraph, and a failed `upload()` for a pasted or dropped file is reported (`onUploadError` in React, `@upload-error` in Vue, plus an inline message in media blocks) instead of being an unhandled rejection. Core exports the shared `pasteBlocksIntoTextBlock` and `plainTextToBlocks` helpers.
