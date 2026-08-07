<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import {
  ProEditor,
  createBlock,
  type AITransport,
  type Block,
  type FetchBookmarkMetaFn,
} from '@xproeditor/vue'

type ToolbarMode = 'fixed' | 'floating' | 'both'

const mode = ref<ToolbarMode>('floating')
const dark = ref(document.documentElement.classList.contains('xpe-dark'))

/** Demo-only mock transport — replace with your LLM backend in production. */
const demoAITransport: AITransport = async function* (request) {
  const selection = request.context.selectionText.trim()
  const reply = selection
    ? `**Improved writing**\n\n${selection.replace(/\s+/g, ' ').trim()}`
    : [
        '## AI draft',
        '',
        `Prompt: ${request.prompt.slice(0, 120)}`,
        '',
        'Here is a short draft you can Accept or Discard:',
        '',
        '- Clear opening sentence',
        '- One supporting detail',
        '- A concrete next step',
      ].join('\n')

  for (const chunk of reply.match(/.{1,12}/gs) ?? [reply]) {
    yield { text: chunk }
    await new Promise((r) => setTimeout(r, 18))
  }
  yield { done: true }
}

/** Plain object (not a computed) so `ai.transport` is always visible to ProEditor props. */
const ai = { transport: demoAITransport }

function seed(): Block[] {
  return [
    createBlock('heading_1', { content: [{ text: 'XProEditor — Vue demo' }] }),
    createBlock('paragraph', {
      content: [
        { text: 'This is a ' },
        { text: 'Notion-like', marks: { bold: true } },
        { text: ' block editor. Try ' },
        { text: '/', marks: { code: true } },
        { text: ' for the slash menu, or ' },
        { text: '/ai', marks: { code: true } },
        { text: ' for Ask AI.' },
      ],
    }),
    createBlock('bulleted_list_item', { content: [{ text: 'Switch modes above: fixed toolbar, floating (Notion-like), or both.' }] }),
    createBlock('bulleted_list_item', { content: [{ text: 'Ask AI appears in / only when ai.transport is passed (wired in this demo).' }] }),
    createBlock('to_do', { content: [{ text: 'Select this line, then /ai → Improve writing' }] }),
    createBlock('toggle', {
      content: [{ text: 'Toggle list — click the chevron, or press Enter to nest content' }],
      props: { collapsed: false },
    }),
    createBlock('paragraph', {
      content: [{ text: 'Nested under the toggle (indent +1). Collapse the parent to hide me.' }],
      props: { indent: 1 },
    }),
    createBlock('toggle_heading_2', {
      content: [{ text: 'Toggle heading' }],
      props: { collapsed: false },
    }),
    createBlock('paragraph', {
      content: [{ text: 'Also try /toggle heading 1–3 in the slash menu.' }],
      props: { indent: 1 },
    }),
    createBlock('callout', {
      content: [{ text: 'Callouts, tables, images, videos, bookmarks, and code blocks are all supported.' }],
    }),
    createBlock('bookmark', {
      props: {
        url: 'https://github.com',
        title: 'GitHub',
        description: 'Where the world builds software',
        favicon: 'https://www.google.com/s2/favicons?domain=github.com&sz=64',
      },
    }),
    createBlock('paragraph', { content: [] }),
  ]
}

/** Demo metadata helper — hostname + public favicon; swap for your OG fetcher in production. */
const fetchBookmarkMeta: FetchBookmarkMetaFn = async (url) => {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./i, '')
    return {
      title: host,
      favicon: `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=64`,
    }
  } catch {
    return null
  }
}

const blocks = ref<Block[]>(seed())

function reset() {
  blocks.value = seed()
}

function applyDemoDark(isDark: boolean) {
  document.documentElement.classList.toggle('xpe-dark', isDark)
  document.documentElement.style.colorScheme = isDark ? 'dark' : 'light'
  document.body.style.background = isDark ? '#111827' : '#ffffff'
  document.body.style.color = isDark ? '#e5e7eb' : '#111827'
}

onMounted(() => applyDemoDark(dark.value))
watch(dark, (v) => applyDemoDark(v))
</script>

<template>
  <div style="max-width: 860px; margin: 0 auto; padding: 24px; font-family: system-ui, sans-serif">
    <header style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px">
      <h1
        :style="{
          fontSize: '15px',
          fontWeight: 600,
          color: dark ? '#9ca3af' : '#6b7280',
        }"
      >
        @xproeditor/vue demo
      </h1>
      <div style="display: flex; gap: 6px; align-items: center">
        <select
          v-model="mode"
          :style="{
            height: '32px',
            borderRadius: '8px',
            border: `1px solid ${dark ? '#374151' : '#e5e7eb'}`,
            background: dark ? '#1f2937' : '#fff',
            color: dark ? '#e5e7eb' : '#111827',
            padding: '0 8px',
            fontSize: '13px',
          }"
        >
          <option value="fixed">Fixed toolbar</option>
          <option value="floating">Floating (Notion-like)</option>
          <option value="both">Both</option>
        </select>
        <button
          type="button"
          :title="dark ? 'Switch to light theme' : 'Switch to dark theme'"
          :aria-label="dark ? 'Switch to light theme' : 'Switch to dark theme'"
          :style="{
            height: '32px',
            padding: '0 12px',
            borderRadius: '8px',
            border: `1px solid ${dark ? '#374151' : '#e5e7eb'}`,
            background: dark ? '#1f2937' : '#fff',
            color: dark ? '#e5e7eb' : '#111827',
            fontSize: '13px',
            cursor: 'pointer',
          }"
          @click="dark = !dark"
        >
          {{ dark ? 'Light' : 'Dark' }}
        </button>
        <button
          type="button"
          :style="{
            height: '32px',
            padding: '0 12px',
            borderRadius: '8px',
            border: `1px solid ${dark ? '#374151' : '#e5e7eb'}`,
            background: dark ? '#1f2937' : '#fff',
            color: dark ? '#e5e7eb' : '#111827',
            fontSize: '13px',
            cursor: 'pointer',
          }"
          @click="reset"
        >
          Reset
        </button>
      </div>
    </header>

    <div
      :style="{
        border: `1px solid ${dark ? '#374151' : '#e5e7eb'}`,
        borderRadius: '12px',
        overflow: 'hidden',
      }"
    >
      <ProEditor
        :key="mode"
        :model-value="blocks"
        :toolbar="mode"
        :ai="ai"
        :fetch-bookmark-meta="fetchBookmarkMeta"
        editor-dir="ltr"
      />
      <div style="padding: 16px 24px 32px" />
    </div>
  </div>
</template>
