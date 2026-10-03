import { computed, inject, provide, unref, type ComputedRef, type InjectionKey, type MaybeRef } from 'vue'
import {
  EN_DICTIONARY,
  resolveEditorDictionary,
  type EditorDictionary,
  type EditorDictionaryOverrides,
} from '@xproeditor/core'

export const EDITOR_I18N_KEY: InjectionKey<ComputedRef<EditorDictionary>> = Symbol('xpe-i18n')

const ENGLISH = computed(() => EN_DICTIONARY)

/**
 * Provide the editor UI strings to every descendant (teleported menus
 * included). Returns the resolved dictionary for the providing component.
 */
export function provideEditorI18n(
  locale: MaybeRef<string | undefined>,
  dictionary: MaybeRef<EditorDictionaryOverrides | undefined>,
): ComputedRef<EditorDictionary> {
  const dict = computed(() => resolveEditorDictionary(unref(locale), unref(dictionary)))
  provide(EDITOR_I18N_KEY, dict)
  return dict
}

/** Current editor UI strings (English outside a provider). */
export function useEditorDictionary(): ComputedRef<EditorDictionary> {
  return inject(EDITOR_I18N_KEY, ENGLISH)
}
