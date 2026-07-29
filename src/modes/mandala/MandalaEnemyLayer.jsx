import { useEffect, useRef, useState } from 'react'

import { MICROGAME_NAMES } from '../../minigames/catalog.jsx'
import { MANDALA_CONFIG } from './mandalaConfig.js'

// The foes are the game's microgames, rendered as their little windows. Each
// panel is positioned + scaled every frame from the shared screen-space
// projection (enemiesRef, filled by MandalaScene's stepper), so it reads as the
// same minigame travelling down the tube toward the player. When the katana
// cuts one (its id lands in deathsRef) the panel is sliced in two and thrown
// apart. Positioning is done imperatively (no React churn at 60fps); React only
// mounts/unmounts the set of live ids.

const NOMINAL_HALF = 66 // half the panel's nominal width; scale = pixelRadius/this
const DEATH_MS = 520

// Microgame kind -> header colour, mirroring the surface minigame windows.
const CATEGORY_COLOR = {
  discomfort: '#a45f62',
  tremor: '#8d5e72',
  dizziness: '#8d5e72',
  checking: '#bb6c48',
  racingHeart: '#bb6c48',
  anxiety: '#c46f43',
  workingMemory: '#657c8f',
  directionLoss: '#657c8f',
  brainFog: '#657c8f',
  heavyEyes: '#625d82',
  microRest: '#625d82',
  fatigue: '#625d82',
  lightSensitivity: '#6e7d61',
}
const colorFor = (kind) => CATEGORY_COLOR[kind] ?? '#6b5d76'
const nameFor = (kind) => (kind && MICROGAME_NAMES[kind]) || 'SYMPTOM'

function opacityFor(distanceAhead, config) {
  if (distanceAhead > config.APPROACHING_DISTANCE) return 0.22
  const span = config.APPROACHING_DISTANCE - config.INTERACTION_DISTANCE
  const t = (config.APPROACHING_DISTANCE - distanceAhead) / span
  return Math.max(0.3, Math.min(1, 0.3 + t * 0.7))
}

function EnemyCard({ meta }) {
  return (
    <div className="enemy-card" style={{ '--enemy-accent': meta.color }}>
      <div className="enemy-card-header">{meta.name}</div>
      <div className="enemy-card-body">
        <i />
        <i />
        <i />
      </div>
    </div>
  )
}

export default function MandalaEnemyLayer({ enemiesRef, deathsRef, config = MANDALA_CONFIG }) {
  const [ids, setIds] = useState([])
  const nodesRef = useRef(new Map())
  const metaRef = useRef(new Map()) // id -> {name,color}, captured once and kept
  const dyingRef = useRef(new Set())
  const sigRef = useRef('')
  const timersRef = useRef([])

  useEffect(() => {
    let raf
    let frame = 0

    const startDeath = (id, node) => {
      if (dyingRef.current.has(id)) return
      dyingRef.current.add(id)
      node.classList.remove('is-active', 'is-arriving')
      node.classList.add('is-dying')
      const timer = window.setTimeout(() => {
        dyingRef.current.delete(id)
        sigRef.current = '__resync__' // force the next sync to drop this id
      }, DEATH_MS)
      timersRef.current.push(timer)
    }

    const loop = () => {
      const map = enemiesRef.current
      const deaths = deathsRef.current
      const nodes = nodesRef.current

      // Kick off death animations for foes the sword just cut.
      if (deaths.size) {
        deaths.forEach((id) => {
          const node = nodes.get(id)
          if (node) startDeath(id, node)
        })
        deaths.clear()
      }

      // Position every live (non-dying) enemy from the projection.
      nodes.forEach((node, id) => {
        if (dyingRef.current.has(id)) return
        const data = map.get(id)
        if (!data) {
          node.style.opacity = '0'
          return
        }
        const scale = data.pixelRadius / NOMINAL_HALF
        node.style.transform = `translate(${data.x}px, ${data.y}px) translate(-50%, -50%) scale(${scale.toFixed(3)})`
        node.style.opacity = opacityFor(data.distanceAhead, config).toFixed(2)
        node.classList.toggle('is-active', data.state === 'active')
        node.classList.toggle('is-arriving', data.state === 'arriving')
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
          // Capture display meta once per id; prune meta for gone ids.
          for (const id of union) {
            if (!metaRef.current.has(id)) {
              const kind = map.get(id)?.kind
              metaRef.current.set(id, { name: nameFor(kind), color: colorFor(kind) })
            }
          }
          for (const id of metaRef.current.keys()) {
            if (!union.includes(id)) metaRef.current.delete(id)
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
        const meta = metaRef.current.get(id) ?? { name: 'SYMPTOM', color: '#6b5d76' }
        return (
          <div
            key={id}
            className="mandala-enemy"
            ref={(node) => {
              if (node) nodesRef.current.set(id, node)
              else nodesRef.current.delete(id)
            }}
            style={{ opacity: 0 }}
          >
            <span className="enemy-flash" />
            <div className="enemy-shell enemy-shell-top">
              <EnemyCard meta={meta} />
            </div>
            <div className="enemy-shell enemy-shell-bottom">
              <EnemyCard meta={meta} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
