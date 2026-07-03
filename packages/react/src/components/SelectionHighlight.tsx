import { useEffect, useRef, useState } from 'react'
import { getRangeClientRects } from '@xproeditor/core'

export interface SelectionHighlightProps {
  target: HTMLElement | null
  start: number
  end: number
}

export function SelectionHighlight({ target, start, end }: SelectionHighlightProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [rects, setRects] = useState<
    Array<{ top: number; left: number; width: number; height: number }>
  >([])

  function updateRects() {
    if (!target || !containerRef.current || end <= start) {
      setRects([])
      return
    }

    const containerBox = containerRef.current.getBoundingClientRect()
    const clientRects = getRangeClientRects(target, start, end)

    setRects(
      clientRects.map((r) => ({
        top: r.top - containerBox.top,
        left: r.left - containerBox.left,
        width: r.width,
        height: r.height,
      })),
    )
  }

  useEffect(() => {
    updateRects()

    const ro = target ? new ResizeObserver(() => updateRects()) : null
    if (ro && target) ro.observe(target)

    return () => ro?.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, start, end])

  useEffect(() => {
    window.addEventListener('scroll', updateRects, true)
    window.addEventListener('resize', updateRects)

    return () => {
      window.removeEventListener('scroll', updateRects, true)
      window.removeEventListener('resize', updateRects)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      ref={containerRef}
      className="esh-layer pointer-events-none absolute inset-0 overflow-visible"
    >
      {rects.map((rect, i) => (
        <div
          key={i}
          className="esh-rect absolute"
          style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
        />
      ))}
    </div>
  )
}
