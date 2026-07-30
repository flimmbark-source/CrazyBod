import { useEffect, useRef, useState } from 'react'

import { MICROGAME_NAMES, NewMicrogameContent } from '../../minigames/catalog.jsx'
import { MANDALA_CONFIG } from './mandalaConfig.js'
import { cutPolygonCssByLine, lineNormal } from '../sword/sliceGeometry.js'

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
const DEATH_MS = 540
const NOOP = () => {}
// Docked (on-plane) panels sit at this stacking level; foes still in the pipe
// stack below it (by depth), so the UI-plane panels are always in front.
const PLANE_Z = 3000
// In-pipe foes never render larger than this, so a docked panel (scale 1) is
// always the biggest/closest-reading — reinforcing the plane separation.
const PIPE_MAX_SCALE = 0.85

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
  const kindRef = useRef(new Map()) // id -> kind, captured once
  const snapshotRef = useRef(new Map()) // id -> detached clone of the parked panel
  const dyingRef = useRef(new Set()) // guard against double-processing a death
  const deathLayerRef = useRef(null) // non-React container for the cut halves
  const sigRef = useRef('')
  const timersRef = useRef([])

  useEffect(() => {
    let raf
    let frame = 0

    // Build the cut halves in a separate, non-React container so React's list
    // re-renders (constant, as foes arrive) can never wipe them. The live enemy
    // node is just hidden and unmounts normally once the sim drops it.
    const startDeath = (id, node, cut) => {
      if (dyingRef.current.has(id)) return
      dyingRef.current.add(id)

      const container = deathLayerRef.current
      // Prefer the cached detached snapshot (survives unmount); fall back to the
      // live node if it's still around.
      const content = snapshotRef.current.get(id) ?? node?.querySelector('.enemy-content')
      if (node) node.style.opacity = '0' // hide the live panel immediately

      if (container && content && cut && Number.isFinite(cut.cx)) {
        const group = document.createElement('div')
        group.className = 'mandala-death'
        group.style.left = `${cut.cx}px`
        group.style.top = `${cut.cy}px`

        // Map the blade segment into the panel's local coords (parked = scale 1,
        // centred on cx,cy → pure translation), so the split follows exactly
        // where the blade crossed the panel.
        const p1 = { x: cut.ax - cut.cx + ENEMY_W / 2, y: cut.ay - cut.cy + ENEMY_H / 2 }
        const p2 = { x: cut.bx - cut.cx + ENEMY_W / 2, y: cut.by - cut.cy + ENEMY_H / 2 }
        const normal = lineNormal(p1, p2)

        for (const side of [1, -1]) {
          const half = document.createElement('div')
          half.className = 'enemy-half'
          const css = cutPolygonCssByLine(ENEMY_W, ENEMY_H, p1, p2, side)
          half.style.clipPath = css
          half.style.webkitClipPath = css
          const snapshot = content.cloneNode(true) // static snapshot of the exact panel
          snapshot.style.visibility = 'visible'
          half.appendChild(snapshot)
          group.appendChild(half)
          window.requestAnimationFrame(() => {
            const dx = (side * normal.x * 58).toFixed(1)
            const dy = (side * normal.y * 58).toFixed(1)
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

      // Start death animations for foes the sword just cut (id -> cut angle).
      if (deaths.size) {
        deaths.forEach((cut, id) => {
          startDeath(id, nodes.get(id), cut)
        })
        deaths.clear()
      }

      // Position every live (non-dying) enemy.
      nodes.forEach((node, id) => {
        if (dyingRef.current.has(id)) return
        const data = map.get(id)
        if (!data) {
          node.style.opacity = '0'
          return
        }
        if (data.parked) {
          // Docked on the sword's plane at full UI size, and always in front of
          // anything still travelling in the pipe. Settle in with a short
          // transition from wherever it arrived.
          if (node.dataset.mode !== 'parked') {
            node.dataset.mode = 'parked'
            node.style.transition = 'transform 340ms cubic-bezier(0.18, 0.7, 0.3, 1), opacity 220ms ease-out'
          }
          node.style.transform = `translate(${data.x}px, ${data.y}px) translate(-50%, -50%) scale(1)`
          node.style.opacity = '1'
          node.style.zIndex = String(PLANE_Z)
          node.classList.add('is-active')
          node.classList.remove('is-arriving')
          // Cache a detached snapshot of the docked panel for the cut animation.
          if (!snapshotRef.current.has(id)) {
            const content = node.querySelector('.enemy-content')
            if (content) snapshotRef.current.set(id, content.cloneNode(true))
          }
        } else {
          // Flying down the tube: depth-projected, capped below full size, and
          // stacked BEHIND the on-plane panels (nearer flyers above farther
          // ones, but all under the plane).
          if (node.dataset.mode !== 'flying') {
            node.dataset.mode = 'flying'
            node.style.transition = 'none'
          }
          const scale = Math.min(PIPE_MAX_SCALE, data.pixelRadius / NOMINAL_HALF)
          node.style.transform = `translate(${data.x}px, ${data.y}px) translate(-50%, -50%) scale(${scale.toFixed(3)})`
          node.style.opacity = opacityFor(data.distanceAhead, config).toFixed(2)
          const depthZ = Math.round((config.APPROACHING_DISTANCE - data.distanceAhead) * 20)
          node.style.zIndex = String(Math.max(1, Math.min(PLANE_Z - 100, depthZ)))
          node.classList.remove('is-active')
          node.classList.toggle('is-arriving', data.state === 'arriving')
        }
      })

      // Reconcile the mounted id set a few times a second. A dying foe is kept
      // mounted (hidden) until its animation ends, so its panel stays available
      // to snapshot; its cut halves themselves live in the separate death layer.
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
      {/* Non-React container: cut halves are appended here imperatively so list
          re-renders can never wipe them. React renders it empty and leaves its
          children alone. */}
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
