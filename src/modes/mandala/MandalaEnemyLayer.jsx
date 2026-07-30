import { useEffect, useRef, useState } from 'react'

import { MICROGAME_NAMES, NewMicrogameContent } from '../../minigames/catalog.jsx'
import { MANDALA_CONFIG } from './mandalaConfig.js'
import { cutPolygonCssByLine, lineNormal } from '../sword/sliceGeometry.js'
import { SWORD_PHYSICS } from '../sword/swordPhysics.js'

// The foes are the game's real microgames — rendered with the actual microgame
// window markup + CSS, so they look identical to their counterparts elsewhere.
// Each panel is positioned + depth-scaled every frame from the shared screen
// projection (enemiesRef). When the katana cuts one, its id + cut angle land in
// deathsRef; we snapshot the live panel (cloneNode) and split that snapshot into
// two halves clipped along the actual swing line, then throw them apart.

// Fixed enemy panel size (the microgame is stretched to fill it) so projection
// scaling and the slice geometry share one coordinate space.
const ENEMY_W = 236
const ENEMY_H = 202
const NOMINAL_HALF = ENEMY_W / 2
// Death tuning lives with the sword config, so sword + whip + death are set in
// one place.
const DEATH_MS = SWORD_PHYSICS.DEATH_MS
const DEATH_SEPARATION = SWORD_PHYSICS.DEATH_SEPARATION
const NOOP = () => {}
const PIPE_Z_BASE = 3000

const nameFor = (kind) => (kind && MICROGAME_NAMES[kind]) || 'SYMPTOM'

function opacityFor(distanceAhead, config) {
  if (distanceAhead > config.APPROACHING_DISTANCE) return 0.22
  const span = config.APPROACHING_DISTANCE - config.INTERACTION_DISTANCE
  const t = (config.APPROACHING_DISTANCE - distanceAhead) / span
  return Math.max(0.3, Math.min(1, 0.3 + t * 0.7))
}

// The real microgame window, exactly as the rest of the game renders it.
function EnemyMicrogame({ kind }) {
  return (
    <div className={`microgame microgame-${kind} mandala-enemy-microgame`}>
      <div className="microgame-header">
        <span>{nameFor(kind)}</span>
        <i />
      </div>
      <div className="microgame-body">
        <NewMicrogameContent kind={kind} onResolve={NOOP} />
      </div>
    </div>
  )
}

export default function MandalaEnemyLayer({ enemiesRef, deathsRef, config = MANDALA_CONFIG }) {
  const [ids, setIds] = useState([])
  const nodesRef = useRef(new Map())
  const kindRef = useRef(new Map())
  const snapshotRef = useRef(new Map())
  const dyingRef = useRef(new Set())
  const deathLayerRef = useRef(null)
  const sigRef = useRef('')
  const timersRef = useRef([])

  useEffect(() => {
    let raf
    let frame = 0

    const startDeath = (id, node, cut) => {
      if (dyingRef.current.has(id)) return
      dyingRef.current.add(id)

      const container = deathLayerRef.current
      const content = snapshotRef.current.get(id) ?? node?.querySelector('.enemy-content')
      if (node) node.style.opacity = '0'

      if (container && content && cut && Number.isFinite(cut.cx)) {
        const group = document.createElement('div')
        group.className = 'mandala-death'
        group.style.left = `${cut.cx}px`
        group.style.top = `${cut.cy}px`

        const p1 = { x: cut.ax - cut.cx + ENEMY_W / 2, y: cut.ay - cut.cy + ENEMY_H / 2 }
        const p2 = { x: cut.bx - cut.cx + ENEMY_W / 2, y: cut.by - cut.cy + ENEMY_H / 2 }
        const normal = lineNormal(p1, p2)

        for (const side of [1, -1]) {
          const half = document.createElement('div')
          half.className = 'enemy-half'
          half.style.transition = `transform ${DEATH_MS}ms cubic-bezier(0.2, 0.6, 0.3, 1), opacity ${DEATH_MS}ms ease-out`
          const css = cutPolygonCssByLine(ENEMY_W, ENEMY_H, p1, p2, side)
          half.style.clipPath = css
          half.style.webkitClipPath = css
          const snapshot = content.cloneNode(true)
          snapshot.style.visibility = 'visible'
          half.appendChild(snapshot)
          group.appendChild(half)
          window.requestAnimationFrame(() => {
            const dx = (side * normal.x * DEATH_SEPARATION).toFixed(1)
            const dy = (side * normal.y * DEATH_SEPARATION).toFixed(1)
            half.style.transform = `translate(${dx}px, ${dy}px) rotate(${side * 8}deg)`
            half.style.opacity = '0'
          })
        }

        const flash = document.createElement('span')
        flash.className = 'enemy-flash'
        group.appendChild(flash)

        container.appendChild(group)
        timersRef.current.push(window.setTimeout(() => group.remove(), DEATH_MS))
      }

      timersRef.current.push(window.setTimeout(() => dyingRef.current.delete(id), DEATH_MS))
    }

    const loop = () => {
      const map = enemiesRef.current
      const deaths = deathsRef.current
      const nodes = nodesRef.current

      if (deaths.size) {
        deaths.forEach((cut, id) => {
          startDeath(id, nodes.get(id), cut)
        })
        deaths.clear()
      }

      nodes.forEach((node, id) => {
        if (dyingRef.current.has(id)) return
        const data = map.get(id)
        if (!data) {
          node.style.opacity = '0'
          return
        }

        if (node.dataset.mode !== 'flying') {
          node.dataset.mode = 'flying'
          node.style.transition = 'none'
        }

        // Preserve perspective all the way through the player rather than
        // snapping to a fixed sword plane. The panel can grow beyond full UI
        // size as it passes, which carries it naturally off-screen.
        const scale = Math.max(0.12, data.pixelRadius / NOMINAL_HALF)
        node.style.transform = `translate(${data.x}px, ${data.y}px) translate(-50%, -50%) scale(${scale.toFixed(3)})`
        node.style.opacity = opacityFor(data.distanceAhead, config).toFixed(2)
        const depthZ = Math.round((config.APPROACHING_DISTANCE - data.distanceAhead) * 20)
        node.style.zIndex = String(Math.max(1, Math.min(PIPE_Z_BASE, depthZ)))
        node.classList.toggle('is-active', data.state === 'active')
        node.classList.toggle('is-arriving', data.state === 'arriving')

        if (data.state === 'active' && !snapshotRef.current.has(id)) {
          const content = node.querySelector('.enemy-content')
          if (content) snapshotRef.current.set(id, content.cloneNode(true))
        }
      })

      frame += 1
      if (frame % 5 === 0) {
        const keys = [...map.keys()]
        const dyingExtra = [...dyingRef.current].filter((id) => !map.has(id))
        const union = keys.concat(dyingExtra)
        const sig = union.join('|')
        if (sig !== sigRef.current) {
          sigRef.current = sig
          for (const id of union) {
            if (!kindRef.current.has(id)) kindRef.current.set(id, map.get(id)?.kind ?? null)
          }
          for (const id of kindRef.current.keys()) {
            if (!union.includes(id)) kindRef.current.delete(id)
          }
          for (const id of snapshotRef.current.keys()) {
            if (!union.includes(id) && !dyingRef.current.has(id)) snapshotRef.current.delete(id)
          }
          setIds(union)
        }
      }

      raf = window.requestAnimationFrame(loop)
    }

    raf = window.requestAnimationFrame(loop)
    return () => {
      window.cancelAnimationFrame(raf)
      timersRef.current.forEach((timer) => window.clearTimeout(timer))
      timersRef.current = []
      dyingRef.current.clear()
    }
  }, [enemiesRef, deathsRef, config])

  return (
    <>
      <div className="mandala-death-layer" ref={deathLayerRef} aria-hidden="true" />
      <div className="mandala-enemy-layer" aria-hidden="true">
        {ids.map((id) => {
          const kind = kindRef.current.get(id)
          return (
            <div
              key={id}
              className="mandala-enemy"
              ref={(node) => {
                if (node) nodesRef.current.set(id, node)
                else nodesRef.current.delete(id)
              }}
            >
              <div className="enemy-content">
                <EnemyMicrogame kind={kind} />
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
