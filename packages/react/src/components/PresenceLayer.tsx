import { useLayoutEffect, useRef, useState } from 'react'
import type { CollabPeer } from '@xproeditor/core'

export interface PresenceLayerProps {
  peers: CollabPeer[]
  root: HTMLElement | null
  /** Bumped by the editor on every render so markers follow layout changes. */
  revision: number
}

interface Marker {
  key: string
  name: string
  color: string
  top: number
  height: number
  /** Position among peers on the same block (labels fan out). */
  stack: number
}

/**
 * Collaborator markers: a coloured bar beside the block each peer is
 * editing, with their name. Positioned from the rendered rows (any block
 * type), so blocks themselves stay unaware of presence.
 */
export function PresenceLayer({ peers, root, revision }: PresenceLayerProps) {
  const anchorRef = useRef<HTMLDivElement | null>(null)
  const [markers, setMarkers] = useState<Marker[]>([])
  const [layoutTick, setLayoutTick] = useState(0)

  useLayoutEffect(() => {
    if (!root || typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(() => setLayoutTick((t) => t + 1))
    observer.observe(root)
    return () => observer.disconnect()
  }, [root])

  useLayoutEffect(() => {
    const anchor = anchorRef.current
    if (!anchor || !root) return

    const origin = anchor.getBoundingClientRect().top
    const next: Marker[] = []
    const stacked = new Map<string, number>()

    for (const peer of peers) {
      if (!peer.blockId) continue

      const row = root.querySelector<HTMLElement>(`[data-block-id="${CSS.escape(peer.blockId)}"]`)
      if (!row) continue

      const rect = row.getBoundingClientRect()
      const index = stacked.get(peer.blockId) ?? 0
      stacked.set(peer.blockId, index + 1)
      next.push({
        key: peer.clientId,
        name: peer.user.name,
        color: peer.user.color,
        top: rect.top - origin,
        height: rect.height,
        stack: index,
      })
    }

    setMarkers((prev) =>
      prev.length === next.length &&
      prev.every((m, i) => m.key === next[i].key && m.top === next[i].top && m.height === next[i].height && m.stack === next[i].stack)
        ? prev
        : next,
    )
  }, [peers, root, revision, layoutTick])

  return (
    <div ref={anchorRef} className="xpe-presence-layer" aria-hidden="true">
      {markers.map((m) => (
        <div
          key={m.key}
          className="xpe-presence-marker"
          style={{ top: m.top, height: m.height, ['--xpe-peer' as string]: m.color, ['--xpe-peer-stack' as string]: m.stack }}
        >
          <span className="xpe-presence-name">{m.name}</span>
        </div>
      ))}
    </div>
  )
}
