import type { InjectionKey, Ref } from 'vue'

export interface PopoverContext {
  open: Ref<boolean>
  triggerEl: Ref<HTMLElement | null>
  setOpen: (value: boolean) => void
}

export const popoverContextKey: InjectionKey<PopoverContext> = Symbol('xpe-popover')
