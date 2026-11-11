import { getColumnsGroupLength } from './columns'
import { cloneBlock } from './ops'
import type { Block, BlockType } from './types'
import { isToggleBlock } from './types'

/**
 * Inclusive length of a block that owns the blocks after it, in the flat block
 * model: a toggle and its nested children (every following block with
 * indent > toggle.indent, in the same column), or a `columns` block and its
 * group. Any other block is 1.
 */
export function getToggleSubtreeLength(blocks: Block[], index: number): number {
  const block = blocks[index]
  if (!block) return 1
  if (block.type === 'columns') return getColumnsGroupLength(blocks, index)
  if (!isToggleBlock(block.type)) return 1

  const base = block.props.indent ?? 0
  const column = block.props.column
  let len = 1

  for (let i = index + 1; i < blocks.length; i++) {
    if ((blocks[i].props.indent ?? 0) > base && blocks[i].props.column === column) len++
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

  let hideColumn: number | undefined

  blocks.forEach((block, index) => {
    const ind = block.props.indent ?? 0

    if (hideDeeperThan !== null) {
      // A collapsed toggle hides its children only inside its own column.
      if (ind > hideDeeperThan && block.props.column === hideColumn) return
      hideDeeperThan = null
    }

    out.push({ block, index })

    if (isToggleBlock(block.type) && isCollapsed(block, index)) {
      hideDeeperThan = ind
      hideColumn = block.props.column
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
