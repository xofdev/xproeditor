/** Shown in the FAQ section and emitted as FAQPage structured data at prerender. */
export const FAQ: { q: string; a: string }[] = [
  {
    q: 'Is XProEditor free for commercial projects?',
    a: 'Yes. All three packages are MIT licensed — use them in commercial, closed-source or open-source apps. There is no paid tier and no API key.',
  },
  {
    q: 'Does it work with Vue and React?',
    a: 'Yes. @xproeditor/vue (Vue 3.4+) and @xproeditor/react (React 18 and 19) are two thin adapters over one framework-agnostic core, so both behave the same and store the same JSON.',
  },
  {
    q: 'Can several people edit the same document in real time?',
    a: 'Yes. Pass a session from createCollabSession to the collaboration prop. Edits sync block by block with live presence markers, over BroadcastChannel (no server), a WebSocket relay, or your own transport.',
  },
  {
    q: 'How is the content stored?',
    a: 'As a plain Block[] JSON array with stable ids — easy to save in any database. Export to Markdown, sanitized HTML or plain text with one call, and render it read-only with DocRenderer.',
  },
  {
    q: 'Do I need Tailwind, Radix or shadcn?',
    a: 'No. Styles ship precompiled in one CSS file. Restyle with --xpe-* CSS variables, switch to dark with the xpe-dark class, and right-to-left languages work out of the box.',
  },
  {
    q: 'Is it safe to render user content?',
    a: 'Links, media URLs, colours, pasted HTML and JSON, AI output and collaboration messages are sanitized in core, so stored or pasted content cannot inject script into the editor or the renderer.',
  },
  {
    q: 'Can I plug in my own AI model?',
    a: 'Yes. Ask AI takes a transport function you write — OpenAI, Anthropic, a local model or your backend. The package never ships or asks for API keys.',
  },
]
