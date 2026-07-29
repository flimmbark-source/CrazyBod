import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

import { MANDALA_CONFIG, mandalaAxisAt } from './mandalaConfig.js'
import { ENCOUNTER_STATES } from './mandalaState.js'
import MandalaTube from './MandalaTube.jsx'

const tmp = new THREE.Vector3()
const tmpEdge = new THREE.Vector3()

// The single per-frame driver: advances the sim, flies the camera down the
// tube, and projects every encounter to screen space. The projection feeds two
// consumers — `enemiesRef` (the DOM minigame-enemy layer) and `registryRef`
// (the Sword's slash hitboxes) — so both share one source of truth about where
// each foe is on screen and how big it is.
function MandalaStepper({ runRef, step, inputsRef, onOverload, enemiesRef, registryRef, config }) {
  const camera = useThree((state) => state.camera)
  const size = useThree((state) => state.size)

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05)
    const inputs = inputsRef.current
    const run = step(delta, {
      diving: inputs.diveEnabled && inputs.forwardHeld,
      capacity: inputs.capacity,
      onOverload,
    })
    if (!run) return

    // Fly the camera along the tube axis, looking down the curve ahead.
    const here = mandalaAxisAt(run.travelDistance, config)
    const ahead = mandalaAxisAt(run.travelDistance + 14, config)
    camera.position.set(here.x * 0.35, here.y * 0.35, 0)
    camera.up.set(0, 1, 0)
    camera.lookAt(ahead.x, ahead.y, -14)
    camera.rotation.z += Math.sin(run.travelDistance * config.UNDULATION_FREQ * 1.3) * 0.12

    // Project every encounter into screen space.
    const enemies = enemiesRef.current
    const registry = registryRef.current
    const seen = new Set()

    for (const encounter of run.encounters) {
      // Resolved/passed foes are dead — the enemy layer owns their death
      // animation, so drop them from the projection immediately.
      if (encounter.state === ENCOUNTER_STATES.RESOLVED || encounter.state === ENCOUNTER_STATES.PASSED) {
        continue
      }
      const distanceAhead = encounter.routeZ - run.travelDistance
      if (distanceAhead < config.SLASH_REAR_LIMIT - 2 || distanceAhead > config.APPROACHING_DISTANCE + 10) {
        continue
      }

      const axis = mandalaAxisAt(encounter.routeZ, config)
      const worldX = axis.x + encounter.offset.x * config.TUBE_RADIUS
      const worldY = axis.y + encounter.offset.y * config.TUBE_RADIUS
      const worldZ = -distanceAhead

      tmp.set(worldX, worldY, worldZ).project(camera)
      // Behind the camera projects with w<0; skip those frames.
      if (tmp.z > 1) continue
      const screenX = (tmp.x * 0.5 + 0.5) * size.width
      const screenY = (-tmp.y * 0.5 + 0.5) * size.height
      tmpEdge.set(worldX + config.ENEMY_WORLD_RADIUS, worldY, worldZ).project(camera)
      const pixelRadius = Math.max(14, Math.abs((tmpEdge.x * 0.5 + 0.5) * size.width - screenX))

      const active = encounter.state === ENCOUNTER_STATES.ACTIVE
      const arriving = encounter.state === ENCOUNTER_STATES.ARRIVING

      enemies.set(encounter.id, {
        id: encounter.id,
        kind: encounter.sourceMicrogameKind,
        x: screenX,
        y: screenY,
        pixelRadius,
        state: encounter.state,
        distanceAhead,
      })
      seen.add(encounter.id)

      // Only active/arriving foes near the plane are slashable.
      if ((active || arriving) && distanceAhead > config.SLASH_REAR_LIMIT) {
        registry.set(encounter.id, { x: screenX, y: screenY, radius: pixelRadius * 1.15, active })
      } else {
        registry.delete(encounter.id)
      }
    }

    // Drop enemies/hitboxes for encounters that are gone (culled or pruned).
    for (const id of enemies.keys()) {
      if (!seen.has(id)) {
        enemies.delete(id)
        registry.delete(id)
      }
    }
  })

  return null
}

export default function MandalaScene({
  runRef,
  step,
  registryRef,
  enemiesRef,
  inputsRef,
  onOverload,
  config = MANDALA_CONFIG,
}) {
  const enemiesFallback = useRef(new Map())
  const enemies = enemiesRef ?? enemiesFallback

  // color/fog must attach at the scene root, so they are top-level here (not
  // wrapped in a group) — MandalaScene is a direct child of the Canvas.
  return (
    <>
      <color attach="background" args={['#0d0a14']} />
      <fog attach="fog" args={['#0d0a14', 12, 62]} />
      <ambientLight intensity={0.9} />
      <pointLight position={[0, 0, 2]} intensity={2.4} distance={40} color="#ffd9a0" />
      <MandalaStepper
        runRef={runRef}
        step={step}
        inputsRef={inputsRef}
        onOverload={onOverload}
        enemiesRef={enemies}
        registryRef={registryRef}
        config={config}
      />
      <MandalaTube runRef={runRef} config={config} />
    </>
  )
}
