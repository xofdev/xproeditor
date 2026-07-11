<script setup lang="ts">
import { computed, ref, watch } from 'vue'

defineProps<{
  compact?: boolean
  hideContrastRatio?: boolean
  hideDefaultSwatches?: boolean
}>()

const model = defineModel<string>({ default: '#000000' })

const hexDraft = ref(model.value)

watch(model, (value) => {
  hexDraft.value = value
})

const isValidHex = computed(() => /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hexDraft.value))

function commitHex(): void {
  if (isValidHex.value) model.value = hexDraft.value
}

function onNativeColorInput(event: Event): void {
  const value = (event.target as HTMLInputElement).value
  hexDraft.value = value
  model.value = value
}
</script>

<template>
  <div class="xpe-color-picker">
    <input
      type="color"
      class="xpe-color-swatch"
      :value="model"
      @input="onNativeColorInput"
    />
    <input
      v-model="hexDraft"
      type="text"
      class="xpe-color-hex"
      spellcheck="false"
      placeholder="#000000"
      @keydown.enter.prevent="commitHex"
      @blur="commitHex"
    />
  </div>
</template>

<style scoped>
.xpe-color-picker {
  display: flex;
  align-items: center;
  gap: 8px;
}
.xpe-color-swatch {
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid var(--xpe-border, #e5e7eb);
  border-radius: 8px;
  cursor: pointer;
  background: none;
}
.xpe-color-hex {
  flex: 1;
  height: 32px;
  border: 1px solid var(--xpe-border, #e5e7eb);
  border-radius: 8px;
  padding: 0 8px;
  font-size: 12px;
  font-family: var(--xpe-font-mono, ui-monospace, monospace);
  outline: none;
}
.xpe-color-hex:focus {
  border-color: var(--xpe-ring, #6366f1);
}
</style>
