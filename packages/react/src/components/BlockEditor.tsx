import { forwardRef, memo, useCallback, useImperativeHandle, useRef, type MutableRefObject } from 'react'
import type { AICommand, AITransport, Block, EditorDocumentApi, InlineSpan } from '@xproeditor/core'
import { useBlockEditor, type UseBlockEditorOptions } from '../hooks/useBlockEditor'
import { AIMenu } from './AIMenu'
import { BlockItem, type BlockItemProps } from './BlockItem'
import { BubbleToolbar } from './BubbleToolbar'
import { EmojiTriggerMenu } from './EmojiTriggerMenu'
import { SlashMenu } from './SlashMenu'
import type { FormatToolbarState } from '../types'
import { EditorI18nProvider, type EditorI18nProps } from '../i18n'

export interface BlockEditorProps {
  /** Seed content. The editor owns the blocks afterwards (uncontrolled, like `<input defaultValue>`). */
  defaultValue: Block[]
  upload?: UseBlockEditorOptions['upload']
  pickMedia?: UseBlockEditorOptions['pickMedia']
  fetchBookmarkMeta?: UseBlockEditorOptions['fetchBookmarkMeta']
  editorDir?: 'ltr' | 'rtl'
  readonly?: boolean
  /** Floating bubble toolbar on text selection (disabled when using a sticky format toolbar). */
  showBubbleToolbar?: boolean
  /** Pluggable AI agent — host supplies transport (OpenAI/Anthropic/custom). */
  ai?: {
    transport: AITransport
    commands?: AICommand[]
  }
  onChange?: (blocks: Block[]) => void
  onFormatState?: (state: FormatToolbarState | null) => void
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

export interface BlockEditorHandle extends EditorDocumentApi {
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  applyToolbarMark: ReturnType<typeof useBlockEditor>['applyToolbarMark']
  turnIntoBlock: ReturnType<typeof useBlockEditor>['turnIntoBlock']
  indentFocusedBlock: () => void
  outdentFocusedBlock: () => void
  setFocusedAlign: ReturnType<typeof useBlockEditor>['setFocusedAlign']
  setFocusedDir: ReturnType<typeof useBlockEditor>['setFocusedDir']
  setFocusedCalloutIcon: (icon: string | null) => void
  patchTableStyle: ReturnType<typeof useBlockEditor>['patchTableStyle']
  patchTableCellBackground: (color: string | null) => void
  openAIMenu: () => void
  focusFirst: () => void
  focusEnd: () => void
}

/**
 * The block editor surface (no fixed toolbar). Most apps want `<ProEditor>`;
 * use this when you build your own chrome around the editor API.
 */
export const BlockEditor = forwardRef<BlockEditorHandle, BlockEditorProps>(function BlockEditor(
  { locale, dictionary, ...props },
  ref,
) {
  return (
    <EditorI18nProvider locale={locale} dictionary={dictionary}>
      <BlockEditorInner ref={ref} {...props} />
    </EditorI18nProvider>
  )
})

const BlockEditorInner = forwardRef<
  BlockEditorHandle,
  Omit<BlockEditorProps, 'locale' | 'dictionary'>
>(function BlockEditorInner(
  {
    defaultValue,
    upload,
    pickMedia,
    fetchBookmarkMeta,
    editorDir,
    readonly,
    showBubbleToolbar,
    ai,
    onChange,
    onFormatState,
    onUploadError,
    placeholder,
    spellCheck,
    autofocus,
  },
  ref,
) {
  const ed = useBlockEditor({
    onUploadError,
    placeholder,
    spellCheck,
    autofocus,
    defaultValue,
    upload,
    pickMedia,
    fetchBookmarkMeta,
    editorDir,
    readonly,
    showBubbleToolbar,
    ai,
    onChange,
    onFormatState,
  })

  // Rows read handlers through this ref at call time, so a row that skipped
  // re-rendering (memoised) never calls a stale handler.
  const edRef = useRef(ed)
  edRef.current = ed

  useImperativeHandle(ref, () => ({
    undo: ed.undo,
    redo: ed.redo,
    canUndo: ed.canUndo,
    canRedo: ed.canRedo,
    applyToolbarMark: ed.applyToolbarMark,
    turnIntoBlock: ed.turnIntoBlock,
    indentFocusedBlock: ed.indentFocusedBlock,
    outdentFocusedBlock: ed.outdentFocusedBlock,
    setFocusedAlign: ed.setFocusedAlign,
    setFocusedDir: ed.setFocusedDir,
    setFocusedCalloutIcon: ed.setFocusedCalloutIcon,
    patchTableStyle: ed.patchTableStyle,
    patchTableCellBackground: ed.patchTableCellBackground,
    openAIMenu: ed.openAIMenu,
    focusFirst: ed.focusFirst,
    focusEnd: ed.focusEnd,
    focus: ed.focus,
    getBlocks: ed.getBlocks,
    setBlocks: ed.setBlocks,
    insertBlocks: ed.insertBlocks,
    updateBlock: ed.updateBlock,
    removeBlocks: ed.removeBlocks,
    getMarkdown: ed.getMarkdown,
    getHTML: ed.getHTML,
    getText: ed.getText,
    getStats: ed.getStats,
  }))

  return (
    <div
      ref={ed.rootRef}
      className="block-editor outline-none"
      dir={ed.editorDir ?? 'ltr'}
      tabIndex={-1}
      onKeyDownCapture={ed.onKeydownCapture}
      onKeyDown={ed.onRootKeydown}
      onCopyCapture={ed.onCopy}
      onCutCapture={ed.onCut}
      onPasteCapture={ed.onPaste}
      onDragOver={ed.onDragOver}
      onDrop={ed.onDrop}
      onDragEnd={ed.onDragEnd}
    >
      {ed.visibleBlocks.map((block) => {
        const highlight = ed.textHighlightForBlock(block.id)

        return (
          <EditorBlockRow
            key={block.id}
            edRef={edRef}
            block={block}
            signature={blockSignature(block)}
            number={ed.numbering.get(block.id)}
            placeholder={ed.placeholderFor(block)}
            selected={ed.isBlockChromeSelected(block.id)}
            highlightStart={highlight?.start ?? -1}
            highlightEnd={highlight?.end ?? -1}
            dropPosition={ed.dropTarget && ed.dropTarget.id === block.id ? ed.dropTarget.position : null}
            upload={ed.upload}
            pickMedia={ed.pickMedia}
            fetchBookmarkMeta={ed.fetchBookmarkMeta}
            editorDir={ed.editorDir}
            readonly={ed.readonly}
            themeSource={ed.rootRef.current}
            iconPickerTab={
              ed.iconPickerRequest && ed.iconPickerRequest.blockId === block.id
                ? ed.iconPickerRequest.tab
                : null
            }
            aiEnabled={!!ed.ai?.transport}
            spellCheck={ed.spellCheck}
            tocHeadings={block.type === 'table_of_contents' ? ed.tocHeadings : undefined}
          />
        )
      })}

      {!ed.readonly && <div className="h-28 cursor-text" onClick={ed.onTailClick} />}

      {ed.slashState && !ed.readonly && (
        <SlashMenu
          ref={ed.slashMenuApiRef}
          query={ed.slashState.query}
          position={ed.slashState.position}
          dir={ed.editorDir ?? 'ltr'}
          themeSource={ed.rootRef.current}
          aiEnabled={typeof ed.ai?.transport === 'function'}
          onSelect={ed.onSlashSelect}
          onClose={ed.closeSlash}
        />
      )}

      {ed.emojiTriggerState && !ed.readonly && (
        <EmojiTriggerMenu
          query={ed.emojiTriggerState.query}
          position={ed.emojiTriggerState.position}
          dir={ed.editorDir ?? 'ltr'}
          themeSource={ed.rootRef.current}
          onSelect={ed.onEmojiTriggerSelect}
        />
      )}

      {ed.showBubbleToolbar && ed.bubble && !ed.readonly && (
        <BubbleToolbar
          position={ed.bubble.position}
          placement={ed.bubble.placement}
          activeMarks={ed.bubble.activeMarks}
          currentLink={ed.bubble.currentLink}
          currentColor={ed.bubble.currentColor}
          currentHighlight={ed.bubble.currentHighlight}
          blockType={ed.bubble.blockType}
          multiBlock={ed.bubble.multiBlock}
          mixedTypes={ed.bubble.mixedTypes}
          aiEnabled={typeof ed.ai?.transport === 'function'}
          themeSource={ed.rootRef.current}
          onMark={ed.onBubbleMark}
          onTurnInto={ed.onBubbleTurnInto}
          onClearFormatting={ed.onBubbleClearFormatting}
          onAskAI={ed.onBubbleAskAI}
          onCopy={ed.bubble.multiBlock ? ed.onBubbleCopy : undefined}
          onDuplicate={ed.bubble.multiBlock ? ed.onBubbleDuplicate : undefined}
          onDelete={ed.bubble.multiBlock ? ed.onBubbleDelete : undefined}
          linkRequest={ed.linkRequest}
        />
      )}

      {ed.aiMenu && ed.ai?.transport && !ed.readonly && (
        <AIMenu
          open
          position={ed.aiMenu.position}
          transport={ed.ai.transport}
          commands={ed.ai.commands}
          blocks={ed.blocks}
          selectionBlocks={ed.getAISelectionBlocks()}
          focusBlockId={ed.focusedBlockId ?? ed.selectedBlockId}
          themeSource={ed.rootRef.current}
          onApply={ed.replaceDocumentBlocks}
          onClose={ed.closeAIMenu}
        />
      )}
    </div>
  )
})

type EditorApi = ReturnType<typeof useBlockEditor>

const contentSignatures = new WeakMap<InlineSpan[], string>()

/**
 * Cheap change detector for a block. The editor mutates blocks in place, so
 * object identity can't tell a row whether to re-render; the serialized
 * type/props/content can. Content arrays are replaced on every edit, so
 * their serialization is cached per array.
 */
function blockSignature(block: Block): string {
  let content = contentSignatures.get(block.content)

  if (content === undefined) {
    content = JSON.stringify(block.content)
    contentSignatures.set(block.content, content)
  }

  return `${block.type}\u0000${JSON.stringify(block.props)}\u0000${content}`
}

interface EditorBlockRowProps
  extends Pick<
    BlockItemProps,
    | 'number'
    | 'placeholder'
    | 'selected'
    | 'dropPosition'
    | 'upload'
    | 'pickMedia'
    | 'fetchBookmarkMeta'
    | 'editorDir'
    | 'readonly'
    | 'themeSource'
    | 'aiEnabled'
    | 'spellCheck'
    | 'tocHeadings'
  > {
  edRef: MutableRefObject<EditorApi>
  block: Block
  signature: string
  highlightStart: number
  highlightEnd: number
  iconPickerTab: 'emoji' | 'icon' | null
}

/**
 * One editor row. Memoised on its data props only — typing in one block no
 * longer re-renders every other block — while every handler is resolved
 * through `edRef` when it fires.
 */
const EditorBlockRow = memo(function EditorBlockRow({
  edRef,
  block,
  signature: _signature,
  highlightStart,
  highlightEnd,
  iconPickerTab,
  ...data
}: EditorBlockRowProps) {
  const ed = () => edRef.current
  const setRef = useCallback(
    (instance: Parameters<EditorApi['setItemRef']>[1]) => edRef.current.setItemRef(block.id, instance),
    [edRef, block.id],
  )

  return (
    <BlockItem
      ref={setRef}
      block={block}
      {...data}
      textHighlight={highlightStart >= 0 ? { start: highlightStart, end: highlightEnd } : null}
      iconPickerRequest={iconPickerTab ? { tab: iconPickerTab } : null}
      onInput={(s, c) => ed().handleInput(block, s, c)}
      onEnter={(o) => ed().handleEnter(block, o)}
      onBackspaceStart={() => ed().handleBackspaceStart(block)}
      onDeleteEnd={() => ed().handleDeleteEnd(block)}
      onArrowUp={() => ed().handleArrow(block, -1)}
      onArrowDown={() => ed().handleArrow(block, 1)}
      onTab={(s) => ed().handleTab(block, s)}
      onFormat={(m) => ed().handleFormat(block, m)}
      onPasted={(p) => void ed().handlePasted(block, p)}
      onFocus={() => ed().onBlockFocus(block)}
      onPatch={(p) => ed().patchProps(block, p)}
      onIconPickerOpened={() => ed().setIconPickerRequest(null)}
      onSelect={() => ed().selectBlock(block.id)}
      onAddBelow={() => ed().addBelow(block)}
      onDuplicate={() => ed().duplicateBlock(block)}
      onCopy={() => void ed().copyBlock(block)}
      onCut={() => void ed().cutBlock(block)}
      onRemove={() => ed().removeBlock(block)}
      onTurnInto={(type) => ed().turnBlockInto(block, type)}
      onAskAI={data.aiEnabled ? () => ed().openAIMenu() : undefined}
      onDragHandleStart={(e) => ed().onDragHandleStart(block, e)}
      onPointerDown={(e) => ed().onBlockPointerDown(block, e)}
      onSelectionPointerDown={(p) => ed().onSelectionPointerDown(block, p)}
      onTableCellFocus={(p) => ed().onTableCellFocus(block, p)}
      onTableCellInput={(p) => ed().onTableCellInput(block, p)}
      onTableCellFormat={(p) => ed().handleTableFormat(block, p)}
      onTableCellTab={(p) => ed().handleTableTab(block, p)}
      onTableCellNavigate={(p) => ed().handleTableNavigate(block, p)}
      onTableCellSelectionChange={(cells) => ed().onTableCellSelectionChange(block, cells)}
      onNavigateToBlock={(id) => ed().navigateToBlock(id)}
    />
  )
})
