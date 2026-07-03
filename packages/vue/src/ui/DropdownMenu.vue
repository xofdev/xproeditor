<script setup lang="ts">
import { provide, ref } from 'vue'
import { popoverContextKey } from './popoverContext'

const open = ref(false)
const triggerEl = ref<HTMLElement | null>(null)

provide(popoverContextKey, {
  open,
  triggerEl,
  setOpen: (value: boolean) => {
    open.value = value
  },
})
</script>

<template>
  <slot />
</template>
