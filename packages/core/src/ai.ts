/**
 * Pluggable AI agent types for XProEditor.
 *
 * AI is not a document block — it's an overlay agent (BlockNote xl-ai pattern):
 * slash `/ai`, toolbar "Edit with AI", streaming suggestions, Accept / Reject.
 * Host apps supply an `AITransport` that talks to any LLM backend.
 */

import { createBlock, generateBlockId, normalizeSpans } from './ops'
import { htmlToBlocks } from './normalize'
import { markdownToBlocks } from './markdown'
import type { Block, InlineSpan } from './types'
import { isTextBlock } from './types'

export type AIAgentStatus =
  | 'closed'
  | 'user-input'
  | 'thinking'
  | 'ai-writing'
  | 'user-reviewing'
  | 'error'

export type AICommandKind = 'add' | 'update'

export interface AICommand {
  id: string
  label: string
  /** Short helper under the label in the AI menu */
  description?: string
  /** Shown when the user has a text selection */
  requiresSelection?: boolean
  /** Shown when there is no selection (cursor only) */
  requiresNoSelection?: boolean
  kind: AICommandKind
  /** Optional prompt seed filled into the input */
  prompt?: string
  aliases?: string[]
}

export interface AIDocumentContext {
  /** Full document blocks (read-only snapshot) */
  blocks: Block[]
  /** Selected blocks (may be empty) */
  selection: Block[]
  /** Plain-text of selection, or empty */
  selectionText: string
  /** Focused block id if any */
  focusBlockId: string | null
}

export interface AIRequest {
  prompt: string
  commandId: string | null
  context: AIDocumentContext
  signal?: AbortSignal
}

export interface AIStreamChunk {
  /** Incremental plain text / markdown from the model */
  text?: string
  /** When the model returns structured blocks directly */
  blocks?: Block[]
  done?: boolean
  error?: string
}

/**
 * Host-supplied transport. Implement with fetch/OpenAI/Anthropic/etc.
 * Yield chunks; final chunk may include `blocks` or leave `text` for the
 * editor to parse as markdown.
 */
export type AITransport = (request: AIRequest) => AsyncIterable<AIStreamChunk>

export interface AISuggestion {
  id: string
  /** Blocks proposed by the AI (to insert or replace selection) */
  blocks: Block[]
  kind: AICommandKind
  /** Target block ids to replace when kind === 'update' */
  replaceBlockIds: string[]
}

export const DEFAULT_AI_COMMANDS: AICommand[] = [
  {
    id: 'improve',
    label: 'Improve writing',
    description: 'Polish tone and clarity',
    requiresSelection: true,
    kind: 'update',
    prompt: 'Improve the writing of the selected text. Keep the meaning.',
    aliases: ['improve', 'rewrite'],
  },
  {
    id: 'fix-spelling',
    label: 'Fix spelling & grammar',
    description: 'Correct mistakes only',
    requiresSelection: true,
    kind: 'update',
    prompt: 'Fix spelling and grammar in the selected text.',
    aliases: ['fix', 'grammar', 'spell'],
  },
  {
    id: 'simplify',
    label: 'Simplify',
    description: 'Shorter and clearer',
    requiresSelection: true,
    kind: 'update',
    prompt: 'Simplify the selected text. Make it clearer and shorter.',
    aliases: ['simplify', 'shorter'],
  },
  {
    id: 'continue',
    label: 'Continue writing',
    description: 'Extend from the cursor',
    requiresNoSelection: true,
    kind: 'add',
    prompt: 'Continue writing from the cursor in the same style.',
    aliases: ['continue', 'write more'],
  },
  {
    id: 'summarize',
    label: 'Summarize',
    description: 'Short paragraph summary',
    requiresNoSelection: true,
    kind: 'add',
    prompt: 'Summarize the document above the cursor in a short paragraph.',
    aliases: ['summarize', 'summary'],
  },
  {
    id: 'action-items',
    label: 'Add action items',
    description: 'Extract as a to-do list',
    requiresNoSelection: true,
    kind: 'add',
    prompt: 'Extract action items from the document as a to-do list.',
    aliases: ['todos', 'action items', 'tasks'],
  },
]

export function filterAICommands(
  commands: AICommand[],
  query: string,
  hasSelection: boolean,
): AICommand[] {
  const q = query.trim().toLowerCase()

  return commands.filter((cmd) => {
    if (cmd.requiresSelection && !hasSelection) {
      return false
    }

    if (cmd.requiresNoSelection && hasSelection) {
      return false
    }

    if (!q) {
      return true
    }

    const hay = [cmd.label, cmd.description ?? '', cmd.id, ...(cmd.aliases ?? [])]
      .join(' ')
      .toLowerCase()

    return hay.includes(q)
  })
}

/** Turn model output into Block[]. Prefers explicit blocks, then MD, then HTML, then plain. */
export function parseAIResponseToBlocks(chunk: {
  text?: string
  blocks?: Block[]
}): Block[] {
  if (chunk.blocks && chunk.blocks.length > 0) {
    return chunk.blocks.map(b => ({
      ...b,
      id: b.id || generateBlockId(),
      content: Array.isArray(b.content) ? normalizeSpans(b.content as InlineSpan[]) : [],
      props: b.props ?? {},
    }))
  }

  const text = (chunk.text ?? '').trim()

  if (!text) {
    return []
  }

  if (text.includes('<') && text.includes('>')) {
    const fromHtml = htmlToBlocks(text)

    if (fromHtml.length) {
      return fromHtml
    }
  }

  const fromMd = markdownToBlocks(text)

  if (fromMd.length) {
    return fromMd
  }

  return [createBlock('paragraph', { content: [{ text }] })]
}

export interface ApplyAISuggestionResult {
  blocks: Block[]
  focusBlockId: string | null
}

/**
 * Apply an accepted suggestion. Mutates a cloned array — caller should
 * replace document state with the returned blocks.
 */
export function applyAISuggestion(
  documentBlocks: Block[],
  suggestion: AISuggestion,
  insertAfterBlockId: string | null,
): ApplyAISuggestionResult {
  const next = documentBlocks.map(b => ({ ...b, content: [...b.content], props: { ...b.props } }))
  const proposed = suggestion.blocks.map(b => ({
    ...b,
    id: generateBlockId(),
    content: normalizeSpans(b.content),
    props: { ...b.props },
  }))

  if (suggestion.kind === 'update' && suggestion.replaceBlockIds.length > 0) {
    const firstId = suggestion.replaceBlockIds[0]
    const lastId = suggestion.replaceBlockIds[suggestion.replaceBlockIds.length - 1]
    const startIdx = next.findIndex(b => b.id === firstId)
    const endIdx = next.findIndex(b => b.id === lastId)

    if (startIdx !== -1 && endIdx !== -1 && endIdx >= startIdx) {
      next.splice(startIdx, endIdx - startIdx + 1, ...proposed)

      return {
        blocks: next,
        focusBlockId: proposed[proposed.length - 1]?.id ?? null,
      }
    }
  }

  let insertIdx = next.length

  if (insertAfterBlockId) {
    const idx = next.findIndex(b => b.id === insertAfterBlockId)

    if (idx !== -1) {
      insertIdx = idx + 1
    }
  }

  next.splice(insertIdx, 0, ...proposed)

  return {
    blocks: next,
    focusBlockId: proposed[proposed.length - 1]?.id ?? null,
  }
}

export function selectionTextFromBlocks(blocks: Block[]): string {
  return blocks
    .map((b) => {
      if (isTextBlock(b.type)) {
        return b.content.map(s => s.text).join('')
      }

      if (b.type === 'code') {
        return b.props.code ?? ''
      }

      return ''
    })
    .filter(Boolean)
    .join('\n')
}

/** Collect AI stream into a final text buffer + optional structured blocks. */
export async function collectAIStream(
  transport: AITransport,
  request: AIRequest,
): Promise<{ text: string; blocks: Block[] | null; error: string | null }> {
  let text = ''
  let blocks: Block[] | null = null
  let error: string | null = null

  for await (const chunk of transport(request)) {
    if (chunk.error) {
      error = chunk.error
      break
    }

    if (chunk.text) {
      text += chunk.text
    }

    if (chunk.blocks) {
      blocks = chunk.blocks
    }

    if (chunk.done) {
      break
    }
  }

  return { text, blocks, error }
}
