<script setup lang="ts">
import { ref } from 'vue'
import EmojiPicker from './EmojiPicker.vue'
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
      <EmojiPicker @select="pick" />
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
  padding: 0;
  width: 300px;
  overflow: hidden;
}
.xpe-icon-custom {
  display: flex;
  gap: 6px;
  margin: 0;
  padding: 8px 10px;
  border-top: 1px solid var(--xpe-border, #f3f4f6);
}
.xpe-icon-custom-input {
  flex: 1;
  height: 28px;
  border: 1px solid var(--xpe-border, #e5e7eb);
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
  background: var(--xpe-primary, #4f46e5);
  color: var(--xpe-primary-foreground, #fff);
  font-size: 12px;
  cursor: pointer;
}
</style>
