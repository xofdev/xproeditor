<script setup lang="ts">
import { inject, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { syncThemeVars } from '@xproeditor/core'
import { popoverContextKey } from './popoverContext'

const props = withDefaults(
  defineProps<{
    align?: 'start' | 'center' | 'end'
    side?: 'top' | 'bottom' | 'left' | 'right'
    sideOffset?: number
  }>(),
  {
    align: 'start',
    side: 'bottom',
    sideOffset: 6,
  },
)

defineOptions({ inheritAttrs: false })

const ctx = inject(popoverContextKey)
if (!ctx) {
  throw new Error('<PopoverContent> must be used inside <Popover>')
}

const contentEl = ref<HTMLElement | null>(null)
const style = ref<Record<string, string>>({ position: 'fixed', top: '0px', left: '0px' })

function reposition(): void {
  const trigger = ctx!.triggerEl.value
  const content = contentEl.value
  if (!trigger || !content) return

  // The popover is teleported to <body>, which escapes any scoped theme
  // class applied to an ancestor of the editor — resync inline so it still
  // picks up a custom --xpe-* theme.
  syncThemeVars(trigger, content)

  const anchor = (trigger.firstElementChild as HTMLElement | null) ?? trigger
  const rect = anchor.getBoundingClientRect()
  const contentRect = content.getBoundingClientRect()

  let top = rect.bottom + props.sideOffset
  let left = rect.left

  if (props.side === 'top') top = rect.top - contentRect.height - props.sideOffset
  if (props.side === 'left') {
    top = rect.top
    left = rect.left - contentRect.width - props.sideOffset
  }
  if (props.side === 'right') {
    top = rect.top
    left = rect.right + props.sideOffset
  }

  if (props.side === 'top' || props.side === 'bottom') {
    if (props.align === 'center') left = rect.left + rect.width / 2 - contentRect.width / 2
    if (props.align === 'end') left = rect.right - contentRect.width
  }

  const maxLeft = window.innerWidth - contentRect.width - 8
  left = Math.min(Math.max(8, left), Math.max(8, maxLeft))
  top = Math.min(Math.max(8, top), window.innerHeight - 8)

  style.value = { position: 'fixed', top: `${top}px`, left: `${left}px` }
}

function onOutsideDown(event: MouseEvent): void {
  if (document.body.dataset.colorPickerDragging === 'true') return

  const target = event.target as Node
  if (contentEl.value?.contains(target)) return
  if (ctx!.triggerEl.value?.contains(target)) return

  ctx!.setOpen(false)
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') ctx!.setOpen(false)
}

watch(
  () => ctx!.open.value,
  async (open) => {
    if (open) {
      await nextTick()
      reposition()
      window.addEventListener('mousedown', onOutsideDown, true)
      window.addEventListener('resize', reposition)
      window.addEventListener('keydown', onKeydown)
    } else {
      window.removeEventListener('mousedown', onOutsideDown, true)
      window.removeEventListener('resize', reposition)
      window.removeEventListener('keydown', onKeydown)
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  window.removeEventListener('mousedown', onOutsideDown, true)
  window.removeEventListener('resize', reposition)
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="ctx.open.value"
      ref="contentEl"
      class="xpe-popover-content"
      :style="style"
      v-bind="$attrs"
    >
      <slot />
    </div>
  </Teleport>
</template>

<style scoped>
.xpe-popover-content {
  z-index: 80;
  border-radius: var(--xpe-radius, 12px);
  border: 1px solid var(--xpe-muted, #f3f4f6);
  background: var(--xpe-surface, #fff);
  box-shadow:
    0 10px 15px -3px rgb(0 0 0 / 0.1),
    0 4px 6px -4px rgb(0 0 0 / 0.1);
}
</style>
