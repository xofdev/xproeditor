import { describe, expect, it } from 'vitest'
import { BLOCK_TYPES } from './types'
import { EN_DICTIONARY, FA_DICTIONARY, localeDirection, resolveEditorDictionary } from './i18n'

function keysOf(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object') return [prefix]
  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) => keysOf(v, prefix ? `${prefix}.${k}` : k))
}

describe('i18n', () => {
  it('Persian covers every English key', () => {
    expect(keysOf(FA_DICTIONARY).sort()).toEqual(keysOf(EN_DICTIONARY).sort())
  })

  it('labels every block type', () => {
    for (const type of BLOCK_TYPES) {
      expect(EN_DICTIONARY.blockTypes[type]).toBeTruthy()
      expect(FA_DICTIONARY.blockTypes[type]).toBeTruthy()
      expect(EN_DICTIONARY.blockDescriptions[type]).toBeTruthy()
    }
  })

  it('merges partial overrides over the chosen locale', () => {
    const dict = resolveEditorDictionary('fa', { toolbar: { bold: 'B!' } })

    expect(dict.toolbar.bold).toBe('B!')
    expect(dict.toolbar.italic).toBe(FA_DICTIONARY.toolbar.italic)
    expect(FA_DICTIONARY.toolbar.bold).not.toBe('B!')
  })

  it('falls back to English for unknown locales', () => {
    expect(resolveEditorDictionary('xx')).toBe(EN_DICTIONARY)
  })

  it('knows RTL locales', () => {
    expect(localeDirection('fa')).toBe('rtl')
    expect(localeDirection('ar-EG')).toBe('rtl')
    expect(localeDirection('en')).toBe('ltr')
  })
})
