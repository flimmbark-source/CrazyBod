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

const PHASES = Object.freeze({ READY: 'ready', DRAWING: 'drawing', AIMING: 'aiming', EXECUTING: 'executing', RECOVERING: 'recovering' })
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

const lerp = (a, b, t) => a + (b - a) * t
const ease = (t) => t * t * (3 - 2 * t)
const pointsString = (points) => points.map((point) => `${point.x},${point.y}`).join(' ')
const angleBetween = (a, b, fallback = 0) => Math.hypot(b.x - a.x, b.y - a.y) > 0.01 ? Math.atan2(b.y - a.y, b.x - a.x) : fallback
const pivotBehindTip = (tip, angle) => ({ x: tip.x - Math.cos(angle) * SWORD_PHYSICS.BLADE_LENGTH, y: tip.y - Math.sin(angle) * SWORD_PHYSICS.BLADE_LENGTH })
const transformFor = (pivot, angle, scale = 1, shake = { x: 0, y: 0, angle: 0 }) => `translate(${pivot.x - PIVOT_X + shake.x}px, ${pivot.y - PIVOT_Y + shake.y}px) rotate(${angle + shake.angle}rad) scale(${scale})`

export default function PlannedSwordCursor({ enabled, registryRef, onResolve, perception }) {
  const [flashes, setFlashes] = useState([])
  const layerRef = useRef(null)
  const bladeRef = useRef(null)
  const planRef = useRef(null)
  const phaseRef = useRef(PHASES.READY)
  const phaseStartedRef = useRef(0)
  const pointerRef = useRef({ x: 0, y: 0 })
  const pointsRef = useRef([])
  const metricsRef = useRef(null)
  const executionDistanceRef = useRef(0)
  const executionTipRef = useRef(null)
  const angleRef = useRef(0)
  const cutIdsRef = useRef(new Set())
  const crossingsRef = useRef(new Map())
  const onResolveRef = useRef(onResolve)
  const perceptionRef = useRef(perception)
  onResolveRef.current = onResolve
  perceptionRef.current = perception

  useEffect(() => {
    if (!enabled) return undefined

    pointerRef.current = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
    pointsRef.current = []
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

    const move = (event) => {
      const point = eventPoint(event)
      pointerRef.current = point
      if (phaseRef.current === PHASES.DRAWING) pointsRef.current = appendPathPoint(pointsRef.current, point)
    }

    const down = (event) => {
      if (event.button !== 0 || phaseRef.current !== PHASES.READY) return
      const point = eventPoint(event)
      pointerRef.current = point
      pointsRef.current = [point]
      metricsRef.current = null
      cutIdsRef.current.clear()
      crossingsRef.current.clear()
      setPhase(PHASES.DRAWING)
    }

    const finishDrawing = (point) => {
      if (phaseRef.current !== PHASES.DRAWING) return
      pointerRef.current = point
      pointsRef.current = appendPathPoint(pointsRef.current, point, 1)
      if (pathLength(pointsRef.current) < SLASH_PATH_CONFIG.MIN_PATH_LENGTH) {
        pointsRef.current = []
        setPhase(PHASES.READY)
        return
      }
      metricsRef.current = buildPathMetrics(pointsRef.current)
      executionDistanceRef.current = 0
      executionTipRef.current = metricsRef.current.points[0]
      setPhase(PHASES.AIMING)
    }

    const up = (event) => {
      if (event.button !== 0) return
      finishDrawing(eventPoint(event))
    }
    const cancel = () => finishDrawing(pointerRef.current)

    const addFlash = (x, y) => {
      const key = ++flashKey
      setFlashes((current) => [...current, { key, x, y }])
      window.setTimeout(() => setFlashes((current) => current.filter((flash) => flash.key !== key)), 360)
    }

    const resolveCut = (id, center, entry, exit, now) => {
      if (cutIdsRef.current.has(id)) return
      if (Math.hypot(exit.x - entry.x, exit.y - entry.y) < center.radius * SWORD_PHYSICS.CUT_MIN_CHORD_FRACTION) return
      cutIdsRef.current.add(id)
      crossingsRef.current.delete(id)
      onResolveRef.current?.(id, { cx: center.x, cy: center.y, ax: entry.x, ay: entry.y, bx: exit.x, by: exit.y, at: now })
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
            const entry = intersections.length ? pointAlong(from, to, Math.min(...intersections)) : { ...from }
            crossingsRef.current.set(id, { entry })
          }
          return
        }

        if (crossing) {
          const exit = intersections.length ? pointAlong(from, to, Math.max(...intersections)) : { ...to }
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

    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('pointerdown', down)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)

    let raf
    let previousFrame = performance.now()
    const frame = (now) => {
      const dt = Math.min((now - previousFrame) / 1000, 0.05)
      previousFrame = now
      const phase = phaseRef.current
      const pointer = pointerRef.current
      let visiblePoints = pointsRef.current

      if (phase === PHASES.READY || phase === PHASES.DRAWING) {
        const previous = pointsRef.current.at(-2) ?? { x: pointer.x - 1, y: pointer.y }
        const angle = angleBetween(previous, pointer, angleRef.current)
        angleRef.current = angle
        const tension = phase === PHASES.DRAWING ? Math.min(1, (now - phaseStartedRef.current) / 700) : 0
        const shake = { x: Math.sin(now * 0.075) * tension * 2.8, y: Math.cos(now * 0.091) * tension * 2.8, angle: Math.sin(now * 0.11) * tension * 0.028 }
        if (bladeRef.current) bladeRef.current.style.transform = transformFor(pivotBehindTip(pointer, angle), angle, 1, shake)
      } else if (phase === PHASES.AIMING) {
        const t = ease(Math.min(1, (now - phaseStartedRef.current) / SLASH_PATH_CONFIG.AIM_DURATION_MS))
        const startTip = metricsRef.current.points[0]
        const startPivot = pivotBehindTip(startTip, angleRef.current)
        const attackPivot = { x: window.innerWidth * 0.5, y: window.innerHeight * 1.04 }
        const pivot = { x: lerp(startPivot.x, attackPivot.x, t), y: lerp(startPivot.y, attackPivot.y, t) }
        const angle = lerp(angleRef.current, -Math.PI / 2, t)
        if (bladeRef.current) bladeRef.current.style.transform = transformFor(pivot, angle, lerp(1, 0.7, t))
        if (t >= 1) {
          executionTipRef.current = metricsRef.current.points[0]
          setPhase(PHASES.EXECUTING, now)
        }
      } else if (phase === PHASES.EXECUTING) {
        const metrics = metricsRef.current
        const previousDistance = executionDistanceRef.current
        executionDistanceRef.current = Math.min(metrics.length, previousDistance + SLASH_PATH_CONFIG.EXECUTION_SPEED * dt)
        const previousTip = executionTipRef.current ?? pointAtDistance(metrics, previousDistance).point
        const tip = pointAtDistance(metrics, executionDistanceRef.current).point
        const angle = angleBetween(previousTip, tip, angleRef.current)
        angleRef.current = angle
        if (bladeRef.current) bladeRef.current.style.transform = transformFor(pivotBehindTip(tip, angle), angle, 1.08)
        cutAlong(previousTip, tip, now)
        executionTipRef.current = tip
        visiblePoints = remainingPathPoints(metrics, executionDistanceRef.current)
        if (executionDistanceRef.current >= metrics.length) setPhase(PHASES.RECOVERING, now)
      } else if (phase === PHASES.RECOVERING) {
        const t = ease(Math.min(1, (now - phaseStartedRef.current) / SLASH_PATH_CONFIG.RECOVERY_DURATION_MS))
        const endTip = metricsRef.current.points.at(-1)
        const startPivot = pivotBehindTip(endTip, angleRef.current)
        const returnAngle = 0
        const returnPivot = pivotBehindTip(pointer, returnAngle)
        const pivot = { x: lerp(startPivot.x, returnPivot.x, t), y: lerp(startPivot.y, returnPivot.y, t) }
        if (bladeRef.current) bladeRef.current.style.transform = transformFor(pivot, lerp(angleRef.current, returnAngle, t), lerp(1.08, 1, t))
        visiblePoints = []
        if (t >= 1) {
          pointsRef.current = []
          metricsRef.current = null
          executionDistanceRef.current = 0
          executionTipRef.current = null
          cutIdsRef.current.clear()
          crossingsRef.current.clear()
          angleRef.current = returnAngle
          setPhase(PHASES.READY, now)
        }
      }

      if (bladeRef.current) bladeRef.current.style.opacity = '1'
      if (planRef.current) planRef.current.setAttribute('points', pointsString(visiblePoints))
      if (layerRef.current) {
        layerRef.current.classList.toggle('is-tensioned', phase === PHASES.DRAWING)
        layerRef.current.classList.toggle('is-executing', phase === PHASES.EXECUTING)
      }
      raf = window.requestAnimationFrame(frame)
    }
    raf = window.requestAnimationFrame(frame)

    return () => {
      window.cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerdown', down)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
      cutIdsRef.current.clear()
      crossingsRef.current.clear()
    }
  }, [enabled, registryRef])

  if (!enabled) return null

  return (
    <div className="sword-cursor-layer" ref={layerRef} data-phase={PHASES.READY} aria-hidden="true">
      <svg className="sword-trail" width="100%" height="100%"><polyline ref={planRef} className="sword-plan-line" points="" /></svg>
      {flashes.map((flash) => <span key={flash.key} className="sword-hit-flash" style={{ left: `${flash.x}px`, top: `${flash.y}px` }} />)}
      <div className="sword-blade" ref={bladeRef} style={{ transformOrigin: `${PIVOT_X}px ${PIVOT_Y}px`, opacity: 0 }}>
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
