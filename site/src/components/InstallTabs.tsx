import { useState } from 'react'
import { CodeBlock } from './CodeBlock'

const VUE_SNIPPET = `npm install @xproeditor/vue

<script setup lang="ts">
import { ProEditor, createBlock } from '@xproeditor/vue'
import '@xproeditor/vue/style.css'

const blocks = ref([createBlock('paragraph', { content: [{ text: 'Hello!' }] })])
</script>

<template>
  <ProEditor :model-value="blocks" toolbar="floating" />
</template>`

const REACT_SNIPPET = `npm install @xproeditor/react

import { ProEditor, createBlock } from '@xproeditor/react'
import '@xproeditor/react/style.css'

const initialBlocks = [createBlock('paragraph', { content: [{ text: 'Hello!' }] })]

export default () => (
  <ProEditor defaultValue={initialBlocks} toolbar="floating" />
)`

export function InstallTabs() {
  const [tab, setTab] = useState<'vue' | 'react'>('react')

  return (
    <section id="install">
      <div className="container">
        <div className="section-head">
          <span className="eyebrow">Get started</span>
          <h2>Two lines to a Notion-like editor</h2>
          <p>No Tailwind, no Radix, no shadcn required — styles ship precompiled.</p>
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
          <CodeBlock code={tab === 'vue' ? VUE_SNIPPET : REACT_SNIPPET} />
        </div>
      </div>
    </section>
  )
}
