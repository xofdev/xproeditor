import { useMemo, useState } from 'react'
import {
  BookOpen,
  FilePenLine,
  ListChecks,
  Newspaper,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'
import { DocRenderer, ProEditor, createBlock, type AITransport, type Block } from '@xproeditor/react'

type UseCaseId = 'blog' | 'docs' | 'changelog' | 'notes'
type ViewMode = 'edit' | 'publish'

type UseCase = {
  id: UseCaseId
  icon: LucideIcon
  title: string
  blurb: string
  audience: string
  seed: () => Block[]
}

const demoAITransport: AITransport = async function* (request) {
  const selection = request.context.selectionText.trim()
  const reply = selection
    ? `**Improved for publication**\n\n${selection.replace(/\s+/g, ' ').trim()}`
    : `## Suggested section\n\n${request.prompt.slice(0, 160)}\n\n- Key point\n- Supporting detail\n- Call to action`
  for (const chunk of reply.match(/.{1,14}/gs) ?? [reply]) {
    yield { text: chunk }
    await new Promise((r) => setTimeout(r, 12))
  }
  yield { done: true }
}

function blogSeed(): Block[] {
  return [
    createBlock('heading_1', { content: [{ text: 'Shipping a Notion-like editor in a weekend' }] }),
    createBlock('paragraph', {
      content: [
        { text: 'Most teams do not need another text box — they need ' },
        { text: 'structured content', marks: { bold: true } },
        { text: ' that looks right on the public site and still feels fast to write.' },
      ],
    }),
    createBlock('callout', {
      content: [{ text: 'Write in the editor → publish with DocRenderer. Same Block[] JSON, two surfaces.' }],
      props: { icon: '✍️', color: '#f0fdf4' },
    }),
    createBlock('heading_2', { content: [{ text: 'What readers expect' }] }),
    createBlock('bulleted_list_item', { content: [{ text: 'Clear headings and scannable lists' }] }),
    createBlock('bulleted_list_item', { content: [{ text: 'Code samples that stay readable' }] }),
    createBlock('bulleted_list_item', { content: [{ text: 'A CTA that is actually a button, not a plain link' }] }),
    createBlock('heading_2', { content: [{ text: 'A tiny example' }] }),
    createBlock('code', {
      props: {
        language: 'tsx',
        code: `// Edit\n<ProEditor defaultValue={blocks} onChange={setBlocks} />\n\n// Publish\n<DocRenderer blocks={blocks} />`,
      },
    }),
    createBlock('quote', {
      content: [{ text: 'Switch to Published above — this draft becomes the public article, instantly.' }],
    }),
    createBlock('button', {
      content: [{ text: 'Read the docs' }],
      props: {
        url: 'https://github.com/xofdev/xproeditor/tree/main/docs',
        buttonStyle: 'primary',
        color: '#111827',
        openInNewTab: true,
        align: 'left',
      },
    }),
    createBlock('divider'),
    createBlock('paragraph', {
      content: [{ text: 'Tip: select a paragraph and run /ai → Improve writing before you publish.' }],
    }),
  ]
}

function docsSeed(): Block[] {
  return [
    createBlock('heading_1', { content: [{ text: 'API: ProEditor' }] }),
    createBlock('paragraph', {
      content: [{ text: 'Drop-in editor for product docs, help centers, and internal wikis.' }],
    }),
    createBlock('heading_2', { content: [{ text: 'Props' }] }),
    createBlock('table', {
      props: {
        table: {
          hasHeader: true,
          rows: [
            [
              { content: [{ text: 'Prop', marks: { bold: true } }] },
              { content: [{ text: 'Type', marks: { bold: true } }] },
              { content: [{ text: 'Notes', marks: { bold: true } }] },
            ],
            [
              { content: [{ text: 'toolbar', marks: { code: true } }] },
              { content: [{ text: '"floating" | "fixed" | …' }] },
              { content: [{ text: 'Editing chrome' }] },
            ],
            [
              { content: [{ text: 'ai', marks: { code: true } }] },
              { content: [{ text: '{ transport }' }] },
              { content: [{ text: 'Optional Ask AI' }] },
            ],
            [
              { content: [{ text: 'onChange', marks: { code: true } }] },
              { content: [{ text: '(blocks) => void' }] },
              { content: [{ text: 'Persist Block[]' }] },
            ],
          ],
        },
      },
    }),
    createBlock('heading_2', { content: [{ text: 'Rendering' }] }),
    createBlock('paragraph', {
      content: [
        { text: 'Use ' },
        { text: 'DocRenderer', marks: { code: true } },
        { text: ' on the public docs site — no editor chrome, still interactive toggles and code highlight.' },
      ],
    }),
    createBlock('callout', {
      content: [{ text: 'Authors edit in-app; customers only ever see the published renderer.' }],
      props: { icon: '📚', color: '#eff6ff' },
    }),
  ]
}

function changelogSeed(): Block[] {
  return [
    createBlock('heading_1', { content: [{ text: 'Changelog — March' }] }),
    createBlock('heading_2', { content: [{ text: '0.3 — Ask AI & Markdown' }] }),
    createBlock('bulleted_list_item', { content: [{ text: 'Pluggable AI agent with Accept / Reject' }] }),
    createBlock('bulleted_list_item', { content: [{ text: 'Markdown paste + lossy export helpers' }] }),
    createBlock('bulleted_list_item', { content: [{ text: 'Button block color & settings UX' }] }),
    createBlock('heading_2', { content: [{ text: 'Fixes' }] }),
    createBlock('to_do', {
      content: [{ text: 'Multi-block copy now includes media between text endpoints' }],
      props: { checked: true },
    }),
    createBlock('to_do', {
      content: [{ text: 'Document HTML round-trip for buttons' }],
      props: { checked: true },
    }),
    createBlock('divider'),
    createBlock('button', {
      content: [{ text: 'View release notes' }],
      props: {
        url: 'https://github.com/xofdev/xproeditor/releases',
        buttonStyle: 'outline',
        openInNewTab: true,
      },
    }),
  ]
}

function notesSeed(): Block[] {
  return [
    createBlock('heading_1', { content: [{ text: 'Design sync — notes' }] }),
    createBlock('paragraph', {
      content: [{ text: 'Capture decisions live, then publish a clean summary for the team.' }],
    }),
    createBlock('to_do', { content: [{ text: 'Confirm toolbar modes for marketing site' }], props: { checked: true } }),
    createBlock('to_do', { content: [{ text: 'Decide default theme tokens' }], props: { checked: false } }),
    createBlock('to_do', { content: [{ text: 'Wire DocRenderer on blog routes' }], props: { checked: false } }),
    createBlock('toggle', {
      content: [{ text: 'Parking lot' }],
      props: { collapsed: true },
    }),
    createBlock('bulleted_list_item', {
      content: [{ text: 'Explore comments / collab later' }],
      props: { indent: 1 },
    }),
    createBlock('callout', {
      content: [{ text: 'Flip to Published to share a read-only digest without the slash menu chrome.' }],
      props: { icon: '✅', color: '#fefce8' },
    }),
  ]
}

const USE_CASES: UseCase[] = [
  {
    id: 'blog',
    icon: Newspaper,
    title: 'Blog / magazine',
    blurb: 'Authors draft with / and Ask AI; readers get a clean article via DocRenderer.',
    audience: 'Marketing & content teams',
    seed: blogSeed,
  },
  {
    id: 'docs',
    icon: BookOpen,
    title: 'Product docs',
    blurb: 'Tables, callouts, and code for help centers — edit in-app, render on the docs site.',
    audience: 'DevRel & support',
    seed: docsSeed,
  },
  {
    id: 'changelog',
    icon: Sparkles,
    title: 'Changelog',
    blurb: 'Ship release notes with lists, todos, and CTA buttons that stay clickable when published.',
    audience: 'Product & eng',
    seed: changelogSeed,
  },
  {
    id: 'notes',
    icon: ListChecks,
    title: 'Meeting notes',
    blurb: 'Capture action items and toggles, then publish a read-only summary for stakeholders.',
    audience: 'Ops & leadership',
    seed: notesSeed,
  },
]

export function UseCases() {
  const [activeId, setActiveId] = useState<UseCaseId>('blog')
  const [view, setView] = useState<ViewMode>('edit')
  const [resetKey, setResetKey] = useState(0)
  const active = USE_CASES.find((u) => u.id === activeId) ?? USE_CASES[0]
  const [blocks, setBlocks] = useState<Block[]>(() => active.seed())
  const ai = useMemo(() => ({ transport: demoAITransport }), [])

  function selectUseCase(id: UseCaseId) {
    const next = USE_CASES.find((u) => u.id === id) ?? USE_CASES[0]
    setActiveId(id)
    setView('edit')
    setBlocks(next.seed())
    setResetKey((k) => k + 1)
  }

  function resetActive() {
    setBlocks(active.seed())
    setResetKey((k) => k + 1)
    setView('edit')
  }

  return (
    <section id="use-cases" aria-labelledby="use-cases-heading">
      <div className="container">
        <div className="section-head">
          <span className="eyebrow">Use cases</span>
          <h2 id="use-cases-heading">Write once. Publish with DocRenderer.</h2>
          <p>
            Same <code>Block[]</code> document powers the editor and the public page. Pick a use case,
            edit, then switch to Published to see the read-only render.
          </p>
        </div>

        <div className="usecase-picker" role="tablist" aria-label="Use cases">
          {USE_CASES.map(({ id, icon: Icon, title, audience }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={activeId === id}
              className={`usecase-tab${activeId === id ? ' active' : ''}`}
              onClick={() => selectUseCase(id)}
            >
              <Icon size={16} aria-hidden />
              <span className="usecase-tab-title">{title}</span>
              <span className="usecase-tab-meta">{audience}</span>
            </button>
          ))}
        </div>

        <div className="usecase-panel">
          <div className="usecase-panel-head">
            <div>
              <h3>{active.title}</h3>
              <p>{active.blurb}</p>
            </div>
            <div className="usecase-panel-actions">
              <div className="mode-switch" role="tablist" aria-label="Edit or publish">
                <button
                  type="button"
                  className={view === 'edit' ? 'active' : ''}
                  onClick={() => setView('edit')}
                >
                  <FilePenLine size={13} aria-hidden /> Edit
                </button>
                <button
                  type="button"
                  className={view === 'publish' ? 'active' : ''}
                  onClick={() => setView('publish')}
                >
                  <BookOpen size={13} aria-hidden /> Published
                </button>
              </div>
              <button type="button" className="nav-link" style={{ fontSize: 12 }} onClick={resetActive}>
                Reset sample
              </button>
            </div>
          </div>

          <div className={`usecase-stage editor-theme-bento${view === 'publish' ? ' is-published' : ''}`}>
            {view === 'edit' ? (
              <div className="usecase-editor">
                <ProEditor
                  key={`${activeId}-${resetKey}`}
                  defaultValue={blocks}
                  toolbar="floating"
                  editorDir="ltr"
                  ai={ai}
                  onChange={setBlocks}
                />
              </div>
            ) : (
              <article className="usecase-article">
                <header className="usecase-article-meta">
                  <span className="pill-soft">DocRenderer</span>
                  <span>Read-only publish surface · no slash menu · no bubble toolbar</span>
                </header>
                <DocRenderer blocks={blocks} editorDir="ltr" />
              </article>
            )}
          </div>

          {activeId === 'blog' && (
            <p className="usecase-footnote">
              Blog flow: draft with <code>ProEditor</code> → persist <code>blocks</code> → render the
              post route with <code>{'<DocRenderer blocks={post.blocks} />'}</code>.
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
