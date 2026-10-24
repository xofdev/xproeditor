import { generateBlockId } from './ops'
import { sanitizeBlock } from './sanitize'
import type { Block } from './types'

/**
 * Real-time collaboration for the block document — transport-agnostic and
 * dependency-free.
 *
 * Model: the document is a set of blocks keyed by their (stable) id. Each
 * block has two last-writer-wins registers — its value (type/content/props,
 * or a tombstone when deleted) and its position (a fractional index key) —
 * stamped with a Lamport clock. Peers exchange only the blocks that changed,
 * so concurrent edits to *different* blocks always merge, moves and inserts
 * never collide, and every peer converges to the same document regardless
 * of message order. Two people typing in the *same* block at the same moment
 * resolve to the later edit (block granularity — like Notion's offline
 * merge); for character-level merging inside one block, bind a CRDT such as
 * Yjs instead.
 *
 * Plug any transport: `createBroadcastChannelTransport` (tabs of one
 * browser, zero backend), `createWebSocketTransport` (any relay server that
 * forwards each message to the other clients in a room), or
 * `createMemoryCollabHub` (several editors on one page, tests).
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CollabUser {
  id: string
  name: string
  /** CSS color for this user's cursor/presence marker. */
  color: string
}

export interface CollabPeer {
  clientId: string
  user: CollabUser
  /** Block the peer is editing, if any. */
  blockId: string | null
  /** `Date.now()` of the last message from this peer. */
  lastSeen: number
}

/** Lamport timestamp: clock, then client id as tie-breaker. */
export interface CollabStamp {
  c: number
  u: string
}

export interface CollabEntry {
  id: string
  /** Block value without its id; `null` is a tombstone. */
  block: Omit<Block, 'id'> | null
  v: CollabStamp
  /** Fractional index — blocks are ordered by `(pos, id)`. */
  pos: string
  pv: CollabStamp
}

export type CollabMessage =
  | { t: 'hello'; from: string; user: CollabUser }
  | {
      t: 'state'
      from: string
      to: string
      user: CollabUser
      blockId: string | null
      since: number
      /** Sender has no local edits yet (it will adopt an older peer's document). */
      pristine: boolean
      entries: CollabEntry[]
    }
  | { t: 'ops'; from: string; entries: CollabEntry[] }
  | { t: 'presence'; from: string; user: CollabUser; blockId: string | null }
  | { t: 'bye'; from: string }

export type CollabTransportStatus = 'connecting' | 'open' | 'closed'

export interface CollabTransport {
  send(message: CollabMessage): void
  subscribe(listener: (message: CollabMessage) => void): () => void
  /** Optional: connection state changes (a reconnect triggers a resync). */
  onStatus?(listener: (status: CollabTransportStatus) => void): () => void
  close?(): void
}

export interface CollabSessionOptions {
  transport: CollabTransport
  /** Starting document. Peers that load the same saved document (same block ids) merge cleanly. */
  blocks?: Block[]
  user?: Partial<CollabUser>
  /** Presence heartbeat in ms (default 10 000; `0` disables timers, e.g. in tests). */
  heartbeat?: number
}

export interface CollabSession {
  readonly clientId: string
  readonly user: CollabUser
  /** The merged document. */
  getBlocks(): Block[]
  /** Feed the local document after a change; the block-level diff is broadcast. */
  update(blocks: readonly Block[]): void
  /** Broadcast which block this user is editing (`null` = none). */
  setPresence(blockId: string | null): void
  getPeers(): CollabPeer[]
  /** Fires with the merged document after a remote change. */
  onChange(listener: (blocks: Block[]) => void): () => void
  onPeers(listener: (peers: CollabPeer[]) => void): () => void
  /** Leave the room and close the transport. */
  destroy(): void
}

// ─── Fractional index keys ──────────────────────────────────────────────────

const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

/** Key strictly between `a` and `b` (`''` = start, `null` = end). Keys never end in `'0'`. */
function midpoint(a: string, b: string | null): string {
  if (b !== null) {
    let n = 0

    while ((a[n] ?? '0') === b[n]) {
      n++
    }

    if (n > 0) {
      return b.slice(0, n) + midpoint(a.slice(n), b.slice(n))
    }
  }

  const digitA = a ? DIGITS.indexOf(a[0]) : 0
  const digitB = b !== null ? DIGITS.indexOf(b[0]) : DIGITS.length

  if (digitB - digitA > 1) {
    return DIGITS[Math.round((digitA + digitB) / 2)]
  }

  if (b !== null && b.length > 1) {
    return b.slice(0, 1)
  }

  return DIGITS[digitA] + midpoint(a.slice(1), null)
}

/** Fractional index between two keys (`null` = open end). */
export function collabKeyBetween(a: string | null, b: string | null): string {
  if (a !== null && b !== null && a >= b) {
    throw new Error(`collabKeyBetween: ${a} >= ${b}`)
  }

  return midpoint(a ?? '', b)
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const PEER_COLORS = ['#e11d48', '#2563eb', '#16a34a', '#d97706', '#9333ea', '#0891b2', '#db2777', '#4f46e5']

/** Deterministic presence color for a user id. */
export function collabColorFor(id: string): string {
  let hash = 0

  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0
  }

  return PEER_COLORS[Math.abs(hash) % PEER_COLORS.length]
}

function gt(a: CollabStamp, b: CollabStamp): boolean {
  return a.c !== b.c ? a.c > b.c : a.u > b.u
}

function compareEntries(a: CollabEntry, b: CollabEntry): number {
  if (a.pos !== b.pos) {
    return a.pos < b.pos ? -1 : 1
  }

  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

function blockValue(block: Block): Omit<Block, 'id'> {
  return { type: block.type, content: block.content, props: block.props }
}

function isStamp(raw: unknown): raw is CollabStamp {
  const s = raw as CollabStamp
  return !!s && typeof s === 'object' && Number.isFinite(s.c) && typeof s.u === 'string'
}

/** Validate an untrusted entry from the wire (blocks are re-sanitized). */
function readEntry(raw: unknown): CollabEntry | null {
  const e = raw as CollabEntry

  if (!e || typeof e !== 'object' || typeof e.id !== 'string' || !e.id || e.id.length > 200) {
    return null
  }

  if (!isStamp(e.v) || !isStamp(e.pv) || typeof e.pos !== 'string' || e.pos.length > 1000) {
    return null
  }

  let block: CollabEntry['block'] = null

  if (e.block !== null) {
    const clean = sanitizeBlock({ ...(e.block as object), id: e.id })

    if (!clean) {
      return null
    }

    block = blockValue(clean)
  }

  return { id: e.id, block, v: { c: e.v.c, u: e.v.u }, pos: e.pos, pv: { c: e.pv.c, u: e.pv.u } }
}

/** Indices of a longest strictly increasing run of `keys` (nulls skipped). */
function longestIncreasing(keys: readonly (CollabEntry | null)[]): Set<number> {
  const tails: number[] = []
  const prev = new Array<number>(keys.length).fill(-1)

  keys.forEach((entry, i) => {
    if (!entry) {
      return
    }

    let lo = 0
    let hi = tails.length

    while (lo < hi) {
      const mid = (lo + hi) >> 1

      if (compareEntries(keys[tails[mid]] as CollabEntry, entry) < 0) {
        lo = mid + 1
      } else {
        hi = mid
      }
    }

    prev[i] = lo > 0 ? tails[lo - 1] : -1
    tails[lo] = i
  })

  const out = new Set<number>()
  let k = tails.length ? tails[tails.length - 1] : -1

  while (k !== -1) {
    out.add(k)
    k = prev[k]
  }

  return out
}

function randomId(): string {
  return generateBlockId().replace(/-/g, '').slice(0, 16)
}

/**
 * `next`, reusing `current`'s block objects wherever a block is unchanged (so
 * memoised rows skip re-rendering). Returns `null` when the two documents are
 * identical.
 */
export function reconcileBlocks(current: readonly Block[], next: readonly Block[]): Block[] | null {
  const byId = new Map(current.map(b => [b.id, b]))
  let changed = current.length !== next.length

  const out = next.map((block, i) => {
    const existing = byId.get(block.id)

    if (existing && JSON.stringify(existing) === JSON.stringify(block)) {
      if (current[i] !== existing) {
        changed = true
      }

      return existing
    }

    changed = true
    return block
  })

  return changed ? out : null
}

// ─── Session ────────────────────────────────────────────────────────────────

export function createCollabSession(options: CollabSessionOptions): CollabSession {
  const { transport } = options
  const clientId = randomId()
  const userId = options.user?.id ?? clientId
  const user: CollabUser = {
    id: userId,
    name: options.user?.name ?? 'Guest',
    color: options.user?.color ?? collabColorFor(userId),
  }
  const since = Date.now()
  const heartbeat = options.heartbeat ?? 10_000

  const entries = new Map<string, CollabEntry>()
  /** JSON of each live block's value, for cheap diffing. */
  const jsonCache = new Map<string, string>()
  const peers = new Map<string, CollabPeer>()
  const changeListeners = new Set<(blocks: Block[]) => void>()
  const peerListeners = new Set<(peers: CollabPeer[]) => void>()

  let clock = 0
  /** No local edits yet — a joiner adopts the room's document instead of merging. */
  let pristine = true
  /** Already replaced the seed with the room's document. */
  let adopted = false
  let presenceBlockId: string | null = null
  let destroyed = false

  function tick(): CollabStamp {
    clock += 1
    return { c: clock, u: clientId }
  }

  function observe(stamp: CollabStamp) {
    if (stamp.c > clock) {
      clock = stamp.c
    }
  }

  function send(message: CollabMessage) {
    if (!destroyed) {
      transport.send(message)
    }
  }

  // Seed: every peer that loads the same blocks gets identical entries.
  {
    const zero: CollabStamp = { c: 0, u: '' }
    let prevKey: string | null = null

    for (const block of options.blocks ?? []) {
      if (entries.has(block.id)) {
        continue
      }

      const pos = collabKeyBetween(prevKey, null)
      prevKey = pos
      const value = blockValue(block)
      entries.set(block.id, { id: block.id, block: value, v: zero, pos, pv: zero })
      jsonCache.set(block.id, JSON.stringify(value))
    }
  }

  function liveEntries(): CollabEntry[] {
    return [...entries.values()].filter(e => e.block !== null).sort(compareEntries)
  }

  function materialize(): Block[] {
    return liveEntries().map(e => JSON.parse(JSON.stringify({ id: e.id, ...e.block })) as Block)
  }

  function cloneEntry(e: CollabEntry): CollabEntry {
    return JSON.parse(JSON.stringify(e)) as CollabEntry
  }

  // ── Local → remote ────────────────────────────────────────────────────────

  let pending: readonly Block[] | null = null
  let flushTimer: ReturnType<typeof setTimeout> | null = null

  function flush() {
    if (flushTimer) {
      clearTimeout(flushTimer)
      flushTimer = null
    }

    if (!pending) {
      return
    }

    const blocks = pending
    pending = null
    const changed = new Map<string, CollabEntry>()
    const seen = new Set<string>()
    const unique = blocks.filter((b) => {
      if (seen.has(b.id)) {
        return false
      }

      seen.add(b.id)
      return true
    })

    for (const block of unique) {
      const value = blockValue(block)
      const json = JSON.stringify(value)
      const entry = entries.get(block.id)

      if (!entry) {
        entries.set(block.id, { id: block.id, block: JSON.parse(json), v: tick(), pos: '', pv: { c: -1, u: '' } })
        jsonCache.set(block.id, json)
        changed.set(block.id, entries.get(block.id) as CollabEntry)
      } else if (entry.block === null || jsonCache.get(block.id) !== json) {
        entry.block = JSON.parse(json)
        entry.v = tick()
        jsonCache.set(block.id, json)
        changed.set(block.id, entry)
      }
    }

    // Positions: keep the longest run already in order, re-key the rest.
    const keyed = unique.map((b) => {
      const e = entries.get(b.id) as CollabEntry
      return e.pv.c >= 0 ? e : null
    })
    const stable = longestIncreasing(keyed)
    let prevKey: string | null = null

    for (let i = 0; i < unique.length; i++) {
      const entry = entries.get(unique[i].id) as CollabEntry

      if (!stable.has(i)) {
        let nextKey: string | null = null

        for (let j = i + 1; j < unique.length; j++) {
          if (stable.has(j)) {
            nextKey = (entries.get(unique[j].id) as CollabEntry).pos
            break
          }
        }

        if (nextKey !== null && prevKey !== null && prevKey >= nextKey) {
          nextKey = null
        }

        entry.pos = collabKeyBetween(prevKey, nextKey)
        entry.pv = tick()
        changed.set(entry.id, entry)
      }

      prevKey = entry.pos
    }

    // Equal keys (rare concurrent inserts) can still sort differently than
    // the local order — re-key everything once so every peer agrees.
    const order = liveEntries().filter(e => seen.has(e.id))

    if (order.some((e, i) => e.id !== unique[i]?.id)) {
      let key: string | null = null

      for (const block of unique) {
        const entry = entries.get(block.id) as CollabEntry
        key = collabKeyBetween(key, null)
        entry.pos = key
        entry.pv = tick()
        changed.set(entry.id, entry)
      }
    }

    for (const entry of entries.values()) {
      if (entry.block !== null && !seen.has(entry.id)) {
        entry.block = null
        entry.v = tick()
        jsonCache.delete(entry.id)
        changed.set(entry.id, entry)
      }
    }

    if (changed.size > 0) {
      pristine = false
      send({ t: 'ops', from: clientId, entries: [...changed.values()].map(cloneEntry) })
    }
  }

  // ── Remote → local ────────────────────────────────────────────────────────

  function emitChange() {
    const blocks = materialize()
    changeListeners.forEach(fn => fn(blocks))
  }

  function emitPeers() {
    const list = [...peers.values()]
    peerListeners.forEach(fn => fn(list))
  }

  function merge(raw: unknown[]): boolean {
    let changed = false

    for (const item of raw) {
      const incoming = readEntry(item)

      if (!incoming) {
        continue
      }

      observe(incoming.v)
      observe(incoming.pv)
      const local = entries.get(incoming.id)

      if (!local) {
        entries.set(incoming.id, incoming)
        changed = true
      } else {
        if (gt(incoming.v, local.v)) {
          local.block = incoming.block
          local.v = incoming.v
          changed = true
        }

        if (gt(incoming.pv, local.pv)) {
          local.pos = incoming.pos
          local.pv = incoming.pv
          changed = true
        }
      }

      const entry = entries.get(incoming.id) as CollabEntry

      if (entry.block) {
        jsonCache.set(entry.id, JSON.stringify(entry.block))
      } else {
        jsonCache.delete(entry.id)
      }
    }

    return changed
  }

  function touchPeer(from: string, peerUser: CollabUser | undefined, blockId?: string | null) {
    const existing = peers.get(from)

    if (!existing && !peerUser) {
      return
    }

    const safeUser: CollabUser = peerUser
      ? {
          id: String(peerUser.id ?? from).slice(0, 100),
          name: String(peerUser.name ?? 'Guest').slice(0, 60),
          color: /^#[0-9a-f]{3,8}$/i.test(String(peerUser.color)) ? peerUser.color : collabColorFor(from),
        }
      : (existing as CollabPeer).user

    peers.set(from, {
      clientId: from,
      user: safeUser,
      blockId: blockId === undefined ? (existing?.blockId ?? null) : typeof blockId === 'string' ? blockId : null,
      lastSeen: Date.now(),
    })
    emitPeers()
  }

  function sendState(to: string) {
    send({
      t: 'state',
      from: clientId,
      to,
      user,
      blockId: presenceBlockId,
      since,
      pristine,
      entries: [...entries.values()].map(cloneEntry),
    })
  }

  function onMessage(message: CollabMessage) {
    if (destroyed || !message || typeof message !== 'object' || message.from === clientId) {
      return
    }

    switch (message.t) {
      case 'hello':
        touchPeer(message.from, message.user, null)
        sendState(message.from)
        break

      case 'state': {
        if (message.to !== clientId || !Array.isArray(message.entries)) {
          return
        }

        touchPeer(message.from, message.user, message.blockId)
        flush()

        // A fresh joiner shows the room's document instead of merging its
        // own seed into it (two different seeds would otherwise interleave).
        // The older session is the room; a pristine younger peer adopts it.
        const remoteIsOlder = message.since < since || (message.since === since && message.from < clientId)

        if (remoteIsOlder) {
          if (pristine && !adopted) {
            entries.clear()
            jsonCache.clear()
            adopted = true
          }
        } else if (message.pristine) {
          // It will adopt ours — its seed must not leak into the room.
          break
        }

        if (merge(message.entries)) {
          emitChange()
        }

        break
      }

      case 'ops':
        if (!Array.isArray(message.entries)) {
          return
        }

        flush()

        if (merge(message.entries)) {
          emitChange()
        }

        if (peers.has(message.from)) {
          touchPeer(message.from, undefined)
        }

        break

      case 'presence':
        touchPeer(message.from, message.user, message.blockId)
        break

      case 'bye':
        if (peers.delete(message.from)) {
          emitPeers()
        }

        break
    }
  }

  const unsubscribe = transport.subscribe(onMessage)
  let opened = false
  const unsubscribeStatus = transport.onStatus?.((status) => {
    if (status !== 'open') {
      return
    }

    // On reconnect, push everything we have (offline edits) and resync.
    if (opened) {
      flush()
      send({ t: 'ops', from: clientId, entries: [...entries.values()].map(cloneEntry) })
    }

    opened = true
    send({ t: 'hello', from: clientId, user })
  })

  send({ t: 'hello', from: clientId, user })

  let heartbeatTimer: ReturnType<typeof setInterval> | null = null

  if (heartbeat > 0) {
    heartbeatTimer = setInterval(() => {
      send({ t: 'presence', from: clientId, user, blockId: presenceBlockId })
      const cutoff = Date.now() - heartbeat * 3
      let removed = false

      for (const [id, peer] of peers) {
        if (peer.lastSeen < cutoff) {
          peers.delete(id)
          removed = true
        }
      }

      if (removed) {
        emitPeers()
      }
    }, heartbeat)
  }

  const onPageHide = () => send({ t: 'bye', from: clientId })

  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', onPageHide)
  }

  return {
    clientId,
    user,
    getBlocks() {
      flush()
      return materialize()
    },
    update(blocks) {
      if (destroyed) {
        return
      }

      // Coalesce bursts of keystrokes into one diff.
      pending = blocks.slice()
      flushTimer ??= setTimeout(flush, 30)
    },
    setPresence(blockId) {
      if (blockId === presenceBlockId) {
        return
      }

      presenceBlockId = blockId
      send({ t: 'presence', from: clientId, user, blockId })
    },
    getPeers: () => [...peers.values()],
    onChange(listener) {
      changeListeners.add(listener)
      return () => changeListeners.delete(listener)
    },
    onPeers(listener) {
      peerListeners.add(listener)
      return () => peerListeners.delete(listener)
    },
    destroy() {
      if (destroyed) {
        return
      }

      flush()
      send({ t: 'bye', from: clientId })
      destroyed = true
      unsubscribe()
      unsubscribeStatus?.()

      if (heartbeatTimer) {
        clearInterval(heartbeatTimer)
      }

      if (typeof window !== 'undefined') {
        window.removeEventListener('pagehide', onPageHide)
      }

      changeListeners.clear()
      peerListeners.clear()
      transport.close?.()
    },
  }
}

// ─── Transports ─────────────────────────────────────────────────────────────

/** Tabs/windows of the same browser (same origin). No server needed. */
export function createBroadcastChannelTransport(room: string): CollabTransport {
  const channel = new BroadcastChannel(`xproeditor:${room}`)

  return {
    send: message => channel.postMessage(message),
    subscribe(listener) {
      const handler = (event: MessageEvent) => listener(event.data as CollabMessage)
      channel.addEventListener('message', handler)
      return () => channel.removeEventListener('message', handler)
    },
    close: () => channel.close(),
  }
}

export interface CollabMemoryHub {
  /** A transport connected to this hub (one per editor). */
  connect(): CollabTransport
}

/** In-memory room: several editors on one page, demos and tests. */
export function createMemoryCollabHub(options: { latency?: number } = {}): CollabMemoryHub {
  const listeners = new Set<(message: CollabMessage) => void>()
  const deliver = (fn: () => void) =>
    options.latency ? setTimeout(fn, options.latency) : queueMicrotask(fn)

  return {
    connect() {
      const own = new Set<(message: CollabMessage) => void>()

      return {
        send(message) {
          const copy = JSON.parse(JSON.stringify(message)) as CollabMessage
          listeners.forEach((fn) => {
            if (!own.has(fn)) {
              deliver(() => fn(copy))
            }
          })
        },
        subscribe(listener) {
          own.add(listener)
          listeners.add(listener)
          return () => {
            own.delete(listener)
            listeners.delete(listener)
          }
        },
        close() {
          own.forEach(fn => listeners.delete(fn))
          own.clear()
        },
      }
    },
  }
}

export interface WebSocketTransportOptions {
  /** Max reconnect delay in ms (default 10 000). */
  maxBackoff?: number
  /** Messages buffered while offline (default 500). */
  maxQueue?: number
  /** Custom constructor (tests, Node). Defaults to the global `WebSocket`. */
  WebSocket?: typeof WebSocket
}

/**
 * JSON over a WebSocket relay that forwards each message to the other
 * clients of the room (see docs/collaboration.md for a 20-line server).
 * Reconnects with exponential backoff and resyncs on reconnect.
 */
export function createWebSocketTransport(url: string, options: WebSocketTransportOptions = {}): CollabTransport {
  const WS = options.WebSocket ?? globalThis.WebSocket
  const maxBackoff = options.maxBackoff ?? 10_000
  const maxQueue = options.maxQueue ?? 500
  const listeners = new Set<(message: CollabMessage) => void>()
  const statusListeners = new Set<(status: CollabTransportStatus) => void>()
  const queue: string[] = []
  let socket: WebSocket | null = null
  let attempt = 0
  let closed = false
  let retryTimer: ReturnType<typeof setTimeout> | null = null

  function status(s: CollabTransportStatus) {
    statusListeners.forEach(fn => fn(s))
  }

  function connect() {
    if (closed) {
      return
    }

    status('connecting')
    const ws = new WS(url)
    socket = ws

    ws.onopen = () => {
      attempt = 0
      status('open')

      while (queue.length && ws.readyState === 1) {
        ws.send(queue.shift() as string)
      }
    }

    ws.onmessage = (event) => {
      if (typeof event.data !== 'string' || event.data.length > 5_000_000) {
        return
      }

      try {
        const message = JSON.parse(event.data) as CollabMessage
        listeners.forEach(fn => fn(message))
      } catch {
        // Not ours — ignore.
      }
    }

    ws.onclose = () => {
      socket = null
      status('closed')

      if (!closed) {
        const delay = Math.min(maxBackoff, 500 * 2 ** attempt) * (0.5 + Math.random() / 2)
        attempt += 1
        retryTimer = setTimeout(connect, delay)
      }
    }

    ws.onerror = () => ws.close()
  }

  connect()

  return {
    send(message) {
      const data = JSON.stringify(message)

      if (socket && socket.readyState === 1) {
        socket.send(data)
      } else if (message.t === 'ops') {
        queue.push(data)

        if (queue.length > maxQueue) {
          queue.shift()
        }
      }
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    onStatus(listener) {
      statusListeners.add(listener)
      return () => statusListeners.delete(listener)
    },
    close() {
      closed = true

      if (retryTimer) {
        clearTimeout(retryTimer)
      }

      socket?.close()
      listeners.clear()
      statusListeners.clear()
    },
  }
}
