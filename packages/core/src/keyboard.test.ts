import { describe, expect, it } from 'vitest'
import { getBlockSubtreeLength, moveBlockSubtree, resolveBlockKeyboardShortcut } from './keyboard'
import { createBlock, spansToText } from './ops'
import type { Block } from './types'

const key = (k: string, mods: Partial<{ ctrl: boolean; meta: boolean; alt: boolean; shift: boolean }> = {}, code?: string) =>
  resolveBlockKeyboardShortcut({
    key: k,
    code,
    ctrlKey: !!mods.ctrl,
    metaKey: !!mods.meta,
    altKey: !!mods.alt,
    shiftKey: !!mods.shift,
  })

const p = (text: string, indent = 0) => createBlock('paragraph', { content: [{ text }], props: indent ? { indent } : {} })
const names = (blocks: Block[]) => blocks.map(b => spansToText(b.content))

describe('resolveBlockKeyboardShortcut', () => {
  it('maps heading and list shortcuts using the physical digit key', () => {
    expect(key('¡', { meta: true, alt: true }, 'Digit1')).toEqual({ kind: 'turn-into', type: 'heading_1' })
    expect(key('0', { ctrl: true, alt: true }, 'Digit0')).toEqual({ kind: 'turn-into', type: 'paragraph' })
    expect(key('&', { meta: true, shift: true }, 'Digit7')).toEqual({ kind: 'turn-into', type: 'numbered_list_item' })
    expect(key('*', { ctrl: true, shift: true }, 'Digit8')).toEqual({ kind: 'turn-into', type: 'bulleted_list_item' })
    expect(key('(', { ctrl: true, shift: true }, 'Digit9')).toEqual({ kind: 'turn-into', type: 'to_do' })
  })

  it('maps move, duplicate, toggle and link', () => {
    expect(key('ArrowUp', { meta: true, shift: true })).toEqual({ kind: 'move', direction: -1 })
    expect(key('ArrowDown', { ctrl: true, shift: true })).toEqual({ kind: 'move', direction: 1 })
    expect(key('d', { meta: true })).toEqual({ kind: 'duplicate' })
    expect(key('Enter', { ctrl: true })).toEqual({ kind: 'toggle' })
    expect(key('k', { meta: true })).toEqual({ kind: 'link' })
  })

  it('ignores plain keys and unrelated combos', () => {
    expect(key('d')).toBeNull()
    expect(key('b', { meta: true })).toBeNull()
    expect(key('1', { meta: true }, 'Digit1')).toBeNull()
  })
})

describe('moveBlockSubtree', () => {
  it('moves a block with its children past its sibling', () => {
    const blocks = [p('a'), p('b'), p('b1', 1), p('b2', 1), p('c')]

    expect(getBlockSubtreeLength(blocks, 1)).toBe(3)
    expect(moveBlockSubtree(blocks, blocks[1].id, -1)).toBe(true)
    expect(names(blocks)).toEqual(['b', 'b1', 'b2', 'a', 'c'])
    expect(moveBlockSubtree(blocks, blocks[0].id, 1)).toBe(true)
    expect(names(blocks)).toEqual(['a', 'b', 'b1', 'b2', 'c'])
  })

  it('swaps whole subtrees when moving down', () => {
    const blocks = [p('a'), p('a1', 1), p('b'), p('b1', 1)]

    moveBlockSubtree(blocks, blocks[0].id, 1)
    expect(names(blocks)).toEqual(['b', 'b1', 'a', 'a1'])
  })

  it('stays inside its parent', () => {
    const blocks = [p('parent'), p('child', 1), p('next')]

    expect(moveBlockSubtree(blocks, blocks[1].id, -1)).toBe(false)
    expect(moveBlockSubtree(blocks, blocks[1].id, 1)).toBe(false)
    expect(moveBlockSubtree(blocks, blocks[0].id, -1)).toBe(false)
    expect(names(blocks)).toEqual(['parent', 'child', 'next'])
  })
})
