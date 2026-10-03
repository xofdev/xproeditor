import { createContext, useContext, useMemo, type ReactNode } from 'react'
import {
  EN_DICTIONARY,
  resolveEditorDictionary,
  type EditorDictionary,
  type EditorDictionaryOverrides,
} from '@xproeditor/core'

const EditorI18nContext = createContext<EditorDictionary>(EN_DICTIONARY)

export interface EditorI18nProps {
  /** Built-in UI language (`'en'` default, `'fa'`). Unknown codes fall back to English. */
  locale?: string
  /** Override any UI string, or provide a whole new language. */
  dictionary?: EditorDictionaryOverrides
}

/** Provides the editor UI strings to every component (including portaled menus). */
export function EditorI18nProvider({
  locale,
  dictionary,
  children,
}: EditorI18nProps & { children: ReactNode }) {
  // Hosts often pass `dictionary` inline — key the memo on its content, not identity.
  const key = dictionary ? JSON.stringify(dictionary) : ''
  const value = useMemo(
    () => resolveEditorDictionary(locale, dictionary),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale, key],
  )

  return <EditorI18nContext.Provider value={value}>{children}</EditorI18nContext.Provider>
}

/** Current editor UI strings (English outside a provider). */
export function useEditorDictionary(): EditorDictionary {
  return useContext(EditorI18nContext)
}
