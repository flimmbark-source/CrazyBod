import { useCallback, useRef, useState } from 'react'

import { useSlashInput } from './useSlashInput.js'
import { targetsHitBySlash } from './slashGeometry.js'

let flashKey = 0

// The pointer-as-sword overlay for the Mandala. It reads the screen-space
// registry the encounters project into, tests each valid slash against the
// active hitboxes, resolves the ones it cuts, and draws the blade + trail +
// hit sparks. The whole layer is pointer-events:none, so it never blocks the
// ordinary UI beneath it.
export default function SwordCursor({ enabled, registryRef, onResolve }) {
  const [flashes, setFlashes] = useState([])
  const flashTimersRef = useRef([])

  const onSlash = useCallback(
    (segment, resolvedIds) => {
      const registry = registryRef.current
      if (!registry) return []

      const targets = []
      registry.forEach((entry, id) => {
        if (entry.active) targets.push({ id, x: entry.x, y: entry.y, radius: entry.radius })
      })

      const hitIds = targetsHitBySlash(segment, targets, resolvedIds)
      if (hitIds.length === 0) return hitIds

      hitIds.forEach((id) => {
        const entry = registry.get(id)
        onResolve?.(id)
        if (entry) {
          const key = ++flashKey
          setFlashes((current) => [...current, { key, x: entry.x, y: entry.y }])
          const timer = window.setTimeout(() => {
            setFlashes((current) => current.filter((flash) => flash.key !== key))
          }, 300)
          flashTimersRef.current.push(timer)
        }
      })
      return hitIds
    },
    [registryRef, onResolve],
  )

  const { cursor, trail } = useSlashInput({ enabled, onSlash })

  if (!enabled) return null

  const trailPath = trail.length > 1 ? trail.map((p) => `${p.x},${p.y}`).join(' ') : null

  return (
    <div className="sword-cursor-layer" aria-hidden="true">
      <svg className="sword-trail" width="100%" height="100%">
        {trailPath && <polyline points={trailPath} className="sword-trail-line" />}
      </svg>

      {flashes.map((flash) => (
        <span key={flash.key} className="sword-hit-flash" style={{ left: `${flash.x}px`, top: `${flash.y}px` }} />
      ))}

      {cursor && (
        <span className="sword-blade" style={{ left: `${cursor.x}px`, top: `${cursor.y}px` }}>
          <svg viewBox="0 0 40 40" width="44" height="44">
            <path d="M31 5 L20 24 L16 20 Z" className="sword-blade-steel" />
            <path d="M14 22 l6 6" className="sword-blade-guard" />
            <path d="M12 24 l-5 5" className="sword-blade-hilt" />
          </svg>
        </span>
      )}
    </div>
  )
}
