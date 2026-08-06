import { useState } from 'react'
import { CodeBlock } from './CodeBlock'

const INSTALL = {
  vue: 'npm install @xproeditor/vue',
  react: 'npm install @xproeditor/react',
} as const

const REACT_SNIPPET = `import { ProEditor, DocRenderer, createBlock } from '@xproeditor/react'
import '@xproeditor/react/style.css'
import { useState } from 'react'

const initial = [createBlock('heading_1', { content: [{ text: 'My post' }] })]

export default function BlogAdmin() {
  const [blocks, setBlocks] = useState(initial)
  const [published, setPublished] = useState(false)

  if (published) return <DocRenderer blocks={blocks} />

  return (
    <ProEditor
      defaultValue={blocks}
      toolbar="floating"
      onChange={setBlocks}
    />
  )
}`

const VUE_SNIPPET = `<script setup lang="ts">
import { ref } from 'vue'
import { ProEditor, DocRenderer, createBlock } from '@xproeditor/vue'
import '@xproeditor/vue/style.css'

const blocks = ref([createBlock('heading_1', { content: [{ text: 'My post' }] })])
const published = ref(false)
</script>

<template>
  <DocRenderer v-if="published" :blocks="blocks" />
  <ProEditor
    v-else
    :model-value="blocks"
    toolbar="floating"
    @change="/* persist blocks */"
  />
</template>`

export function InstallTabs() {
  const [tab, setTab] = useState<'vue' | 'react'>('react')

  return (
    <section id="install">
      <div className="container">
        <div className="section-head">
          <span className="eyebrow">Get started</span>
          <h2>Install, drop in, optionally plug AI</h2>
          <p>
            No Tailwind, no Radix, no shadcn required — styles ship precompiled. Pass{' '}
            <code>ai.transport</code> only when you want Ask AI. For public pages, render the same
            blocks with <code>DocRenderer</code>.
          </p>
        </div>

        <div className="install-card">
          <div className="install-tabs">
            <button type="button" className={tab === 'vue' ? 'active' : ''} onClick={() => setTab('vue')}>
              Vue
            </button>
            <button
              type="button"
              className={tab === 'react' ? 'active' : ''}
              onClick={() => setTab('react')}
            >
              React
            </button>
          </div>
          <CodeBlock variant="command" code={INSTALL[tab]} />
          <CodeBlock code={tab === 'vue' ? VUE_SNIPPET : REACT_SNIPPET} />
        </div>
      </div>
    </section>
  )
}
