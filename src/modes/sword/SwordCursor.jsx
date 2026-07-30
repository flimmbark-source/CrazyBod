import { useEffect, useRef, useState } from 'react'

import {
  SWORD_PHYSICS,
  createSwordState,
  stepSword,
  isSwinging,
} from './swordPhysics.js'
import { targetsHitBySlash } from './slashGeometry.js'

let flashKey = 0

// Local katana geometry. The pivot (the hands, on the grip) is at
// (PIVOT_X, PIVOT_Y); the blade is drawn pointing along +x so a rotation about
// the pivot aims it at the physics tip. Room is left behind the pivot for the
// long two-hand grip, and above the axis for the blade's curve (sori).
const PIVOT_X = 48
const PIVOT_Y = 34
const TIP_X = PIVOT_X + SWORD_PHYSICS.BLADE_LENGTH
const SVG_W = TIP_X + 22
const SVG_H = 66
const TRAIL_MAX = 18
const HIT_COOLDOWN_MS = 260

// Derived blade shapes (curved, single-edged, tapering to the kissaki point).
const BASE_X = PIVOT_X + 16
const MID_X = (BASE_X + TIP_X) / 2
const SORI = 17 // how far the tip curves up off the axis
const GRIP_BACK = PIVOT_X - 40
const BLADE_PATH =
  `M ${BASE_X} ${PIVOT_Y - 3.2} ` +
  `Q ${MID_X} ${PIVOT_Y - SORI + 2} ${TIP_X} ${PIVOT_Y - SORI} ` +
  `L ${TIP_X + 6} ${PIVOT_Y - SORI + 3.5} ` +
  `Q ${MID_X} ${PIVOT_Y - 4} ${BASE_X} ${PIVOT_Y + 3.4} Z`
const HAMON_PATH =
  `M ${BASE_X + 5} ${PIVOT_Y + 0.6} ` +
  `Q ${MID_X} ${PIVOT_Y - 5.5} ${TIP_X - 3} ${PIVOT_Y - SORI + 3}`

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
        // The cut line is the blade's current direction (hand -> tip).
        const cutAngle = Math.atan2(state.tip.y - hand.y, state.tip.x - hand.x)
        hits.forEach((id) => {
          const entry = registryRef.current.get(id)
          onResolveRef.current?.(id, cutAngle)
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
          {/* tsuka (long two-hand grip) + kashira cap, behind the pivot */}
          <rect
            x={GRIP_BACK}
            y={PIVOT_Y - 3.8}
            width={PIVOT_X + 8 - GRIP_BACK}
            height={7.6}
            rx={3.2}
            className="sword-katana-grip"
          />
          <line x1={GRIP_BACK + 3} y1={PIVOT_Y} x2={PIVOT_X + 6} y2={PIVOT_Y} className="sword-katana-wrap" />
          <rect x={GRIP_BACK - 3} y={PIVOT_Y - 4.6} width={4.5} height={9.2} rx={1.6} className="sword-katana-fitting" />
          {/* tsuba (guard) at the pivot */}
          <ellipse cx={PIVOT_X + 9} cy={PIVOT_Y} rx={3.4} ry={11.5} className="sword-katana-tsuba" />
          {/* blade + hamon */}
          <path d={BLADE_PATH} className="sword-blade-steel" />
          <path d={HAMON_PATH} className="sword-katana-hamon" fill="none" />
        </svg>
      </div>
    </div>
  )
}
