import { useEffect, useRef, useState } from 'react'

import { SLASH_DEFAULTS, isValidSlash, slashSegment } from './slashGeometry.js'

// Pointer-driven slash detection. Keeps a short rolling window of pointer
// samples, and when that window is a valid slash (long + fast enough) hands the
// straight segment to onSlash. onSlash returns the ids it resolved; those are
// held off briefly so a single continuous gesture cannot re-cut the same foe.
//
// Listeners live on window and are fully torn down when disabled or unmounted,
// so a slash can never get "stuck". The trail/cursor are exposed for rendering.
export function useSlashInput({ enabled, onSlash, options }) {
  const [cursor, setCursor] = useState(null)
  const [trail, setTrail] = useState([])
  const historyRef = useRef([])
  const cooldownUntilRef = useRef(0)
  const recentlyResolvedRef = useRef(new Map())
  const onSlashRef = useRef(onSlash)
  onSlashRef.current = onSlash

  useEffect(() => {
    if (!enabled) {
      historyRef.current = []
      recentlyResolvedRef.current.clear()
      setTrail([])
      setCursor(null)
      return undefined
    }

    const opts = { ...SLASH_DEFAULTS, ...options }

    const reset = () => {
      historyRef.current = []
      setTrail([])
      setCursor(null)
    }

    const onMove = (event) => {
      const now = performance.now()
      const point = { x: event.clientX, y: event.clientY, t: now }
      const cutoff = now - opts.HISTORY_MS
      const history = historyRef.current.filter((p) => p.t >= cutoff)
      history.push(point)
      historyRef.current = history

      setCursor({ x: point.x, y: point.y })
      setTrail(history.map((p) => ({ x: p.x, y: p.y })))

      if (now < cooldownUntilRef.current) return
      if (!isValidSlash(history, opts)) return

      // Build the "already cut this gesture" set, aging out old entries.
      const resolvedIds = new Set()
      for (const [id, t] of recentlyResolvedRef.current) {
        if (now - t < 320) resolvedIds.add(id)
        else recentlyResolvedRef.current.delete(id)
      }

      const segment = slashSegment(history)
      const hitIds = onSlashRef.current?.(segment, resolvedIds) ?? []
      const now2 = performance.now()
      for (const id of hitIds) recentlyResolvedRef.current.set(id, now2)
      if (hitIds.length > 0) cooldownUntilRef.current = now2 + 55
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerleave', reset)
    window.addEventListener('blur', reset)

    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerleave', reset)
      window.removeEventListener('blur', reset)
      historyRef.current = []
      recentlyResolvedRef.current.clear()
    }
  }, [enabled, options])

  return { cursor, trail }
}
