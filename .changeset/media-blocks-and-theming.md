---
'@xproeditor/core': minor
'@xproeditor/vue': minor
'@xproeditor/react': minor
---

Add `audio` and `file` block types with upload / library / URL insertion, per-file metadata (name, size, MIME), download card UI, and read-only rendering in `DocRenderer`. Media import now works out of the box without an `upload` prop (object-URL fallback), supports pasting files from the clipboard, and dropping OS files directly onto the editor at a precise position. Image blocks gain a paste-URL tab. Core exports new media helpers: `blockTypeForFile`, `formatFileSize`, `mediaPropsFromFile`, `fileToObjectUrl`, `acceptForBlockType`.
