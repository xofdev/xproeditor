import { describe, expect, it } from 'vitest'
import { createBlockHistory } from './history'
import { createBlock } from './ops'
import type { Block } from './types'

function para(id: string, text: string): Block {
  return createBlock('paragraph', { id, content: [{ text }] })
}

function texts(blocks: Block[]): string[] {
  return blocks.map(b => b.content.map(s => s.text).join(''))
}

describe('createBlockHistory', () => {
  it('undoes and redoes a text edit', () => {
    let doc = [para('a', 'one'), para('b', 'two')]
    const h = createBlockHistory()
    h.reset(doc)

    doc = [doc[0], { ...doc[1], content: [{ text: 'two!' }] }]
    expect(h.commit(doc)).toBe(true)
    expect(h.canUndo()).toBe(true)

    doc = h.undo(doc) as Block[]
    expect(texts(doc)).toEqual(['one', 'two'])
    expect(h.canRedo()).toBe(true)

    doc = h.redo(doc) as Block[]
    expect(texts(doc)).toEqual(['one', 'two!'])
  })

  it('returns null and records nothing when the document is unchanged', () => {
    const doc = [para('a', 'one')]
    const h = createBlockHistory()
    h.reset(doc)
    expect(h.commit(doc)).toBe(false)
    expect(h.undo(doc)).toBeNull()
  })

  it('keeps the identity of blocks the step did not touch', () => {
    let doc = [para('a', 'one'), para('b', 'two')]
    const h = createBlockHistory()
    h.reset(doc)
    const untouched = doc[0]

    doc = [untouched, { ...doc[1], content: [{ text: 'changed' }] }]
    h.commit(doc)
    doc = h.undo(doc) as Block[]
    expect(doc[0]).toBe(untouched)
  })

  it('restores inserted, removed and moved blocks', () => {
    let doc = [para('a', 'A'), para('b', 'B'), para('c', 'C')]
    const h = createBlockHistory()
    h.reset(doc)

    doc = [doc[2], doc[0], para('d', 'D')] // move c up, remove b, add d
    h.commit(doc)

    doc = h.undo(doc) as Block[]
    expect(texts(doc)).toEqual(['A', 'B', 'C'])

    doc = h.redo(doc) as Block[]
    expect(texts(doc)).toEqual(['C', 'A', 'D'])
  })

  it('does not revert remote edits that were rebased in', () => {
    let doc = [para('a', 'mine'), para('b', 'theirs')]
    const h = createBlockHistory()
    h.reset(doc)

    doc = [{ ...doc[0], content: [{ text: 'mine edited' }] }, doc[1]]
    h.commit(doc)

    // A collaborator edits block b and adds block r.
    doc = [doc[0], { ...doc[1], content: [{ text: 'theirs edited' }] }, para('r', 'remote')]
    h.rebase(doc)

    doc = h.undo(doc) as Block[]
    expect(texts(doc)).toEqual(['mine', 'theirs edited', 'remote'])
  })

  it('commits pending changes before undoing them', () => {
    let doc = [para('a', 'x')]
    const h = createBlockHistory()
    h.reset(doc)
    doc = [{ ...doc[0], content: [{ text: 'xy' }] }]
    // No explicit commit — undo must still revert the pending edit.
    doc = h.undo(doc) as Block[]
    expect(texts(doc)).toEqual(['x'])
  })

  it('drops the redo branch after a new edit and honours the limit', () => {
    let doc = [para('a', '0')]
    const h = createBlockHistory({ limit: 3 })
    h.reset(doc)

    for (let i = 1; i <= 5; i++) {
      doc = [{ ...doc[0], content: [{ text: String(i) }] }]
      h.commit(doc)
    }

    let undos = 0
    while (h.canUndo()) {
      doc = h.undo(doc) as Block[]
      undos++
    }

    expect(undos).toBe(3)
    expect(texts(doc)).toEqual(['2'])

    doc = h.redo(doc) as Block[]
    doc = [{ ...doc[0], content: [{ text: 'new' }] }]
    h.commit(doc)
    expect(h.canRedo()).toBe(false)
  })
})
