---
"@xproeditor/react": patch
"@xproeditor/vue": patch
---

Faster and lighter. Typing in a long document no longer re-renders every block (React rows are memoised; multi-block highlight is computed once per render in both adapters), `DocRenderer` loads highlight.js on demand as a separate chunk instead of eagerly, and the Vue build no longer inlines highlight.js and the icon set (its ESM bundle drops from ~666 KB to ~360 KB, and apps can now dedupe and tree-shake those dependencies).
