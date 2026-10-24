<script setup lang="ts">
import { onBeforeUnmount, ref, shallowRef, watch, nextTick } from 'vue'
import type { CollabPeer } from '@xproeditor/core'

/**
 * Collaborator markers: a coloured bar beside the block each peer is
 * editing, with their name. Positioned from the rendered rows (any block
 * type), so blocks themselves stay unaware of presence.
 */
const props = defineProps<{
  peers: CollabPeer[]
  root: HTMLElement | null
  /** Bumped by the editor on edits so markers follow layout changes. */
  revision: number
}>()

interface Marker {
  key: string
  name: string
  color: string
  top: number
  height: number
  /** Position among peers on the same block (labels fan out). */
  stack: number
}

const anchorEl = ref<HTMLElement | null>(null)
const markers = shallowRef<Marker[]>([])
let observer: ResizeObserver | null = null

function measure() {
  const anchor = anchorEl.value
  const root = props.root

  if (!anchor || !root) {
    markers.value = []
    return
  }

  const origin = anchor.getBoundingClientRect().top
  const stacked = new Map<string, number>()
  const next: Marker[] = []

  for (const peer of props.peers) {
    if (!peer.blockId) {
      continue
    }

    const row = root.querySelector<HTMLElement>(`[data-block-id="${CSS.escape(peer.blockId)}"]`)

    if (!row) {
      continue
    }

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

  markers.value = next
}

watch(
  () => [props.peers, props.root, props.revision],
  () => nextTick(measure),
  { immediate: true },
)

watch(
  () => props.root,
  (root) => {
    observer?.disconnect()
    observer = null

    if (root && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => measure())
      observer.observe(root)
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div
    ref="anchorEl"
    class="xpe-presence-layer"
    aria-hidden="true"
  >
    <div
      v-for="m in markers"
      :key="m.key"
      class="xpe-presence-marker"
      :style="{ top: `${m.top}px`, height: `${m.height}px`, '--xpe-peer': m.color, '--xpe-peer-stack': m.stack }"
    >
      <span class="xpe-presence-name">{{ m.name }}</span>
    </div>
  </div>
</template>
