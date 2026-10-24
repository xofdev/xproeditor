import type { Block } from './types'

/**
 * Block-level undo history shared by both adapters.
 *
 * Instead of storing a JSON snapshot of the whole document per step (memory
 * grows with doc size × steps, and undo re-creates every block object so
 * every row re-renders), each step stores only the blocks that changed plus
 * the block order when it changed. Undo/redo re-apply just those blocks onto
 * the *current* document, which also makes history collaboration-safe: a
 * remote edit to another block is never reverted by a local undo (see
 * `rebase`).
 */

interface BlockChange {
  id: string
  /** Block JSON before the step (`null` = the block did not exist). */
  before: string | null
  /** Block JSON after the step (`null` = the block was removed). */
  after: string | null
}

interface HistoryStep {
  changes: BlockChange[]
  /** Id order before/after — only stored when the order changed. */
  orderBefore: string[] | null
  orderAfter: string[] | null
}

export interface BlockHistoryOptions {
  /** Maximum undo steps kept (default 200). */
  limit?: number
}

export interface BlockHistory {
  /**
   * Record the difference between the last baseline and `blocks` as one
   * undo step. Returns `false` when nothing changed.
   */
  commit(blocks: readonly Block[]): boolean
  /** Adopt `blocks` as the baseline without recording a step (remote edits). */
  rebase(blocks: readonly Block[]): void
  /** Drop every step and adopt `blocks` as the baseline (loading a document). */
  reset(blocks: readonly Block[]): void
  /**
   * Undo the last step against the current document. Commits pending
   * changes first. Returns the new document (unchanged blocks keep their
   * object identity) or `null` when there is nothing to undo.
   */
  undo(blocks: readonly Block[]): Block[] | null
  /** Redo the next step. Returns the new document or `null`. */
  redo(blocks: readonly Block[]): Block[] | null
  canUndo(): boolean
  canRedo(): boolean
}

function sameOrder(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) {
    return false
  }

  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false
    }
  }

  return true
}

/**
 * Order `present` ids like `target`, keeping ids that `target` doesn't know
 * (added by someone else since) right after their current predecessor.
 */
function mergeOrder(target: readonly string[], currentIds: readonly string[], present: Map<string, Block>): string[] {
  const result = target.filter(id => present.has(id))
  const placed = new Set(result)
  let prev: string | null = null

  for (const id of currentIds) {
    if (present.has(id) && !placed.has(id)) {
      const at = prev === null ? 0 : result.indexOf(prev) + 1
      result.splice(at, 0, id)
      placed.add(id)
    }

    if (placed.has(id)) {
      prev = id
    }
  }

  for (const id of present.keys()) {
    if (!placed.has(id)) {
      result.push(id)
    }
  }

  return result
}

export function createBlockHistory(options: BlockHistoryOptions = {}): BlockHistory {
  const limit = Math.max(1, options.limit ?? 200)
  let steps: HistoryStep[] = []
  /** Number of applied steps (`steps[pointer - 1]` is the one undo reverts). */
  let pointer = 0
  let baseline = new Map<string, string>()
  let baselineOrder: string[] = []

  function adopt(blocks: readonly Block[]) {
    baseline = new Map(blocks.map(b => [b.id, JSON.stringify(b)]))
    baselineOrder = blocks.map(b => b.id)
  }

  function commit(blocks: readonly Block[]): boolean {
    const next = new Map<string, string>()
    const changes: BlockChange[] = []

    for (const block of blocks) {
      const json = JSON.stringify(block)
      const prev = baseline.get(block.id)
      next.set(block.id, json)

      if (prev !== json) {
        changes.push({ id: block.id, before: prev ?? null, after: json })
      }
    }

    for (const [id, json] of baseline) {
      if (!next.has(id)) {
        changes.push({ id, before: json, after: null })
      }
    }

    const order = blocks.map(b => b.id)
    const orderChanged = !sameOrder(order, baselineOrder)

    if (changes.length === 0 && !orderChanged) {
      return false
    }

    steps = steps.slice(0, pointer)
    steps.push({
      changes,
      orderBefore: orderChanged ? baselineOrder : null,
      orderAfter: orderChanged ? order : null,
    })

    if (steps.length > limit) {
      steps.shift()
    }

    pointer = steps.length
    baseline = next
    baselineOrder = order

    return true
  }

  function apply(current: readonly Block[], step: HistoryStep, side: 'before' | 'after'): Block[] {
    const present = new Map(current.map(b => [b.id, b]))

    for (const change of step.changes) {
      const json = side === 'before' ? change.before : change.after

      if (json === null) {
        present.delete(change.id)
      } else {
        present.set(change.id, JSON.parse(json) as Block)
      }
    }

    const currentIds = current.map(b => b.id)
    const target = side === 'before' ? step.orderBefore : step.orderAfter
    const order = target
      ? mergeOrder(target, currentIds, present)
      : mergeOrder(currentIds, currentIds, present)

    return order.map(id => present.get(id) as Block)
  }

  return {
    commit,
    rebase: adopt,
    reset(blocks) {
      steps = []
      pointer = 0
      adopt(blocks)
    },
    undo(blocks) {
      commit(blocks)

      if (pointer === 0) {
        return null
      }

      pointer -= 1
      const result = apply(blocks, steps[pointer], 'before')
      adopt(result)

      return result
    },
    redo(blocks) {
      if (pointer >= steps.length) {
        return null
      }

      const result = apply(blocks, steps[pointer], 'after')
      pointer += 1
      adopt(result)

      return result
    },
    canUndo: () => pointer > 0,
    canRedo: () => pointer < steps.length,
  }
}
