<script setup lang="ts">
import { provide, ref, watch } from 'vue'
import { popoverContextKey } from './popoverContext'

const props = withDefaults(
  defineProps<{
    open?: boolean
  }>(),
  {
    open: undefined,
  },
)

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const internalOpen = ref(false)
const triggerEl = ref<HTMLElement | null>(null)

watch(
  () => props.open,
  (value) => {
    if (value !== undefined) {
      internalOpen.value = value
    }
  },
  { immediate: true },
)

function setOpen(value: boolean): void {
  if (props.open === undefined) {
    internalOpen.value = value
  }
  emit('update:open', value)
}

provide(popoverContextKey, { open: internalOpen, triggerEl, setOpen })
</script>

<template>
  <slot />
</template>
