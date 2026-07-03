<script setup lang="ts">
import { ref } from 'vue'
import { ProEditor, createBlock, type Block } from '@xproeditor/vue'

type ToolbarMode = 'fixed' | 'floating' | 'both'

const mode = ref<ToolbarMode>('floating')

function seed(): Block[] {
  return [
    createBlock('heading_1', { content: [{ text: 'XProEditor — Vue demo' }] }),
    createBlock('paragraph', {
      content: [
        { text: 'This is a ' },
        { text: 'Notion-like', marks: { bold: true } },
        { text: ' block editor. Try ' },
        { text: '/', marks: { code: true } },
        { text: ' for the slash menu, or select text for the floating toolbar.' },
      ],
    }),
    createBlock('bulleted_list_item', { content: [{ text: 'Switch modes above: fixed toolbar, floating (Notion-like), or both.' }] }),
    createBlock('bulleted_list_item', { content: [{ text: 'Everything here is powered by @xproeditor/vue.' }] }),
    createBlock('to_do', { content: [{ text: 'Try checking this off' }] }),
    createBlock('callout', { content: [{ text: 'Callouts, tables, images, videos, and code blocks are all supported.' }] }),
    createBlock('paragraph', { content: [] }),
  ]
}

const blocks = ref<Block[]>(seed())

function reset() {
  blocks.value = seed()
}
</script>

<template>
  <div style="max-width: 860px; margin: 0 auto; padding: 24px; font-family: system-ui, sans-serif">
    <header style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px">
      <h1 style="font-size: 15px; font-weight: 600; color: #6b7280">@xproeditor/vue demo</h1>
      <div style="display: flex; gap: 6px; align-items: center">
        <select v-model="mode" style="height: 32px; border-radius: 8px; border: 1px solid #e5e7eb; padding: 0 8px; font-size: 13px">
          <option value="fixed">Fixed toolbar</option>
          <option value="floating">Floating (Notion-like)</option>
          <option value="both">Both</option>
        </select>
        <button
          style="height: 32px; padding: 0 12px; border-radius: 8px; border: 1px solid #e5e7eb; background: #fff; font-size: 13px; cursor: pointer"
          @click="reset"
        >
          Reset
        </button>
      </div>
    </header>

    <div style="border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden">
      <ProEditor :key="mode" :model-value="blocks" :toolbar="mode" editor-dir="ltr" />
      <div style="padding: 16px 24px 32px">
        <!-- ProEditor renders its own canvas; padding keeps the tail-click area usable -->
      </div>
    </div>
  </div>
</template>
