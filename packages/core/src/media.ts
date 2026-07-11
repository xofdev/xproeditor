import type { BlockType } from './types'

/** Media block types whose main body is a URL-backed asset. */
export const MEDIA_BLOCK_TYPES: BlockType[] = ['image', 'video', 'audio', 'file']

/** Pick the block type that best represents a dropped/pasted file. */
export function blockTypeForFile(file: { type?: string }): BlockType {
  const mime = file.type ?? ''

  if (mime.startsWith('image/')) {
return 'image'
}

  if (mime.startsWith('video/')) {
return 'video'
}

  if (mime.startsWith('audio/')) {
return 'audio'
}

  return 'file'
}

/** Human-readable file size, e.g. "3.4 MB". */
export function formatFileSize(bytes: number | undefined): string {
  if (bytes === undefined || !Number.isFinite(bytes) || bytes < 0) {
return ''
}

  if (bytes < 1024) {
return `${bytes} B`
}

  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let unit = 0

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }

  return `${value >= 10 ? Math.round(value) : Math.round(value * 10) / 10} ${units[unit]}`
}

/** Accept string for a file input, per media block type. */
export function acceptForBlockType(type: BlockType): string {
  switch (type) {
    case 'image':
      return 'image/*'
    case 'video':
      return 'video/*'
    case 'audio':
      return 'audio/*'
    default:
      return '*/*'
  }
}

/**
 * Default upload when the host app provides no `upload` prop: an object URL
 * kept alive for the session. Works out of the box in demos and local-first
 * apps; persistent apps should pass a real `upload` that stores the file.
 */
export function fileToObjectUrl(file: File): Promise<string> {
  return Promise.resolve(URL.createObjectURL(file))
}

/** Props patch for a media block created from a File. */
export function mediaPropsFromFile(file: File, url: string): Record<string, unknown> {
  return {
    url,
    name: file.name,
    size: file.size,
    mime: file.type || undefined,
  }
}
