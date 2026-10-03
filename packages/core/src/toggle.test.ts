import { describe, expect, it } from 'vitest'
import { blocksToHtmlContent } from './clipboard'
import { htmlToBlocks } from './normalize'
import { createBlock } from './ops'
import {
  cloneToggleSubtree,
  filterVisibleBlocks,
  getToggleSubtreeLength,
  removeToggleSubtree,
} from './toggle'
import { isToggleBlock, toggleHeadingLevel } from './types'

describe('toggle model helpers', () => {
  it('createBlock defaults collapsed=false for the toggle family', () => {
    expect(createBlock('toggle').props.collapsed).toBe(false)
    expect(createBlock('toggle_heading_1').props.collapsed).toBe(false)
    expect(createBlock('toggle_heading_2').props.collapsed).toBe(false)
    expect(createBlock('toggle_heading_3').props.collapsed).toBe(false)
  })

  it('recognizes toggle types and heading levels', () => {
    expect(isToggleBlock('toggle')).toBe(true)
    expect(isToggleBlock('toggle_heading_2')).toBe(true)
    expect(isToggleBlock('heading_1')).toBe(false)
    expect(toggleHeadingLevel('toggle_heading_3')).toBe(3)
    expect(toggleHeadingLevel('toggle')).toBeNull()
  })

  it('computes toggle subtree length from indent nesting', () => {
    const blocks = [
      createBlock('toggle', { id: 't', content: [{ text: 'Parent' }] }),
      createBlock('paragraph', { id: 'c1', content: [{ text: 'Child' }], props: { indent: 1 } }),
      createBlock('paragraph', { id: 'c2', content: [{ text: 'Nested' }], props: { indent: 2 } }),
      createBlock('paragraph', { id: 'sib', content: [{ text: 'Sibling' }] }),
    ]

    expect(getToggleSubtreeLength(blocks, 0)).toBe(3)
    expect(cloneToggleSubtree(blocks, 0).map((b) => b.content[0]?.text)).toEqual([
      'Parent',
      'Child',
      'Nested',
    ])
    expect(cloneToggleSubtree(blocks, 0)[0].id).not.toBe('t')

    removeToggleSubtree(blocks, 0)
    expect(blocks.map((b) => b.id)).toEqual(['sib'])
  })

  it('hides deeper blocks when a toggle is collapsed', () => {
    const blocks = [
      createBlock('toggle', { content: [{ text: 'A' }], props: { collapsed: true } }),
      createBlock('paragraph', { content: [{ text: 'hidden' }], props: { indent: 1 } }),
      createBlock('toggle_heading_1', { content: [{ text: 'B' }], props: { collapsed: false } }),
      createBlock('paragraph', { content: [{ text: 'shown' }], props: { indent: 1 } }),
    ]

    const visible = filterVisibleBlocks(blocks, (b) => !!b.props.collapsed)
    expect(visible.map((v) => v.block.content[0]?.text)).toEqual(['A', 'B', 'shown'])
  })
})

describe('toggle HTML round-trip', () => {
  it('serializes toggle + children as details/summary and parses back', () => {
    const blocks = [
      createBlock('toggle', { content: [{ text: 'Title' }], props: { collapsed: false } }),
      createBlock('paragraph', { content: [{ text: 'Body' }], props: { indent: 1 } }),
    ]

    const html = blocksToHtmlContent(blocks)
    expect(html).toContain('data-xpe-type="toggle"')
    expect(html).toContain('<summary>')
    expect(html).toContain('Title')
    expect(html).toContain('Body')
    expect(html).toContain(' open')

    const parsed = htmlToBlocks(html)
    expect(parsed[0]?.type).toBe('toggle')
    expect(parsed[0]?.props.collapsed).toBe(false)
    expect(parsed[0]?.content[0]?.text).toBe('Title')
    expect(parsed[1]?.type).toBe('paragraph')
    expect(parsed[1]?.props.indent).toBe(1)
    expect(parsed[1]?.content[0]?.text).toBe('Body')
  })

  it('round-trips toggle headings', () => {
    const blocks = [
      createBlock('toggle_heading_2', {
        content: [{ text: 'Section' }],
        props: { collapsed: true },
      }),
      createBlock('paragraph', { content: [{ text: 'Note' }], props: { indent: 1 } }),
    ]

    const html = blocksToHtmlContent(blocks)
    expect(html).toContain('data-xpe-type="toggle_heading_2"')
    expect(html).toMatch(/<h2 id="[^"]+">/)
    expect(html).not.toMatch(/<details[^>]*\sopen/)

    const parsed = htmlToBlocks(html)
    expect(parsed[0]?.type).toBe('toggle_heading_2')
    expect(parsed[0]?.props.collapsed).toBe(true)
    expect(parsed[0]?.content[0]?.text).toBe('Section')
    expect(parsed[1]?.props.indent).toBe(1)
  })
})
