import type { InjectionKey, Ref } from 'vue'

export interface TabsContext {
  active: Ref<string>
  setActive: (value: string) => void
}

export const tabsContextKey: InjectionKey<TabsContext> = Symbol('xpe-tabs')
