<script setup lang="ts">
import hljs from 'highlight.js/lib/common'
import { ChevronRight, Link as LinkIcon, X } from 'lucide-vue-next'
import { ref, computed } from 'vue'
import {
  computeListNumbering,
  escapeHtml,
  formatFileSize,
  headingAnchorIds,
  isAllowedEmbedUrl,
  normalizeTableData,
  resolveBlockDirection,
  spansToHtml,
  tableCellStyle,
  tableWrapperStyle,
} from '@xproeditor/core'
import type { Block, TableCell } from '@xproeditor/core'
import { IconValueDisplay } from '../ui'

const props = defineProps<{
  blocks: Block[]
  /** Fallback direction when block dir is auto and content is empty. */
  editorDir?: 'ltr' | 'rtl'
}>()

function blockDirection(block: Block): 'ltr' | 'rtl' {
  return resolveBlockDirection(block, props.editorDir ?? 'ltr')
}

function tableForBlock(block: Block) {
  return normalizeTableData(block.props.table)
}

function renderCellStyle(cell: TableCell, rowIdx: number, hasHeader: boolean, block: Block) {
  const table = tableForBlock(block)

  return tableCellStyle(cell, rowIdx, hasHeader, table.style)
}

// Toggle collapse state (index-keyed for SSR-stable rendering)
const toggleOverrides = ref<Record<number, boolean>>({})

function isCollapsed(idx: number, block: Block): boolean {
  return toggleOverrides.value[idx] ?? (block.props.collapsed ?? false)
}

interface VisibleEntry {
  block: Block
  idx: number
}

const visible = computed<VisibleEntry[]>(() => {
  const out: VisibleEntry[] = []
  let hideDeeperThan: number | null = null
  props.blocks.forEach((block, idx) => {
    const ind = block.props.indent ?? 0

    if (hideDeeperThan !== null) {
      if (ind > hideDeeperThan) {
return
}

      hideDeeperThan = null
    }

    out.push({ block, idx })

    if (block.type === 'toggle' && isCollapsed(idx, block)) {
hideDeeperThan = ind
}
  })

  return out
})

const numbering = computed(() => computeListNumbering(visible.value.map(v => v.block)))
const anchors = computed(() => headingAnchorIds(props.blocks))

function headingTag(type: string): string {
  return type === 'heading_1' ? 'h2' : type === 'heading_2' ? 'h3' : 'h4'
}

function inlineHtml(block: Block): string {
  return spansToHtml(block.content)
}

function highlightCode(code: string, language?: string): string {
  try {
    if (language && language !== 'plaintext' && hljs.getLanguage(language)) {
      return hljs.highlight(code, { language }).value
    }
  } catch { /* fall through */ }

  return escapeHtml(code)
}

// Heading anchor copy
const copiedAnchor = ref<string | null>(null)

function copyAnchor(id: string) {
  const url = `${window.location.origin}${window.location.pathname}#${id}`
  navigator.clipboard?.writeText(url)
  copiedAnchor.value = id
  setTimeout(() => {
 copiedAnchor.value = null 
}, 1500)
}

// Image lightbox
const lightboxUrl = ref<string | null>(null)
function safeVideoEmbedUrl(block: Block): string {
  const url = block.props.url ?? ''

  if (block.props.provider === 'youtube' || block.props.provider === 'vimeo') {
    return isAllowedEmbedUrl(url) ? url : ''
  }

  return url
}
</script>

<template>
  <div class="doc-blocks" dir="auto">
    <template v-for="{ block, idx } in visible" :key="idx">
      <!-- Headings -->
      <component
        :is="headingTag(block.type)"
        v-if="block.type.startsWith('heading')"
        :id="anchors.get(block.id)"
        class="db-heading group"
        :class="`db-${block.type}`"
        dir="auto"
      >
        <span v-html="inlineHtml(block)" />
        <button
          v-if="anchors.get(block.id)"
          class="db-anchor-btn"
          :title="copiedAnchor === anchors.get(block.id) ? 'Copied!' : 'Copy link'"
          @click="copyAnchor(anchors.get(block.id)!)"
        >
          <LinkIcon class="w-3.5 h-3.5" />
        </button>
      </component>

      <!-- Paragraph -->
      <p
        v-else-if="block.type === 'paragraph'"
        class="db-p"
        dir="auto"
        :style="{ paddingInlineStart: `${(block.props.indent ?? 0) * 24}px`, textAlign: block.props.align }"
        v-html="inlineHtml(block)"
      />

      <!-- List items -->
      <div
        v-else-if="block.type === 'bulleted_list_item' || block.type === 'numbered_list_item'"
        class="db-li"
        :dir="blockDirection(block)"
        :style="{ paddingInlineStart: `${(block.props.indent ?? 0) * 24}px` }"
      >
        <span class="db-li-marker" :class="{ 'tabular-nums': block.type === 'numbered_list_item' }">
          {{ block.type === 'bulleted_list_item' ? '•' : `${numbering.get(block.id) ?? 1}.` }}
        </span>
        <span class="db-li-content" v-html="inlineHtml(block)" />
      </div>

      <!-- To-do -->
      <div
        v-else-if="block.type === 'to_do'"
        class="db-li"
        :dir="blockDirection(block)"
        :style="{ paddingInlineStart: `${(block.props.indent ?? 0) * 24}px` }"
      >
        <span
          class="db-todo-box"
          :class="block.props.checked ? 'db-todo-checked' : ''"
        >
          <svg v-if="block.props.checked" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 13l4 4L19 7" /></svg>
        </span>
        <span
          class="db-li-content"
          :class="{ 'line-through opacity-50': block.props.checked }"
          v-html="inlineHtml(block)"
        />
      </div>

      <!-- Toggle -->
      <div
        v-else-if="block.type === 'toggle'"
        class="db-li db-toggle"
        :dir="blockDirection(block)"
        :style="{ paddingInlineStart: `${(block.props.indent ?? 0) * 24}px` }"
        role="button"
        @click="toggleOverrides[idx] = !isCollapsed(idx, block)"
      >
        <span
          class="db-toggle-chevron"
          :class="{
            'rotate-90': !isCollapsed(idx, block),
            'db-toggle-chevron--rtl': blockDirection(block) === 'rtl',
          }"
        >
          <ChevronRight class="w-4 h-4" />
        </span>
        <span class="db-li-content font-medium" v-html="inlineHtml(block)" />
      </div>

      <!-- Quote -->
      <blockquote
        v-else-if="block.type === 'quote'"
        class="db-quote"
        dir="auto"
        :style="{ marginInlineStart: `${(block.props.indent ?? 0) * 24}px` }"
        v-html="inlineHtml(block)"
      />

      <!-- Callout -->
      <div
        v-else-if="block.type === 'callout'"
        class="db-callout"
        :dir="blockDirection(block)"
        :style="{ marginInlineStart: `${(block.props.indent ?? 0) * 24}px`, background: block.props.color || undefined }"
      >
        <span class="db-callout-icon">
          <IconValueDisplay :icon="block.props.icon ?? '💡'" class="text-lg" />
        </span>
        <span class="db-li-content" v-html="inlineHtml(block)" />
      </div>

      <!-- Code -->
      <div v-else-if="block.type === 'code'" class="db-code" dir="ltr">
        <div class="db-code-header">
          <span>{{ block.props.language ?? 'plaintext' }}</span>
        </div>
        <pre><code class="hljs" v-html="highlightCode(block.props.code ?? '', block.props.language)" /></pre>
      </div>

      <!-- Divider -->
      <hr v-else-if="block.type === 'divider'" class="db-divider" />

      <!-- Image -->
      <figure v-else-if="block.type === 'image' && block.props.url" class="db-figure">
        <img
          :src="block.props.url"
          :alt="block.props.caption || ''"
          :style="{ width: `${block.props.width ?? 100}%` }"
          class="db-img"
          loading="lazy"
          @click="lightboxUrl = block.props.url ?? null"
        />
        <figcaption v-if="block.props.caption" class="db-caption">{{ block.props.caption }}</figcaption>
      </figure>

      <!-- Video -->
      <figure v-else-if="block.type === 'video' && block.props.url" class="db-figure">
        <div
          class="db-video-wrap overflow-hidden rounded-xl bg-black"
          :style="{ width: `${block.props.width ?? 100}%` }"
        >
          <iframe
            v-if="(block.props.provider === 'youtube' || block.props.provider === 'vimeo') && safeVideoEmbedUrl(block)"
            :src="safeVideoEmbedUrl(block)"
            class="aspect-video w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen
            title="Embedded video"
          />
          <video
            v-else
            :src="block.props.url"
            class="aspect-video w-full"
            controls
            playsinline
          />
        </div>
        <figcaption v-if="block.props.caption" class="db-caption">{{ block.props.caption }}</figcaption>
      </figure>

      <!-- Audio -->
      <figure v-else-if="block.type === 'audio' && block.props.url" class="db-figure">
        <div class="db-audio-wrap">
          <div v-if="block.props.name" class="db-audio-name">{{ block.props.name }}</div>
          <audio :src="block.props.url" controls preload="metadata" class="w-full" />
        </div>
        <figcaption v-if="block.props.caption" class="db-caption">{{ block.props.caption }}</figcaption>
      </figure>

      <!-- File -->
      <a
        v-else-if="block.type === 'file' && block.props.url"
        :href="block.props.url"
        :download="block.props.name ?? true"
        class="db-file"
      >
        <span class="db-file-name">{{ block.props.name || 'Download file' }}</span>
        <span v-if="block.props.size" class="db-file-size">{{ formatFileSize(block.props.size) }}</span>
      </a>

      <!-- Button -->
      <div
        v-else-if="block.type === 'button'"
        class="db-button-row"
        :style="{ justifyContent: block.props.align === 'center' ? 'center' : block.props.align === 'right' ? 'flex-end' : 'flex-start' }"
      >
        <a
          v-if="block.props.url"
          :href="block.props.url"
          :target="block.props.openInNewTab ? '_blank' : undefined"
          :rel="block.props.openInNewTab ? 'noopener noreferrer' : undefined"
          class="db-button"
          :class="`db-button--${block.props.buttonStyle ?? 'primary'}`"
          v-html="inlineHtml(block) || 'Button'"
        />
        <span
          v-else
          class="db-button"
          :class="`db-button--${block.props.buttonStyle ?? 'primary'}`"
          v-html="inlineHtml(block) || 'Button'"
        />
      </div>

      <!-- Table -->
      <div
        v-else-if="block.type === 'table' && block.props.table"
        class="db-table-wrap"
        dir="auto"
        :style="tableWrapperStyle(tableForBlock(block).style, tableForBlock(block).width)"
      >
        <table class="db-table">
          <tbody>
            <tr v-for="(row, rIdx) in tableForBlock(block).rows" :key="rIdx">
              <template v-for="(cell, cIdx) in row" :key="cIdx">
                <th
                  v-if="!cell.hidden && rIdx === 0 && tableForBlock(block).hasHeader"
                  :colspan="cell.colspan && cell.colspan > 1 ? cell.colspan : undefined"
                  :rowspan="cell.rowspan && cell.rowspan > 1 ? cell.rowspan : undefined"
                  :style="renderCellStyle(cell, rIdx, tableForBlock(block).hasHeader, block)"
                  dir="auto"
                  v-html="spansToHtml(cell.content)"
                />
                <td
                  v-else-if="!cell.hidden"
                  :colspan="cell.colspan && cell.colspan > 1 ? cell.colspan : undefined"
                  :rowspan="cell.rowspan && cell.rowspan > 1 ? cell.rowspan : undefined"
                  :style="renderCellStyle(cell, rIdx, tableForBlock(block).hasHeader, block)"
                  dir="auto"
                  v-html="spansToHtml(cell.content)"
                />
              </template>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- Lightbox -->
    <Teleport to="body">
      <div
        v-if="lightboxUrl"
        class="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-6 cursor-zoom-out"
        @click="lightboxUrl = null"
      >
        <img :src="lightboxUrl" class="max-w-full max-h-full rounded-lg shadow-2xl" alt="" />
        <button class="absolute top-4 end-4 text-white/80 hover:text-white">
          <X class="w-6 h-6" />
        </button>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.doc-blocks {
  font-size: 1rem;
  line-height: 1.8;
  color: var(--xpe-foreground);
  word-break: break-word;
}

/* --- Headings --- */
.db-heading {
  position: relative;
  scroll-margin-top: 90px;
  letter-spacing: -0.015em;
  color: var(--xpe-foreground);
}
.db-heading_1 {
  font-size: 1.875em;
  font-weight: 800;
  line-height: 1.2;
  margin-top: 1.6em;
  margin-bottom: 0.55em;
}
.db-heading_2 {
  font-size: 1.4em;
  font-weight: 700;
  line-height: 1.3;
  margin-top: 1.5em;
  margin-bottom: 0.5em;
  padding-bottom: 0.25em;
  border-bottom: 1px solid var(--xpe-border);
}
.db-heading_3 {
  font-size: 1.15em;
  font-weight: 650;
  line-height: 1.4;
  margin-top: 1.3em;
  margin-bottom: 0.4em;
}
.db-heading:first-child { margin-top: 0; }
.db-anchor-btn {
  display: inline-flex;
  vertical-align: middle;
  margin-inline-start: 8px;
  padding: 3px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--xpe-muted-foreground);
  opacity: 0;
  cursor: pointer;
  transition: opacity 0.15s, background 0.15s;
}
.db-heading:hover .db-anchor-btn { opacity: 0.7; }
.db-anchor-btn:hover { opacity: 1 !important; background: var(--xpe-muted); }

/* --- Paragraph --- */
.db-p {
  margin: 0 0 0.9em;
}
.db-p:empty { min-height: 1.2em; }

/* --- List items --- */
.db-li {
  display: flex;
  align-items: flex-start;
  gap: 0.6em;
  margin-bottom: 0.35em;
}
.db-li-marker {
  flex-shrink: 0;
  min-width: 1.1em;
  text-align: center;
  line-height: 1.8;
  color: var(--xpe-foreground);
}
.db-li-content { flex: 1; min-width: 0; }

.db-todo-box {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  margin-top: 0.45em;
  border-radius: 4px;
  border: 1.5px solid var(--xpe-border);
}
.db-todo-checked {
  background: var(--xpe-primary);
  border-color: var(--xpe-primary);
  color: var(--xpe-primary-foreground);
}
.db-todo-box svg { width: 10px; height: 10px; }

.db-toggle { cursor: pointer; user-select: none; }
.db-toggle-chevron {
  flex-shrink: 0;
  display: inline-flex;
  margin-top: 0.4em;
  color: var(--xpe-muted-foreground);
  transition: transform 0.15s;
}
.db-toggle-chevron--rtl {
  transform: scaleX(-1);
}
.db-toggle-chevron--rtl.rotate-90 {
  transform: scaleX(-1) rotate(90deg);
}

/* --- Quote --- */
.db-quote {
  border-inline-start: 3px solid var(--xpe-primary);
  padding: 0.4em 1.1em;
  margin: 1em 0;
  color: var(--xpe-muted-foreground);
  font-style: italic;
  background: var(--xpe-muted);
  border-radius: 0.5rem;
}

/* --- Callout --- */
.db-callout {
  display: flex;
  align-items: flex-start;
  gap: 0.7em;
  padding: 0.85em 1.1em;
  margin: 1em 0;
  border-radius: 0.75rem;
  border: 1px solid var(--xpe-border);
  background: var(--xpe-muted);
}
:global(.dark) .db-callout { background: var(--xpe-muted) !important; }
.db-callout-icon { font-size: 1.15em; line-height: 1.5; }

/* --- Code --- */
.db-code {
  margin: 1.25em 0;
  border-radius: 0.75rem;
  overflow: hidden;
  border: 1px solid var(--xpe-border);
}
.db-code-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.4em 1em;
  background: #16182a;
  color: #8b8fa3;
  font-size: 0.72em;
  font-family: var(--xpe-font-mono, ui-monospace, monospace);
  text-transform: lowercase;
}
.db-code pre {
  margin: 0;
  padding: 1.1em 1.25em;
  background: #1e1e2e;
  color: #cdd6f4;
  overflow-x: auto;
  font-size: 0.85em;
  line-height: 1.7;
}
.db-code code {
  background: none;
  padding: 0;
  border: none;
  font-family: var(--xpe-font-mono, ui-monospace, monospace);
}

/* --- Divider --- */
.db-divider {
  border: none;
  border-top: 1px solid var(--xpe-border);
  margin: 1.8em 0;
}

/* --- Image --- */
.db-figure { margin: 1.4em 0; }
.db-img {
  border-radius: 0.75rem;
  cursor: zoom-in;
  display: block;
  margin: 0 auto;
  height: auto;
  max-width: 100%;
}
.db-caption {
  margin-top: 0.5em;
  text-align: center;
  font-size: 0.8em;
  color: var(--xpe-muted-foreground);
}

/* --- Audio / file --- */
.db-audio-wrap {
  background: var(--xpe-muted);
  border: 1px solid var(--xpe-border);
  border-radius: var(--xpe-radius, 0.75rem);
  padding: 0.75rem;
}
.db-audio-wrap audio { width: 100%; }
.db-audio-name {
  font-size: 0.85em;
  font-weight: 500;
  margin-bottom: 0.5em;
  color: var(--xpe-foreground);
}
.db-file {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin: 0.75em 0;
  padding: 0.65rem 0.9rem;
  background: var(--xpe-muted);
  border: 1px solid var(--xpe-border);
  border-radius: var(--xpe-radius, 0.75rem);
  text-decoration: none;
  color: var(--xpe-foreground);
}
.db-file:hover { border-color: var(--xpe-primary); }
.db-file-name { font-size: 0.9em; font-weight: 500; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.db-file-size { font-size: 0.8em; color: var(--xpe-muted-foreground); flex-shrink: 0; }

/* --- Button --- */
.db-button-row { display: flex; margin: 0.75em 0; }
.db-button { display: inline-flex; align-items: center; justify-content: center; min-width: 64px; padding: 0.5em 1.1em; border-radius: var(--xpe-radius, 0.6rem); font-size: 0.9em; font-weight: 600; text-decoration: none; cursor: pointer; border: 1px solid transparent; transition: opacity 0.12s; }
.db-button:hover { opacity: 0.88; }
.db-button--primary { background: var(--xpe-primary); color: var(--xpe-primary-foreground); }
.db-button--outline { background: transparent; border-color: var(--xpe-border); color: var(--xpe-foreground); }
.db-button--ghost { background: var(--xpe-muted); color: var(--xpe-foreground); }

/* --- Table --- */
.db-table-wrap { overflow-x: auto; margin: 1.25em 0; }
.db-table {
  width: 100%;
  border-collapse: collapse;
  border-radius: 0.5rem;
  overflow: hidden;
}
.db-table th,
.db-table td {
  padding: 0.55em 1em;
  text-align: start;
  vertical-align: top;
  line-height: 1.6;
  font-size: 0.9em;
}
.db-table th {
  font-weight: 600;
}

/* --- Inline marks (from spansToHtml) --- */
.doc-blocks :deep(strong) { font-weight: 700; }
.doc-blocks :deep(s) { text-decoration: line-through; }
.doc-blocks :deep(u) { text-decoration: underline; text-underline-offset: 3px; }
.doc-blocks :deep(code) {
  background: var(--xpe-muted);
  border: 1px solid var(--xpe-border);
  border-radius: 0.375rem;
  padding: 0.12em 0.4em;
  font-size: 0.85em;
  font-family: var(--xpe-font-mono, ui-monospace, monospace);
  font-weight: 500;
}
.doc-blocks :deep(a) {
  color: var(--xpe-primary);
  text-decoration: underline;
  text-underline-offset: 3px;
  text-decoration-thickness: 1px;
}
.doc-blocks :deep(a:hover) { opacity: 0.8; }

/* --- Syntax highlighting (Catppuccin-ish, matches previous theme) --- */
.db-code :deep(.hljs-comment), .db-code :deep(.hljs-quote) { color: #6c7086; font-style: italic; }
.db-code :deep(.hljs-keyword), .db-code :deep(.hljs-selector-tag), .db-code :deep(.hljs-built_in) { color: #cba6f7; }
.db-code :deep(.hljs-string), .db-code :deep(.hljs-doctag), .db-code :deep(.hljs-title), .db-code :deep(.hljs-section), .db-code :deep(.hljs-attribute) { color: #a6e3a1; }
.db-code :deep(.hljs-number), .db-code :deep(.hljs-literal) { color: #fab387; }
.db-code :deep(.hljs-type), .db-code :deep(.hljs-class .hljs-title) { color: #f9e2af; }
.db-code :deep(.hljs-function), .db-code :deep(.hljs-function .hljs-title) { color: #89b4fa; }
.db-code :deep(.hljs-params) { color: #f2cdcd; }
.db-code :deep(.hljs-variable), .db-code :deep(.hljs-template-variable) { color: #f5c2e7; }
.db-code :deep(.hljs-tag), .db-code :deep(.hljs-name) { color: #89b4fa; }
.db-code :deep(.hljs-attr) { color: #f9e2af; }
.db-code :deep(.hljs-symbol), .db-code :deep(.hljs-bullet), .db-code :deep(.hljs-deletion) { color: #f38ba8; }
.db-code :deep(.hljs-meta) { color: #fab387; }
.db-code :deep(.hljs-addition) { color: #a6e3a1; }
.db-code :deep(.hljs-emphasis) { font-style: italic; }
.db-code :deep(.hljs-strong) { font-weight: 700; }
</style>
