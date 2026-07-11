# Block model

XProEditor stores documents as a flat array of blocks — no nested tree. List
nesting, toggle children, quote indentation, etc. are all expressed with a
per-block `indent` number rather than parent/child nesting, which keeps the
persisted shape simple to store, diff, and migrate.

## `BlocksContent` (what you persist)

```ts
interface BlocksContent {
  format: 'blocks'
  version: 1
  blocks: Block[]
  /** Derived plain text, e.g. for a Postgres `content->>'text'` full-text index */
  text: string
}
```

Build one from a `Block[]` with `buildBlocksContent()` (from `@xproeditor/core`).

## `Block`

```ts
interface Block {
  id: string
  type: BlockType
  content: InlineSpan[]
  props: BlockProps
}

type BlockType =
  | 'paragraph' | 'heading_1' | 'heading_2' | 'heading_3'
  | 'bulleted_list_item' | 'numbered_list_item' | 'to_do' | 'toggle'
  | 'quote' | 'callout' | 'code' | 'divider'
  | 'image' | 'video' | 'audio' | 'file' | 'table'
```

## `InlineSpan` (rich text)

A run of text sharing the same marks:

```ts
interface InlineSpan {
  text: string
  marks?: {
    bold?: boolean
    italic?: boolean
    underline?: boolean
    strikethrough?: boolean
    code?: boolean
    link?: string
    color?: string
    highlight?: string
  }
}
```

## `BlockProps` (per-type fields)

```ts
interface BlockProps {
  indent?: number          // list/to-do/toggle/quote/callout/paragraph nesting depth
  checked?: boolean         // to_do
  collapsed?: boolean       // toggle
  language?: string         // code
  code?: string             // code
  url?: string              // image/video/audio/file
  caption?: string          // image/video/audio
  name?: string              // audio/file: original file name
  size?: number              // audio/file: size in bytes
  mime?: string              // audio/file: MIME type
  width?: number             // image/video width percent (10–100)
  provider?: 'file' | 'youtube' | 'vimeo' // video
  icon?: string              // callout
  color?: string             // callout background
  table?: TableData          // table
  dir?: 'auto' | 'ltr' | 'rtl'
  align?: 'left' | 'center' | 'right'
}
```

## Tables

```ts
interface TableData {
  hasHeader: boolean
  rows: TableCell[][]
  width?: { mode: 'percent' | 'pixel'; value: number }
  style?: {
    background?: string
    headerBackground?: string
    border?: { color?: string; width?: 0 | 1 | 2 | 3 | 4; style?: 'solid' | 'dashed' | 'dotted' | 'none' }
  }
}

interface TableCell {
  content: InlineSpan[]
  colspan?: number
  rowspan?: number
  align?: 'left' | 'center' | 'right' | 'justify'
  background?: string
  hidden?: boolean // covered by a merged cell's colspan/rowspan
}
```

## Working with blocks headlessly

`@xproeditor/core` exports everything needed to build, inspect, and render
blocks without any UI:

```ts
import { createBlock, blocksToPlainText, blocksToHtmlContent, buildBlocksContent } from '@xproeditor/core'

const blocks = [createBlock('paragraph', { content: [{ text: 'Hi' }] })]

blocksToPlainText(blocks) // "Hi"
blocksToHtmlContent(blocks) // "<p>Hi</p>"
buildBlocksContent(blocks) // { format: 'blocks', version: 1, blocks, text: 'Hi' }
```

## Migrating from HTML or Tiptap

- `htmlToBlocks(html: string): Block[]` — parses pasted/imported HTML.
- `tiptapToBlocks(doc): Block[]` — converts a Tiptap/ProseMirror JSON doc.
