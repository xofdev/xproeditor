import { describe, expect, it } from 'vitest'
import { placeFloating } from './floating'

const viewport = { width: 1000, height: 800 }
const size = { width: 380, height: 300 }

describe('placeFloating', () => {
  it('opens below the anchor when it fits', () => {
    const p = placeFloating({ x: 100, top: 200, bottom: 220 }, size, { viewport })
    expect(p).toMatchObject({ side: 'below', left: 100, top: 226 })
  })

  it('flips above when there is no room below', () => {
    const p = placeFloating({ x: 100, top: 700, bottom: 720 }, size, { viewport })
    expect(p.side).toBe('above')
    expect(p.top).toBe(700 - 6 - 300)
  })

  it('clamps horizontally and grows toward the start in RTL', () => {
    expect(placeFloating({ x: 900, top: 100, bottom: 120 }, size, { viewport }).left).toBe(1000 - 380 - 8)
    expect(placeFloating({ x: 600, top: 100, bottom: 120 }, size, { viewport, dir: 'rtl' }).left).toBe(220)
    expect(placeFloating({ x: 100, top: 100, bottom: 120 }, size, { viewport, dir: 'rtl' }).left).toBe(8)
  })

  it('uses the roomier side and caps the height when it fits nowhere', () => {
    const p = placeFloating({ x: 0, top: 500, bottom: 520 }, { width: 380, height: 900 }, { viewport })
    expect(p.side).toBe('above')
    expect(p.maxHeight).toBe(500 - 6 - 8)
    expect(p.top).toBeGreaterThanOrEqual(8)
  })
})
