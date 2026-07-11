import { useRef, useState } from 'react'
import { Download, FileText, FolderOpen, Loader2, Paperclip, Upload } from 'lucide-react'
import type { Block } from '@xproeditor/core'
import { fileToObjectUrl, formatFileSize, mediaPropsFromFile } from '@xproeditor/core'
import type { PickMediaFn, UploadFn } from '../types'

export interface FileBlockProps {
  block: Block
  selected?: boolean
  readonly?: boolean
  upload?: UploadFn
  pickMedia?: PickMediaFn
  onPatch: (patch: Record<string, unknown>) => void
  onSelect: () => void
}

export function FileBlock({
  block,
  selected,
  readonly,
  upload,
  pickMedia,
  onPatch,
  onSelect,
}: FileBlockProps) {
  const [uploading, setUploading] = useState(false)
  const [picking, setPicking] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInput = useRef<HTMLInputElement | null>(null)

  const busy = uploading || picking

  async function uploadFile(file: File) {
    setUploading(true)
    try {
      const url = await (upload ?? fileToObjectUrl)(file)
      onPatch(mediaPropsFromFile(file, url))
    } finally {
      setUploading(false)
    }
  }

  async function pickFromLibrary() {
    if (!pickMedia) return

    setPicking(true)
    try {
      const result = await pickMedia({ accept: ['*/*'], title: 'Choose file' })
      if (result?.url) onPatch({ url: result.url, ...(result.caption ? { name: result.caption } : {}) })
    } finally {
      setPicking(false)
    }
  }

  function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) uploadFile(file)
  }

  function onDrop(e: React.DragEvent) {
    setDragOver(false)
    const file = e.dataTransfer?.files?.[0]
    if (file) uploadFile(file)
  }

  const stop = (e: React.SyntheticEvent) => e.stopPropagation()

  if (!block.props.url && !readonly) {
    return (
      <div className="my-1">
        <div
          className={`flex flex-col items-center justify-center gap-3 rounded-[var(--xpe-radius)] border-2 border-dashed py-6 transition-colors ${dragOver ? 'border-[var(--xpe-ring)] bg-[var(--xpe-primary-muted)]' : 'border-[var(--xpe-border)] bg-[var(--xpe-muted)]'}`}
          onClick={onSelect}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onDrop(e)
          }}
        >
          <div className="flex items-center gap-2 text-[var(--xpe-muted-foreground)]">
            {busy ? (
              <Loader2 className="h-5 w-5 animate-spin text-[var(--xpe-primary)]" />
            ) : (
              <Paperclip className="h-5 w-5" />
            )}
            <span className="text-sm">{busy ? 'Working...' : 'Attach a file'}</span>
          </div>
          {!busy && (
            <div
              className="flex flex-wrap items-center justify-center gap-2"
              onClick={stop}
              onMouseDown={stop}
              onPointerDown={stop}
            >
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--xpe-border)] bg-[var(--xpe-surface)] px-3 py-1.5 text-xs font-medium text-[var(--xpe-foreground)] hover:bg-[var(--xpe-surface-hover)]"
                onClick={() => fileInput.current?.click()}
              >
                <Upload className="h-3.5 w-3.5" />
                Upload
              </button>
              {pickMedia && (
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--xpe-border)] bg-[var(--xpe-surface)] px-3 py-1.5 text-xs font-medium text-[var(--xpe-foreground)] hover:bg-[var(--xpe-surface-hover)]"
                  onClick={pickFromLibrary}
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                  Library
                </button>
              )}
            </div>
          )}
          <input ref={fileInput} type="file" className="hidden" onChange={onFilePicked} />
        </div>
      </div>
    )
  }

  return (
    <div className="my-1">
      <div className="group/file relative">
        <div
          className={`flex items-center gap-3 rounded-[var(--xpe-radius)] border bg-[var(--xpe-muted)] px-3.5 py-2.5 transition-shadow ${selected ? 'border-[var(--xpe-ring)] ring-1 ring-[var(--xpe-ring)]' : 'border-[var(--xpe-border)]'}`}
          onClick={onSelect}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--xpe-surface)] text-[var(--xpe-primary)]">
            <FileText className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-[var(--xpe-foreground)]">
              {block.props.name || 'File'}
            </span>
            {block.props.size ? (
              <span className="block text-xs text-[var(--xpe-muted-foreground)]">
                {formatFileSize(block.props.size)}
              </span>
            ) : null}
          </span>
          <a
            href={block.props.url}
            download={block.props.name ?? true}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--xpe-muted-foreground)] hover:bg-[var(--xpe-surface-hover)] hover:text-[var(--xpe-foreground)]"
            title="Download"
            onClick={(e) => e.stopPropagation()}
          >
            <Download className="h-4 w-4" />
          </a>
        </div>

        {!readonly && (
          <div className="absolute end-12 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded-lg bg-black/60 p-0.5 backdrop-blur group-hover/file:flex">
            <button
              className="rounded-md px-1.5 py-0.5 text-[10px] text-white/80 hover:bg-white/20"
              title="Replace file"
              onClick={(e) => {
                e.stopPropagation()
                fileInput.current?.click()
              }}
            >
              ↻
            </button>
            <button
              className="rounded-md px-1.5 py-0.5 text-[10px] text-white/80 hover:bg-white/20"
              title="Remove file"
              onClick={(e) => {
                e.stopPropagation()
                onPatch({ url: '', name: undefined, size: undefined, mime: undefined })
              }}
            >
              ✕
            </button>
            <input ref={fileInput} type="file" className="hidden" onChange={onFilePicked} />
          </div>
        )}
      </div>
    </div>
  )
}
