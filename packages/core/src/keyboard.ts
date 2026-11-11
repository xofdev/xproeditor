/**
 * Block-level keyboard shortcuts shared by both adapters.
 *
 * Digits are read from `KeyboardEvent.code` (`Digit1`, …) because the `key`
 * for Shift/Alt+digit differs per layout (`&`, `¡`, Persian digits, …).
 */

import { getColumnsGroupLength } from './columns'
import type { Block, BlockType } from './types'

export type BlockKeyboardAction =
  | { kind: 'turn-into'; type: BlockType }
  | { kind: 'move'; direction: -1 | 1 }
  | { kind: 'duplicate' }
  | { kind: 'toggle' }
  | { kind: 'link' }

export interface KeyboardShortcutInput {
  key: string
  code?: string
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  shiftKey: boolean
}

/** Human-readable catalogue (for help dialogs / docs). `Mod` = ⌘ on macOS, Ctrl elsewhere. */
export const BLOCK_KEYBOARD_SHORTCUTS: ReadonlyArray<{ keys: string; action: string }> = [
  { keys: 'Mod+Alt+0', action: 'Turn into text' },
  { keys: 'Mod+Alt+1 / 2 / 3', action: 'Turn into heading 1 / 2 / 3' },
  { keys: 'Mod+Shift+7', action: 'Turn into numbered list' },
  { keys: 'Mod+Shift+8', action: 'Turn into bulleted list' },
  { keys: 'Mod+Shift+9', action: 'Turn into to-do' },
  { keys: 'Mod+Shift+↑ / ↓', action: 'Move block up / down' },
  { keys: 'Mod+D', action: 'Duplicate block' },
  { keys: 'Mod+Enter', action: 'Check / uncheck to-do, open / close toggle' },
  { keys: 'Mod+K', action: 'Add or edit link' },
]

function digitOf(input: KeyboardShortcutInput): number | null {
  const fromCode = /^(?:Digit|Numpad)(\d)$/.exec(input.code ?? '')?.[1]

  if (fromCode) {
    return Number(fromCode)
  }

  return /^\d$/.test(input.key) ? Number(input.key) : null
}

export function resolveBlockKeyboardShortcut(input: KeyboardShortcutInput): BlockKeyboardAction | null {
  if (!(input.ctrlKey || input.metaKey)) {
    return null
  }

  const key = input.key.toLowerCase()
  const digit = digitOf(input)

  if (input.altKey && !input.shiftKey && digit !== null) {
    if (digit === 0) return { kind: 'turn-into', type: 'paragraph' }
    if (digit === 1) return { kind: 'turn-into', type: 'heading_1' }
    if (digit === 2) return { kind: 'turn-into', type: 'heading_2' }
    if (digit === 3) return { kind: 'turn-into', type: 'heading_3' }
  }

  if (input.shiftKey && !input.altKey) {
    if (digit === 7) return { kind: 'turn-into', type: 'numbered_list_item' }
    if (digit === 8) return { kind: 'turn-into', type: 'bulleted_list_item' }
    if (digit === 9) return { kind: 'turn-into', type: 'to_do' }
    if (input.key === 'ArrowUp') return { kind: 'move', direction: -1 }
    if (input.key === 'ArrowDown') return { kind: 'move', direction: 1 }
  }

  if (!input.shiftKey && !input.altKey) {
    if (key === 'd') return { kind: 'duplicate' }
    if (key === 'enter') return { kind: 'toggle' }
    if (key === 'k') return { kind: 'link' }
  }

  return null
}

/**
 * Number of blocks owned by `blocks[index]`: the block itself plus every
 * following block indented deeper than it (its nested children).
 */
export function getBlockSubtreeLength(blocks: Block[], index: number): number {
  const block = blocks[index]

  if (!block) {
    return 0
  }

  if (block.type === 'columns') {
    return getColumnsGroupLength(blocks, index)
  }

  const base = block.props.indent ?? 0
  const column = block.props.column
  let len = 1

  for (let i = index + 1; i < blocks.length; i++) {
    if ((blocks[i].props.indent ?? 0) > base && blocks[i].props.column === column) len++
    else break
  }

  return len
}

/**
 * Move a block (with its nested children) past its previous / next sibling.
 * Mutates `blocks`; returns false when there is no sibling to swap with
 * (first/last child of its parent).
 *
 * Columns: a `columns` group moves as one top-level block and swaps with whole
 * groups; a block inside a column only swaps with siblings of the same column.
 */
export function moveBlockSubtree(blocks: Block[], blockId: string, direction: -1 | 1): boolean {
  const index = blocks.findIndex(b => b.id === blockId)

  if (index === -1) {
    return false
  }

  const indent = blocks[index].props.indent ?? 0
  const column = blocks[index].props.column
  const len = getBlockSubtreeLength(blocks, index)
  // A sibling: same indent in the same column, or (for a top-level block) a whole group.
  const sameLevel = (b: Block) =>
    ((b.props.indent ?? 0) === indent && b.props.column === column && b.type !== 'columns') ||
    (column === undefined && indent === 0 && b.type === 'columns')
  const nested = (b: Block) =>
    column === undefined ? (b.props.indent ?? 0) > indent || b.props.column !== undefined : (b.props.indent ?? 0) > indent && b.props.column === column

  if (direction === -1) {
    let prev = index - 1

    while (prev >= 0 && nested(blocks[prev])) {
      prev--
    }

    if (prev < 0 || !sameLevel(blocks[prev])) {
      return false
    }

    const moved = blocks.splice(index, len)
    blocks.splice(prev, 0, ...moved)

    return true
  }

  const next = index + len

  if (next >= blocks.length || !sameLevel(blocks[next])) {
    return false
  }

  const nextLen = getBlockSubtreeLength(blocks, next)
  const moved = blocks.splice(index, len)
  blocks.splice(index + nextLen, 0, ...moved)

  return true
}
