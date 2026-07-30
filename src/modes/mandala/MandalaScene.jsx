import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

import { MANDALA_CONFIG, mandalaAxisAt } from './mandalaConfig.js'
import { ENCOUNTER_STATES } from './mandalaState.js'
import MandalaTube from './MandalaTube.jsx'

const tmp = new THREE.Vector3()
const tmpEdge = new THREE.Vector3()

// Parked (on-plane) panels render at full UI size; this is half the enemy
// panel's nominal width, matching MandalaEnemyLayer.
const PARK_NOMINAL_HALF = 118
// Slash hitbox radius for a parked panel (screen px).
const PARK_RADIUS = 104

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

// Where a foe lands when it reaches the plane: its own projected screen position
// at the interaction plane, so it docks exactly where it arrives (no relocation)
// — only nudged to stay fully on-screen and clear of the HUD.
function landingSlot(encounter, camera, size, config) {
  const axis = mandalaAxisAt(encounter.routeZ, config)
  const worldX = axis.x + encounter.offset.x * config.TUBE_RADIUS
  const worldY = axis.y + encounter.offset.y * config.TUBE_RADIUS
  tmp.set(worldX, worldY, -config.INTERACTION_DISTANCE).project(camera)
  const x = (tmp.x * 0.5 + 0.5) * size.width
  const y = (-tmp.y * 0.5 + 0.5) * size.height
  return {
    x: clamp(x, 122, size.width - 122),
    y: clamp(y, 126, size.height - 114),
  }
}

// The single per-frame driver: advances the sim, flies the camera down the
// tube, and resolves every encounter's screen position. Foes flying down the
// tube are projected from 3D (and are NOT cuttable). Once a foe reaches the
// plane it parks at a fixed screen slot at full UI size and becomes cuttable —
// the sword only cuts panels on its plane. The result feeds `enemiesRef` (the
// DOM panel layer) and `registryRef` (the sword's hitboxes).
function MandalaStepper({ runRef, step, inputsRef, onOverload, enemiesRef, registryRef, twistScale = 1, config }) {
  const camera = useThree((state) => state.camera)
  const size = useThree((state) => state.size)
  const parkRef = useRef(new Map())

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
    camera.rotation.z += Math.sin(run.travelDistance * config.UNDULATION_FREQ * 1.3) * 0.12 * twistScale

    const enemies = enemiesRef.current
    const registry = registryRef.current
    const parked = parkRef.current
    const seen = new Set()

    for (const encounter of run.encounters) {
      // Resolved/passed foes are dead — the enemy layer owns their death
      // animation, so drop them from the projection immediately.
      if (encounter.state === ENCOUNTER_STATES.RESOLVED || encounter.state === ENCOUNTER_STATES.PASSED) {
        continue
      }

      const distanceAhead = encounter.routeZ - run.travelDistance

      // Arrived at the plane: park it. It stops here at full UI size and stays
      // (as load) until cut — regardless of how far travel has since moved on.
      if (encounter.state === ENCOUNTER_STATES.ACTIVE) {
        let slot = parked.get(encounter.id)
        if (!slot) {
          slot = landingSlot(encounter, camera, size, config)
          parked.set(encounter.id, slot)
        }
        enemies.set(encounter.id, {
          id: encounter.id,
          kind: encounter.sourceMicrogameKind,
          x: slot.x,
          y: slot.y,
          pixelRadius: PARK_NOMINAL_HALF,
          parked: true,
          state: encounter.state,
          distanceAhead,
        })
        registry.set(encounter.id, { x: slot.x, y: slot.y, radius: PARK_RADIUS, active: true })
        seen.add(encounter.id)
        continue
      }

      // Still flying down the tube: project from 3D. Not cuttable yet.
      if (distanceAhead < config.SLASH_REAR_LIMIT - 2 || distanceAhead > config.APPROACHING_DISTANCE + 10) {
        continue
      }
      const axis = mandalaAxisAt(encounter.routeZ, config)
      const worldX = axis.x + encounter.offset.x * config.TUBE_RADIUS
      const worldY = axis.y + encounter.offset.y * config.TUBE_RADIUS
      const worldZ = -distanceAhead
      tmp.set(worldX, worldY, worldZ).project(camera)
      if (tmp.z > 1) continue // behind the camera
      const screenX = (tmp.x * 0.5 + 0.5) * size.width
      const screenY = (-tmp.y * 0.5 + 0.5) * size.height
      tmpEdge.set(worldX + config.ENEMY_WORLD_RADIUS, worldY, worldZ).project(camera)
      const pixelRadius = Math.max(14, Math.abs((tmpEdge.x * 0.5 + 0.5) * size.width - screenX))

      enemies.set(encounter.id, {
        id: encounter.id,
        kind: encounter.sourceMicrogameKind,
        x: screenX,
        y: screenY,
        pixelRadius,
        parked: false,
        state: encounter.state,
        distanceAhead,
      })
      registry.delete(encounter.id) // flying foes are not on the plane
      seen.add(encounter.id)
    }

    // Drop enemies/hitboxes/slots for encounters that are gone.
    for (const id of enemies.keys()) {
      if (!seen.has(id)) {
        enemies.delete(id)
        registry.delete(id)
      }
    }
    for (const id of parked.keys()) {
      if (!seen.has(id)) parked.delete(id)
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
