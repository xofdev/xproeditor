import { describe, expect, it } from 'vitest'
import {
  collabKeyBetween,
  createCollabSession,
  createMemoryCollabHub,
  reconcileBlocks,
  type CollabMessage,
  type CollabSession,
  type CollabTransport,
} from './collab'
import { createBlock } from './ops'
import type { Block } from './types'

const tick = () => new Promise(resolve => setTimeout(resolve, 60))

function para(id: string, text: string): Block {
  return createBlock('paragraph', { id, content: [{ text }] })
}

function texts(blocks: Block[]): string[] {
  return blocks.map(b => b.content.map(s => s.text).join(''))
}

function edit(blocks: Block[], id: string, text: string): Block[] {
  return blocks.map(b => (b.id === id ? { ...b, content: [{ text }] } : b))
}

function seed(): Block[] {
  return [para('a', 'A'), para('b', 'B'), para('c', 'C')]
}

function pair(): { hub: ReturnType<typeof createMemoryCollabHub>; one: CollabSession; two: CollabSession } {
  const hub = createMemoryCollabHub()
  const one = createCollabSession({ transport: hub.connect(), blocks: seed(), heartbeat: 0, user: { name: 'One' } })
  const two = createCollabSession({ transport: hub.connect(), blocks: seed(), heartbeat: 0, user: { name: 'Two' } })
  return { hub, one, two }
}

describe('collabKeyBetween', () => {
  it('generates keys in order, including repeated inserts at the same spot', () => {
    const keys: string[] = [collabKeyBetween(null, null)]

    for (let i = 0; i < 50; i++) {
      keys.push(collabKeyBetween(keys[keys.length - 1], null))
    }

    let lo = keys[0]
    const hi = keys[1]

    for (let i = 0; i < 50; i++) {
      const mid = collabKeyBetween(lo, hi)
      expect(mid > lo && mid < hi).toBe(true)
      lo = mid
    }

    expect([...keys].sort()).toEqual(keys)
    expect(collabKeyBetween(null, keys[0]) < keys[0]).toBe(true)
  })
})

describe('createCollabSession', () => {
  it('syncs edits to different blocks in both directions', async () => {
    const { one, two } = pair()
    await tick()

    one.update(edit(one.getBlocks(), 'a', 'A by one'))
    two.update(edit(two.getBlocks(), 'c', 'C by two'))
    await tick()
    await tick()

    expect(texts(one.getBlocks())).toEqual(['A by one', 'B', 'C by two'])
    expect(texts(two.getBlocks())).toEqual(['A by one', 'B', 'C by two'])
  })

  it('converges on inserts, deletes and moves', async () => {
    const { one, two } = pair()
    await tick()

    const d1 = one.getBlocks()
    one.update([d1[0], para('x', 'X'), d1[1], d1[2]])
    const d2 = two.getBlocks()
    two.update([d2[2], d2[0]]) // move C to the top, delete B
    await tick()
    await tick()

    expect(texts(one.getBlocks())).toEqual(texts(two.getBlocks()))
    expect(texts(one.getBlocks())).toEqual(['C', 'A', 'X'])
  })

  it('resolves concurrent edits to the same block to one value on every peer', async () => {
    const { one, two } = pair()
    await tick()

    one.update(edit(one.getBlocks(), 'b', 'one wins?'))
    two.update(edit(two.getBlocks(), 'b', 'two wins?'))
    await tick()
    await tick()

    expect(texts(one.getBlocks())).toEqual(texts(two.getBlocks()))
  })

  it('emits remote changes and presence', async () => {
    const { one, two } = pair()
    const seen: string[][] = []
    two.onChange(blocks => seen.push(texts(blocks)))
    await tick()

    one.setPresence('b')
    one.update(edit(one.getBlocks(), 'a', 'hi'))
    await tick()
    await tick()

    expect(seen.at(-1)).toEqual(['hi', 'B', 'C'])
    const peer = two.getPeers().find(p => p.clientId === one.clientId)
    expect(peer?.user.name).toBe('One')
    expect(peer?.blockId).toBe('b')

    one.destroy()
    await tick()
    expect(two.getPeers()).toHaveLength(0)
  })

  it('a fresh joiner adopts the room document instead of merging its seed', async () => {
    const hub = createMemoryCollabHub()
    const host = createCollabSession({ transport: hub.connect(), blocks: seed(), heartbeat: 0 })
    host.update(edit(host.getBlocks(), 'a', 'edited'))
    await tick()

    // Different ids — e.g. a page that created its own default document.
    const joiner = createCollabSession({
      transport: hub.connect(),
      blocks: [para('zz', 'local default')],
      heartbeat: 0,
    })
    await tick()
    await tick()

    expect(texts(joiner.getBlocks())).toEqual(['edited', 'B', 'C'])
    expect(texts(host.getBlocks())).toEqual(['edited', 'B', 'C'])
  })

  it('sanitizes untrusted entries from the wire', async () => {
    const listeners = new Set<(m: CollabMessage) => void>()
    const evil: CollabTransport = {
      send: () => {},
      subscribe(fn) {
        listeners.add(fn)
        return () => listeners.delete(fn)
      },
    }
    const session = createCollabSession({ transport: evil, blocks: seed(), heartbeat: 0 })

    listeners.forEach(fn =>
      fn({
        t: 'ops',
        from: 'attacker',
        entries: [
          {
            id: 'a',
            block: {
              type: 'paragraph',
              content: [{ text: 'click', marks: { link: 'javascript:alert(1)' } }],
              props: {},
            },
            v: { c: 99, u: 'attacker' },
            pos: 'V',
            pv: { c: 0, u: '' },
          },
          { id: 'b', block: null, v: 'nope', pos: 1, pv: null } as never,
        ],
      }),
    )

    const a = session.getBlocks().find(b => b.id === 'a') as Block
    expect(a.content[0].marks?.link ?? '').not.toContain('javascript')
    expect(session.getBlocks().some(b => b.id === 'b')).toBe(true)
  })
})

describe('reconcileBlocks', () => {
  it('keeps unchanged block objects and reports identical documents', () => {
    const current = seed()
    expect(reconcileBlocks(current, JSON.parse(JSON.stringify(current)))).toBeNull()

    const next = edit(JSON.parse(JSON.stringify(current)), 'b', 'changed')
    const out = reconcileBlocks(current, next) as Block[]
    expect(out[0]).toBe(current[0])
    expect(out[1]).not.toBe(current[1])
    expect(out[2]).toBe(current[2])
  })
})
