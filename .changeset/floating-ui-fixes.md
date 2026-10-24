---
'@xproeditor/core': minor
'@xproeditor/vue': patch
'@xproeditor/react': patch
---

Ask AI opens next to what you're working on: anchored to the caret, the selected text or the focused block (never the window corner when opened from the toolbar or block menu), measured instead of assuming a fixed size, flipped above when there's no room below, RTL-aware, scrollable when tall, and it follows its block on scroll. The placement logic is exported from core as `placeFloating` and `resolveEditorAnchor`. Toggle chevrons now rotate smoothly (one `rotate()` per state, 220 ms, reduced-motion aware) in the editor and `DocRenderer`.
