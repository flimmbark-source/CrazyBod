import { useEffect, useRef, useState } from 'react'
import { animate } from 'animejs'

import {
  SWORD_PHYSICS,
  createSwordState,
  stepSword,
} from './swordPhysics.js'
import { segmentCircleIntersections, pointAlong } from './slashGeometry.js'
import {
  SLASH_PATH_CONFIG,
  appendPathPoint,
  buildPathMetrics,
  pathLength,
  pointAtDistance,
  remainingPathPoints,
} from './slashPath.js'

let flashKey = 0

const PHASES = Object.freeze({
  READY: 'ready',
  DRAWING: 'drawing',
  AIMING: 'aiming',
  EXECUTING: 'executing',
  RECOVERING: 'recovering',
})

const PIVOT_X = 48
const PIVOT_Y = 34
const TIP_X = PIVOT_X + SWORD_PHYSICS.BLADE_LENGTH
const SVG_W = TIP_X + 22
const SVG_H = 66
const BASE_X = PIVOT_X + 16
const MID_X = (BASE_X + TIP_X) / 2
const SORI = 20
const GRIP_BACK = PIVOT_X - 40
const BLADE_PATH = `M ${BASE_X} ${PIVOT_Y - 3.8} Q ${MID_X} ${PIVOT_Y - SORI + 2} ${TIP_X} ${PIVOT_Y - SORI} L ${TIP_X + 7} ${PIVOT_Y - SORI + 4} Q ${MID_X} ${PIVOT_Y - 4} ${BASE_X} ${PIVOT_Y + 4.2} Z`
const HAMON_PATH = `M ${BASE_X + 5} ${PIVOT_Y + 0.8} Q ${MID_X} ${PIVOT_Y - 6} ${TIP_X - 3} ${PIVOT_Y - SORI + 3.5}`

const POV = Object.freeze({
  X: 0.72,
  Y: 1.12,
  SCALE: 3.65,
  ANGLE: -1.36,
  ROTATE_X: 58,
  ROTATE_Y: -24,
  AIM_MS: 430,
  HOLD_MS: 115,
  RECOVERY_MS: 360,
  SLASH_SCALE: 3.25,
  SLASH_ROTATE_X: 18,
  SLASH_ROTATE_Y: -12,
  SWAY_X: 52,
  SWAY_Y: 24,
})

const pointsString = (points) => points.map((point) => `${point.x},${point.y}`).join(' ')
const angleBetween = (a, b, fallback = 0) => (
  Math.hypot(b.x - a.x, b.y - a.y) > 0.01
    ? Math.atan2(b.y - a.y, b.x - a.x)
    : fallback
)

function applyPose(node, pose, shake = null) {
  if (!node) return
  const shakeX = shake?.x ?? 0
  const shakeY = shake?.y ?? 0
  const shakeAngle = shake?.angle ?? 0
  node.style.transform = [
    `translate3d(${pose.x - PIVOT_X + shakeX}px, ${pose.y - PIVOT_Y + shakeY}px, 0)`,
    `rotateZ(${pose.angle + shakeAngle}rad)`,
    `rotateX(${pose.rotateX ?? 0}deg)`,
    `rotateY(${pose.rotateY ?? 0}deg)`,
    `scale(${pose.scale ?? 1})`,
  ].join(' ')
  node.style.opacity = '1'
}

export default function PlannedSwordCursor({ enabled, registryRef, onResolve, perception }) {
  const [flashes, setFlashes] = useState([])
  const layerRef = useRef(null)
  const bladeRef = useRef(null)
  const planRef = useRef(null)
  const phaseRef = useRef(PHASES.READY)
  const phaseStartedRef = useRef(0)
  const pointerRef = useRef({ x: 0, y: 0 })
  const swordStateRef = useRef(null)
  const pointsRef = useRef([])
  const metricsRef = useRef(null)
  const currentPoseRef = useRef({ x: 0, y: 0, angle: Math.PI / 2, scale: 1, rotateX: 0, rotateY: 0 })
  const cutIdsRef = useRef(new Set())
  const crossingsRef = useRef(new Map())
  const animationRef = useRef(null)
  const holdTimerRef = useRef(null)
  const onResolveRef = useRef(onResolve)
  const perceptionRef = useRef(perception)
  onResolveRef.current = onResolve
  perceptionRef.current = perception

  useEffect(() => {
    if (!enabled) return undefined

    const startHand = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
    pointerRef.current = startHand
    swordStateRef.current = createSwordState(startHand)
    pointsRef.current = []
    metricsRef.current = null
    cutIdsRef.current.clear()
    crossingsRef.current.clear()

    const setPhase = (phase, now = performance.now()) => {
      phaseRef.current = phase
      phaseStartedRef.current = now
      if (layerRef.current) layerRef.current.dataset.phase = phase
    }

    const eventPoint = (event) => ({
      x: perceptionRef.current?.invertPointerX ? window.innerWidth - event.clientX : event.clientX,
      y: event.clientY,
    })

    const addFlash = (x, y) => {
      const key = ++flashKey
      setFlashes((current) => [...current, { key, x, y }])
      window.setTimeout(() => {
        setFlashes((current) => current.filter((flash) => flash.key !== key))
      }, 360)
    }

    const resolveCut = (id, center, entry, exit, now) => {
      if (cutIdsRef.current.has(id)) return
      const chord = Math.hypot(exit.x - entry.x, exit.y - entry.y)
      if (chord < center.radius * SWORD_PHYSICS.CUT_MIN_CHORD_FRACTION) return
      cutIdsRef.current.add(id)
      crossingsRef.current.delete(id)
      onResolveRef.current?.(id, {
        cx: center.x,
        cy: center.y,
        ax: entry.x,
        ay: entry.y,
        bx: exit.x,
        by: exit.y,
        at: now,
      })
      addFlash(center.x, center.y)
    }

    const cutAlong = (from, to, now) => {
      const registry = registryRef.current
      if (!registry) return
      const active = new Set()

      registry.forEach((target, id) => {
        if (!target.active || cutIdsRef.current.has(id)) return
        active.add(id)
        const center = { x: target.x, y: target.y, radius: target.radius }
        const intersections = segmentCircleIntersections(from, to, center, center.radius)
        const nowInside = Math.hypot(to.x - center.x, to.y - center.y) <= center.radius
        const crossing = crossingsRef.current.get(id)

        if (nowInside) {
          if (!crossing) {
            const entry = intersections.length
              ? pointAlong(from, to, Math.min(...intersections))
              : { ...from }
            crossingsRef.current.set(id, { entry })
          }
          return
        }

        if (crossing) {
          const exit = intersections.length
            ? pointAlong(from, to, Math.max(...intersections))
            : { ...to }
          resolveCut(id, center, crossing.entry, exit, now)
          return
        }

        if (intersections.length === 2) {
          const entry = pointAlong(from, to, Math.min(...intersections))
          const exit = pointAlong(from, to, Math.max(...intersections))
          resolveCut(id, center, entry, exit, now)
        }
      })

      crossingsRef.current.forEach((_, id) => {
        if (!active.has(id)) crossingsRef.current.delete(id)
      })
    }

    const recoverToPointer = () => {
      setPhase(PHASES.RECOVERING)
      const pointer = pointerRef.current
      const returnPose = {
        x: pointer.x,
        y: pointer.y,
        angle: Math.PI / 2,
        scale: 1,
        rotateX: 0,
        rotateY: 0,
      }
      animationRef.current = animate(currentPoseRef.current, {
        ...returnPose,
        duration: POV.RECOVERY_MS,
        ease: 'out(3)',
        onUpdate: () => applyPose(bladeRef.current, currentPoseRef.current),
        onComplete: () => {
          swordStateRef.current = createSwordState(pointerRef.current)
          pointsRef.current = []
          metricsRef.current = null
          cutIdsRef.current.clear()
          crossingsRef.current.clear()
          if (planRef.current) planRef.current.setAttribute('points', '')
          setPhase(PHASES.READY)
        },
      })
    }

    const startExecution = () => {
      const metrics = metricsRef.current
      if (!metrics) return
      setPhase(PHASES.EXECUTING)

      const driver = { distance: 0 }
      let previousTip = metrics.points[0]
      const duration = Math.max(320, (metrics.length / SLASH_PATH_CONFIG.EXECUTION_SPEED) * 1000)
      const povAnchor = {
        x: window.innerWidth * POV.X,
        y: window.innerHeight * POV.Y,
      }

      animationRef.current = animate(driver, {
        distance: metrics.length,
        duration,
        ease: 'inOut(2)',
        onUpdate: () => {
          const sample = pointAtDistance(metrics, driver.distance)
          const tip = sample.point
          const tangent = angleBetween(previousTip, tip, currentPoseRef.current.angle)
          const progress = metrics.length > 0 ? driver.distance / metrics.length : 1
          const screenX = window.innerWidth > 0 ? tip.x / window.innerWidth - 0.5 : 0
          const screenY = window.innerHeight > 0 ? tip.y / window.innerHeight - 0.5 : 0

          // The sword remains held in the player's foreground. The path controls
          // its facing and swing, while only a small body sway moves the hilt.
          const pose = {
            x: povAnchor.x + screenX * POV.SWAY_X,
            y: povAnchor.y + screenY * POV.SWAY_Y,
            angle: tangent,
            scale: POV.SLASH_SCALE + Math.sin(progress * Math.PI) * 0.38,
            rotateX: POV.SLASH_ROTATE_X + Math.sin(progress * Math.PI) * -12,
            rotateY: POV.SLASH_ROTATE_Y + screenX * 18,
          }
          currentPoseRef.current = pose
          applyPose(bladeRef.current, pose)

          // Collision and trail erasure still follow the authored line exactly.
          cutAlong(previousTip, tip, performance.now())
          previousTip = tip
          if (planRef.current) {
            planRef.current.setAttribute('points', pointsString(remainingPathPoints(metrics, driver.distance)))
          }
        },
        onComplete: recoverToPointer,
      })
    }

    const pullIntoPov = () => {
      setPhase(PHASES.AIMING)
      const povPose = {
        x: window.innerWidth * POV.X,
        y: window.innerHeight * POV.Y,
        angle: POV.ANGLE,
        scale: POV.SCALE,
        rotateX: POV.ROTATE_X,
        rotateY: POV.ROTATE_Y,
      }

      animationRef.current?.pause?.()
      animationRef.current = animate(currentPoseRef.current, {
        ...povPose,
        duration: POV.AIM_MS,
        ease: 'out(4)',
        onUpdate: () => applyPose(bladeRef.current, currentPoseRef.current),
        onComplete: () => {
          holdTimerRef.current = window.setTimeout(startExecution, POV.HOLD_MS)
        },
      })
    }

    const move = (event) => {
      pointerRef.current = eventPoint(event)
    }

    const down = (event) => {
      if (event.button !== 0 || phaseRef.current !== PHASES.READY) return
      pointsRef.current = []
      cutIdsRef.current.clear()
      crossingsRef.current.clear()
      setPhase(PHASES.DRAWING)
    }

    const finishDrawing = () => {
      if (phaseRef.current !== PHASES.DRAWING) return
      if (pathLength(pointsRef.current) < SLASH_PATH_CONFIG.MIN_PATH_LENGTH) {
        pointsRef.current = []
        setPhase(PHASES.READY)
        return
      }
      metricsRef.current = buildPathMetrics(pointsRef.current)
      pullIntoPov()
    }

    const up = (event) => {
      if (event.button !== 0) return
      finishDrawing()
    }

    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('pointerdown', down)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', finishDrawing)

    let raf
    let previousFrame = performance.now()
    const frame = (now) => {
      const dt = Math.min((now - previousFrame) / 1000, 0.05)
      previousFrame = now
      const phase = phaseRef.current

      if (phase === PHASES.READY || phase === PHASES.DRAWING) {
        const hand = pointerRef.current
        const swordState = stepSword(swordStateRef.current, {
          hand,
          dt,
          config: perceptionRef.current?.bladeProfile === 'heavy'
            ? { ...SWORD_PHYSICS, DAMPING: 0.968, GRAVITY: SWORD_PHYSICS.GRAVITY * 1.18 }
            : SWORD_PHYSICS,
        })
        swordStateRef.current = swordState
        const pose = {
          x: hand.x,
          y: hand.y,
          angle: swordState.angle,
          scale: 1,
          rotateX: 0,
          rotateY: 0,
        }
        currentPoseRef.current = pose
        const tension = phase === PHASES.DRAWING
          ? Math.min(1, (now - phaseStartedRef.current) / 700)
          : 0
        applyPose(bladeRef.current, pose, {
          x: Math.sin(now * 0.075) * tension * 2.8,
          y: Math.cos(now * 0.091) * tension * 2.8,
          angle: Math.sin(now * 0.11) * tension * 0.028,
        })

        if (phase === PHASES.DRAWING) {
          pointsRef.current = appendPathPoint(pointsRef.current, swordState.tip)
          if (planRef.current) {
            planRef.current.setAttribute('points', pointsString(pointsRef.current))
          }
        }
      }

      if (layerRef.current) {
        layerRef.current.classList.toggle('is-tensioned', phase === PHASES.DRAWING)
        layerRef.current.classList.toggle('is-pov', phase === PHASES.AIMING || phase === PHASES.EXECUTING)
        layerRef.current.classList.toggle('is-executing', phase === PHASES.EXECUTING)
      }

      raf = window.requestAnimationFrame(frame)
    }
    raf = window.requestAnimationFrame(frame)

    return () => {
      window.cancelAnimationFrame(raf)
      animationRef.current?.pause?.()
      if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerdown', down)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', finishDrawing)
      cutIdsRef.current.clear()
      crossingsRef.current.clear()
    }
  }, [enabled, registryRef])

  if (!enabled) return null

  return (
    <div className="sword-cursor-layer sword-pov-stage" ref={layerRef} data-phase={PHASES.READY} aria-hidden="true">
      <svg className="sword-trail" width="100%" height="100%">
        <polyline ref={planRef} className="sword-plan-line" points="" />
      </svg>

      {flashes.map((flash) => (
        <span
          key={flash.key}
          className="sword-hit-flash"
          style={{ left: `${flash.x}px`, top: `${flash.y}px` }}
        />
      ))}

      <div
        className="sword-blade"
        ref={bladeRef}
        style={{ transformOrigin: `${PIVOT_X}px ${PIVOT_Y}px`, opacity: 0 }}
      >
        <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} width={SVG_W} height={SVG_H}>
          <rect x={GRIP_BACK} y={PIVOT_Y - 4.4} width={PIVOT_X + 8 - GRIP_BACK} height={8.8} rx={3.4} className="sword-katana-grip" />
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
