import { useEffect, useMemo, useState } from 'react'
import {
  ProEditor,
  createBlock,
  type AITransport,
  type Block,
  type FetchBookmarkMetaFn,
} from '@xproeditor/react'

type ToolbarMode = 'fixed' | 'floating' | 'both'

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

function seed(): Block[] {
  return [
    createBlock('heading_1', { content: [{ text: 'XProEditor — React demo' }] }),
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
    createBlock('bulleted_list_item', {
      content: [{ text: 'Switch modes above: fixed toolbar, floating (Notion-like), or both.' }],
    }),
    createBlock('bulleted_list_item', {
      content: [{ text: 'Ask AI appears in / only when ai.transport is passed (wired in this demo).' }],
    }),
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

function applyDemoDark(dark: boolean) {
  document.documentElement.classList.toggle('xpe-dark', dark)
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
  document.body.style.background = dark ? '#111827' : '#ffffff'
  document.body.style.color = dark ? '#e5e7eb' : '#111827'
}

export default function App() {
  const [mode, setMode] = useState<ToolbarMode>('floating')
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('xpe-dark'))
  const [resetKey, setResetKey] = useState(0)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- resetKey is an intentional remount trigger, not a real dependency
  const initialBlocks = useMemo(() => seed(), [resetKey])
  const ai = useMemo(() => ({ transport: demoAITransport as AITransport }), [])

  useEffect(() => {
    applyDemoDark(dark)
  }, [dark])

  const chrome = {
    border: `1px solid ${dark ? '#374151' : '#e5e7eb'}`,
    background: dark ? '#1f2937' : '#fff',
    color: dark ? '#e5e7eb' : '#111827',
  } as const

  return (
    <div
      style={{ maxWidth: 860, margin: '0 auto', padding: 24, fontFamily: 'system-ui, sans-serif' }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}
      >
        <h1 style={{ fontSize: 15, fontWeight: 600, color: dark ? '#9ca3af' : '#6b7280' }}>
          @xproeditor/react demo
        </h1>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as ToolbarMode)}
            style={{
              height: 32,
              borderRadius: 8,
              border: chrome.border,
              background: chrome.background,
              color: chrome.color,
              padding: '0 8px',
              fontSize: 13,
            }}
          >
            <option value="fixed">Fixed toolbar</option>
            <option value="floating">Floating (Notion-like)</option>
            <option value="both">Both</option>
          </select>
          <button
            type="button"
            title={dark ? 'Switch to light theme' : 'Switch to dark theme'}
            aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
            style={{
              height: 32,
              padding: '0 12px',
              borderRadius: 8,
              border: chrome.border,
              background: chrome.background,
              color: chrome.color,
              fontSize: 13,
              cursor: 'pointer',
            }}
            onClick={() => setDark((v) => !v)}
          >
            {dark ? 'Light' : 'Dark'}
          </button>
          <button
            type="button"
            style={{
              height: 32,
              padding: '0 12px',
              borderRadius: 8,
              border: chrome.border,
              background: chrome.background,
              color: chrome.color,
              fontSize: 13,
              cursor: 'pointer',
            }}
            onClick={() => setResetKey((k) => k + 1)}
          >
            Reset
          </button>
        </div>
      </header>

      <div style={{ border: chrome.border, borderRadius: 12, overflow: 'hidden' }}>
        <ProEditor
          key={`${mode}-${resetKey}`}
          defaultValue={initialBlocks}
          toolbar={mode}
          editorDir="ltr"
          ai={ai}
          fetchBookmarkMeta={fetchBookmarkMeta}
        />
      </div>
    </div>
  )
}
