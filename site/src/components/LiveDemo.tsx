import { useMemo, useState } from 'react'
import { ProEditor, createBlock, type AITransport, type Block } from '@xproeditor/react'

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
        'Here is a short draft you can Accept or Reject:',
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
    createBlock('heading_1', { content: [{ text: 'Tour the editor' }] }),
    createBlock('paragraph', {
      content: [
        { text: 'This is the real ' },
        { text: '@xproeditor/react', marks: { code: true } },
        { text: ' package — not a mockup. Try the tips below the toolbar.' },
      ],
    }),
    createBlock('callout', {
      content: [
        {
          text: 'Type / for blocks · /ai for Ask AI · paste Markdown · drag-select across blocks to copy or delete.',
        },
      ],
      props: { icon: '✨', color: '#eff6ff' },
    }),
    createBlock('heading_2', { content: [{ text: 'Lists & tasks' }] }),
    createBlock('bulleted_list_item', { content: [{ text: 'Headings, quotes, callouts, toggles' }] }),
    createBlock('numbered_list_item', { content: [{ text: 'Tables with merge, borders, and fills' }] }),
    createBlock('to_do', {
      content: [{ text: 'Markdown paste and multi-block clipboard' }],
      props: { checked: true },
    }),
    createBlock('to_do', {
      content: [{ text: 'Try Ask AI on this line (select it, then /ai)' }],
      props: { checked: false },
    }),
    createBlock('heading_2', { content: [{ text: 'Code & CTA' }] }),
    createBlock('code', {
      props: {
        language: 'tsx',
        code: `<ProEditor\n  defaultValue={blocks}\n  toolbar="floating"\n  ai={{ transport }}\n/>`,
      },
    }),
    createBlock('button', {
      content: [{ text: 'Star on GitHub' }],
      props: {
        url: 'https://github.com/xofdev/xproeditor',
        buttonStyle: 'primary',
        color: '#111827',
        align: 'left',
        openInNewTab: true,
      },
    }),
    createBlock('quote', {
      content: [{ text: 'Click the link icon beside the button to change label, URL, color, and style.' }],
    }),
    createBlock('divider'),
    createBlock('paragraph', {
      content: [{ text: 'Empty line — type /table, /image, or paste:' }],
    }),
    createBlock('paragraph', {
      content: [
        {
          text: '# Hello\n- from Markdown\n- paste me here',
          marks: { code: true },
        },
      ],
    }),
    createBlock('paragraph', { content: [] }),
  ]
}

const MODES: { value: ToolbarMode; label: string }[] = [
  { value: 'floating', label: 'Floating' },
  { value: 'fixed', label: 'Fixed toolbar' },
  { value: 'both', label: 'Both' },
]

const TRY_TIPS = [
  { label: 'Slash menu', detail: 'Type / on an empty line' },
  { label: 'Ask AI', detail: 'Type /ai or use the toolbar sparkles' },
  { label: 'Markdown', detail: 'Copy the code snippet above and paste' },
  { label: 'Multi-select', detail: 'Drag across several blocks, then ⌘C / ⌘X / Delete' },
  { label: 'Button', detail: 'Click the link icon next to the CTA' },
  { label: 'Turn into', detail: 'Select text → Turn into → Button / Callout' },
]

type EditorTheme = 'bento' | 'default'

export function LiveDemo() {
  const [mode, setMode] = useState<ToolbarMode>('floating')
  const [editorTheme, setEditorTheme] = useState<EditorTheme>('bento')
  const [resetKey, setResetKey] = useState(0)
  const [activeTip, setActiveTip] = useState(0)
  const initialBlocks = useMemo(() => seed(), [resetKey])
  const ai = useMemo(() => ({ transport: demoAITransport }), [])

  return (
    <section id="demo">
      <div className="container">
        <div className="section-head">
          <span className="eyebrow">Live demo</span>
          <h2>Not a screenshot. Actually try it.</h2>
          <p>
            Same packages you install on npm — with Ask AI wired to a mock transport so you can
            exercise Accept / Reject without an API key.
          </p>
        </div>

        <div className="demo-tips" role="list" aria-label="Things to try">
          {TRY_TIPS.map((tip, i) => (
            <button
              key={tip.label}
              type="button"
              role="listitem"
              className={`demo-tip${activeTip === i ? ' active' : ''}`}
              onClick={() => setActiveTip(i)}
            >
              <span className="demo-tip-label">{tip.label}</span>
              {activeTip === i && <span className="demo-tip-detail">{tip.detail}</span>}
            </button>
          ))}
        </div>

        <div className="demo-frame">
          <div className="demo-toolbar">
            <span className="demo-toolbar-dots" aria-hidden>
              <span />
              <span />
              <span />
            </span>
            <div className="demo-toolbar-controls">
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
              <div className="mode-switch" role="tablist" aria-label="Editor theme">
                {(['bento', 'default'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={editorTheme === t ? 'active' : ''}
                    onClick={() => setEditorTheme(t)}
                  >
                    {t === 'bento' ? 'Bento theme' : 'Default'}
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
          </div>
          <div className={`demo-body${editorTheme === 'bento' ? ' editor-theme-bento' : ''}`}>
            <ProEditor
              key={`${mode}-${resetKey}`}
              defaultValue={initialBlocks}
              toolbar={mode}
              editorDir="ltr"
              ai={ai}
            />
          </div>
        </div>
        <p className="demo-hint">
          Active tip: <strong>{TRY_TIPS[activeTip].label}</strong> — {TRY_TIPS[activeTip].detail}.
          Theme switch only flips <code>--xpe-*</code> variables.
        </p>
      </div>
    </section>
  )
}
