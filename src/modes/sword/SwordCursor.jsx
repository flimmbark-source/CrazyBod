import { useEffect, useRef, useState } from 'react'

import {
  SWORD_PHYSICS,
  createSwordState,
  stepSword,
  isSwinging,
} from './swordPhysics.js'
import {
  HEAVY_HAND_PHYSICS,
  createHandState,
  stepHand,
} from './swordHandPhysics.js'
import { segmentCircleIntersections, pointAlong } from './slashGeometry.js'

let flashKey = 0

const PIVOT_X = 48
const PIVOT_Y = 34
const TIP_X = PIVOT_X + SWORD_PHYSICS.BLADE_LENGTH
const SVG_W = TIP_X + 22
const SVG_H = 66
const TRAIL_MAX = 24

const BASE_X = PIVOT_X + 16
const MID_X = (BASE_X + TIP_X) / 2
const SORI = 20
const GRIP_BACK = PIVOT_X - 40
const BLADE_PATH =
  `M ${BASE_X} ${PIVOT_Y - 3.8} ` +
  `Q ${MID_X} ${PIVOT_Y - SORI + 2} ${TIP_X} ${PIVOT_Y - SORI} ` +
  `L ${TIP_X + 7} ${PIVOT_Y - SORI + 4} ` +
  `Q ${MID_X} ${PIVOT_Y - 4} ${BASE_X} ${PIVOT_Y + 4.2} Z`
const HAMON_PATH =
  `M ${BASE_X + 5} ${PIVOT_Y + 0.8} ` +
  `Q ${MID_X} ${PIVOT_Y - 6} ${TIP_X - 3} ${PIVOT_Y - SORI + 3.5}`

function physicsFor(profile) {
  if (profile === 'heavy') {
    return {
      ...SWORD_PHYSICS,
      DAMPING: 0.968,
      GRAVITY: SWORD_PHYSICS.GRAVITY * 1.18,
      MIN_COMMITMENT_MS: 185,
      RECOVERY_MS: 320,
    }
  }
  if (profile === 'light') {
    return {
      ...SWORD_PHYSICS,
      DAMPING: 0.925,
      GRAVITY: SWORD_PHYSICS.GRAVITY * 0.68,
      MIN_TIP_SPEED: 600,
      MIN_COMMITMENT_MS: 110,
      MIN_COMMITTED_DISTANCE: 62,
      RECOVERY_MS: 170,
    }
  }
  return SWORD_PHYSICS
}

function handPhysicsFor(profile) {
  if (profile === 'heavy') {
    return {
      ...HEAVY_HAND_PHYSICS,
      ACCELERATION: 2050,
      MAX_SPEED: 610,
      DRAG: 0.915,
      REVERSAL_RESISTANCE: 0.46,
    }
  }
  if (profile === 'light') {
    return {
      ...HEAVY_HAND_PHYSICS,
      ACCELERATION: 3300,
      MAX_SPEED: 980,
      DRAG: 0.86,
      REVERSAL_RESISTANCE: 0.72,
    }
  }
  return HEAVY_HAND_PHYSICS
}

function vectorBetween(a, b) {
  return { x: b.x - a.x, y: b.y - a.y }
}

function vectorLength(vector) {
  return Math.hypot(vector.x, vector.y)
}

function angleBetweenDegrees(a, b) {
  const aLength = vectorLength(a)
  const bLength = vectorLength(b)
  if (aLength < 1e-6 || bLength < 1e-6) return 0
  const cosine = Math.max(-1, Math.min(1, (a.x * b.x + a.y * b.y) / (aLength * bLength)))
  return Math.acos(cosine) * (180 / Math.PI)
}

// The pointer supplies intent, not position. A simulated hand chases it with
// limited acceleration and speed; the weighted blade then swings from that hand.
// A cut requires a sustained, mostly one-directional traversal through a target.
export default function SwordCursor({ enabled, registryRef, onResolve, perception }) {
  const [flashes, setFlashes] = useState([])
  const layerRef = useRef(null)
  const bladeRef = useRef(null)
  const trailRef = useRef(null)
  const pointerTargetRef = useRef({ x: 0, y: 0 })
  const handStateRef = useRef(null)
  const swordStateRef = useRef(null)
  const trailPointsRef = useRef([])
  const cooldownRef = useRef(new Map())
  const recoveryUntilRef = useRef(0)
  // id -> { entry, startedAt, lastTip, distance, direction, maxTurn, powered }
  const crossingRef = useRef(new Map())
  const onResolveRef = useRef(onResolve)
  onResolveRef.current = onResolve
  const perceptionRef = useRef(perception)
  perceptionRef.current = perception

  useEffect(() => {
    if (!enabled) return undefined

    const startHand = {
      x: (typeof window !== 'undefined' ? window.innerWidth : 640) / 2,
      y: (typeof window !== 'undefined' ? window.innerHeight : 480) / 2,
    }
    pointerTargetRef.current = { ...startHand }
    handStateRef.current = createHandState(startHand)
    swordStateRef.current = createSwordState(startHand)
    trailPointsRef.current = []
    cooldownRef.current.clear()
    crossingRef.current.clear()
    recoveryUntilRef.current = 0

    const onMove = (event) => {
      const x = perceptionRef.current?.invertPointerX
        ? window.innerWidth - event.clientX
        : event.clientX
      pointerTargetRef.current = { x, y: event.clientY }
    }
    window.addEventListener('pointermove', onMove, { passive: true })

    let raf
    let last = performance.now()

    const addFlash = (x, y) => {
      const key = ++flashKey
      setFlashes((current) => [...current, { key, x, y }])
      window.setTimeout(() => {
        setFlashes((current) => current.filter((flash) => flash.key !== key))
      }, 360)
    }

    const loop = (now) => {
      const dt = (now - last) / 1000
      last = now
      const profile = perceptionRef.current?.bladeProfile
      const physicsConfig = physicsFor(profile)
      const handConfig = handPhysicsFor(profile)

      const handState = stepHand(handStateRef.current, {
        target: pointerTargetRef.current,
        dt,
        config: handConfig,
      })
      handStateRef.current = handState
      const hand = handState.position

      const swordState = stepSword(swordStateRef.current, { hand, dt, config: physicsConfig })
      swordStateRef.current = swordState

      const blade = bladeRef.current
      if (blade) {
        blade.style.transform = `translate(${hand.x - PIVOT_X}px, ${hand.y - PIVOT_Y}px) rotate(${swordState.angle}rad)`
        blade.style.opacity = '1'
      }

      const trail = trailPointsRef.current
      trail.push({ x: swordState.tip.x, y: swordState.tip.y })
      if (trail.length > TRAIL_MAX) trail.shift()
      if (trailRef.current) {
        trailRef.current.setAttribute('points', trail.map((point) => `${point.x},${point.y}`).join(' '))
      }

      const movingWithPower = isSwinging(swordState, physicsConfig)
      const recovering = now < recoveryUntilRef.current
      if (layerRef.current) {
        layerRef.current.classList.toggle('is-swinging', movingWithPower && !recovering)
        layerRef.current.classList.toggle('is-recovering', recovering)
      }

      const registry = registryRef.current
      if (registry) {
        const crossing = crossingRef.current
        const cooldown = cooldownRef.current
        const prevTip = swordState.prev
        const tip = swordState.tip
        const frameVector = vectorBetween(prevTip, tip)
        const frameDistance = vectorLength(frameVector)
        const onCooldown = (id) => now - (cooldown.get(id) ?? -Infinity) < physicsConfig.CUT_COOLDOWN_MS

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
          recoveryUntilRef.current = now + physicsConfig.RECOVERY_MS
          addFlash(center.x, center.y)
        }

        const activeIds = new Set()
        registry.forEach((entry, id) => {
          if (!entry.active) return
          activeIds.add(id)
          const center = { x: entry.x, y: entry.y }
          const radius = entry.radius
          const minChord = radius * physicsConfig.CUT_MIN_CHORD_FRACTION
          const nowInside = Math.hypot(tip.x - center.x, tip.y - center.y) <= radius
          const traversal = crossing.get(id)

          if (nowInside) {
            if (!traversal) {
              const intersections = segmentCircleIntersections(prevTip, tip, center, radius)
              const entryPoint = intersections.length
                ? pointAlong(prevTip, tip, Math.min(...intersections))
                : { ...tip }
              crossing.set(id, {
                entry: entryPoint,
                startedAt: now,
                lastTip: { ...tip },
                distance: frameDistance,
                direction: frameDistance > 0 ? frameVector : null,
                maxTurn: 0,
                powered: movingWithPower,
              })
            } else {
              const travel = vectorBetween(traversal.lastTip, tip)
              const travelDistance = vectorLength(travel)
              traversal.distance += travelDistance
              if (traversal.direction && travelDistance > 1) {
                traversal.maxTurn = Math.max(traversal.maxTurn, angleBetweenDegrees(traversal.direction, travel))
              }
              if (travelDistance > 1) traversal.direction = travel
              traversal.lastTip = { ...tip }
              if (movingWithPower) traversal.powered = true
            }
          } else if (traversal) {
            const intersections = segmentCircleIntersections(prevTip, tip, center, radius)
            const exitPoint = intersections.length
              ? pointAlong(prevTip, tip, Math.max(...intersections))
              : { ...prevTip }
            const chord = Math.hypot(exitPoint.x - traversal.entry.x, exitPoint.y - traversal.entry.y)
            const duration = now - traversal.startedAt
            const committed =
              traversal.powered
              && duration >= physicsConfig.MIN_COMMITMENT_MS
              && traversal.distance >= physicsConfig.MIN_COMMITTED_DISTANCE
              && traversal.maxTurn <= physicsConfig.MAX_DIRECTION_CHANGE_DEGREES

            if (committed && chord >= minChord && !recovering && !onCooldown(id)) {
              doCut(id, traversal.entry, exitPoint, center)
            }
            crossing.delete(id)
          }
        })

        crossing.forEach((_, id) => {
          if (!activeIds.has(id)) crossing.delete(id)
        })
        cooldown.forEach((time, id) => {
          if (now - time >= physicsConfig.CUT_COOLDOWN_MS) cooldown.delete(id)
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
          <rect
            x={GRIP_BACK}
            y={PIVOT_Y - 4.4}
            width={PIVOT_X + 8 - GRIP_BACK}
            height={8.8}
            rx={3.4}
            className="sword-katana-grip"
          />
          <line x1={GRIP_BACK + 3} y1={PIVOT_Y} x2={PIVOT_X + 6} y2={PIVOT_Y} className="sword-katana-wrap" />
          <rect x={GRIP_BACK - 3} y={PIVOT_Y - 5.2} width={4.8} height={10.4} rx={1.6} className="sword-katana-fitting" />
          <ellipse cx={PIVOT_X + 9} cy={PIVOT_Y} rx={3.8} ry={12.8} className="sword-katana-tsuba" />
          <path d={BLADE_PATH} className="sword-blade-steel" />
          <path d={HAMON_PATH} className="sword-katana-hamon" fill="none" />
        </svg>
      </div>
    </div>
  )
}
