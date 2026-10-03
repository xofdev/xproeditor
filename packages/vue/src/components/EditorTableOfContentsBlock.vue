<script setup lang="ts">
import { ListTree } from 'lucide-vue-next'
import type { DocHeading } from '@xproeditor/core'
import { useEditorDictionary } from '../i18n'

/** Live table of contents built from the document's headings. */
defineProps<{
  headings: DocHeading[]
  selected?: boolean
}>()

const emit = defineEmits<{
  select: []
  /** Scroll to / focus a heading block. */
  navigate: [blockId: string]
}>()

const dict = useEditorDictionary()

function onClick(e: MouseEvent) {
  if ((e.target as HTMLElement).closest('button')) return
  emit('select')
}
</script>

<template>
  <nav
    class="xpe-toc my-1"
    :class="{ 'xpe-toc--selected': selected }"
    :aria-label="dict.toc.title"
    contenteditable="false"
    @click="onClick"
  >
    <p class="xpe-toc__title">
      <ListTree aria-hidden="true" class="xpe-toc__icon" />
      {{ dict.toc.title }}
    </p>
    <p v-if="headings.length === 0" class="xpe-toc__empty">{{ dict.toc.empty }}</p>
    <ul v-else class="xpe-toc__list">
      <li
        v-for="h in headings"
        :key="h.blockId"
        class="xpe-toc__item"
        :class="`xpe-toc__item--${h.level}`"
      >
        <button type="button" @click="emit('navigate', h.blockId)">{{ h.text }}</button>
      </li>
    </ul>
  </nav>
</template>
