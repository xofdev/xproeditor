---
'@xproeditor/vue': patch
'@xproeditor/react': patch
---

React `onChange` now receives a fresh array on every change, so `onChange={setBlocks}` re-renders as expected. Vue `ProEditor`/`BlockEditor` emit `update:modelValue` (so `v-model` works), keep a plain non-reactive `model-value` array editable, and expose `canUndo`/`canRedo` on `ProEditor`.
