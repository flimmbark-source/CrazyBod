import { useEffect, useRef, useState } from 'react'

import {
  SWORD_PHYSICS,
  createSwordState,
  stepSword,
  isSwinging,
} from './swordPhysics.js'
import { targetsHitBySlash } from './slashGeometry.js'

let flashKey = 0

// Local blade geometry. The pivot (hand/pommel) is at (PIVOT_X, PIVOT_Y); the
// blade is drawn pointing along +x so a rotation about the pivot aims it at the
// physics tip.
const PIVOT_X = 22
const PIVOT_Y = 22
const TIP_X = PIVOT_X + SWORD_PHYSICS.BLADE_LENGTH
const SVG_W = TIP_X + 16
const SVG_H = 44
const TRAIL_MAX = 14
const HIT_COOLDOWN_MS = 240

// A physical sword. The cursor is the hand/pommel; the blade is a weighted
// pendulum (swordPhysics) that trails, whips and settles as you move. What cuts
// is the *blade segment* (hand -> tip) while it is swinging fast enough — so you
// resolve foes by actually swinging the blade through them, not by hovering.
export default function SwordCursor({ enabled, registryRef, onResolve }) {
  const [flashes, setFlashes] = useState([])
  const layerRef = useRef(null)
  const bladeRef = useRef(null)
  const trailRef = useRef(null)
  const handRef = useRef({ x: 0, y: 0 })
  const stateRef = useRef(null)
  const trailPointsRef = useRef([])
  const cooldownRef = useRef(new Map())
  const onResolveRef = useRef(onResolve)
  onResolveRef.current = onResolve

  useEffect(() => {
    if (!enabled) return undefined

    const startHand = {
      x: (typeof window !== 'undefined' ? window.innerWidth : 640) / 2,
      y: (typeof window !== 'undefined' ? window.innerHeight : 480) / 2,
    }
    handRef.current = { ...startHand }
    stateRef.current = createSwordState(startHand)
    trailPointsRef.current = []
    cooldownRef.current.clear()

    const onMove = (event) => {
      handRef.current = { x: event.clientX, y: event.clientY }
    }
    window.addEventListener('pointermove', onMove, { passive: true })

    let raf
    let last = performance.now()

    const addFlash = (x, y) => {
      const key = ++flashKey
      setFlashes((current) => [...current, { key, x, y }])
      window.setTimeout(() => {
        setFlashes((current) => current.filter((flash) => flash.key !== key))
      }, 300)
    }

    const loop = (now) => {
      const dt = (now - last) / 1000
      last = now
      const hand = handRef.current

      const state = stepSword(stateRef.current, { hand, dt })
      stateRef.current = state

      // Draw the blade: translate the pivot onto the hand, rotate to the tip.
      const blade = bladeRef.current
      if (blade) {
        blade.style.transform = `translate(${hand.x - PIVOT_X}px, ${hand.y - PIVOT_Y}px) rotate(${state.angle}rad)`
        blade.style.opacity = '1'
      }

      // Draw the tip's swing trail.
      const trail = trailPointsRef.current
      trail.push({ x: state.tip.x, y: state.tip.y })
      if (trail.length > TRAIL_MAX) trail.shift()
      if (trailRef.current) {
        trailRef.current.setAttribute('points', trail.map((p) => `${p.x},${p.y}`).join(' '))
      }

      // Cut: the blade segment resolves active foes it sweeps through while the
      // tip is moving fast enough. One resolve per foe per short cooldown.
      const swinging = isSwinging(state)
      if (layerRef.current) layerRef.current.classList.toggle('is-swinging', swinging)
      if (swinging && registryRef.current) {
        const targets = []
        registryRef.current.forEach((entry, id) => {
          if (entry.active) targets.push({ id, x: entry.x, y: entry.y, radius: entry.radius })
        })
        const resolvedIds = new Set()
        for (const [id, t] of cooldownRef.current) {
          if (now - t < HIT_COOLDOWN_MS) resolvedIds.add(id)
          else cooldownRef.current.delete(id)
        }
        const segment = { a: hand, b: state.tip }
        const hits = targetsHitBySlash(segment, targets, resolvedIds)
        hits.forEach((id) => {
          const entry = registryRef.current.get(id)
          onResolveRef.current?.(id)
          cooldownRef.current.set(id, now)
          if (entry) addFlash(entry.x, entry.y)
        })
      }

      raf = window.requestAnimationFrame(loop)
    }
    raf = window.requestAnimationFrame(loop)

    return () => {
      window.cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
      cooldownRef.current.clear()
      trailPointsRef.current = []
    }
  }, [enabled, registryRef])

  if (!enabled) return null

  return (
    <div className="sword-cursor-layer" ref={layerRef} aria-hidden="true">
      <svg className="sword-trail" width="100%" height="100%">
        <polyline ref={trailRef} className="sword-trail-line" points="" />
      </svg>

      {flashes.map((flash) => (
        <span key={flash.key} className="sword-hit-flash" style={{ left: `${flash.x}px`, top: `${flash.y}px` }} />
      ))}

      <div className="sword-blade" ref={bladeRef} style={{ transformOrigin: `${PIVOT_X}px ${PIVOT_Y}px`, opacity: 0 }}>
        <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} width={SVG_W} height={SVG_H}>
          {/* blade */}
          <polygon
            points={`${PIVOT_X + 6},${PIVOT_Y - 5} ${TIP_X},${PIVOT_Y} ${PIVOT_X + 6},${PIVOT_Y + 5}`}
            className="sword-blade-steel"
          />
          <line x1={PIVOT_X + 8} y1={PIVOT_Y} x2={TIP_X - 3} y2={PIVOT_Y} className="sword-blade-edge" />
          {/* guard */}
          <line x1={PIVOT_X + 4} y1={PIVOT_Y - 9} x2={PIVOT_X + 4} y2={PIVOT_Y + 9} className="sword-blade-guard" />
          {/* grip + pommel (behind the pivot) */}
          <line x1={PIVOT_X - 12} y1={PIVOT_Y} x2={PIVOT_X + 4} y2={PIVOT_Y} className="sword-blade-hilt" />
          <circle cx={PIVOT_X - 14} cy={PIVOT_Y} r="3.2" className="sword-blade-pommel" />
        </svg>
      </div>
    </div>
  )
}
