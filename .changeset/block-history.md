---
'@xproeditor/core': minor
'@xproeditor/vue': patch
'@xproeditor/react': patch
---

Undo history now stores only the blocks each step changed (new `createBlockHistory` in core) instead of a full-document snapshot per step — far less memory on long documents, untouched rows no longer re-render on undo/redo, and undo never reverts a collaborator's edits.
