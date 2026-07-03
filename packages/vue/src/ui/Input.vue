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
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  padding: 0 10px;
  font-size: 13px;
  color: #111827;
  background: #fff;
  outline: none;
  transition: border-color 0.12s, box-shadow 0.12s;
}
.xpe-input:focus {
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgb(99 102 241 / 0.15);
}
.xpe-input::placeholder {
  color: #9ca3af;
}
</style>
