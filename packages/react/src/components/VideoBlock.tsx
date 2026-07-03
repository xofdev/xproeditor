import { useRef, useState } from 'react'
import { FolderOpen, Link2, Loader2, Upload, Video } from 'lucide-react'
import { isAllowedEmbedUrl, parseVideoEmbed } from '@xproeditor/core'
import type { Block } from '@xproeditor/core'
import type { PickMediaFn, UploadFn } from '../types'

export interface VideoBlockProps {
  block: Block
  selected?: boolean
  readonly?: boolean
  upload?: UploadFn
  pickMedia?: PickMediaFn
  onPatch: (patch: Record<string, unknown>) => void
  onSelect: () => void
}

type InsertMode = 'upload' | 'library' | 'embed'
const WIDTHS = [40, 60, 80, 100]

export function VideoBlock({
  block,
  selected,
  readonly,
  upload,
  pickMedia,
  onPatch,
  onSelect,
}: VideoBlockProps) {
  const [mode, setMode] = useState<InsertMode>('upload')
  const [uploading, setUploading] = useState(false)
  const [picking, setPicking] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [embedInput, setEmbedInput] = useState('')
  const [embedError, setEmbedError] = useState('')
  const embedInputRef = useRef<HTMLInputElement | null>(null)
  const fileInput = useRef<HTMLInputElement | null>(null)

  const busy = uploading || picking
  const isEmbed = block.props.provider === 'youtube' || block.props.provider === 'vimeo'
  const safeEmbedUrl = () => {
    const url = block.props.url ?? ''
    return isAllowedEmbedUrl(url) ? url : ''
  }

  async function uploadFile(file: File) {
    if (!upload || !file.type.startsWith('video/')) return

    setUploading(true)
    try {
      const url = await upload(file)
      onPatch({ url, provider: 'file' })
    } finally {
      setUploading(false)
    }
  }

  async function pickFromLibrary() {
    if (!pickMedia) return

    setPicking(true)
    try {
      const result = await pickMedia({ accept: ['video/*'], title: 'Choose video' })
      if (result?.url)
        onPatch({
          url: result.url,
          provider: 'file',
          ...(result.caption ? { caption: result.caption } : {}),
        })
    } finally {
      setPicking(false)
    }
  }

  function applyEmbed() {
    setEmbedError('')
    const parsed = parseVideoEmbed(embedInput)

    if (!parsed) {
      setEmbedError('Enter a valid YouTube or Vimeo URL')
      return
    }

    onPatch({ url: parsed.embedUrl, provider: parsed.provider })
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

  function switchMode(next: InsertMode) {
    setMode(next)
    if (next === 'embed') requestAnimationFrame(() => embedInputRef.current?.focus())
  }

  if (!block.props.url && !readonly) {
    return (
      <div className="my-1">
        <div
          className={`flex flex-col gap-3 rounded-xl border-2 border-dashed py-6 transition-colors ${dragOver ? 'border-indigo-400 bg-indigo-50/50' : 'border-gray-200 bg-gray-50 hover:border-gray-300'}`}
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
          <div className="flex items-center justify-center gap-2 text-gray-500">
            {busy ? (
              <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
            ) : (
              <Video className="h-5 w-5" />
            )}
            <span className="text-sm">{busy ? 'Working...' : 'Add a video'}</span>
          </div>

          {!busy && (
            <div
              className="flex justify-center gap-1 px-4"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className={`rounded-lg px-2.5 py-1 text-xs font-medium ${mode === 'upload' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:bg-gray-100'}`}
                onClick={(e) => {
                  e.stopPropagation()
                  switchMode('upload')
                }}
              >
                Upload
              </button>
              {pickMedia && (
                <button
                  type="button"
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium ${mode === 'library' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:bg-gray-100'}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    switchMode('library')
                  }}
                >
                  Library
                </button>
              )}
              <button
                type="button"
                className={`rounded-lg px-2.5 py-1 text-xs font-medium ${mode === 'embed' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:bg-gray-100'}`}
                onClick={(e) => {
                  e.stopPropagation()
                  switchMode('embed')
                }}
              >
                Embed
              </button>
            </div>
          )}

          {!busy && (
            <div
              className="px-4"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {mode === 'upload' && (
                <div className="flex justify-center">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    onClick={(e) => {
                      e.stopPropagation()
                      fileInput.current?.click()
                    }}
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Choose video file
                  </button>
                  <input
                    ref={fileInput}
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={onFilePicked}
                  />
                </div>
              )}

              {mode === 'library' && (
                <div className="flex justify-center">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    onClick={(e) => {
                      e.stopPropagation()
                      pickFromLibrary()
                    }}
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                    Open media library
                  </button>
                </div>
              )}

              {mode === 'embed' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Link2 className="h-4 w-4 shrink-0 text-gray-400" />
                    <input
                      ref={embedInputRef}
                      type="url"
                      className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-indigo-300"
                      placeholder="YouTube or Vimeo URL"
                      value={embedInput}
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
                      className="rounded-lg bg-gray-800 px-2.5 py-1.5 text-xs text-white"
                      onClick={(e) => {
                        e.stopPropagation()
                        applyEmbed()
                      }}
                    >
                      Add
                    </button>
                  </div>
                  {embedError && <p className="text-center text-xs text-red-500">{embedError}</p>}
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
      <figure className="group/video relative" style={{ width: `${block.props.width ?? 100}%` }}>
        <div onClick={onSelect}>
          <div
            className={`overflow-hidden rounded-xl bg-black ${selected ? 'ring-2 ring-indigo-400' : ''}`}
          >
            {isEmbed && safeEmbedUrl() ? (
              <iframe
                src={safeEmbedUrl()}
                className="aspect-video w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title="Embedded video"
              />
            ) : (
              <video src={block.props.url} className="aspect-video w-full" controls playsInline />
            )}
          </div>
        </div>

        {!readonly && (
          <div className="absolute end-2 top-2 hidden items-center gap-0.5 rounded-lg bg-black/60 p-0.5 backdrop-blur group-hover/video:flex">
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
              title="Remove video"
              onClick={(e) => {
                e.stopPropagation()
                onPatch({ url: '', provider: 'file' })
              }}
            >
              ✕
            </button>
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
