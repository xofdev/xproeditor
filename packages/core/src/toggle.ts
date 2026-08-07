import { cloneBlock } from './ops'
import type { Block, BlockType } from './types'
import { isToggleBlock } from './types'

/**
 * Inclusive length of a toggle and its nested children in the flat block
 * model (every following block with indent > toggle.indent).
 */
export function getToggleSubtreeLength(blocks: Block[], index: number): number {
  const block = blocks[index]
  if (!block || !isToggleBlock(block.type)) return 1

  const base = block.props.indent ?? 0
  let len = 1

  for (let i = index + 1; i < blocks.length; i++) {
    if ((blocks[i].props.indent ?? 0) > base) len++
    else break
  }

  return len
}

/** Clone a toggle and its children with fresh ids. */
export function cloneToggleSubtree(blocks: Block[], index: number): Block[] {
  const len = getToggleSubtreeLength(blocks, index)
  return blocks.slice(index, index + len).map((b) => cloneBlock(b, true))
}

/** Drop a toggle and its children; returns the next index after the splice. */
export function removeToggleSubtree(blocks: Block[], index: number): number {
  const len = getToggleSubtreeLength(blocks, index)
  blocks.splice(index, len)
  return index
}

/**
 * Filter blocks for collapsed-toggle visibility (editor + DocRenderer).
 * When a toggle is collapsed, hide every following block with deeper indent
 * until a peer/ancestor at indent ≤ toggle.indent.
 */
export function filterVisibleBlocks(
  blocks: Block[],
  isCollapsed: (block: Block, index: number) => boolean,
): Array<{ block: Block; index: number }> {
  const out: Array<{ block: Block; index: number }> = []
  let hideDeeperThan: number | null = null

  blocks.forEach((block, index) => {
    const ind = block.props.indent ?? 0

    if (hideDeeperThan !== null) {
      if (ind > hideDeeperThan) return
      hideDeeperThan = null
    }

    out.push({ block, index })

    if (isToggleBlock(block.type) && isCollapsed(block, index)) {
      hideDeeperThan = ind
    }
  })

  return out
}

export function isToggleBlockType(type: string): type is BlockType {
  return (
    type === 'toggle' ||
    type === 'toggle_heading_1' ||
    type === 'toggle_heading_2' ||
    type === 'toggle_heading_3'
  )
}
