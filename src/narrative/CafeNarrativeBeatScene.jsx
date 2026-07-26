import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { CAFE_BEAT_PHASES, CAFE_BEAT_TIMINGS } from './cafeBeat.js'

const SEATED_POSITION = new THREE.Vector3(4.2, 0, -91.6)
const STANDING_POSITION = new THREE.Vector3(4.2, 0.08, -91.6)
const AISLE_POSITION = new THREE.Vector3(6.05, 0, -90.5)
const EXIT_POSITION = new THREE.Vector3(0.15, 0, -75.4)
const CAMERA_POSITION = new THREE.Vector3(4.2, 1.38, -88.25)
const CAFE_DOOR_LOOK = new THREE.Vector3(0, 1.65, -73.5)
const FACE_OFFSET = new THREE.Vector3(0, 1.62, 0)

function clamp01(value) {
  return Math.max(0, Math.min(1, value))
}

function smoothstep(value) {
  const t = clamp01(value)
  return t * t * (3 - 2 * t)
}

function sampleDeparture(progress, target) {
  const t = clamp01(progress)
  if (t < 0.32) {
    target.lerpVectors(STANDING_POSITION, AISLE_POSITION, smoothstep(t / 0.32))
  } else {
    target.lerpVectors(AISLE_POSITION, EXIT_POSITION, smoothstep((t - 0.32) / 0.68))
  }
  return target
}

function LowPolyMara({ mode }) {
  const leftArmRef = useRef(null)
  const rightArmRef = useRef(null)
  const leftLegRef = useRef(null)
  const rightLegRef = useRef(null)
  const timeRef = useRef(0)

  useFrame((_, delta) => {
    timeRef.current += delta
    const time = timeRef.current
    const walking = mode === 'walk'
    const seated = mode === 'seated'
    const angry = mode === 'angry'
    const stride = walking ? Math.sin(time * 8.2) * 0.62 : 0

    if (leftArmRef.current) {
      leftArmRef.current.rotation.x = seated ? -0.2 : -stride * 0.72
      leftArmRef.current.rotation.z = angry ? 1.02 : 0.08
    }
    if (rightArmRef.current) {
      rightArmRef.current.rotation.x = seated ? -0.15 : stride * 0.72
      rightArmRef.current.rotation.z = angry ? -1.18 : -0.08
    }
    if (leftLegRef.current) leftLegRef.current.rotation.x = seated ? -1.18 : stride
    if (rightLegRef.current) rightLegRef.current.rotation.x = seated ? -1.18 : -stride
  })

  return (
    <group scale={0.98}>
      <mesh position={[0, 1.74, 0]} castShadow>
        <icosahedronGeometry args={[0.25, 1]} />
        <meshStandardMaterial color="#d7a982" roughness={0.9} flatShading />
      </mesh>
      <mesh position={[0, 1.91, -0.03]} castShadow>
        <sphereGeometry args={[0.24, 9, 7, 0, Math.PI * 2, 0, Math.PI * 0.52]} />
        <meshStandardMaterial color="#493e4a" roughness={0.92} />
      </mesh>
      <mesh position={[0, 1.12, 0]} castShadow>
        <cylinderGeometry args={[0.25, 0.34, 1.05, 7]} />
        <meshStandardMaterial color="#a65d63" roughness={0.84} flatShading />
      </mesh>
      <group ref={leftArmRef} position={[-0.34, 1.42, 0]} rotation={[0, 0, 0.08]}>
        <mesh position={[0, -0.38, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.075, 0.095, 0.78, 6]} />
          <meshStandardMaterial color="#d7a982" roughness={0.78} />
        </mesh>
      </group>
      <group ref={rightArmRef} position={[0.34, 1.42, 0]} rotation={[0, 0, -0.08]}>
        <mesh position={[0, -0.38, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.075, 0.095, 0.78, 6]} />
          <meshStandardMaterial color="#d7a982" roughness={0.78} />
        </mesh>
      </group>
      <group ref={leftLegRef} position={[-0.15, 0.62, 0]}>
        <mesh position={[0, -0.38, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.08, 0.105, 0.82, 6]} />
          <meshStandardMaterial color="#493e4a" roughness={0.78} />
        </mesh>
      </group>
      <group ref={rightLegRef} position={[0.15, 0.62, 0]}>
        <mesh position={[0, -0.38, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.08, 0.105, 0.82, 6]} />
          <meshStandardMaterial color="#493e4a" roughness={0.78} />
        </mesh>
      </group>
    </group>
  )
}

export default function CafeNarrativeBeatScene({ elapsed, phase }) {
  const rootRef = useRef(null)
  const phaseRef = useRef(phase)
  const phaseElapsedRef = useRef(0)
  const friendPosition = useMemo(() => new THREE.Vector3(), [])
  const cameraTarget = useMemo(() => new THREE.Vector3(), [])
  const lookTarget = useMemo(() => new THREE.Vector3(), [])
  const smoothedLook = useMemo(() => CAFE_DOOR_LOOK.clone(), [])

  useEffect(() => {
    phaseRef.current = phase
    phaseElapsedRef.current = 0
  }, [phase])

  useFrame(({ camera }, delta) => {
    const currentPhase = phaseRef.current
    if (currentPhase !== CAFE_BEAT_PHASES.INACTIVE) phaseElapsedRef.current += delta

    if (rootRef.current) {
      if (currentPhase === CAFE_BEAT_PHASES.RUPTURE) {
        const standProgress = smoothstep(phaseElapsedRef.current / 0.58)
        rootRef.current.position.lerpVectors(SEATED_POSITION, STANDING_POSITION, standProgress)
        rootRef.current.rotation.y = 0
        rootRef.current.visible = true
      } else if (currentPhase === CAFE_BEAT_PHASES.DEPARTURE) {
        const progress = phaseElapsedRef.current / (CAFE_BEAT_TIMINGS.departureMs / 1000)
        sampleDeparture(progress, friendPosition)
        rootRef.current.position.copy(friendPosition)
        rootRef.current.rotation.y = progress < 0.32 ? -Math.PI / 2 : Math.PI
        rootRef.current.visible = progress < 0.98
      } else if (currentPhase === CAFE_BEAT_PHASES.AFTERMATH
        || currentPhase === CAFE_BEAT_PHASES.CELEBRATION) {
        rootRef.current.visible = false
      } else {
        rootRef.current.position.copy(SEATED_POSITION)
        rootRef.current.rotation.y = 0
        rootRef.current.visible = elapsed >= 42
      }
    }

    if (currentPhase === CAFE_BEAT_PHASES.INACTIVE) return

    cameraTarget.copy(CAMERA_POSITION)
    if (currentPhase === CAFE_BEAT_PHASES.DEPARTURE) {
      sampleDeparture(phaseElapsedRef.current / (CAFE_BEAT_TIMINGS.departureMs / 1000), friendPosition)
      lookTarget.copy(friendPosition).add(FACE_OFFSET)
    } else if (currentPhase === CAFE_BEAT_PHASES.AFTERMATH
      || currentPhase === CAFE_BEAT_PHASES.CELEBRATION) {
      lookTarget.copy(CAFE_DOOR_LOOK)
    } else {
      lookTarget.copy(rootRef.current?.position ?? SEATED_POSITION).add(FACE_OFFSET)
    }

    const snap = currentPhase === CAFE_BEAT_PHASES.RUPTURE
    camera.position.lerp(cameraTarget, 1 - Math.exp(-delta * (snap ? 13 : 7)))
    smoothedLook.lerp(lookTarget, 1 - Math.exp(-delta * (snap ? 18 : 8)))
    camera.lookAt(smoothedLook)

    const lookingAtDoor = currentPhase === CAFE_BEAT_PHASES.AFTERMATH
      || currentPhase === CAFE_BEAT_PHASES.CELEBRATION
    const targetFov = lookingAtDoor ? 61 : 57
    const nextFov = THREE.MathUtils.lerp(camera.fov, targetFov, 1 - Math.exp(-delta * 6))
    if (Math.abs(nextFov - camera.fov) > 0.01) {
      camera.fov = nextFov
      camera.updateProjectionMatrix()
    }
  })

  const mode = phase === CAFE_BEAT_PHASES.RUPTURE
    ? 'angry'
    : phase === CAFE_BEAT_PHASES.DEPARTURE
      ? 'walk'
      : 'seated'

  return (
    <group ref={rootRef} position={SEATED_POSITION.toArray()} rotation={[0, 0, 0]}>
      <LowPolyMara mode={mode} />
    </group>
  )
}
