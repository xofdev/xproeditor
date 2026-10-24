---
'@xproeditor/core': minor
'@xproeditor/vue': minor
'@xproeditor/react': minor
---

Real-time collaboration: pass a session from `createCollabSession` to the new `collaboration` prop and edits sync block by block with live presence markers. Ships with `createBroadcastChannelTransport` (no server), `createWebSocketTransport` (any relay, reconnects and resyncs) and `createMemoryCollabHub`; remote messages are sanitized like pasted content.
