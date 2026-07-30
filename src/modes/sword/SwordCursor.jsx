import { useEffect, useRef, useState } from 'react'

import {
  SWORD_PHYSICS,
  createSwordState,
  stepSword,
  isSwinging,
} from './swordPhysics.js'
import { segmentCircleIntersections, pointAlong } from './slashGeometry.js'

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

// Perception effects from the director change how the blade feels/aims.
function physicsFor(profile) {
  if (profile === 'heavy') {
    return { ...SWORD_PHYSICS, DAMPING: 0.955, GRAVITY: SWORD_PHYSICS.GRAVITY * 1.35 }
  }
  if (profile === 'light') {
    return {
      ...SWORD_PHYSICS,
      DAMPING: 0.9,
      GRAVITY: SWORD_PHYSICS.GRAVITY * 0.6,
      MIN_TIP_SPEED: SWORD_PHYSICS.MIN_TIP_SPEED * 0.85,
    }
  }
  return SWORD_PHYSICS
}

// A physical sword. The cursor is the hand/pommel; the blade is a weighted
// pendulum (swordPhysics) that trails, whips and settles as you move. A game is
// cut only when the blade TIP traces across it — entering its hitbox and exiting
// again (a full pass), while whipping fast enough. That entry->exit trace is the
// cut line. Merely resting the blade on a game, or grazing its edge, never cuts.
//
// `perception` (from the Mandala director) can mirror the aim (invertPointerX)
// and swap the blade profile (light / heavy) mid-descent.
export default function SwordCursor({ enabled, registryRef, onResolve, perception }) {
  const [flashes, setFlashes] = useState([])
  const layerRef = useRef(null)
  const bladeRef = useRef(null)
  const trailRef = useRef(null)
  const handRef = useRef({ x: 0, y: 0 })
  const stateRef = useRef(null)
  const trailPointsRef = useRef([])
  const cooldownRef = useRef(new Map())
  // Per-game whip-traversal state: id -> { entry:{x,y}, whipped:bool }. An entry
  // is recorded when the tip enters a game; a cut fires when it exits.
  const crossingRef = useRef(new Map())
  const onResolveRef = useRef(onResolve)
  onResolveRef.current = onResolve
  // Latest perception effects, read live inside the frame loop / pointer handler.
  const perceptionRef = useRef(perception)
  perceptionRef.current = perception

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
    crossingRef.current.clear()

    const onMove = (event) => {
      // Inverted aim mirrors horizontal motion around the screen centre.
      const x = perceptionRef.current?.invertPointerX
        ? window.innerWidth - event.clientX
        : event.clientX
      handRef.current = { x, y: event.clientY }
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

      const physicsConfig = physicsFor(perceptionRef.current?.bladeProfile)
      const state = stepSword(stateRef.current, { hand, dt, config: physicsConfig })
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

      // Cut: a game is resolved only when the tip TRACES ACROSS it — entering
      // its hitbox and exiting again, while whipping fast enough on the way. The
      // entry->exit chord is the cut line.
      const swinging = isSwinging(state, physicsConfig)
      if (layerRef.current) layerRef.current.classList.toggle('is-swinging', swinging)

      const registry = registryRef.current
      if (registry) {
        const crossing = crossingRef.current
        const cooldown = cooldownRef.current
        const prevTip = state.prev
        const tip = state.tip
        const onCooldown = (id) => now - (cooldown.get(id) ?? -Infinity) < SWORD_PHYSICS.CUT_COOLDOWN_MS

        const doCut = (id, entry, exit, center) => {
          onResolveRef.current?.(id, {
            cx: center.x,
            cy: center.y,
            ax: entry.x,
            ay: entry.y,
            bx: exit.x,
            by: exit.y,
          })
          cooldown.set(id, now)
          addFlash(center.x, center.y)
        }

        const activeIds = new Set()
        registry.forEach((entry, id) => {
          if (!entry.active) return
          activeIds.add(id)
          const center = { x: entry.x, y: entry.y }
          const radius = entry.radius
          const minChord = radius * SWORD_PHYSICS.CUT_MIN_CHORD_FRACTION
          const nowInside = Math.hypot(tip.x - center.x, tip.y - center.y) <= radius
          const st = crossing.get(id)

          if (nowInside) {
            // Inside the game: open (or continue) a traversal, tracking whether
            // the tip has whipped fast enough at any point while crossing.
            if (!st) {
              const ts = segmentCircleIntersections(prevTip, tip, center, radius)
              const entryPoint = ts.length ? pointAlong(prevTip, tip, Math.min(...ts)) : { ...tip }
              crossing.set(id, { entry: entryPoint, whipped: swinging })
            } else if (swinging) {
              st.whipped = true
            }
          } else if (st) {
            // Just left the game: a completed traversal. Cut if it was a real
            // whip that spanned enough of the game.
            const ts = segmentCircleIntersections(prevTip, tip, center, radius)
            const exitPoint = ts.length ? pointAlong(prevTip, tip, Math.max(...ts)) : { ...prevTip }
            const chord = Math.hypot(exitPoint.x - st.entry.x, exitPoint.y - st.entry.y)
            if (st.whipped && chord >= minChord && !onCooldown(id)) {
              doCut(id, st.entry, exitPoint, center)
            }
            crossing.delete(id)
          } else if (swinging) {
            // Fast flick: the tip passed clean through between two frames without
            // a frame landing inside. Treat a full through-pass as a cut.
            const ts = segmentCircleIntersections(prevTip, tip, center, radius)
            if (ts.length === 2) {
              const a = pointAlong(prevTip, tip, Math.min(...ts))
              const b = pointAlong(prevTip, tip, Math.max(...ts))
              if (Math.hypot(b.x - a.x, b.y - a.y) >= minChord && !onCooldown(id)) {
                doCut(id, a, b, center)
              }
            }
          }
        })

        // Drop traversal + cooldown state for games no longer on the plane.
        crossing.forEach((_, id) => {
          if (!activeIds.has(id)) crossing.delete(id)
        })
        cooldown.forEach((t, id) => {
          if (now - t >= SWORD_PHYSICS.CUT_COOLDOWN_MS) cooldown.delete(id)
        })
      }

      raf = window.requestAnimationFrame(loop)
    }
    raf = window.requestAnimationFrame(loop)

    return () => {
      window.cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
      cooldownRef.current.clear()
      crossingRef.current.clear()
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
