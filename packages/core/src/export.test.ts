import { describe, expect, it } from 'vitest'
import { blocksToHtmlContent } from './clipboard'
import { resolveEmbed } from './embed'
import { blocksToMarkdownLossy, markdownToBlocks } from './markdown'
import { htmlToBlocks } from './normalize'
import { createBlock, spansToText } from './ops'
import type { Block } from './types'

const summary = (blocks: Block[]) =>
  blocks.map(b => `${b.type}${b.props.indent ? `@${b.props.indent}` : ''}:${spansToText(b.content)}`)

describe('HTML export ↔ import', () => {
  it('nests list items by indent and round-trips them', () => {
    const blocks = [
      createBlock('bulleted_list_item', { content: [{ text: 'a' }] }),
      createBlock('bulleted_list_item', { content: [{ text: 'a1' }], props: { indent: 1 } }),
      createBlock('numbered_list_item', { content: [{ text: 'a1i' }], props: { indent: 2 } }),
      createBlock('bulleted_list_item', { content: [{ text: 'b' }] }),
    ]
    const html = blocksToHtmlContent(blocks)

    expect(html).toBe('<ul><li>a<ul><li>a1<ol><li>a1i</li></ol></li></ul></li><li>b</li></ul>')
    expect(summary(htmlToBlocks(html))).toEqual(summary(blocks))
  })

  it('exports and re-imports to-dos with their checked state', () => {
    const blocks = [
      createBlock('to_do', { content: [{ text: 'done' }], props: { checked: true } }),
      createBlock('to_do', { content: [{ text: 'open' }] }),
    ]
    const html = blocksToHtmlContent(blocks)
    const back = htmlToBlocks(html)

    expect(html).toContain('type="checkbox"')
    expect(back.map(b => [b.type, b.props.checked, spansToText(b.content)])).toEqual([
      ['to_do', true, 'done'],
      ['to_do', false, 'open'],
    ])
  })

  it('imports GitHub-style task lists', () => {
    const back = htmlToBlocks('<ul class="contains-task-list"><li class="task-list-item"><input type="checkbox" checked disabled> Ship it</li></ul>')

    expect(back[0].type).toBe('to_do')
    expect(back[0].props.checked).toBe(true)
    expect(spansToText(back[0].content)).toBe('Ship it')
  })

  it('keeps the code language', () => {
    const html = blocksToHtmlContent([createBlock('code', { props: { language: 'typescript', code: 'let a = 1' } })])

    expect(html).toBe('<pre><code class="language-typescript">let a = 1</code></pre>')
    expect(htmlToBlocks(html)[0].props.language).toBe('typescript')
  })

  it('exports video blocks instead of dropping them', () => {
    const file = createBlock('video', { props: { url: 'https://cdn/x.mp4', provider: 'file' } })
    const yt = createBlock('video', { props: { url: 'https://www.youtube.com/embed/dQw4w9WgXcQ', provider: 'youtube' } })
    const html = blocksToHtmlContent([file, yt])

    expect(html).toContain('<video controls src="https://cdn/x.mp4">')
    expect(html).toContain('<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"')
    expect(htmlToBlocks(html).map(b => [b.type, b.props.url])).toEqual([
      ['video', 'https://cdn/x.mp4'],
      ['video', 'https://www.youtube.com/embed/dQw4w9WgXcQ'],
    ])
  })

  it('round-trips callouts with icon and colour', () => {
    const block = createBlock('callout', { content: [{ text: 'Note' }], props: { icon: '🔥', color: '#fef3c7' } })
    const [back] = htmlToBlocks(blocksToHtmlContent([block]))

    expect(back.type).toBe('callout')
    expect(back.props.icon).toBe('🔥')
    expect(back.props.color).toBe('#fef3c7')
    expect(spansToText(back.content)).toBe('Note')
  })

  it('wraps captioned images in figure/figcaption', () => {
    const html = blocksToHtmlContent([createBlock('image', { props: { url: 'https://a/b.png', caption: 'Cap' } })])

    expect(html).toBe('<figure><img src="https://a/b.png" alt="Cap"><figcaption>Cap</figcaption></figure>')
    expect(htmlToBlocks(html)[0].props.caption).toBe('Cap')
  })

  it('links the table of contents to heading anchors', () => {
    const html = blocksToHtmlContent([
      createBlock('table_of_contents'),
      createBlock('heading_1', { content: [{ text: 'Intro' }] }),
      createBlock('heading_2', { content: [{ text: 'Setup' }] }),
    ])

    expect(html).toContain('<a href="#intro">Intro</a>')
    expect(html).toContain('<h2 id="setup">Setup</h2>')
    expect(htmlToBlocks(html).map(b => b.type)).toEqual(['table_of_contents', 'heading_1', 'heading_2'])
  })

  it('round-trips allow-listed embeds and drops unknown iframes', () => {
    const block = createBlock('embed', { props: { url: 'https://codepen.io/team/pen/abcDEF' } })
    const html = blocksToHtmlContent([block])

    expect(html).toContain('src="https://codepen.io/team/embed/abcDEF?default-tab=result"')
    expect(htmlToBlocks(html)[0].props.url).toBe('https://codepen.io/team/pen/abcDEF')
    expect(htmlToBlocks('<iframe src="https://evil.example/x"></iframe>')).toEqual([])
  })

  it('keeps alignment and drops hostile URLs on export', () => {
    const html = blocksToHtmlContent([
      createBlock('paragraph', { content: [{ text: 'c' }], props: { align: 'center' } }),
      createBlock('image', { props: { url: 'javascript:alert(1)' } }),
      createBlock('button', { content: [{ text: 'Go' }], props: { url: 'javascript:alert(1)' } }),
    ])

    expect(html).toContain('<p style="text-align:center">c</p>')
    expect(html).not.toContain('javascript:')
  })
})

describe('resolveEmbed', () => {
  it.each([
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'youtube', 'https://www.youtube.com/embed/dQw4w9WgXcQ'],
    ['youtu.be/dQw4w9WgXcQ', 'youtube', 'https://www.youtube.com/embed/dQw4w9WgXcQ'],
    ['https://vimeo.com/76979871', 'vimeo', 'https://player.vimeo.com/video/76979871'],
    ['https://www.loom.com/share/0281766fa2d04bb788eaf19e65135184', 'loom', 'https://www.loom.com/embed/0281766fa2d04bb788eaf19e65135184'],
    ['https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC', 'spotify', 'https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC'],
    ['https://codesandbox.io/s/new', 'codesandbox', 'https://codesandbox.io/embed/new'],
    ['https://codepen.io/team/codepen/pen/PNaGbb', 'codepen', 'https://codepen.io/team/codepen/embed/PNaGbb?default-tab=result'],
    ['<iframe src="https://www.google.com/maps/embed?pb=!1m18" width="600"></iframe>', 'google-maps', 'https://www.google.com/maps/embed?pb=!1m18'],
  ])('%s → %s', (input, provider, src) => {
    const resolved = resolveEmbed(input)

    expect(resolved?.provider.id).toBe(provider)
    expect(resolved?.embedUrl).toBe(src)
  })

  it('rejects unknown hosts and non-http schemes', () => {
    expect(resolveEmbed('https://evil.example/embed')).toBeNull()
    expect(resolveEmbed('javascript:alert(1)')).toBeNull()
    expect(resolveEmbed('')).toBeNull()
  })
})

describe('markdown', () => {
  it('does not italicise inside identifiers', () => {
    const [block] = markdownToBlocks('call foo_bar_baz() and _real italic_')

    expect(block.content.find(s => s.marks?.italic)?.text).toBe('real italic')
    expect(spansToText(block.content)).toBe('call foo_bar_baz() and real italic')
  })

  it('parses nested lists, ordered markers and task items', () => {
    const blocks = markdownToBlocks(['- a', '  - a1', '    1) deep', '- [ ] todo', '3. three'].join('\n'))

    expect(summary(blocks)).toEqual([
      'bulleted_list_item:a',
      'bulleted_list_item@1:a1',
      'numbered_list_item@2:deep',
      'to_do:todo',
      'numbered_list_item:three',
    ])
  })

  it('parses nested emphasis and safe links only', () => {
    const [block] = markdownToBlocks('**bold _and italic_** [ok](https://x.y) [bad](javascript:alert(1))')
    const both = block.content.find(s => s.text === 'and italic')

    expect(both?.marks).toEqual({ bold: true, italic: true })
    expect(block.content.find(s => s.text === 'ok')?.marks?.link).toBe('https://x.y')
    expect(block.content.find(s => s.text === 'bad')?.marks?.link).toBeUndefined()
  })

  it('honours backslash escapes', () => {
    const [block] = markdownToBlocks('2 \\* 3 \\* 4')

    expect(spansToText(block.content)).toBe('2 * 3 * 4')
    expect(block.content.every(s => !s.marks)).toBe(true)
  })

  it('round-trips text that contains markdown syntax characters', () => {
    const blocks = [
      createBlock('paragraph', { content: [{ text: '# not a heading, *not italic*, snake_case' }] }),
      createBlock('paragraph', { content: [{ text: '- not a list' }] }),
      createBlock('paragraph', { content: [{ text: 'code: ' }, { text: 'a`b', marks: { code: true } }] }),
    ]
    const back = markdownToBlocks(blocksToMarkdownLossy(blocks))

    expect(summary(back)).toEqual(summary(blocks))
    expect(back[2].content[1]).toEqual({ text: 'a`b', marks: { code: true } })
  })

  it('exports nested and numbered lists with real numbers and tight spacing', () => {
    const md = blocksToMarkdownLossy([
      createBlock('numbered_list_item', { content: [{ text: 'one' }] }),
      createBlock('numbered_list_item', { content: [{ text: 'sub' }], props: { indent: 1 } }),
      createBlock('numbered_list_item', { content: [{ text: 'two' }] }),
      createBlock('to_do', { content: [{ text: 't' }], props: { checked: true, indent: 1 } }),
    ])

    expect(md).toBe('1. one\n  1. sub\n2. two\n  - [x] t')
  })
})
