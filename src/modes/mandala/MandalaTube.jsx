import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

import { MANDALA_CONFIG, mandalaAxisAt } from './mandalaConfig.js'

const DEG = Math.PI / 180

// A tunnel of rings marching toward the camera. Each ring's centre rides the
// same undulating axis the encounters use, and rings recycle from back to front
// so travel reads as continuous forward motion of unbounded depth.
export default function MandalaTube({ runRef, config = MANDALA_CONFIG }) {
  const ringsRef = useRef([])

  const ringColors = useMemo(
    () =>
      Array.from({ length: config.RING_COUNT }, (_, index) => {
        const t = index / config.RING_COUNT
        return new THREE.Color().setHSL(0.62 - t * 0.12, 0.45, 0.28 + t * 0.12)
      }),
    [config.RING_COUNT],
  )

  useFrame(() => {
    const run = runRef.current
    if (!run) return
    const travel = run.travelDistance
    const anchor = Math.floor(travel / config.RING_SPACING) * config.RING_SPACING

    for (let i = 0; i < config.RING_COUNT; i += 1) {
      const ring = ringsRef.current[i]
      if (!ring) continue
      const depth = anchor + i * config.RING_SPACING
      const axis = mandalaAxisAt(depth, config)
      ring.position.set(axis.x, axis.y, travel - depth)
      ring.rotation.z = depth * config.TWIST_PER_UNIT * DEG
    }
  })

  return (
    <group>
      {Array.from({ length: config.RING_COUNT }, (_, index) => (
        <mesh
          key={index}
          ref={(node) => {
            ringsRef.current[index] = node
          }}
        >
          <torusGeometry args={[config.TUBE_RADIUS, 0.13, 6, 20]} />
          <meshStandardMaterial
            color={ringColors[index]}
            emissive={ringColors[index]}
            emissiveIntensity={0.35}
            flatShading
          />
        </mesh>
      ))}
    </group>
  )
}
