<script setup lang="ts">
defineProps<{
  placeholder?: string
}>()

const model = defineModel<string>({ default: '' })
</script>

<template>
  <input v-model="model" type="text" class="xpe-input" :placeholder="placeholder" />
</template>

<style scoped>
.xpe-input {
  width: 100%;
  border-radius: calc(var(--xpe-radius, 12px) * 0.66);
  border: 1px solid var(--xpe-border, #e5e7eb);
  padding: 0 10px;
  font-size: 13px;
  color: var(--xpe-foreground, #111827);
  background: var(--xpe-surface, #fff);
  outline: none;
  transition: border-color 0.12s, box-shadow 0.12s;
}
.xpe-input:focus {
  border-color: var(--xpe-ring, #6366f1);
  box-shadow: 0 0 0 3px rgb(99 102 241 / 0.15);
}
.xpe-input::placeholder {
  color: var(--xpe-muted-foreground, #9ca3af);
}
</style>
