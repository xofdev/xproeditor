import { useRef, useState } from 'react'
import { FolderOpen, ImagePlus, Loader2, Upload } from 'lucide-react'
import type { Block } from '@xproeditor/core'
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

export function ImageBlock({
  block,
  selected,
  readonly,
  upload,
  pickMedia,
  onPatch,
  onSelect,
}: ImageBlockProps) {
  const [uploading, setUploading] = useState(false)
  const [picking, setPicking] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInput = useRef<HTMLInputElement | null>(null)

  const busy = uploading || picking

  async function uploadFile(file: File) {
    if (!upload || !file.type.startsWith('image/')) return

    setUploading(true)
    try {
      const url = await upload(file)
      onPatch({ url })
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

  function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) uploadFile(file)
  }

  function onDrop(e: React.DragEvent) {
    setDragOver(false)
    const file = e.dataTransfer?.files?.[0]
    if (file) uploadFile(file)
  }

  if (!block.props.url && !readonly) {
    return (
      <div className="my-1">
        <div
          className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-8 transition-colors ${dragOver ? 'border-indigo-400 bg-indigo-50/50' : 'border-gray-200 bg-gray-50 hover:border-gray-300'}`}
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
          {busy ? (
            <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
          ) : (
            <ImagePlus className="h-6 w-6 text-gray-400" />
          )}
          <span className="text-sm text-gray-500">{busy ? 'Working...' : 'Add an image'}</span>
          {!busy && (
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                onClick={(e) => {
                  e.stopPropagation()
                  fileInput.current?.click()
                }}
              >
                <Upload className="h-3.5 w-3.5" />
                Upload
              </button>
              {pickMedia && (
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  onClick={(e) => {
                    e.stopPropagation()
                    pickFromLibrary()
                  }}
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                  Library
                </button>
              )}
            </div>
          )}
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onFilePicked}
          />
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
            className={`w-full rounded-xl transition-shadow ${selected ? 'ring-2 ring-indigo-400' : ''}`}
            draggable={false}
          />
        </div>
        {!readonly && (
          <div className="absolute end-2 top-2 hidden items-center gap-0.5 rounded-lg bg-black/60 p-0.5 backdrop-blur group-hover/img:flex">
            {WIDTHS.map((w) => (
              <button
                key={w}
                className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium transition-colors ${(block.props.width ?? 100) === w ? 'bg-white text-gray-900' : 'text-white/80 hover:bg-white/20'}`}
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
            className="mt-1.5 w-full bg-transparent text-center text-xs text-gray-400 outline-none placeholder:text-gray-300"
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
