import { useEffect, useRef, useState } from 'react'

import { MICROGAME_NAMES, NewMicrogameContent } from '../../minigames/catalog.jsx'
import { MANDALA_CONFIG } from './mandalaConfig.js'
import { cutPolygonCss, cutNormal } from '../sword/sliceGeometry.js'

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
  const dyingRef = useRef(new Set())
  const sigRef = useRef('')
  const timersRef = useRef([])

  useEffect(() => {
    let raf
    let frame = 0

    const startDeath = (id, node, angle) => {
      if (dyingRef.current.has(id)) return
      dyingRef.current.add(id)
      node.classList.remove('is-active', 'is-arriving')
      node.classList.add('is-dying')

      const content = node.querySelector('.enemy-content')
      if (content) {
        content.style.visibility = 'hidden' // hide the live panel; halves take over
        const normal = cutNormal(angle)
        for (const side of [1, -1]) {
          const half = document.createElement('div')
          half.className = 'enemy-half'
          const css = cutPolygonCss(ENEMY_W, ENEMY_H, angle, side)
          half.style.clipPath = css
          half.style.webkitClipPath = css
          const snapshot = content.cloneNode(true) // static snapshot of the exact panel
          snapshot.style.visibility = 'visible'
          half.appendChild(snapshot)
          node.appendChild(half)
          // Next frame: slide the half apart along the cut normal + fade.
          window.requestAnimationFrame(() => {
            const dx = (side * normal.x * 54).toFixed(1)
            const dy = (side * normal.y * 54).toFixed(1)
            half.style.transform = `translate(${dx}px, ${dy}px) rotate(${side * 9}deg)`
            half.style.opacity = '0'
          })
        }
      }

      const timer = window.setTimeout(() => {
        dyingRef.current.delete(id)
        sigRef.current = '__resync__'
      }, DEATH_MS)
      timersRef.current.push(timer)
    }

    const loop = () => {
      const map = enemiesRef.current
      const deaths = deathsRef.current
      const nodes = nodesRef.current

      // Start death animations for foes the sword just cut (id -> cut angle).
      if (deaths.size) {
        deaths.forEach((angle, id) => {
          const node = nodes.get(id)
          if (node) startDeath(id, node, angle)
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
          // Docked at the sword's plane at full UI size. Settle in with a short
          // transition from wherever it arrived.
          if (node.dataset.mode !== 'parked') {
            node.dataset.mode = 'parked'
            node.style.transition = 'transform 340ms cubic-bezier(0.18, 0.7, 0.3, 1), opacity 220ms ease-out'
          }
          node.style.transform = `translate(${data.x}px, ${data.y}px) translate(-50%, -50%) scale(1)`
          node.style.opacity = '1'
          node.classList.add('is-active')
          node.classList.remove('is-arriving')
        } else {
          // Flying down the tube: depth-projected, no transition.
          if (node.dataset.mode !== 'flying') {
            node.dataset.mode = 'flying'
            node.style.transition = 'none'
          }
          const scale = Math.min(1.7, data.pixelRadius / NOMINAL_HALF)
          node.style.transform = `translate(${data.x}px, ${data.y}px) translate(-50%, -50%) scale(${scale.toFixed(3)})`
          node.style.opacity = opacityFor(data.distanceAhead, config).toFixed(2)
          node.classList.remove('is-active')
          node.classList.toggle('is-arriving', data.state === 'arriving')
        }
      })

      // Reconcile the mounted id set a few times a second.
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
            <span className="enemy-flash" />
            <div className="enemy-content">
              <EnemyMicrogame kind={kind} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
