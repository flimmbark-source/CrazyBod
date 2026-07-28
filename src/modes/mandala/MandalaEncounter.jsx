import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

import { MANDALA_CONFIG, mandalaAxisAt } from './mandalaConfig.js'
import { ENCOUNTER_STATES } from './mandalaState.js'

const ENCOUNTER_WORLD_RADIUS = 0.72
const MIN_SCREEN_RADIUS = 30
const tmp = new THREE.Vector3()
const tmpEdge = new THREE.Vector3()

// One Mandala foe. It reads its own live state from the shared run ref each
// frame — it is the *same* object all the way from distant depth to the
// interaction plane, growing through perspective, then registering a screen-
// space hitbox once it is active so the Sword can cut it. Distant/approaching
// foes render but never register a hitbox and never count as load.
export default function MandalaEncounter({ id, runRef, registryRef, config = MANDALA_CONFIG }) {
  const groupRef = useRef()
  const spinRef = useRef(Math.random() * Math.PI)
  const camera = useThree((state) => state.camera)
  const size = useThree((state) => state.size)

  useFrame((_, delta) => {
    const group = groupRef.current
    const run = runRef.current
    if (!group || !run) return

    const encounter = run.encounters.find((e) => e.id === id)
    if (!encounter || encounter.state === ENCOUNTER_STATES.RESOLVED || encounter.state === ENCOUNTER_STATES.PASSED) {
      group.visible = false
      registryRef.current?.delete(id)
      return
    }

    const distanceAhead = encounter.routeZ - run.travelDistance
    // Cull once well behind the camera or absurdly far ahead.
    if (distanceAhead < config.SLASH_REAR_LIMIT - 2 || distanceAhead > config.APPROACHING_DISTANCE + 10) {
      group.visible = false
      registryRef.current?.delete(id)
      return
    }
    group.visible = true

    const axis = mandalaAxisAt(encounter.routeZ, config)
    const worldX = axis.x + encounter.offset.x * config.TUBE_RADIUS
    const worldY = axis.y + encounter.offset.y * config.TUBE_RADIUS
    const worldZ = -distanceAhead
    group.position.set(worldX, worldY, worldZ)

    const active = encounter.state === ENCOUNTER_STATES.ACTIVE
    const arriving = encounter.state === ENCOUNTER_STATES.ARRIVING

    // Face the camera, then add a settling spin (fast when far, calm once it
    // reaches the plane and is ready to be read and cut).
    group.lookAt(camera.position)
    spinRef.current += (active ? 0.4 : 2.2) * delta
    group.rotateZ(spinRef.current)
    group.scale.setScalar(active ? 1.2 : arriving ? 1.0 : 0.85)

    // Register a screen-space hitbox only while interactable and in front.
    if ((active || arriving) && distanceAhead > config.SLASH_REAR_LIMIT) {
      tmp.set(worldX, worldY, worldZ).project(camera)
      const screenX = (tmp.x * 0.5 + 0.5) * size.width
      const screenY = (-tmp.y * 0.5 + 0.5) * size.height
      tmpEdge.set(worldX + ENCOUNTER_WORLD_RADIUS, worldY, worldZ).project(camera)
      const edgeX = (tmpEdge.x * 0.5 + 0.5) * size.width
      const screenRadius = Math.max(MIN_SCREEN_RADIUS, Math.abs(edgeX - screenX))
      registryRef.current?.set(id, {
        x: screenX,
        y: screenY,
        radius: screenRadius * 1.35,
        active,
      })
    } else {
      registryRef.current?.delete(id)
    }
  })

  return (
    <group ref={groupRef}>
      <mesh>
        <octahedronGeometry args={[ENCOUNTER_WORLD_RADIUS, 0]} />
        <meshStandardMaterial color="#d8607a" emissive="#7a1f36" emissiveIntensity={0.6} flatShading />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[ENCOUNTER_WORLD_RADIUS * 1.5, 0.06, 6, 18]} />
        <meshStandardMaterial color="#f0b429" emissive="#f0b429" emissiveIntensity={0.5} flatShading />
      </mesh>
    </group>
  )
}
