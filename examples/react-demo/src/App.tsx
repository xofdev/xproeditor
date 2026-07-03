import { useMemo, useState } from 'react'
import { ProEditor, createBlock, type Block } from '@xproeditor/react'

type ToolbarMode = 'fixed' | 'floating' | 'both'

function seed(): Block[] {
  return [
    createBlock('heading_1', { content: [{ text: 'XProEditor — React demo' }] }),
    createBlock('paragraph', {
      content: [
        { text: 'This is a ' },
        { text: 'Notion-like', marks: { bold: true } },
        { text: ' block editor. Try ' },
        { text: '/', marks: { code: true } },
        { text: ' for the slash menu, or select text for the floating toolbar.' },
      ],
    }),
    createBlock('bulleted_list_item', {
      content: [{ text: 'Switch modes above: fixed toolbar, floating (Notion-like), or both.' }],
    }),
    createBlock('bulleted_list_item', {
      content: [{ text: 'Everything here is powered by @xproeditor/react.' }],
    }),
    createBlock('to_do', { content: [{ text: 'Try checking this off' }] }),
    createBlock('callout', {
      content: [{ text: 'Callouts, tables, images, videos, and code blocks are all supported.' }],
    }),
    createBlock('paragraph', { content: [] }),
  ]
}

export default function App() {
  const [mode, setMode] = useState<ToolbarMode>('floating')
  const [resetKey, setResetKey] = useState(0)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- resetKey is an intentional remount trigger, not a real dependency
  const initialBlocks = useMemo(() => seed(), [resetKey])

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
        <h1 style={{ fontSize: 15, fontWeight: 600, color: '#6b7280' }}>@xproeditor/react demo</h1>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as ToolbarMode)}
            style={{
              height: 32,
              borderRadius: 8,
              border: '1px solid #e5e7eb',
              padding: '0 8px',
              fontSize: 13,
            }}
          >
            <option value="fixed">Fixed toolbar</option>
            <option value="floating">Floating (Notion-like)</option>
            <option value="both">Both</option>
          </select>
          <button
            style={{
              height: 32,
              padding: '0 12px',
              borderRadius: 8,
              border: '1px solid #e5e7eb',
              background: '#fff',
              fontSize: 13,
              cursor: 'pointer',
            }}
            onClick={() => setResetKey((k) => k + 1)}
          >
            Reset
          </button>
        </div>
      </header>

      <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
        <ProEditor
          key={`${mode}-${resetKey}`}
          defaultValue={initialBlocks}
          toolbar={mode}
          editorDir="ltr"
        />
      </div>
    </div>
  )
}
