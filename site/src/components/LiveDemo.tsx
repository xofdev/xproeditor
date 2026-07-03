import { useMemo, useState } from 'react'
import { ProEditor, createBlock, type Block } from '@xproeditor/react'

type ToolbarMode = 'fixed' | 'floating' | 'both'

function seed(): Block[] {
  return [
    createBlock('heading_1', { content: [{ text: 'Welcome to XProEditor' }] }),
    createBlock('paragraph', {
      content: [
        { text: 'This editor is ' },
        { text: 'really running', marks: { bold: true } },
        { text: ' right here in the page — try selecting this text, or type ' },
        { text: '/', marks: { code: true } },
        { text: ' on an empty line below.' },
      ],
    }),
    createBlock('bulleted_list_item', { content: [{ text: 'Headings, lists, to-dos, toggles, quotes' }] }),
    createBlock('bulleted_list_item', { content: [{ text: 'Tables, images, video, and code blocks' }] }),
    createBlock('to_do', { content: [{ text: 'Undo/redo, markdown shortcuts, rich clipboard' }], props: { checked: true } }),
    createBlock('callout', { content: [{ text: 'Switch modes above — fixed toolbar or Notion-like floating.' }] }),
    createBlock('paragraph', { content: [] }),
  ]
}

const MODES: { value: ToolbarMode; label: string }[] = [
  { value: 'floating', label: 'Floating' },
  { value: 'fixed', label: 'Fixed toolbar' },
  { value: 'both', label: 'Both' },
]

export function LiveDemo() {
  const [mode, setMode] = useState<ToolbarMode>('floating')
  const [resetKey, setResetKey] = useState(0)
  const initialBlocks = useMemo(() => seed(), [resetKey])

  return (
    <section id="demo">
      <div className="container">
        <div className="section-head">
          <span className="eyebrow">Live demo</span>
          <h2>Not a screenshot. Actually try it.</h2>
          <p>The exact same package you'd install, running client-side on this page.</p>
        </div>

        <div className="demo-frame">
          <div className="demo-toolbar">
            <span className="demo-toolbar-dots">
              <span />
              <span />
              <span />
            </span>
            <div className="mode-switch" role="tablist" aria-label="Toolbar mode">
              {MODES.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  className={mode === m.value ? 'active' : ''}
                  onClick={() => setMode(m.value)}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="nav-link"
              style={{ fontSize: 12 }}
              onClick={() => setResetKey((k) => k + 1)}
            >
              Reset
            </button>
          </div>
          <div className="demo-body">
            <ProEditor key={`${mode}-${resetKey}`} defaultValue={initialBlocks} toolbar={mode} editorDir="ltr" />
          </div>
        </div>
        <p className="demo-hint">
          Press <code>/</code> for the block menu, or select text for the floating toolbar.
        </p>
      </div>
    </section>
  )
}
