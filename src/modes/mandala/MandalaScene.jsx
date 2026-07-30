import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

import { MANDALA_CONFIG, mandalaAxisAt } from './mandalaConfig.js'
import { movementForEncounter } from './mandalaEnemyMovement.js'
import { ENCOUNTER_STATES } from './mandalaState.js'
import MandalaTube from './MandalaTube.jsx'

const tmp = new THREE.Vector3()
const tmpEdge = new THREE.Vector3()

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

// The single per-frame driver: advances the sim, flies the camera down the
// tube, and resolves every encounter's screen position. Encounters always stay
// on their tube path, with a small kind-specific local motion layered on top.
// Reaching the former sword plane only enables their screen-space hitbox; it
// never docks or redirects the panel.
function MandalaStepper({ runRef, step, inputsRef, onOverload, enemiesRef, registryRef, twistScale = 1, config }) {
  const camera = useThree((state) => state.camera)
  const size = useThree((state) => state.size)

  useFrame((frameState, rawDelta) => {
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
    camera.rotation.z += Math.sin(run.travelDistance * config.UNDULATION_FREQ * 1.3) * 0.12 * twistScale

    const enemies = enemiesRef.current
    const registry = registryRef.current
    const seen = new Set()
    const elapsedSeconds = frameState.clock.elapsedTime

    for (const encounter of run.encounters) {
      // Finished encounters are removed from interaction immediately; the DOM
      // enemy layer owns the sword death animation for resolved targets.
      if (encounter.state === ENCOUNTER_STATES.RESOLVED || encounter.state === ENCOUNTER_STATES.PASSED) {
        continue
      }

      const baseDistanceAhead = encounter.routeZ - run.travelDistance
      const motion = movementForEncounter(encounter, elapsedSeconds)
      // Positive motion.z is a temporary surge toward the player.
      const distanceAhead = baseDistanceAhead - motion.z

      if (distanceAhead < config.SLASH_REAR_LIMIT - 2 || distanceAhead > config.APPROACHING_DISTANCE + 10) {
        continue
      }

      const axis = mandalaAxisAt(encounter.routeZ, config)
      const worldX = axis.x + (encounter.offset.x + motion.x) * config.TUBE_RADIUS
      const worldY = axis.y + (encounter.offset.y + motion.y) * config.TUBE_RADIUS
      const worldZ = -distanceAhead
      tmp.set(worldX, worldY, worldZ).project(camera)

      // Once the panel has fully crossed behind the camera it naturally leaves
      // the screen. The simulation marks it passed using its base route timing,
      // so a temporary forward surge cannot create or avoid overload by itself.
      if (tmp.z > 1) continue

      const screenX = (tmp.x * 0.5 + 0.5) * size.width
      const screenY = (-tmp.y * 0.5 + 0.5) * size.height
      tmpEdge.set(worldX + config.ENEMY_WORLD_RADIUS, worldY, worldZ).project(camera)
      const rawRadius = Math.abs((tmpEdge.x * 0.5 + 0.5) * size.width - screenX)
      const pixelRadius = clamp(rawRadius, 14, Math.max(size.width, size.height) * 1.5)

      enemies.set(encounter.id, {
        id: encounter.id,
        kind: encounter.sourceMicrogameKind,
        x: screenX,
        y: screenY,
        pixelRadius,
        parked: false,
        state: encounter.state,
        distanceAhead,
        rotation: motion.rotation,
      })

      // Cutting begins from the encounter's authoritative lifecycle threshold.
      // The hitbox follows the visible profile movement exactly.
      if (encounter.state === ENCOUNTER_STATES.ACTIVE && baseDistanceAhead > config.SLASH_REAR_LIMIT) {
        registry.set(encounter.id, {
          x: screenX,
          y: screenY,
          radius: Math.max(24, pixelRadius * 0.88),
          active: true,
        })
      } else {
        registry.delete(encounter.id)
      }
      seen.add(encounter.id)
    }

    // Drop enemies and hitboxes for encounters that are gone or out of view.
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
  background = {},
  twistScale = 1,
  config = MANDALA_CONFIG,
}) {
  const enemiesFallback = useRef(new Map())
  const enemies = enemiesRef ?? enemiesFallback

  // Background + fog come from the director's current section/wave effects.
  const color = background.color ?? '#0d0a14'
  const fogNear = background.fogNear ?? 12
  const fogFar = background.fogFar ?? 62

  // color/fog must attach at the scene root, so they are top-level here (not
  // wrapped in a group) — MandalaScene is a direct child of the Canvas.
  return (
    <>
      <color attach="background" args={[color]} />
      <fog attach="fog" args={[color, fogNear, fogFar]} />
      <ambientLight intensity={0.9} />
      <pointLight position={[0, 0, 2]} intensity={2.4} distance={40} color="#ffd9a0" />
      <MandalaStepper
        runRef={runRef}
        step={step}
        inputsRef={inputsRef}
        onOverload={onOverload}
        enemiesRef={enemies}
        registryRef={registryRef}
        twistScale={twistScale}
        config={config}
      />
      <MandalaTube runRef={runRef} twistScale={twistScale} config={config} />
    </>
  )
}
