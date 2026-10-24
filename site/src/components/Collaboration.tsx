import { useEffect, useRef, useState } from 'react'
import {
  DocRenderer,
  ProEditor,
  createBlock,
  createBroadcastChannelTransport,
  createCollabSession,
  createMemoryCollabHub,
  type Block,
  type CollabPeer,
  type CollabSession,
  type ProEditorHandle,
} from '@xproeditor/react'
import { ClientOnly } from './ClientOnly'
import { CodeBlock } from './CodeBlock'

/** Fixed ids: every participant starts from the same document and merges cleanly. */
function collabSeed(): Block[] {
  return [
    createBlock('heading_2', { id: 'c-title', content: [{ text: 'Sprint planning — Q4' }] }),
    createBlock('paragraph', {
      id: 'c-intro',
      content: [
        { text: 'Two editors, ' },
        { text: 'one document', marks: { bold: true } },
        { text: '. Type in either pane — edits sync block by block and the coloured bar shows where each person is.' },
      ],
    }),
    createBlock('to_do', { id: 'c-todo-1', content: [{ text: 'Ship real-time collaboration' }], props: { checked: true } }),
    createBlock('to_do', { id: 'c-todo-2', content: [{ text: 'Write the migration guide' }], props: { checked: false } }),
    createBlock('to_do', { id: 'c-todo-3', content: [{ text: 'Record the demo video' }], props: { checked: false } }),
    createBlock('callout', {
      id: 'c-note',
      content: [{ text: 'Undo (⌘/Ctrl+Z) only reverts your own changes — never a teammate’s.' }],
      props: { icon: '🤝' },
    }),
    createBlock('paragraph', { id: 'c-empty', content: [] }),
  ]
}

const SARA = { id: 'sara', name: 'Sara', color: '#7c3aed' }
const ALI = { id: 'ali', name: 'Ali', color: '#0891b2' }
const GUEST_NAMES = ['Nova', 'Kian', 'Mina', 'Leo', 'Yara', 'Omid', 'Ava', 'Ryo']

const SNIPPET = `import { ProEditor, createCollabSession, createWebSocketTransport } from '@xproeditor/react'

const session = createCollabSession({
  transport: createWebSocketTransport('wss://relay.example.com/doc-42'),
  blocks: savedBlocks,          // same document on every client
  user: { name: 'Sara' },
})

<ProEditor defaultValue={savedBlocks} collaboration={session} />`

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function usePeers(session: CollabSession | null): CollabPeer[] {
  const [peers, setPeers] = useState<CollabPeer[]>([])

  useEffect(() => {
    if (!session) return
    setPeers(session.getPeers())
    return session.onPeers(setPeers)
  }, [session])

  return peers
}

function Avatar({ name, color, you }: { name: string; color: string; you?: boolean }) {
  return (
    <span className="avatar" style={{ ['--avatar' as string]: color }} title={you ? `${name} (you)` : name}>
      {name.slice(0, 1)}
    </span>
  )
}

function PaneHeader({ session, label }: { session: CollabSession; label: string }) {
  const peers = usePeers(session)

  return (
    <div className="collab-pane-head">
      <span className="window-dots" aria-hidden>
        <span />
        <span />
        <span />
      </span>
      <span className="collab-pane-title">
        <Avatar name={session.user.name} color={session.user.color} you />
        {label}
      </span>
      <span className="avatar-stack" aria-label={`${peers.length} other ${peers.length === 1 ? 'person' : 'people'} here`}>
        {peers.map((p) => (
          <Avatar key={p.clientId} name={p.user.name} color={p.user.color} />
        ))}
      </span>
    </div>
  )
}

function SplitCollab() {
  const [resetKey, setResetKey] = useState(0)
  const [pair, setPair] = useState<{ sara: CollabSession; ali: CollabSession; seed: Block[] } | null>(null)
  const [aliTyping, setAliTyping] = useState(false)
  const aliEditor = useRef<ProEditorHandle | null>(null)

  useEffect(() => {
    // 120 ms of simulated network latency makes the sync visible.
    const hub = createMemoryCollabHub({ latency: 120 })
    const seed = collabSeed()
    const sara = createCollabSession({ transport: hub.connect(), blocks: seed, user: SARA })
    const ali = createCollabSession({ transport: hub.connect(), blocks: seed, user: ALI })
    setPair({ sara, ali, seed })

    return () => {
      sara.destroy()
      ali.destroy()
    }
  }, [resetKey])

  async function letAliType() {
    const editor = aliEditor.current
    if (!editor || !pair || aliTyping) return

    setAliTyping(true)
    const id = 'c-todo-3'
    const base = editor.getBlocks().find((b) => b.id === id)
    const start = base ? base.content.map((s) => s.text).join('') : ''
    const phrase = ' — Ali is on it ✍️'
    pair.ali.setPresence(id)

    for (let i = 1; i <= phrase.length; i++) {
      editor.updateBlock(id, { content: [{ text: start + phrase.slice(0, i) }] })
      await sleep(55)
    }

    editor.updateBlock(id, { props: { checked: true } })
    await sleep(900)
    pair.ali.setPresence(null)
    setAliTyping(false)
  }

  if (!pair) return <StaticPanes />

  return (
    <>
      <div className="collab-grid">
        <div className="collab-pane" style={{ ['--pane' as string]: SARA.color }}>
          <PaneHeader session={pair.sara} label="Sara’s laptop" />
          <div className="collab-pane-body editor-theme-site">
            <ProEditor key={`sara-${resetKey}`} defaultValue={pair.seed} collaboration={pair.sara} />
          </div>
        </div>
        <div className="collab-pane" style={{ ['--pane' as string]: ALI.color }}>
          <PaneHeader session={pair.ali} label="Ali’s laptop" />
          <div className="collab-pane-body editor-theme-site">
            <ProEditor key={`ali-${resetKey}`} ref={aliEditor} defaultValue={pair.seed} collaboration={pair.ali} />
          </div>
        </div>
      </div>

      <div className="collab-actions">
        <button type="button" className="btn btn-primary btn-sm" onClick={letAliType} disabled={aliTyping}>
          {aliTyping ? 'Ali is typing…' : 'Let Ali type'}
        </button>
        <a className="btn btn-outline btn-sm" href={`?room=${Math.random().toString(36).slice(2, 8)}#collaborate`} target="_blank" rel="noopener">
          Open a shared room in a new tab
        </a>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setResetKey((k) => k + 1)}>
          Reset
        </button>
      </div>
    </>
  )
}

/** `?room=…` — one editor per tab, synced across tabs with BroadcastChannel (no server). */
function RoomCollab({ room }: { room: string }) {
  const [session, setSession] = useState<CollabSession | null>(null)
  const [seed] = useState(collabSeed)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const name = GUEST_NAMES[Math.floor(Math.random() * GUEST_NAMES.length)]
    const next = createCollabSession({
      transport: createBroadcastChannelTransport(`site-${room}`),
      blocks: seed,
      user: { name },
    })
    setSession(next)
    return () => next.destroy()
  }, [room, seed])

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable */
    }
  }

  if (!session) return <StaticPanes />

  return (
    <>
      <div className="collab-room-note">
        Room <code>{room}</code> — open this exact link in another tab or window of this browser and
        edit in both.
        <button type="button" className="btn btn-outline btn-sm" onClick={copyLink}>
          {copied ? 'Copied!' : 'Copy link'}
        </button>
      </div>
      <div className="collab-pane collab-pane--solo" style={{ ['--pane' as string]: session.user.color }}>
        <PaneHeader session={session} label={`You are ${session.user.name}`} />
        <div className="collab-pane-body editor-theme-site">
          <ProEditor defaultValue={seed} collaboration={session} />
        </div>
      </div>
    </>
  )
}

function StaticPanes() {
  const seed = collabSeed()

  return (
    <div className="collab-grid" aria-hidden>
      {[SARA, ALI].map((user) => (
        <div className="collab-pane" key={user.id} style={{ ['--pane' as string]: user.color }}>
          <div className="collab-pane-head">
            <span className="window-dots">
              <span />
              <span />
              <span />
            </span>
            <span className="collab-pane-title">
              <Avatar name={user.name} color={user.color} />
              {user.name}’s laptop
            </span>
          </div>
          <div className="collab-pane-body editor-theme-site">
            <DocRenderer blocks={seed} />
          </div>
        </div>
      ))}
    </div>
  )
}

function LiveCollab() {
  const room = new URLSearchParams(window.location.search).get('room')
  return room && /^[\w-]{1,40}$/.test(room) ? <RoomCollab room={room} /> : <SplitCollab />
}

export function Collaboration() {
  return (
    <section id="collaborate" aria-labelledby="collab-heading">
      <div className="container">
        <div className="section-head">
          <span className="eyebrow eyebrow--new">New · Real-time</span>
          <h2 id="collab-heading">Write together, live</h2>
          <p>
            Pass a session to <code>collaboration</code> and every edit syncs block by block with live
            presence. Bring any transport — a WebSocket relay, <code>BroadcastChannel</code>, or your
            own backend. No CRDT library, no vendor lock-in.
          </p>
        </div>

        <ClientOnly fallback={<StaticPanes />}>{() => <LiveCollab />}</ClientOnly>

        <div className="collab-explainer">
          <ul className="check-list">
            <li>
              <strong>Conflict-free merge.</strong> Concurrent edits to different blocks, inserts and
              moves always merge; every client converges to the same document.
            </li>
            <li>
              <strong>Collaboration-safe undo.</strong> Undo history is per user and per block, so you
              never undo someone else’s work.
            </li>
            <li>
              <strong>Validated on arrival.</strong> Remote messages are sanitized like pasted content —
              a malicious peer can’t inject script.
            </li>
            <li>
              <strong>Offline tolerant.</strong> The WebSocket transport buffers edits, reconnects with
              backoff and resyncs.
            </li>
          </ul>
          <CodeBlock code={SNIPPET} />
        </div>
      </div>
    </section>
  )
}
