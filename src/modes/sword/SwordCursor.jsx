import { useEffect, useRef, useState } from 'react'

import {
  SWORD_PHYSICS,
  applySwordReleaseImpulse,
  createSwordState,
  stepSword,
  isSwinging,
  isSwingingForward,
} from './swordPhysics.js'
import { segmentCircleIntersections, pointAlong } from './slashGeometry.js'

let flashKey = 0

const ATTACK_PHASES = Object.freeze({
  READY: 'ready',
  WINDING: 'winding',
  SWINGING: 'swinging',
  RECOVERING: 'recovering',
})

// Local katana geometry. The pivot (the hands, on the grip) is at
// (PIVOT_X, PIVOT_Y); the blade is drawn pointing along +x so a rotation about
// the pivot aims it at the physics tip.
const PIVOT_X = 48
const PIVOT_Y = 34
const TIP_X = PIVOT_X + SWORD_PHYSICS.BLADE_LENGTH
const SVG_W = TIP_X + 22
const SVG_H = 66
const TRAIL_MAX = 18

const BASE_X = PIVOT_X + 16
const MID_X = (BASE_X + TIP_X) / 2
const SORI = 17
const GRIP_BACK = PIVOT_X - 40
const BLADE_PATH =
  `M ${BASE_X} ${PIVOT_Y - 3.2} ` +
  `Q ${MID_X} ${PIVOT_Y - SORI + 2} ${TIP_X} ${PIVOT_Y - SORI} ` +
  `L ${TIP_X + 6} ${PIVOT_Y - SORI + 3.5} ` +
  `Q ${MID_X} ${PIVOT_Y - 4} ${BASE_X} ${PIVOT_Y + 3.4} Z`
const HAMON_PATH =
  `M ${BASE_X + 5} ${PIVOT_Y + 0.6} ` +
  `Q ${MID_X} ${PIVOT_Y - 5.5} ${TIP_X - 3} ${PIVOT_Y - SORI + 3}`

function physicsFor(profile) {
  if (profile === 'heavy') {
    return {
      ...SWORD_PHYSICS,
      DAMPING: 0.965,
      GRAVITY: SWORD_PHYSICS.GRAVITY * 1.35,
      HOLD_STIFFNESS: SWORD_PHYSICS.HOLD_STIFFNESS * 0.88,
    }
  }
  if (profile === 'light') {
    return {
      ...SWORD_PHYSICS,
      DAMPING: 0.925,
      GRAVITY: SWORD_PHYSICS.GRAVITY * 0.6,
      MIN_TIP_SPEED: SWORD_PHYSICS.MIN_TIP_SPEED * 0.85,
      HOLD_STIFFNESS: SWORD_PHYSICS.HOLD_STIFFNESS * 1.15,
    }
  }
  return SWORD_PHYSICS
}

function attackSupport(phase, phaseElapsedMs, config) {
  const stiffness = config.HOLD_STIFFNESS ?? 1
  if (phase === ATTACK_PHASES.READY) {
    return {
      targetAngle: config.READY_ANGLE,
      support: config.READY_SUPPORT * stiffness,
    }
  }
  if (phase === ATTACK_PHASES.WINDING) {
    return {
      targetAngle: config.WINDUP_ANGLE,
      support: config.WINDUP_SUPPORT * stiffness,
    }
  }
  if (phase === ATTACK_PHASES.RECOVERING) {
    const recovery = Math.min(1, phaseElapsedMs / config.RECOVERY_MS)
    return {
      targetAngle: config.READY_ANGLE,
      support: (
        config.RECOVERY_SUPPORT
        + (config.READY_SUPPORT - config.RECOVERY_SUPPORT) * recovery
      ) * stiffness,
    }
  }
  return { targetAngle: null, support: 0 }
}

// The blade is physically supported in a left-rotated guard. Holding the
// primary pointer button draws it backward against gravity; releasing injects a
// clockwise tangential impulse and lets the Verlet blade produce the actual arc.
// Whip and damage remain attached to the physical sword at all times: any fast
// enough full tip traversal can cut, regardless of attack phase.
export default function SwordCursor({ enabled, registryRef, onResolve, perception }) {
  const [flashes, setFlashes] = useState([])
  const layerRef = useRef(null)
  const bladeRef = useRef(null)
  const trailRef = useRef(null)
  const handRef = useRef({ x: 0, y: 0 })
  const stateRef = useRef(null)
  const trailPointsRef = useRef([])
  const cooldownRef = useRef(new Map())
  const crossingRef = useRef(new Map())
  const phaseRef = useRef(ATTACK_PHASES.READY)
  const phaseStartedAtRef = useRef(0)
  const windupStartedAtRef = useRef(0)
  const lastFrameDtRef = useRef(1 / 60)
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
    handRef.current = { ...startHand }
    stateRef.current = createSwordState(startHand)
    trailPointsRef.current = []
    cooldownRef.current.clear()
    crossingRef.current.clear()
    phaseRef.current = ATTACK_PHASES.READY
    phaseStartedAtRef.current = performance.now()
    windupStartedAtRef.current = 0

    const setPhase = (phase, now = performance.now()) => {
      phaseRef.current = phase
      phaseStartedAtRef.current = now
      if (layerRef.current) layerRef.current.dataset.attackPhase = phase
    }

    const onMove = (event) => {
      const x = perceptionRef.current?.invertPointerX
        ? window.innerWidth - event.clientX
        : event.clientX
      handRef.current = { x, y: event.clientY }
    }

    const onDown = (event) => {
      if (event.button !== 0 || phaseRef.current !== ATTACK_PHASES.READY) return
      event.preventDefault()
      windupStartedAtRef.current = performance.now()
      setPhase(ATTACK_PHASES.WINDING, windupStartedAtRef.current)
    }

    const releaseSwing = (event) => {
      if (event?.button !== undefined && event.button !== 0) return
      if (phaseRef.current !== ATTACK_PHASES.WINDING || !stateRef.current) return

      const now = performance.now()
      const config = physicsFor(perceptionRef.current?.bladeProfile)
      const heldMs = Math.max(0, now - windupStartedAtRef.current)
      const charge = Math.min(1, heldMs / config.MAX_CHARGE_MS)
      const angularSpeed = config.MIN_RELEASE_ANGULAR_SPEED
        + (config.MAX_RELEASE_ANGULAR_SPEED - config.MIN_RELEASE_ANGULAR_SPEED) * charge

      stateRef.current = applySwordReleaseImpulse(stateRef.current, {
        angularSpeed,
        dt: lastFrameDtRef.current,
        config,
      })
      setPhase(ATTACK_PHASES.SWINGING, now)
    }

    const cancelWindup = () => {
      if (phaseRef.current !== ATTACK_PHASES.WINDING) return
      setPhase(ATTACK_PHASES.RECOVERING)
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('pointerup', releaseSwing)
    window.addEventListener('pointercancel', cancelWindup)
    window.addEventListener('blur', cancelWindup)

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
      const dt = Math.min((now - last) / 1000, SWORD_PHYSICS.MAX_DT)
      last = now
      lastFrameDtRef.current = dt || 1 / 60
      const hand = handRef.current
      const config = physicsFor(perceptionRef.current?.bladeProfile)
      const phase = phaseRef.current
      const phaseElapsedMs = now - phaseStartedAtRef.current
      const support = attackSupport(phase, phaseElapsedMs, config)

      const state = stepSword(stateRef.current, {
        hand,
        dt,
        config,
        targetAngle: support.targetAngle,
        support: support.support,
      })
      stateRef.current = state

      if (phase === ATTACK_PHASES.SWINGING) {
        const swingFinished = phaseElapsedMs >= config.MAX_SWING_MS
          || (
            phaseElapsedMs >= config.MIN_SWING_MS
            && state.angularVelocity < config.MIN_FORWARD_ANGULAR_SPEED * 0.45
          )
        if (swingFinished) {
          setPhase(ATTACK_PHASES.RECOVERING, now)
        }
      } else if (
        phase === ATTACK_PHASES.RECOVERING
        && phaseElapsedMs >= config.RECOVERY_MS
      ) {
        setPhase(ATTACK_PHASES.READY, now)
      }

      const whipping = isSwinging(state, config)
      if (layerRef.current) layerRef.current.classList.toggle('is-swinging', whipping)

      const blade = bladeRef.current
      if (blade) {
        blade.style.transform = `translate(${hand.x - PIVOT_X}px, ${hand.y - PIVOT_Y}px) rotate(${state.angle}rad)`
        blade.style.opacity = '1'
      }

      const trail = trailPointsRef.current
      if (whipping) {
        trail.push({ x: state.tip.x, y: state.tip.y })
        if (trail.length > TRAIL_MAX) trail.shift()
      } else {
        trail.length = 0
      }
      if (trailRef.current) {
        trailRef.current.setAttribute('points', trail.map((p) => `${p.x},${p.y}`).join(' '))
      }

      const registry = registryRef.current
      if (registry && whipping) {
        const crossing = crossingRef.current
        const cooldown = cooldownRef.current
        const prevTip = state.prev
        const tip = state.tip
        const onCooldown = (id) => now - (cooldown.get(id) ?? -Infinity) < config.CUT_COOLDOWN_MS

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
          const minChord = radius * config.CUT_MIN_CHORD_FRACTION
          const nowInside = Math.hypot(tip.x - center.x, tip.y - center.y) <= radius
          const traversal = crossing.get(id)

          if (nowInside) {
            if (!traversal) {
              const intersections = segmentCircleIntersections(prevTip, tip, center, radius)
              const entryPoint = intersections.length
                ? pointAlong(prevTip, tip, Math.min(...intersections))
                : { ...tip }
              crossing.set(id, { entry: entryPoint })
            }
          } else if (traversal) {
            const intersections = segmentCircleIntersections(prevTip, tip, center, radius)
            const exitPoint = intersections.length
              ? pointAlong(prevTip, tip, Math.max(...intersections))
              : { ...prevTip }
            const chord = Math.hypot(
              exitPoint.x - traversal.entry.x,
              exitPoint.y - traversal.entry.y,
            )
            if (chord >= minChord && !onCooldown(id)) {
              doCut(id, traversal.entry, exitPoint, center)
            }
            crossing.delete(id)
          } else {
            const intersections = segmentCircleIntersections(prevTip, tip, center, radius)
            if (intersections.length === 2) {
              const a = pointAlong(prevTip, tip, Math.min(...intersections))
              const b = pointAlong(prevTip, tip, Math.max(...intersections))
              if (Math.hypot(b.x - a.x, b.y - a.y) >= minChord && !onCooldown(id)) {
                doCut(id, a, b, center)
              }
            }
          }
        })

        crossing.forEach((_, id) => {
          if (!activeIds.has(id)) crossing.delete(id)
        })
      } else {
        crossingRef.current.clear()
      }

      cooldownRef.current.forEach((time, id) => {
        if (now - time >= config.CUT_COOLDOWN_MS) cooldownRef.current.delete(id)
      })

      raf = window.requestAnimationFrame(loop)
    }
    raf = window.requestAnimationFrame(loop)

    return () => {
      window.cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', releaseSwing)
      window.removeEventListener('pointercancel', cancelWindup)
      window.removeEventListener('blur', cancelWindup)
      cooldownRef.current.clear()
      crossingRef.current.clear()
      trailPointsRef.current = []
    }
  }, [enabled, registryRef])

  if (!enabled) return null

  return (
    <div
      className="sword-cursor-layer"
      ref={layerRef}
      data-attack-phase={ATTACK_PHASES.READY}
      aria-hidden="true"
    >
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
            y={PIVOT_Y - 3.8}
            width={PIVOT_X + 8 - GRIP_BACK}
            height={7.6}
            rx={3.2}
            className="sword-katana-grip"
          />
          <line x1={GRIP_BACK + 3} y1={PIVOT_Y} x2={PIVOT_X + 6} y2={PIVOT_Y} className="sword-katana-wrap" />
          <rect x={GRIP_BACK - 3} y={PIVOT_Y - 4.6} width={4.5} height={9.2} rx={1.6} className="sword-katana-fitting" />
          <ellipse cx={PIVOT_X + 9} cy={PIVOT_Y} rx={3.4} ry={11.5} className="sword-katana-tsuba" />
          <path d={BLADE_PATH} className="sword-blade-steel" />
          <path d={HAMON_PATH} className="sword-katana-hamon" fill="none" />
        </svg>
      </div>
    </div>
  )
}
