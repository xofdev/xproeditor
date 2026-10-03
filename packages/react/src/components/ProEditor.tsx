import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import type { AICommand, AITransport, Block, EditorDocumentApi } from '@xproeditor/core'
import { BlockEditor, type BlockEditorHandle } from './BlockEditor'
import { FormatToolbar } from './FormatToolbar'
import type { FormatToolbarState } from '../types'
import { EditorI18nProvider, type EditorI18nProps } from '../i18n'
import type { FetchBookmarkMetaFn, PickMediaFn, UploadFn } from '../types'

export interface ProEditorProps {
  defaultValue: Block[]
  /**
   * `fixed` renders a sticky top toolbar (classic WYSIWYG feel). `floating`
   * (default) is the Notion-like experience: a bubble toolbar appears on
   * text selection and `/` opens the slash menu. `both` shows both. `none`
   * renders neither — build your own chrome around {@link BlockEditor}.
   */
  toolbar?: 'fixed' | 'floating' | 'both' | 'none'
  upload?: UploadFn
  pickMedia?: PickMediaFn
  /** Optional OG/favicon metadata fetcher for bookmark blocks. */
  fetchBookmarkMeta?: FetchBookmarkMetaFn
  editorDir?: 'ltr' | 'rtl'
  readonly?: boolean
  /** Pluggable AI agent — host supplies transport (OpenAI/Anthropic/custom). */
  ai?: {
    transport: AITransport
    commands?: AICommand[]
  }
  onChange?: (blocks: Block[]) => void
  /** Called when `upload` rejects for a pasted/dropped file (the file is skipped). */
  onUploadError?: (error: unknown, file: File) => void
  /** Placeholder shown in the focused empty paragraph. */
  placeholder?: string
  /** Browser spellcheck in text blocks (default `true`). */
  spellCheck?: boolean
  /** Focus the editor on mount (`true` = end of document). */
  autofocus?: boolean | 'start' | 'end'
  /** UI language (`'en'` default, `'fa'` built in). */
  locale?: EditorI18nProps['locale']
  /** Override any UI string, or supply a whole new language. */
  dictionary?: EditorI18nProps['dictionary']
}

export interface ProEditorHandle extends EditorDocumentApi {
  undo: () => void
  redo: () => void
  openAIMenu: () => void
  focusFirst: () => void
  focusEnd: () => void
}

export const ProEditor = forwardRef<ProEditorHandle, ProEditorProps>(function ProEditor(
  {
    defaultValue,
    toolbar = 'floating',
    upload,
    pickMedia,
    fetchBookmarkMeta,
    editorDir,
    readonly,
    ai,
    onChange,
    onUploadError,
    placeholder,
    spellCheck,
    autofocus,
    locale,
    dictionary,
  },
  ref,
) {
  const editorRef = useRef<BlockEditorHandle | null>(null)
  const [formatState, setFormatState] = useState<FormatToolbarState | null>(null)

  const showFixedToolbar = toolbar === 'fixed' || toolbar === 'both'
  const showBubbleToolbar = toolbar === 'floating' || toolbar === 'both'

  useImperativeHandle(ref, () => ({
    undo: () => editorRef.current?.undo(),
    redo: () => editorRef.current?.redo(),
    openAIMenu: () => editorRef.current?.openAIMenu(),
    focusFirst: () => editorRef.current?.focusFirst(),
    focusEnd: () => editorRef.current?.focusEnd(),
    focus: (target) => editorRef.current?.focus(target),
    getBlocks: () => editorRef.current?.getBlocks() ?? [],
    setBlocks: (blocks, options) => editorRef.current?.setBlocks(blocks, options),
    insertBlocks: (blocks, position) => editorRef.current?.insertBlocks(blocks, position) ?? [],
    updateBlock: (id, patch) => editorRef.current?.updateBlock(id, patch) ?? false,
    removeBlocks: (ids) => editorRef.current?.removeBlocks(ids),
    getMarkdown: () => editorRef.current?.getMarkdown() ?? '',
    getHTML: () => editorRef.current?.getHTML() ?? '',
    getText: () => editorRef.current?.getText() ?? '',
    getStats: () =>
      editorRef.current?.getStats() ?? {
        blocks: 0,
        words: 0,
        characters: 0,
        charactersNoSpaces: 0,
        readingTimeMinutes: 0,
      },
  }))

  return (
    <EditorI18nProvider locale={locale} dictionary={dictionary}>
      <div className="xpe-pro-editor">
        {showFixedToolbar && (
          <FormatToolbar
            state={formatState}
            aiEnabled={typeof ai?.transport === 'function'}
            onMark={(mark, value) => editorRef.current?.applyToolbarMark(mark, value)}
            onTurnInto={(type) => editorRef.current?.turnIntoBlock(type)}
            onIndent={() => editorRef.current?.indentFocusedBlock()}
            onOutdent={() => editorRef.current?.outdentFocusedBlock()}
            onAlign={(align) => editorRef.current?.setFocusedAlign(align)}
            onDir={(dir) => editorRef.current?.setFocusedDir(dir)}
            onCalloutIcon={(icon) => editorRef.current?.setFocusedCalloutIcon(icon)}
            onTableStyle={(patch) => editorRef.current?.patchTableStyle(patch)}
            onCellBackground={(color) => editorRef.current?.patchTableCellBackground(color)}
            onAskAI={() => editorRef.current?.openAIMenu()}
          />
        )}

        <BlockEditor
          ref={editorRef}
          defaultValue={defaultValue}
          upload={upload}
          pickMedia={pickMedia}
          fetchBookmarkMeta={fetchBookmarkMeta}
          editorDir={editorDir}
          readonly={readonly}
          showBubbleToolbar={showBubbleToolbar}
          ai={ai}
          onChange={onChange}
          onFormatState={setFormatState}
          onUploadError={onUploadError}
          placeholder={placeholder}
          spellCheck={spellCheck}
          autofocus={autofocus}
          locale={locale}
          dictionary={dictionary}
        />
      </div>
    </EditorI18nProvider>
  )
})
