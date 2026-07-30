import { useEffect, useRef, useState } from 'react'

import { SWORD_PHYSICS } from './swordPhysics.js'
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
const BLADE_PATH =
  `M ${BASE_X} ${PIVOT_Y - 3.8} ` +
  `Q ${MID_X} ${PIVOT_Y - SORI + 2} ${TIP_X} ${PIVOT_Y - SORI} ` +
  `L ${TIP_X + 7} ${PIVOT_Y - SORI + 4} ` +
  `Q ${MID_X} ${PIVOT_Y - 4} ${BASE_X} ${PIVOT_Y + 4.2} Z`
const HAMON_PATH =
  `M ${BASE_X + 5} ${PIVOT_Y + 0.8} ` +
  `Q ${MID_X} ${PIVOT_Y - 6} ${TIP_X - 3} ${PIVOT_Y - SORI + 3.5}`

function pointsAttribute(points) {
  return points.map((point) => `${point.x},${point.y}`).join(' ')
}

function angleForSegment(from, to, fallback = -Math.PI / 2) {
  const dx = to.x - from.x
  const dy = to.y - from.y
  return Math.hypot(dx, dy) > 0.01 ? Math.atan2(dy, dx) : fallback
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

function easeInOut(t) {
  return t * t * (3 - 2 * t)
}

function bladeTransform({ pivot, angle, scale = 1, shakeX = 0, shakeY = 0, shakeAngle = 0 }) {
  return `translate(${pivot.x - PIVOT_X + shakeX}px, ${pivot.y - PIVOT_Y + shakeY}px) rotate(${angle + shakeAngle}rad) scale(${scale})`
}

// Hold to draw one persistent cut path with the blade tip. Release to pull the
// weapon into a first-person attack pose, then execute that exact path. Only the
// executing sword performs collision; drawing is planning, never damage.
export default function SwordCursor({ enabled, registryRef, onResolve, perception }) {
  const [flashes, setFlashes] = useState([])
  const layerRef = useRef(null)
  const bladeRef = useRef(null)
  const planRef = useRef(null)
  const phaseRef = useRef(PHASES.READY)
  const pointerRef = useRef({ x: 0, y: 0 })
  const drawnPointsRef = useRef([])
  const metricsRef = useRef(null)
  const phaseStartedAtRef = useRef(0)
  const executionDistanceRef = useRef(0)
  const previousExecutionTipRef = useRef(null)
  const currentAngleRef = useRef(-Math.PI / 2)
  const cutIdsRef = useRef(new Set())
  const onResolveRef = useRef(onResolve)
  const perceptionRef = useRef(perception)
  onResolveRef.current = onResolve
  perceptionRef.current = perception

  useEffect(() => {
    if (!enabled) return undefined

    const center = {
      x: (typeof window !== 'undefined' ? window.innerWidth : 640) / 2,
      y: (typeof window !== 'undefined' ? window.innerHeight : 480) / 2,
    }
    pointerRef.current = center
    phaseRef.current = PHASES.READY
    drawnPointsRef.current = []
    metricsRef.current = null
    executionDistanceRef.current = 0
    previousExecutionTipRef.current = null
    cutIdsRef.current.clear()

    const pointerPosition = (event) => ({
      x: perceptionRef.current?.invertPointerX ? window.innerWidth - event.clientX : event.clientX,
      y: event.clientY,
    })

    const setPhase = (phase, now = performance.now()) => {
      phaseRef.current = phase
      phaseStartedAtRef.current = now
      if (layerRef.current) layerRef.current.dataset.phase = phase
    }

    const onMove = (event) => {
      const point = pointerPosition(event)
      pointerRef.current = point
      if (phaseRef.current === PHASES.DRAWING) {
        drawnPointsRef.current = appendPathPoint(drawnPointsRef.current, point)
      }
    }

    const onDown = (event) => {
      if (event.button !== 0 || phaseRef.current !== PHASES.READY) return
      const point = pointerPosition(event)
      pointerRef.current = point
      drawnPointsRef.current = [point]
      metricsRef.current = null
      executionDistanceRef.current = 0
      previousExecutionTipRef.current = null
      cutIdsRef.current.clear()
      setPhase(PHASES.DRAWING)
    }

    const onUp = (event) => {
      if (event.button !== 0 || phaseRef.current !== PHASES.DRAWING) return
      const point = pointerPosition(event)
      pointerRef.current = point
      drawnPointsRef.current = appendPathPoint(drawnPointsRef.current, point, 1)
      if (pathLength(drawnPointsRef.current) < SLASH_PATH_CONFIG.MIN_PATH_LENGTH) {
        drawnPointsRef.current = []
        setPhase(PHASES.READY)
        return
      }
      metricsRef.current = buildPathMetrics(drawnPointsRef.current)
      executionDistanceRef.current = 0
      previousExecutionTipRef.current = metricsRef.current.points[0]
      setPhase(PHASES.AIMING)
    }

    const addFlash = (x, y) => {
      const key = ++flashKey
      setFlashes((current) => [...current, { key, x, y }])
      window.setTimeout(() => {
        setFlashes((current) => current.filter((flash) => flash.key !== key))
      }, 360)
    }

    const cutAlongSegment = (from, to, now) => {
      const registry = registryRef.current
      if (!registry) return
      registry.forEach((entry, id) => {
        if (!entry.active || cutIdsRef.current.has(id)) return
        const centerPoint = { x: entry.x, y: entry.y }
        const intersections = segmentCircleIntersections(from, to, centerPoint, entry.radius)
        if (!intersections.length) return

        const a = pointAlong(from, to, Math.min(...intersections))
        const b = pointAlong(from, to, Math.max(...intersections))
        const chord = Math.hypot(b.x - a.x, b.y - a.y)
        if (chord < entry.radius * SWORD_PHYSICS.CUT_MIN_CHORD_FRACTION) return

        cutIdsRef.current.add(id)
        onResolveRef.current?.(id, {
          cx: centerPoint.x,
          cy: centerPoint.y,
          ax: a.x,
          ay: a.y,
          bx: b.x,
          by: b.y,
          at: now,
        })
        addFlash(centerPoint.x, centerPoint.y)
      })
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)

    let raf
    let last = performance.now()
    const loop = (now) => {
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      const phase = phaseRef.current
      const pointer = pointerRef.current
      const blade = bladeRef.current
      const plan = planRef.current
      let visiblePlan = drawnPointsRef.current

      if (phase === PHASES.READY || phase === PHASES.DRAWING) {
        const points = drawnPointsRef.current
        const previous = points.length > 1 ? points[points.length - 2] : { x: pointer.x, y: pointer.y + 1 }
        const angle = angleForSegment(previous, pointer, currentAngleRef.current)
        currentAngleRef.current = angle
        const tension = phase === PHASES.DRAWING
          ? Math.min(1, (now - phaseStartedAtRef.current) / 700)
          : 0
        const shake = tension * 2.8
        if (blade) {
          blade.style.transform = bladeTransform({
            pivot: {
              x: pointer.x - Math.cos(angle) * SWORD_PHYSICS.BLADE_LENGTH,
              y: pointer.y - Math.sin(angle) * SWORD_PHYSICS.BLADE_LENGTH,
            },
            angle,
            shakeX: Math.sin(now * 0.075) * shake,
            shakeY: Math.cos(now * 0.091) * shake,
            shakeAngle: Math.sin(now * 0.11) * tension * 0.028,
          })
          blade.style.opacity = '1'
        }
      } else if (phase === PHASES.AIMING) {
        const elapsed = now - phaseStartedAtRef.current
        const t = easeInOut(Math.min(1, elapsed / SLASH_PATH_CONFIG.AIM_DURATION_MS))
        const startTip = metricsRef.current?.points[0] ?? pointer
        const startAngle = currentAngleRef.current
        const attackPivot = { x: window.innerWidth * 0.5, y: window.innerHeight * 1.04 }
        const startPivot = {
          x: startTip.x - Math.cos(startAngle) * SWORD_PHYSICS.BLADE_LENGTH,
          y: startTip.y - Math.sin(startAngle) * SWORD_PHYSICS.BLADE_LENGTH,
        }
        const pivot = {
          x: lerp(startPivot.x, attackPivot.x, t),
          y: lerp(startPivot.y, attackPivot.y, t),
        }
        const angle = lerp(startAngle, -Math.PI / 2, t)
        currentAngleRef.current = angle
        if (blade) {
          blade.style.transform = bladeTransform({ pivot, angle, scale: lerp(1, 0.7, t) })
          blade.style.opacity = '1'
        }
        if (elapsed >= SLASH_PATH_CONFIG.AIM_DURATION_MS) {
          previousExecutionTipRef.current = metricsRef.current.points[0]
          setPhase(PHASES.EXECUTING, now)
        }
      } else if (phase === PHASES.EXECUTING) {
        const metrics = metricsRef.current
        const previousDistance = executionDistanceRef.current
        executionDistanceRef.current = Math.min(
          metrics.length,
          previousDistance + SLASH_PATH_CONFIG.EXECUTION_SPEED * dt,
        )
        const previousSample = pointAtDistance(metrics, previousDistance)
        const sample = pointAtDistance(metrics, executionDistanceRef.current)
        const tip = sample.point
        const previousTip = previousExecutionTipRef.current ?? previousSample.point
        const angle = angleForSegment(previousTip, tip, currentAngleRef.current)
        currentAngleRef.current = angle
        const pivot = {
          x: tip.x - Math.cos(angle) * SWORD_PHYSICS.BLADE_LENGTH,
          y: tip.y - Math.sin(angle) * SWORD_PHYSICS.BLADE_LENGTH,
        }
        if (blade) {
          blade.style.transform = bladeTransform({ pivot, angle, scale: 1.08 })
          blade.style.opacity = '1'
        }
        cutAlongSegment(previousTip, tip, now)
        previousExecutionTipRef.current = tip
        visiblePlan = remainingPathPoints(metrics, executionDistanceRef.current)

        if (executionDistanceRef.current >= metrics.length) {
          setPhase(PHASES.RECOVERING, now)
        }
      } else if (phase === PHASES.RECOVERING) {
        const elapsed = now - phaseStartedAtRef.current
        const t = easeInOut(Math.min(1, elapsed / SLASH_PATH_CONFIG.RECOVERY_DURATION_MS))
        const endTip = metricsRef.current?.points.at(-1) ?? pointer
        const startAngle = currentAngleRef.current
        const endAngle = angleForSegment(
          { x: pointer.x - SWORD_PHYSICS.BLADE_LENGTH, y: pointer.y },
          pointer,
          0,
        )
        const startPivot = {
          x: endTip.x - Math.cos(startAngle) * SWORD_PHYSICS.BLADE_LENGTH,
          y: endTip.y - Math.sin(startAngle) * SWORD_PHYSICS.BLADE_LENGTH,
        }
        const endPivot = {
          x: pointer.x - Math.cos(endAngle) * SWORD_PHYSICS.BLADE_LENGTH,
          y: pointer.y - Math.sin(endAngle) * SWORD_PHYSICS.BLADE_LENGTH,
        }
        const pivot = {
          x: lerp(startPivot.x, endPivot.x, t),
          y: lerp(startPivot.y, endPivot.y, t),
        }
        const angle = lerp(startAngle, endAngle, t)
        currentAngleRef.current = angle
        if (blade) {
          blade.style.transform = bladeTransform({ pivot, angle, scale: lerp(1.08, 1, t) })
          blade.style.opacity = '1'
        }
        visiblePlan = []
        if (elapsed >= SLASH_PATH_CONFIG.RECOVERY_DURATION_MS) {
          drawnPointsRef.current = []
          metricsRef.current = null
          executionDistanceRef.current = 0
          previousExecutionTipRef.current = null
          cutIdsRef.current.clear()
          setPhase(PHASES.READY, now)
        }
      }

      if (plan) plan.setAttribute('points', pointsAttribute(visiblePlan))
      if (layerRef.current) {
        layerRef.current.classList.toggle('is-tensioned', phase === PHASES.DRAWING)
        layerRef.current.classList.toggle('is-executing', phase === PHASES.EXECUTING)
      }

      raf = window.requestAnimationFrame(loop)
    }
    raf = window.requestAnimationFrame(loop)

    return () => {
      window.cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      cutIdsRef.current.clear()
    }
  }, [enabled, registryRef])

  if (!enabled) return null

  return (
    <div className="sword-cursor-layer" ref={layerRef} data-phase={PHASES.READY} aria-hidden="true">
      <svg className="sword-trail" width="100%" height="100%">
        <polyline ref={planRef} className="sword-plan-line" points="" />
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
