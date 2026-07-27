import { Canvas, useFrame } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { DAY_ELAPSED_EVENT } from '../config/gameConfig.js'
import { getTrustyCaneState } from '../progression/trustyCane.js'

function CaneModel({ pickupProgress = 0 }) {
  const groupRef = useRef(null)

  useFrame(() => {
    if (!groupRef.current) return
    const eased = THREE.MathUtils.smoothstep(pickupProgress, 0, 1)
    groupRef.current.position.set(
      THREE.MathUtils.lerp(1.15, 0.28, eased),
      THREE.MathUtils.lerp(-0.72, -0.3, eased),
      THREE.MathUtils.lerp(-3.4, -1.35, eased),
    )
    groupRef.current.rotation.set(
      THREE.MathUtils.lerp(0.03, -0.28, eased),
      THREE.MathUtils.lerp(-0.18, 0.42, eased),
      THREE.MathUtils.lerp(-0.13, -0.48, eased),
    )
    const scale = THREE.MathUtils.lerp(0.68, 1.18, eased)
    groupRef.current.scale.setScalar(scale)
  })

  return (
    <group ref={groupRef}>
      <mesh position={[0, 0.02, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.055, 0.07, 2.2, 7]} />
        <meshStandardMaterial color="#79523d" roughness={0.82} flatShading />
      </mesh>
      <mesh position={[0, -1.12, 0]} castShadow>
        <cylinderGeometry args={[0.075, 0.075, 0.18, 7]} />
        <meshStandardMaterial color="#34343d" roughness={0.9} flatShading />
      </mesh>
      <mesh position={[0.24, 1.04, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[0.25, 0.06, 6, 10, Math.PI * 1.15]} />
        <meshStandardMaterial color="#936846" roughness={0.78} flatShading />
      </mesh>
      <mesh position={[0.02, 0.97, 0]} rotation={[0, 0, -0.38]} castShadow>
        <cylinderGeometry args={[0.055, 0.06, 0.42, 7]} />
        <meshStandardMaterial color="#81583f" roughness={0.8} flatShading />
      </mesh>
    </group>
  )
}

function CaneScene({ state, pickupProgress }) {
  if (state !== 'resting' && state !== 'picking') return null

  return (
    <>
      <ambientLight intensity={1.7} />
      <directionalLight position={[3, 5, 4]} intensity={2.1} castShadow />
      <CaneModel pickupProgress={state === 'picking' ? pickupProgress : 0} />
    </>
  )
}

export default function TrustyCane3DOverlay() {
  const [elapsed, setElapsed] = useState(0)
  const state = getTrustyCaneState(elapsed)
  const pickupProgress = THREE.MathUtils.clamp((elapsed - 13.6) / 1.4, 0, 1)

  useEffect(() => {
    const update = (event) => setElapsed(Number(event.detail) || 0)
    window.addEventListener(DAY_ELAPSED_EVENT, update)
    return () => window.removeEventListener(DAY_ELAPSED_EVENT, update)
  }, [])

  if (state !== 'resting' && state !== 'picking') return null

  return (
    <div className={`trusty-cane-3d-overlay is-${state}`} aria-hidden="true">
      <Canvas
        shadows
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, 0], fov: 54, near: 0.1, far: 20 }}
        gl={{ alpha: true, antialias: true }}
      >
        <CaneScene state={state} pickupProgress={pickupProgress} />
      </Canvas>
    </div>
  )
}
