import { useMemo, useState } from 'react'
import {
  ProEditor,
  createBlock,
  type AITransport,
  type Block,
  type FetchBookmarkMetaFn,
} from '@xproeditor/react'

type ToolbarMode = 'fixed' | 'floating' | 'both'
type DemoLocale = 'en' | 'fa'

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
    createBlock('table_of_contents'),
    createBlock('paragraph', {
      content: [
        { text: 'This is the real ' },
        { text: '@xproeditor/react', marks: { code: true } },
        { text: " package — not a mockup. Try the tips below, or open a block's ··· menu." },
      ],
    }),
    createBlock('callout', {
      content: [
        {
          text: 'Type / for blocks · /ai for Ask AI · paste Markdown · drag-select blocks for the floating edit popover · ⌘/Ctrl+A twice to select all.',
        },
      ],
      props: { icon: '✨' },
    }),
    createBlock('heading_2', { content: [{ text: 'Type like Markdown' }] }),
    createBlock('paragraph', {
      content: [
        { text: 'Type ' },
        { text: '**bold**', marks: { code: true } },
        { text: ', ' },
        { text: '*italic*', marks: { code: true } },
        { text: ', ' },
        { text: '`code`', marks: { code: true } },
        { text: ' or ' },
        { text: '~~strike~~', marks: { code: true } },
        { text: ' inline, and ' },
        { text: '# ', marks: { code: true } },
        { text: ', ' },
        { text: '- ', marks: { code: true } },
        { text: ', ' },
        { text: '1. ', marks: { code: true } },
        { text: ', ' },
        { text: '[x] ', marks: { code: true } },
        { text: ' at the start of a line. ' },
        { text: '⌘/Ctrl+Alt+1', marks: { code: true } },
        { text: ' turns a block into a heading; ' },
        { text: '⌘/Ctrl+Shift+↑', marks: { code: true } },
        { text: ' moves it.' },
      ],
    }),
    createBlock('heading_2', { content: [{ text: 'Lists, toggles & tasks' }] }),
    createBlock('bulleted_list_item', { content: [{ text: 'Headings, quotes, callouts, bookmarks' }] }),
    createBlock('toggle', {
      content: [{ text: 'Toggle — click to expand nested notes' }],
      props: { collapsed: false },
    }),
    createBlock('paragraph', {
      content: [{ text: 'Nested under the toggle — great for FAQs and long docs.' }],
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
    createBlock('to_do', {
      content: [{ text: 'Markdown paste and multi-block clipboard' }],
      props: { checked: true },
    }),
    createBlock('to_do', {
      content: [{ text: 'Try Ask AI on this line (select it, then /ai)' }],
      props: { checked: false },
    }),
    createBlock('heading_2', { content: [{ text: 'Code, CTA & bookmark' }] }),
    createBlock('code', {
      props: {
        language: 'tsx',
        wrap: true,
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
    createBlock('bookmark', {
      props: {
        url: 'https://github.com/xofdev/xproeditor',
        title: 'xofdev/xproeditor',
        description: 'Notion-like block editor for Vue and React — open source on GitHub.',
        favicon: 'https://www.google.com/s2/favicons?domain=github.com&sz=64',
      },
    }),
    createBlock('heading_2', { content: [{ text: 'Embeds' }] }),
    createBlock('embed', {
      props: { url: 'https://codepen.io/team/codepen/pen/PNaGbb', height: 300 },
    }),
    createBlock('quote', {
      content: [
        {
          text: 'Hover a block for ··· · resize tables · drag across cells · use code language / wrap / copy.',
        },
      ],
    }),
    createBlock('divider'),
    createBlock('paragraph', {
      content: [{ text: 'Empty line — type /table, /bookmark, or paste:' }],
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

function seedFa(): Block[] {
  return [
    createBlock('heading_1', { content: [{ text: 'یک ویرایشگر کامل، به فارسی' }] }),
    createBlock('table_of_contents'),
    createBlock('paragraph', {
      content: [
        { text: 'رابط کاربری با ' },
        { text: 'locale="fa"', marks: { code: true } },
        { text: ' کاملاً فارسی و راست‌به‌چپ می‌شود. ' },
        { text: '/', marks: { code: true } },
        { text: ' را بزنید تا منوی بلوک‌ها باز شود.' },
      ],
    }),
    createBlock('heading_2', { content: [{ text: 'میانبرها' }] }),
    createBlock('bulleted_list_item', {
      content: [{ text: 'تایپ ** دور یک کلمه آن را پررنگ می‌کند؛ ` آن را به کد تبدیل می‌کند.' }],
    }),
    createBlock('to_do', { content: [{ text: 'نوشتن [x] در ابتدای خط یک کار انجام‌شده می‌سازد' }], props: { checked: true } }),
    createBlock('heading_2', { content: [{ text: 'نقل‌قول و نکته' }] }),
    createBlock('quote', { content: [{ text: 'جهت هر بلوک از متن آن تشخیص داده می‌شود؛ English stays left-to-right.' }] }),
    createBlock('callout', {
      content: [{ text: 'شمارش کلمات، زمان مطالعه و خروجی Markdown/HTML از طریق API در دسترس است.' }],
      props: { icon: '💡' },
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
  { label: 'Block menu', detail: 'Hover a block → ··· for Turn into, duplicate, delete' },
  { label: 'Multi-select', detail: 'Drag across blocks for the floating edit popover' },
  { label: 'Ask AI', detail: 'Type /ai or use the toolbar sparkles' },
  { label: 'Toggle', detail: 'Expand the toggle / toggle heading above' },
  { label: 'Code chrome', detail: 'Change language, toggle wrap, or copy' },
  { label: 'Bookmark', detail: 'Click the bookmark card or insert with /bookmark' },
  { label: 'Markdown', detail: 'Copy the fenced sample and paste below' },
  { label: 'Shortcuts', detail: 'Type **bold** or `code`, or press ⌘/Ctrl+Alt+1 for a heading' },
  { label: 'Embed', detail: 'Insert /embed and paste a YouTube, Figma, CodePen or Loom link' },
  { label: 'فارسی', detail: 'Switch the language to Persian — the whole UI becomes RTL' },
]

type EditorTheme = 'bento' | 'default'

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

export function LiveDemo() {
  const [mode, setMode] = useState<ToolbarMode>('floating')
  const [editorTheme, setEditorTheme] = useState<EditorTheme>('bento')
  const [resetKey, setResetKey] = useState(0)
  const [activeTip, setActiveTip] = useState(0)
  const [locale, setLocale] = useState<DemoLocale>('en')
  const initialBlocks = useMemo(() => (locale === 'fa' ? seedFa() : seed()), [resetKey, locale])
  const ai = useMemo(() => ({ transport: demoAITransport }), [])

  return (
    <section id="demo" aria-labelledby="demo-heading">
      <div className="container">
        <div className="section-head">
          <span className="eyebrow">Live demo</span>
          <h2 id="demo-heading">Not a screenshot. Actually try it.</h2>
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
                    role="tab"
                    aria-selected={mode === m.value}
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
                    role="tab"
                    aria-selected={editorTheme === t}
                    className={editorTheme === t ? 'active' : ''}
                    onClick={() => setEditorTheme(t)}
                  >
                    {t === 'bento' ? 'Bento theme' : 'Default'}
                  </button>
                ))}
              </div>
              <div className="mode-switch" role="tablist" aria-label="Editor language">
                {(['en', 'fa'] as const).map((l) => (
                  <button
                    key={l}
                    type="button"
                    role="tab"
                    aria-selected={locale === l}
                    className={locale === l ? 'active' : ''}
                    onClick={() => setLocale(l)}
                  >
                    {l === 'en' ? 'English' : 'فارسی'}
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
              key={`${mode}-${resetKey}-${locale}`}
              defaultValue={initialBlocks}
              toolbar={mode}
              locale={locale}
              editorDir={locale === 'fa' ? 'rtl' : 'ltr'}
              ai={ai}
              fetchBookmarkMeta={fetchBookmarkMeta}
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
