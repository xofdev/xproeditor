<script setup lang="ts">
import PopoverContent from './PopoverContent.vue'

withDefaults(
  defineProps<{
    align?: 'start' | 'center' | 'end'
  }>(),
  {
    align: 'start',
  },
)
</script>

<template>
  <PopoverContent :align="align" side="bottom" :side-offset="4" class="xpe-dropdown-content">
    <slot />
  </PopoverContent>
</template>

<style scoped>
.xpe-dropdown-content {
  padding: 4px;
}
</style>
