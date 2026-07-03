# @xproeditor/core

Framework-agnostic engine for **XProEditor**, a Notion-like block editor. This
package has **zero UI** and **zero framework dependency** — it's the block
document model, span/mark operations, contentEditable selection helpers,
clipboard (de)serialization, HTML conversion, and table operations shared by
[`@xproeditor/vue`](../vue) and [`@xproeditor/react`](../react).

You normally don't install this directly — the framework adapters depend on it
and re-export everything it exports. Install it standalone only if you want to
work with the block model headlessly (e.g. rendering blocks to HTML on the
server, or writing an adapter for another framework).

## Install

```bash
npm install @xproeditor/core
```

## The block model

Content is stored as `BlocksContent`:

```ts
interface BlocksContent {
  format: 'blocks'
  version: 1
  blocks: Block[]
  /** derived plain text, handy for full-text search */
  text: string
}

interface Block {
  id: string
  type: BlockType // 'paragraph' | 'heading_1' | 'to_do' | 'table' | ...
  content: InlineSpan[] // rich text runs
  props: BlockProps // per-type props (checked, language, table, url, ...)
}
```

See [`docs/block-model.md`](../../docs/block-model.md) for the full shape.

## What's in here

| Module | Purpose |
| --- | --- |
| `types` | `Block`, `InlineSpan`, `TableData`, and the rest of the model |
| `ops` | Span/mark operations: split, slice, apply/toggle marks, `createBlock`, `detectDir` |
| `dom` | contentEditable caret & selection helpers (`getSelectionOffsets`, `setSelectionOffsets`, `focusStart`/`focusEnd`, `getRangeClientRects`, ...) |
| `selection` | Cross-block text-range selection (multi-block selecting, deleting, extracting) |
| `clipboard` | Custom clipboard MIME serialization for multi-block copy/paste |
| `normalize` | HTML → `Block[]` (paste from other apps), Tiptap JSON → `Block[]` |
| `html` | `Block[]`/spans ↔ HTML conversion |
| `serialize` | Plain-text export, heading anchors, list numbering, word count |
| `table` | Table cell/row/column operations: merge, unmerge, resize, style |
| `video-embed` | YouTube/Vimeo URL parsing + an allow-list for safe iframe embeds |
| `doc-heading-id` | Heading-to-slug helper used for anchor links |

## Example: headless HTML export

```ts
import { blocksToHtmlContent } from '@xproeditor/core'

const html = blocksToHtmlContent(myBlocksArray)
```

## License

MIT © XofDev
