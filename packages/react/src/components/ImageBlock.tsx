import { useEffect, useRef, useState } from 'react'
import { FolderOpen, ImagePlus, Link2, Loader2, Upload } from 'lucide-react'
import type { Block } from '@xproeditor/core'
import { fileToObjectUrl, mediaPropsFromFile } from '@xproeditor/core'
import type { PickMediaFn, UploadFn } from '../types'

export interface ImageBlockProps {
  block: Block
  selected?: boolean
  readonly?: boolean
  upload?: UploadFn
  pickMedia?: PickMediaFn
  onPatch: (patch: Record<string, unknown>) => void
  onSelect: () => void
}

const WIDTHS = [40, 60, 80, 100]

type InsertMode = 'upload' | 'library' | 'embed'

export function ImageBlock({
  block,
  selected,
  readonly,
  upload,
  pickMedia,
  onPatch,
  onSelect,
}: ImageBlockProps) {
  const [mode, setMode] = useState<InsertMode>('upload')
  const [uploading, setUploading] = useState(false)
  const [picking, setPicking] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [embedInput, setEmbedInput] = useState('')
  const [embedError, setEmbedError] = useState('')
  const embedInputRef = useRef<HTMLInputElement | null>(null)
  const fileInput = useRef<HTMLInputElement | null>(null)

  const busy = uploading || picking

  useEffect(() => {
    if (mode === 'embed') embedInputRef.current?.focus()
  }, [mode])

  async function uploadFile(file: File) {
    if (!file.type.startsWith('image/')) return

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
      const result = await pickMedia({ accept: ['image/*'], title: 'Choose image' })
      if (result?.url)
        onPatch({ url: result.url, ...(result.caption ? { caption: result.caption } : {}) })
    } finally {
      setPicking(false)
    }
  }

  function applyEmbed() {
    setEmbedError('')
    const url = embedInput.trim()

    if (!/^https?:\/\//i.test(url)) {
      setEmbedError('Enter a valid image URL')
      return
    }

    onPatch({ url })
    setEmbedInput('')
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
    const tabClass = (active: boolean) =>
      `rounded-lg px-2.5 py-1 text-xs font-medium ${active ? 'bg-[var(--xpe-primary-muted)] text-[var(--xpe-primary)]' : 'text-[var(--xpe-muted-foreground)] hover:bg-[var(--xpe-surface-hover)]'}`

    return (
      <div className="my-1">
        <div
          className={`flex flex-col gap-3 rounded-[var(--xpe-radius)] border-2 border-dashed py-6 transition-colors ${dragOver ? 'border-[var(--xpe-ring)] bg-[var(--xpe-primary-muted)]' : 'border-[var(--xpe-border)] bg-[var(--xpe-muted)]'}`}
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
          <div className="flex items-center justify-center gap-2 text-[var(--xpe-muted-foreground)]">
            {busy ? (
              <Loader2 className="h-5 w-5 animate-spin text-[var(--xpe-primary)]" />
            ) : (
              <ImagePlus className="h-5 w-5" />
            )}
            <span className="text-sm">{busy ? 'Working...' : 'Add an image'}</span>
          </div>

          {!busy && (
            <div
              className="flex justify-center gap-1 px-4"
              onClick={stop}
              onMouseDown={stop}
              onPointerDown={stop}
            >
              <button type="button" className={tabClass(mode === 'upload')} onClick={() => setMode('upload')}>
                Upload
              </button>
              {pickMedia && (
                <button type="button" className={tabClass(mode === 'library')} onClick={() => setMode('library')}>
                  Library
                </button>
              )}
              <button type="button" className={tabClass(mode === 'embed')} onClick={() => setMode('embed')}>
                Link
              </button>
            </div>
          )}

          {!busy && (
            <div className="px-4" onClick={stop} onMouseDown={stop} onPointerDown={stop}>
              {mode === 'upload' && (
                <div className="flex justify-center">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--xpe-border)] bg-[var(--xpe-surface)] px-3 py-1.5 text-xs font-medium text-[var(--xpe-foreground)] hover:bg-[var(--xpe-surface-hover)]"
                    onClick={() => fileInput.current?.click()}
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Choose image
                  </button>
                  <input
                    ref={fileInput}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={onFilePicked}
                  />
                </div>
              )}

              {mode === 'library' && (
                <div className="flex justify-center">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--xpe-border)] bg-[var(--xpe-surface)] px-3 py-1.5 text-xs font-medium text-[var(--xpe-foreground)] hover:bg-[var(--xpe-surface-hover)]"
                    onClick={pickFromLibrary}
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                    Open media library
                  </button>
                </div>
              )}

              {mode === 'embed' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Link2 className="h-4 w-4 shrink-0 text-[var(--xpe-muted-foreground)]" />
                    <input
                      ref={embedInputRef}
                      value={embedInput}
                      type="url"
                      className="min-w-0 flex-1 rounded-lg border border-[var(--xpe-border)] bg-[var(--xpe-surface)] px-2.5 py-1.5 text-xs text-[var(--xpe-foreground)] outline-none focus:border-[var(--xpe-ring)]"
                      placeholder="Paste an image URL"
                      onChange={(e) => setEmbedInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          applyEmbed()
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="rounded-lg bg-[var(--xpe-primary)] px-2.5 py-1.5 text-xs text-[var(--xpe-primary-foreground)]"
                      onClick={applyEmbed}
                    >
                      Add
                    </button>
                  </div>
                  {embedError && (
                    <p className="text-center text-xs text-[var(--xpe-danger)]">{embedError}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="my-1">
      <figure className="group/img relative" style={{ width: `${block.props.width ?? 100}%` }}>
        <div onClick={onSelect}>
          <img
            src={block.props.url}
            alt={block.props.caption || ''}
            className={`w-full rounded-[var(--xpe-radius)] transition-shadow ${selected ? 'ring-2 ring-[var(--xpe-ring)]' : ''}`}
            draggable={false}
          />
        </div>
        {!readonly && (
          <div className="absolute end-2 top-2 hidden items-center gap-0.5 rounded-lg bg-black/60 p-0.5 backdrop-blur group-hover/img:flex">
            {WIDTHS.map((w) => (
              <button
                key={w}
                className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium transition-colors ${(block.props.width ?? 100) === w ? 'bg-[var(--xpe-surface)] text-[var(--xpe-foreground)]' : 'text-white/80 hover:bg-white/20'}`}
                onClick={(e) => {
                  e.stopPropagation()
                  onPatch({ width: w })
                }}
              >
                {w}%
              </button>
            ))}
            <button
              className="rounded-md px-1.5 py-0.5 text-[10px] text-white/80 hover:bg-white/20"
              title="Replace upload"
              onClick={(e) => {
                e.stopPropagation()
                fileInput.current?.click()
              }}
            >
              ↻
            </button>
            {pickMedia && (
              <button
                className="rounded-md px-1.5 py-0.5 text-[10px] text-white/80 hover:bg-white/20"
                title="Pick from library"
                onClick={(e) => {
                  e.stopPropagation()
                  pickFromLibrary()
                }}
              >
                Lib
              </button>
            )}
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onFilePicked}
            />
          </div>
        )}
        <figcaption
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <input
            className="mt-1.5 w-full bg-transparent text-center text-xs text-[var(--xpe-muted-foreground)] outline-none placeholder:opacity-60"
            defaultValue={block.props.caption ?? ''}
            placeholder="Add caption..."
            readOnly={readonly}
            onFocus={onSelect}
            onChange={(e) => onPatch({ caption: e.target.value })}
          />
        </figcaption>
      </figure>
    </div>
  )
}
