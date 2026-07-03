<script setup lang="ts">
import { ref } from 'vue'
import { EMOJI_PRESETS } from './emojiPresets'
import Popover from './Popover.vue'
import PopoverContent from './PopoverContent.vue'
import PopoverTrigger from './PopoverTrigger.vue'

withDefaults(
  defineProps<{
    disabled?: boolean
    align?: 'start' | 'center' | 'end'
    side?: 'top' | 'bottom' | 'left' | 'right'
  }>(),
  {
    disabled: false,
    align: 'start',
    side: 'bottom',
  },
)

const model = defineModel<string | null>({ default: null })

const open = ref(false)
const customValue = ref('')

function pick(icon: string): void {
  model.value = icon
  open.value = false
}

function applyCustom(): void {
  const value = customValue.value.trim()
  if (value) {
    model.value = value
    customValue.value = ''
    open.value = false
  }
}

function toggle(): void {
  open.value = !open.value
}

defineExpose({
  open: (_tab?: 'emoji' | 'icon') => {
    open.value = true
  },
})
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger>
      <slot name="trigger" :selected="model" :is-iconify="false" :toggle="toggle">
        <button type="button" class="xpe-icon-trigger" :disabled="disabled" @click="toggle">
          {{ model ?? '💡' }}
        </button>
      </slot>
    </PopoverTrigger>
    <PopoverContent :align="align" :side="side" class="xpe-icon-popover">
      <div class="xpe-icon-grid">
        <button
          v-for="emoji in EMOJI_PRESETS"
          :key="emoji"
          type="button"
          class="xpe-icon-cell"
          :class="{ 'xpe-icon-cell--active': emoji === model }"
          @click="pick(emoji)"
        >
          {{ emoji }}
        </button>
      </div>
      <div class="xpe-icon-custom">
        <input
          v-model="customValue"
          type="text"
          maxlength="8"
          placeholder="Custom emoji or text"
          class="xpe-icon-custom-input"
          @keydown.enter.prevent="applyCustom"
        />
        <button type="button" class="xpe-icon-custom-apply" @click="applyCustom">Set</button>
      </div>
    </PopoverContent>
  </Popover>
</template>

<style scoped>
.xpe-icon-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  line-height: 1;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0;
}
.xpe-icon-popover {
  padding: 10px;
  width: 232px;
}
.xpe-icon-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 2px;
}
.xpe-icon-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 26px;
  border-radius: 6px;
  border: none;
  background: transparent;
  font-size: 15px;
  cursor: pointer;
}
.xpe-icon-cell:hover {
  background: #f3f4f6;
}
.xpe-icon-cell--active {
  background: #eef2ff;
}
.xpe-icon-custom {
  display: flex;
  gap: 6px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #f3f4f6;
}
.xpe-icon-custom-input {
  flex: 1;
  height: 28px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 0 8px;
  font-size: 12px;
  outline: none;
}
.xpe-icon-custom-apply {
  height: 28px;
  padding: 0 10px;
  border-radius: 6px;
  border: none;
  background: #4f46e5;
  color: #fff;
  font-size: 12px;
  cursor: pointer;
}
</style>
