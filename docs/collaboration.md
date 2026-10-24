# Real-time collaboration

Several people can edit the same document at once. Edits sync **block by
block**, each editor shows where the others are, and every client converges
to the same `Block[]` — with no CRDT library and no vendor service.

## Quick start

**React**

```tsx
import { ProEditor, createCollabSession, createWebSocketTransport } from '@xproeditor/react'

const session = createCollabSession({
  transport: createWebSocketTransport(`wss://relay.example.com/${docId}`),
  blocks: savedBlocks, // the same saved document on every client
  user: { id: currentUser.id, name: currentUser.name },
})

export function Doc() {
  useEffect(() => () => session.destroy(), [])
  return <ProEditor defaultValue={savedBlocks} collaboration={session} onChange={save} />
}
```

**Vue**

```vue
<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { ProEditor, createCollabSession, createWebSocketTransport } from '@xproeditor/vue'

const blocks = ref(savedBlocks)
const session = createCollabSession({
  transport: createWebSocketTransport(`wss://relay.example.com/${docId}`),
  blocks: savedBlocks,
  user: { name: 'Sara' },
})
onBeforeUnmount(() => session.destroy())
</script>

<template>
  <ProEditor v-model="blocks" :collaboration="session" @change="save(blocks)" />
</template>
```

With `collaboration` set, the editor:

- shows the session's document (the room's latest state),
- broadcasts local edits (coalesced, ~30 ms),
- applies remote edits without moving your caret or re-rendering untouched blocks,
- reports which block you are in and draws a coloured bar + name beside the
  block each collaborator is editing,
- keeps undo per user: `⌘/Ctrl+Z` reverts only your own changes.

## Transports

| Transport | Use it for |
| --- | --- |
| `createBroadcastChannelTransport(room)` | Tabs/windows of one browser. No server — great for demos and multi-window apps. |
| `createWebSocketTransport(url, options?)` | Production. JSON over any relay that forwards each message to the other clients in the room. Buffers edits while offline, reconnects with exponential backoff and resyncs. |
| `createMemoryCollabHub({ latency? })` | Several editors on one page, tests. |
| Your own | Implement `CollabTransport` (`send`, `subscribe`, optional `onStatus`, `close`) over Liveblocks, PartyKit, Supabase Realtime, Pusher, WebRTC… |

### A 20-line relay server (Node)

```js
// npm i ws — rooms are the URL path: wss://host/<doc-id>
import { WebSocketServer } from 'ws'

const wss = new WebSocketServer({ port: 8787, maxPayload: 5 * 1024 * 1024 })
const rooms = new Map()

wss.on('connection', (socket, req) => {
  // Authenticate here (cookie / token in req) before joining a room.
  const room = req.url ?? '/'
  if (!rooms.has(room)) rooms.set(room, new Set())
  const peers = rooms.get(room)
  peers.add(socket)

  socket.on('message', (data) => {
    for (const peer of peers) if (peer !== socket && peer.readyState === 1) peer.send(data.toString())
  })
  socket.on('close', () => {
    peers.delete(socket)
    if (peers.size === 0) rooms.delete(room)
  })
})
```

The relay never needs to understand the messages. Persist the document from
any client's `onChange`/`@change` (debounced), or have the server keep its own
`createCollabSession` in the room as an always-on peer that saves the merged
document.

## How merging works

The document is a set of blocks keyed by their stable `id`. Each block carries
two last-writer-wins registers stamped with a Lamport clock:

- its **value** — `type`, `content`, `props`, or a tombstone when deleted;
- its **position** — a fractional index key; blocks are ordered by `(key, id)`.

Peers exchange only the blocks that changed. That gives you:

- concurrent edits to **different** blocks always merge;
- inserts and moves never collide, and every peer ends with the same order;
- messages can arrive late or out of order — the result is the same;
- two people typing in the **same** block at the same moment resolve to the
  later edit (Notion-like block granularity). For character-level merging
  inside a single block, bind a CRDT such as Yjs at the transport level.

When a client joins, peers send it the room's state. A client that has not
edited yet adopts the room's document instead of merging its own seed, so
loading a default document never duplicates content. For clean merges after
offline edits, start every client from the **same saved document** (same
block ids).

## Security

Treat every peer as untrusted. Incoming entries are validated and every block
goes through `sanitizeBlock` — the same pipeline as pasted HTML/JSON — so a
malicious client cannot inject `javascript:` links, unsafe media URLs or style
attributes. Names and colours in presence messages are length- and
format-checked. Authenticate and authorise users in your relay; the session
does not.

## API

```ts
createCollabSession(options: {
  transport: CollabTransport
  blocks?: Block[]
  user?: { id?: string; name?: string; color?: string }
  heartbeat?: number // presence heartbeat ms (default 10 000, 0 = off)
}): CollabSession

interface CollabSession {
  readonly clientId: string
  readonly user: CollabUser
  getBlocks(): Block[]
  update(blocks: readonly Block[]): void      // the editor calls this for you
  setPresence(blockId: string | null): void    // the editor calls this for you
  getPeers(): CollabPeer[]
  onChange(listener: (blocks: Block[]) => void): () => void
  onPeers(listener: (peers: CollabPeer[]) => void): () => void
  destroy(): void
}
```

Build your own avatar list with `session.onPeers(...)` — each peer has
`user.name`, `user.color` and the `blockId` they are in.
