import { forwardRef, useImperativeHandle } from 'react'
import type { Block } from '@xproeditor/core'
import { useBlockEditor, type UseBlockEditorOptions } from '../hooks/useBlockEditor'
import { BlockItem } from './BlockItem'
import { BubbleToolbar } from './BubbleToolbar'
import { SlashMenu } from './SlashMenu'
import type { FormatToolbarState } from '../types'

export interface BlockEditorProps {
  /** Seed content. The editor owns the blocks afterwards (uncontrolled, like `<input defaultValue>`). */
  defaultValue: Block[]
  upload?: UseBlockEditorOptions['upload']
  pickMedia?: UseBlockEditorOptions['pickMedia']
  editorDir?: 'ltr' | 'rtl'
  readonly?: boolean
  /** Floating bubble toolbar on text selection (disabled when using a sticky format toolbar). */
  showBubbleToolbar?: boolean
  onChange?: (blocks: Block[]) => void
  onFormatState?: (state: FormatToolbarState | null) => void
}

export interface BlockEditorHandle {
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
  focusFirst: () => void
  focusEnd: () => void
}

export const BlockEditor = forwardRef<BlockEditorHandle, BlockEditorProps>(function BlockEditor(
  {
    defaultValue,
    upload,
    pickMedia,
    editorDir,
    readonly,
    showBubbleToolbar,
    onChange,
    onFormatState,
  },
  ref,
) {
  const ed = useBlockEditor({
    defaultValue,
    upload,
    pickMedia,
    editorDir,
    readonly,
    showBubbleToolbar,
    onChange,
    onFormatState,
  })

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
    focusFirst: ed.focusFirst,
    focusEnd: ed.focusEnd,
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
      {ed.visibleBlocks.map((block) => (
        <BlockItem
          key={block.id}
          ref={(instance) => ed.setItemRef(block.id, instance)}
          block={block}
          number={ed.numbering.get(block.id)}
          placeholder={ed.placeholderFor(block)}
          selected={ed.selectedBlockId === block.id}
          textHighlight={ed.textHighlightForBlock(block.id)}
          dropPosition={ed.dropTarget?.id === block.id ? ed.dropTarget.position : null}
          upload={ed.upload}
          pickMedia={ed.pickMedia}
          editorDir={ed.editorDir}
          readonly={ed.readonly}
          iconPickerRequest={
            ed.iconPickerRequest?.blockId === block.id ? { tab: ed.iconPickerRequest.tab } : null
          }
          onInput={(s, c) => ed.handleInput(block, s, c)}
          onEnter={(o) => ed.handleEnter(block, o)}
          onBackspaceStart={() => ed.handleBackspaceStart(block)}
          onDeleteEnd={() => ed.handleDeleteEnd(block)}
          onArrowUp={() => ed.handleArrow(block, -1)}
          onArrowDown={() => ed.handleArrow(block, 1)}
          onTab={(s) => ed.handleTab(block, s)}
          onFormat={(m) => ed.handleFormat(block, m)}
          onPasted={(p) => ed.handlePasted(block, p)}
          onFocus={() => ed.onBlockFocus(block)}
          onPatch={(p) => ed.patchProps(block, p)}
          onIconPickerOpened={() => ed.setIconPickerRequest(null)}
          onSelect={() => ed.selectBlock(block.id)}
          onAddBelow={() => ed.addBelow(block)}
          onDuplicate={() => ed.duplicateBlock(block)}
          onRemove={() => ed.removeBlock(block)}
          onDragHandleStart={(e) => ed.onDragHandleStart(block, e)}
          onPointerDown={(e) => ed.onBlockPointerDown(block, e)}
          onSelectionPointerDown={(p) => ed.onSelectionPointerDown(block, p)}
          onTableCellFocus={(p) => ed.onTableCellFocus(block, p)}
          onTableCellInput={(p) => ed.onTableCellInput(block, p)}
          onTableCellFormat={(p) => ed.handleTableFormat(block, p)}
          onTableCellTab={(p) => ed.handleTableTab(block, p)}
          onTableCellNavigate={(p) => ed.handleTableNavigate(block, p)}
          onTableCellSelectionChange={(cells) => ed.onTableCellSelectionChange(block, cells)}
        />
      ))}

      {!ed.readonly && <div className="h-28 cursor-text" onClick={ed.onTailClick} />}

      {ed.slashState && !ed.readonly && (
        <SlashMenu
          ref={ed.slashMenuApiRef}
          query={ed.slashState.query}
          position={ed.slashState.position}
          onSelect={ed.onSlashSelect}
          onClose={ed.closeSlash}
        />
      )}

      {ed.showBubbleToolbar && ed.bubble && !ed.readonly && (
        <BubbleToolbar
          position={ed.bubble.position}
          activeMarks={ed.bubble.activeMarks}
          currentLink={ed.bubble.currentLink}
          currentColor={ed.bubble.currentColor}
          currentHighlight={ed.bubble.currentHighlight}
          blockType={ed.bubble.blockType}
          onMark={ed.onBubbleMark}
          onTurnInto={ed.onBubbleTurnInto}
        />
      )}
    </div>
  )
})
