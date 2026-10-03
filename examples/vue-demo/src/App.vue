<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import {
  DocRenderer,
  ProEditor,
  createBlock,
  type AITransport,
  type Block,
  type DocumentStats,
  type FetchBookmarkMetaFn,
} from '@xproeditor/vue'

type ToolbarMode = 'fixed' | 'floating' | 'both' | 'none'
type Locale = 'en' | 'fa'
type Panel = 'none' | 'preview' | 'markdown' | 'html'

const mode = ref<ToolbarMode>('floating')
const locale = ref<Locale>('en')
const panel = ref<Panel>('none')
const stats = ref<DocumentStats | null>(null)
const snapshot = ref<Block[]>([])
const exported = ref('')
const editorRef = ref<InstanceType<typeof ProEditor> | null>(null)
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

function seedFa(): Block[] {
  return [
    createBlock('heading_1', { content: [{ text: 'ویرایشگر XProEditor — نسخه فارسی' }] }),
    createBlock('table_of_contents'),
    createBlock('paragraph', {
      content: [
        { text: 'این یک ویرایشگر بلوکی ' },
        { text: 'شبیه نوشن', marks: { bold: true } },
        { text: ' است. برای منوی دستورها ' },
        { text: '/', marks: { code: true } },
        { text: ' را تایپ کنید، یا متن را انتخاب کنید تا نوار ابزار ظاهر شود.' },
      ],
    }),
    createBlock('heading_2', { content: [{ text: 'میانبرهای مارک‌داون' }] }),
    createBlock('bulleted_list_item', {
      content: [{ text: '**پررنگ**، *مورب*، `کد` و ~~خط‌خورده~~ را مستقیم تایپ کنید.' }],
    }),
    createBlock('to_do', { content: [{ text: 'با [x] یک کار انجام‌شده بسازید' }], props: { checked: true } }),
    createBlock('heading_2', { content: [{ text: 'بلوک‌ها' }] }),
    createBlock('callout', {
      content: [{ text: 'جدول، تصویر، ویدیو، نشانک، جاسازی و کد همه پشتیبانی می‌شوند.' }],
    }),
    createBlock('paragraph', { content: [] }),
  ]
}

function seed(): Block[] {
  return [
    createBlock('heading_1', { content: [{ text: 'XProEditor — Vue demo' }] }),
    createBlock('table_of_contents'),
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
    createBlock('heading_2', { content: [{ text: 'Embeds' }] }),
    createBlock('embed', { props: { url: 'https://codepen.io/team/codepen/pen/PNaGbb', height: 320 } }),
    createBlock('heading_2', { content: [{ text: 'Links' }] }),
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
  blocks.value = locale.value === 'fa' ? seedFa() : seed()
  void nextTick(refresh)
}

function refresh() {
  const editor = editorRef.value
  if (!editor) return
  stats.value = editor.getStats()
  snapshot.value = editor.getBlocks()
  exported.value = panel.value === 'markdown' ? editor.getMarkdown() : panel.value === 'html' ? editor.getHTML() : ''
}

const dir = computed(() => (locale.value === 'fa' ? 'rtl' : 'ltr'))

watch(locale, reset)
watch(panel, refresh)
onMounted(() => void nextTick(refresh))

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
          <option value="none">No toolbar</option>
        </select>
        <select
          v-model="locale"
          aria-label="Language"
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
          <option value="en">English</option>
          <option value="fa">فارسی (RTL)</option>
        </select>
        <select
          v-model="panel"
          aria-label="Output panel"
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
          <option value="none">No preview</option>
          <option value="preview">Read-only preview</option>
          <option value="markdown">Markdown export</option>
          <option value="html">HTML export</option>
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
        ref="editorRef"
        :key="`${mode}-${locale}`"
        :model-value="blocks"
        :toolbar="mode"
        :locale="locale"
        :editor-dir="dir"
        :ai="ai"
        :fetch-bookmark-meta="fetchBookmarkMeta"
        @change="refresh"
        @upload-error="(error, file) => console.warn('Upload failed', file.name, error)"
      />
      <div style="padding: 16px 24px 32px" />
    </div>

    <p v-if="stats" :style="{ fontSize: '12px', color: dark ? '#9ca3af' : '#6b7280', margin: '8px 2px' }">
      {{ stats.words }} words · {{ stats.characters }} characters · {{ stats.readingTimeMinutes }} min read ·
      {{ stats.blocks }} blocks
    </p>

    <div
      v-if="panel === 'preview'"
      :dir="dir"
      :style="{ border: `1px solid ${dark ? '#374151' : '#e5e7eb'}`, borderRadius: '12px', padding: '24px', marginTop: '12px' }"
    >
      <DocRenderer :blocks="snapshot" :locale="locale" :editor-dir="dir" />
    </div>

    <pre
      v-if="panel === 'markdown' || panel === 'html'"
      :style="{
        border: `1px solid ${dark ? '#374151' : '#e5e7eb'}`,
        borderRadius: '12px',
        padding: '16px',
        marginTop: '12px',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        fontSize: '12px',
      }"
    >{{ exported }}</pre>
  </div>
</template>
