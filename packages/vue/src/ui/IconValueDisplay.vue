<script setup lang="ts">
defineProps<{ icon: string }>()
</script>

<template>
  <span class="xpe-icon-value">{{ icon }}</span>
</template>

<style scoped>
.xpe-icon-value {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}
</style>
