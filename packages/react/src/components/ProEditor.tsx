import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import type { AICommand, AITransport, Block } from '@xproeditor/core'
import { BlockEditor, type BlockEditorHandle } from './BlockEditor'
import { FormatToolbar } from './FormatToolbar'
import type { FormatToolbarState } from '../types'
import type { PickMediaFn, UploadFn } from '../types'

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
  editorDir?: 'ltr' | 'rtl'
  readonly?: boolean
  /** Pluggable AI agent — host supplies transport (OpenAI/Anthropic/custom). */
  ai?: {
    transport: AITransport
    commands?: AICommand[]
  }
  onChange?: (blocks: Block[]) => void
}

export interface ProEditorHandle {
  undo: () => void
  redo: () => void
  openAIMenu: () => void
  focusFirst: () => void
  focusEnd: () => void
}

export const ProEditor = forwardRef<ProEditorHandle, ProEditorProps>(function ProEditor(
  { defaultValue, toolbar = 'floating', upload, pickMedia, editorDir, readonly, ai, onChange },
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
  }))

  return (
    <div className="xpe-pro-editor">
      {showFixedToolbar && (
        <FormatToolbar
          state={formatState}
          showAI={!!ai?.transport}
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
        editorDir={editorDir}
        readonly={readonly}
        showBubbleToolbar={showBubbleToolbar}
        ai={ai}
        onChange={onChange}
        onFormatState={setFormatState}
      />
    </div>
  )
})
