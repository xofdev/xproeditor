<script setup lang="ts">
import { provide, toRef } from 'vue'
import { tabsContextKey } from './tabsContext'

const model = defineModel<string>({ required: true })

provide(tabsContextKey, {
  active: toRef(model),
  setActive: (value: string) => {
    model.value = value
  },
})
</script>

<template>
  <div class="xpe-tabs"><slot /></div>
</template>
