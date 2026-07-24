import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'

const PLAYER_PATH = [
  // Waking up: already standing beside the bed, then walk straight to the bathroom turn.
  { at: 0, position: [-1.8, 1.65, 3.1], look: [-1.8, 1.45, -3.5], walk: 0, fov: 68 },
  { at: 1, position: [-1.8, 1.65, 3.1], look: [-1.8, 1.45, -3.5], walk: 0, fov: 68 },
  { at: 4.5, position: [-1.8, 1.65, -1.0], look: [-1.8, 1.45, -5.2], walk: 0.82, fov: 68 },
  { at: 5.2, position: [-1.8, 1.65, -1.0], look: [-1.8, 1.45, -5.2], walk: 0, fov: 68 },
  { at: 7.4, position: [-1.8, 1.65, -1.0], look: [2.65, 1.4, -1.7], walk: 0, fov: 67 },

  // Getting ready: turn away from the bathroom, walk to the door, and wait for it to open.
  { at: 8, position: [-1.8, 1.65, -1.0], look: [0, 1.45, -10], walk: 0, fov: 67 },
  { at: 12.4, position: [0, 1.65, -10.8], look: [-0.95, 1.45, -14.7], walk: 0.88, fov: 67 },
  { at: 13.6, position: [-0.75, 1.65, -13.0], look: [-0.95, 1.45, -17.5], walk: 0.45, fov: 67 },
  { at: 15.1, position: [-0.75, 1.65, -13.0], look: [-0.95, 1.45, -18.5], walk: 0, fov: 67 },
  { at: 16, position: [-0.95, 1.65, -15.5], look: [0, 1.48, -23], walk: 0.78, fov: 67 },

  // Walking to the café and the existing café sequence.
  { at: 20, position: [-0.4, 1.65, -37], look: [0, 1.42, -45], walk: 1, fov: 68 },
  { at: 25, position: [0, 1.65, -68], look: [0, 1.55, -75], walk: 1, fov: 68 },
  { at: 28, position: [0, 1.65, -77], look: [0, 1.5, -87], walk: 0.65, fov: 67 },
  { at: 32, position: [-0.8, 1.65, -87], look: [-1, 1.48, -92], walk: 0.25, fov: 66 },
  { at: 37, position: [-0.8, 1.65, -87.2], look: [-1, 1.45, -92], walk: 0, fov: 65 },
  { at: 40, position: [1.8, 1.65, -87], look: [4.2, 1.2, -89.5], walk: 0.45, fov: 66 },
  { at: 43, position: [4.2, 1.65, -87.8], look: [4.2, 1.1, -90], walk: 0.35, fov: 65 },
  { at: 46, position: [4.2, 1.15, -89.2], look: [0.5, 1.3, -90], walk: 0, fov: 63 },
  { at: 50, position: [4.2, 1.15, -89.2], look: [0.5, 1.25, -90], walk: 0, fov: 63 },
]

const BEDROOM_COLOR = new THREE.Color('#b8a7bb')
const STREET_COLOR = new THREE.Color('#9eb4c0')
const CAFE_COLOR = new THREE.Color('#9f7e72')
const MARA_LOOK = new THREE.Vector3(-1, 1.45, -92)

function clamp01(value) {
  return Math.max(0, Math.min(1, value))
}

function smoothstep(value) {
  const t = clamp01(value)
  return t * t * (3 - 2 * t)
}

function samplePlayerPath(elapsed) {
  const upperIndex = PLAYER_PATH.findIndex((keyframe) => elapsed <= keyframe.at)
  if (upperIndex <= 0) return PLAYER_PATH[0]
  if (upperIndex < 0) return PLAYER_PATH[PLAYER_PATH.length - 1]

  const previous = PLAYER_PATH[upperIndex - 1]
  const next = PLAYER_PATH[upperIndex]
  const span = Math.max(0.001, next.at - previous.at)
  const mix = smoothstep((elapsed - previous.at) / span)

  return {
    position: previous.position.map((value, index) => THREE.MathUtils.lerp(value, next.position[index], mix)),
    look: previous.look.map((value, index) => THREE.MathUtils.lerp(value, next.look[index], mix)),
    walk: THREE.MathUtils.lerp(previous.walk, next.walk, mix),
    fov: THREE.MathUtils.lerp(previous.fov, next.fov, mix),
  }
}

function Box({ position, size, color, rotation = [0, 0, 0], castShadow = true, receiveShadow = true, opacity = 1 }) {
  return (
    <mesh position={position} rotation={rotation} castShadow={castShadow} receiveShadow={receiveShadow}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.82} transparent={opacity < 1} opacity={opacity} />
    </mesh>
  )
}

function Cylinder({ position, args, color, rotation = [0, 0, 0], castShadow = true }) {
  return (
    <mesh position={position} rotation={rotation} castShadow={castShadow} receiveShadow>
      <cylinderGeometry args={args} />
      <meshStandardMaterial color={color} roughness={0.78} />
    </mesh>
  )
}

function Label({ text, position, size = [4, 1.2], rotation = [0, 0, 0], foreground = '#fff4d8', background = '#6f514c' }) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 160
    const context = canvas.getContext('2d')
    context.fillStyle = background
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.strokeStyle = '#302b38'
    context.lineWidth = 18
    context.strokeRect(9, 9, canvas.width - 18, canvas.height - 18)
    context.fillStyle = foreground
    context.font = '900 78px system-ui, sans-serif'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText(text, canvas.width / 2, canvas.height / 2 + 2)
    const next = new THREE.CanvasTexture(canvas)
    next.colorSpace = THREE.SRGBColorSpace
    return next
  }, [background, foreground, text])

  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={size} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  )
}

function Door({ position, color, progress, openAngle = -Math.PI * 0.48, width = 1.9, height = 3.4 }) {
  return (
    <group position={position} rotation={[0, openAngle * smoothstep(progress), 0]}>
      <Box position={[width / 2, height / 2, 0]} size={[width, height, 0.16]} color={color} />
      <mesh position={[width - 0.22, height * 0.52, 0.12]} castShadow>
        <sphereGeometry args={[0.08, 8, 6]} />
        <meshStandardMaterial color="#d4b15e" metalness={0.45} roughness={0.35} />
      </mesh>
    </group>
  )
}

function Chair({ position, rotation = [0, 0, 0], color = '#6b4f45' }) {
  return (
    <group position={position} rotation={rotation}>
      <Box position={[0, 0.72, 0]} size={[1.05, 0.14, 1.05]} color={color} />
      <Box position={[0, 1.35, 0.45]} size={[1.05, 1.2, 0.14]} color={color} />
      {[-0.42, 0.42].flatMap((x) => [-0.42, 0.42].map((z) => (
        <Box key={`${x}-${z}`} position={[x, 0.34, z]} size={[0.12, 0.72, 0.12]} color="#493b3b" />
      )))}
    </group>
  )
}

function Table({ position, size = [2.5, 0.16, 1.7], color = '#b48261' }) {
  return (
    <group position={position}>
      <Box position={[0, 0.92, 0]} size={size} color={color} />
      {[-0.9, 0.9].flatMap((x) => [-0.55, 0.55].map((z) => (
        <Box key={`${x}-${z}`} position={[x, 0.45, z]} size={[0.13, 0.9, 0.13]} color="#554448" />
      )))}
    </group>
  )
}

function Lamp({ position, color = '#f1cf7a' }) {
  return (
    <group position={position}>
      <Cylinder position={[0, 1.35, 0]} args={[0.06, 0.08, 2.7, 8]} color="#454653" />
      <mesh position={[0, 2.78, 0]} castShadow>
        <octahedronGeometry args={[0.28, 0]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.65} />
      </mesh>
      <pointLight position={[0, 2.7, 0]} color={color} intensity={1.2} distance={8} decay={2} />
    </group>
  )
}

function Tree({ position, scale = 1 }) {
  return (
    <group position={position} scale={scale}>
      <Cylinder position={[0, 1.1, 0]} args={[0.17, 0.22, 2.2, 7]} color="#705247" />
      <mesh position={[0, 2.7, 0]} castShadow>
        <icosahedronGeometry args={[1.15, 1]} />
        <meshStandardMaterial color="#718465" roughness={0.95} flatShading />
      </mesh>
    </group>
  )
}

function AnimatedPerson({
  position,
  rotation = [0, 0, 0],
  color = '#d97862',
  accent = '#424253',
  skin = '#d7a982',
  mode = 'idle',
  active,
  phase = 0,
  scale = 1,
}) {
  const rootRef = useRef(null)
  const leftArmRef = useRef(null)
  const rightArmRef = useRef(null)
  const leftLegRef = useRef(null)
  const rightLegRef = useRef(null)
  const timeRef = useRef(phase)

  useFrame((_, delta) => {
    if (active) timeRef.current += delta
    const time = timeRef.current
    const walking = mode === 'walk'
    const waving = mode === 'wave'
    const seated = mode === 'seated'
    const stride = walking ? Math.sin(time * 7.5) * 0.62 : 0
    const idle = Math.sin(time * 2.1 + phase) * 0.025

    if (rootRef.current) rootRef.current.position.y = position[1] + (walking ? Math.abs(Math.sin(time * 7.5)) * 0.045 : idle)
    if (leftArmRef.current) leftArmRef.current.rotation.x = seated ? -0.2 : -stride * 0.72
    if (rightArmRef.current) {
      rightArmRef.current.rotation.x = seated ? -0.15 : stride * 0.72
      rightArmRef.current.rotation.z = waving ? -1.45 + Math.sin(time * 8) * 0.22 : -0.08
    }
    if (leftLegRef.current) leftLegRef.current.rotation.x = seated ? -1.18 : stride
    if (rightLegRef.current) rightLegRef.current.rotation.x = seated ? -1.18 : -stride
  })

  return (
    <group ref={rootRef} position={position} rotation={rotation} scale={scale}>
      <mesh position={[0, 1.74, 0]} castShadow>
        <icosahedronGeometry args={[0.25, 1]} />
        <meshStandardMaterial color={skin} roughness={0.9} flatShading />
      </mesh>
      <mesh position={[0, 1.91, -0.03]} castShadow>
        <sphereGeometry args={[0.24, 9, 7, 0, Math.PI * 2, 0, Math.PI * 0.52]} />
        <meshStandardMaterial color={accent} roughness={0.92} />
      </mesh>
      <mesh position={[0, 1.12, 0]} castShadow>
        <cylinderGeometry args={[0.25, 0.34, 1.05, 7]} />
        <meshStandardMaterial color={color} roughness={0.84} flatShading />
      </mesh>
      <group ref={leftArmRef} position={[-0.34, 1.42, 0]} rotation={[0, 0, 0.08]}>
        <Cylinder position={[0, -0.38, 0]} args={[0.075, 0.095, 0.78, 6]} color={skin} />
      </group>
      <group ref={rightArmRef} position={[0.34, 1.42, 0]} rotation={[0, 0, -0.08]}>
        <Cylinder position={[0, -0.38, 0]} args={[0.075, 0.095, 0.78, 6]} color={skin} />
      </group>
      <group ref={leftLegRef} position={[-0.15, 0.62, 0]}>
        <Cylinder position={[0, -0.38, 0]} args={[0.08, 0.105, 0.82, 6]} color={accent} />
      </group>
      <group ref={rightLegRef} position={[0.15, 0.62, 0]}>
        <Cylinder position={[0, -0.38, 0]} args={[0.08, 0.105, 0.82, 6]} color={accent} />
      </group>
    </group>
  )
}

function WalkingNpc({ start, end, duration, offset, color, accent, active, scale = 1 }) {
  const groupRef = useRef(null)
  const timeRef = useRef(offset)
  const startVector = useMemo(() => new THREE.Vector3(...start), [start])
  const endVector = useMemo(() => new THREE.Vector3(...end), [end])
  const direction = useMemo(() => endVector.clone().sub(startVector), [endVector, startVector])

  useFrame((_, delta) => {
    if (active) timeRef.current += delta
    const progress = (timeRef.current % duration) / duration
    if (!groupRef.current) return
    groupRef.current.position.lerpVectors(startVector, endVector, progress)
    groupRef.current.rotation.y = Math.atan2(direction.x, direction.z)
  })

  return (
    <group ref={groupRef}>
      <AnimatedPerson position={[0, 0, 0]} color={color} accent={accent} mode="walk" active={active} phase={offset} scale={scale} />
    </group>
  )
}

function CameraRig({ elapsed, active, dialogueOpen }) {
  const targetPosition = useMemo(() => new THREE.Vector3(), [])
  const targetLook = useMemo(() => new THREE.Vector3(), [])
  const smoothedLook = useMemo(() => new THREE.Vector3(...PLAYER_PATH[0].look), [])
  const gaitTimeRef = useRef(0)

  useFrame(({ camera }, delta) => {
    if (active) gaitTimeRef.current += delta
    const sample = samplePlayerPath(elapsed)
    const gait = gaitTimeRef.current
    const bob = active ? Math.sin(gait * 10.5) * 0.035 * sample.walk : 0
    const sway = active ? Math.sin(gait * 5.25) * 0.022 * sample.walk : 0

    targetPosition.set(sample.position[0] + sway, sample.position[1] + bob, sample.position[2])
    targetLook.set(...sample.look)
    if (dialogueOpen && elapsed >= 25 && elapsed < 40) targetLook.lerp(MARA_LOOK, 0.72)

    const positionMix = 1 - Math.exp(-delta * 5.2)
    const lookMix = 1 - Math.exp(-delta * 6.4)
    camera.position.lerp(targetPosition, positionMix)
    smoothedLook.lerp(targetLook, lookMix)
    camera.lookAt(smoothedLook)

    const nextFov = THREE.MathUtils.lerp(camera.fov, sample.fov, 1 - Math.exp(-delta * 4))
    if (Math.abs(nextFov - camera.fov) > 0.01) {
      camera.fov = nextFov
      camera.updateProjectionMatrix()
    }
  })

  return null
}

function Atmosphere({ elapsed }) {
  const target = useMemo(() => new THREE.Color(), [])

  useFrame(({ scene }, delta) => {
    if (elapsed < 16) target.copy(BEDROOM_COLOR)
    else if (elapsed < 25) target.copy(STREET_COLOR)
    else target.copy(CAFE_COLOR)

    if (!(scene.background instanceof THREE.Color)) scene.background = target.clone()
    scene.background.lerp(target, 1 - Math.exp(-delta * 1.8))
    if (scene.fog) scene.fog.color.lerp(target, 1 - Math.exp(-delta * 1.8))
  })

  return <fog attach="fog" args={['#b8a7bb', 10, 48]} />
}

function Bedroom({ elapsed }) {
  const apartmentDoorProgress = clamp01((elapsed - 13.65) / 1.25)

  return (
    <group>
      <Box position={[0, -0.12, -1]} size={[8, 0.24, 14]} color="#9b806d" />
      <Box position={[-4, 2.2, -1]} size={[0.22, 4.4, 14]} color="#d2b69d" />
      <Box position={[4, 2.2, -1]} size={[0.22, 4.4, 14]} color="#d2b69d" />
      <Box position={[0, 2.2, 6]} size={[8, 4.4, 0.22]} color="#c79e89" />

      <group position={[-2.05, 0, 1.8]}>
        <Box position={[0, 0.34, 0]} size={[2.3, 0.55, 4.2]} color="#725b65" />
        <Box position={[0, 0.72, 0]} size={[2.15, 0.3, 4]} color="#d7c4b8" />
        <Box position={[0, 0.94, -1.35]} size={[1.35, 0.28, 0.72]} color="#eee1d2" />
        <Box position={[0.12, 1.0, 0.25]} size={[2.0, 0.18, 2.7]} color="#86748d" rotation={[-0.04, 0, -0.03]} />
      </group>

      <Box position={[2.65, 1.0, -1.7]} size={[1.7, 2, 0.75]} color="#6b735f" />
      <Box position={[2.65, 2.32, -1.28]} size={[1.55, 1.05, 0.08]} color="#8eabb4" opacity={0.78} />
      <Box position={[1.6, 0.06, 1.7]} size={[2.1, 0.08, 2.9]} color="#b57669" />
      <Lamp position={[3.05, 0, 3.25]} color="#f2c97b" />

      <group position={[0, 0, -11]}>
        <Box position={[0, -0.02, 0]} size={[4.2, 0.2, 8]} color="#8f7e6c" />
        <Box position={[-2.1, 1.9, 0]} size={[0.18, 3.8, 8]} color="#c8b49a" />
        <Box position={[2.1, 1.9, 0]} size={[0.18, 3.8, 8]} color="#c8b49a" />
        <Box position={[0, 3.72, 0]} size={[4.2, 0.16, 8]} color="#b49b86" />
        <Door position={[-0.95, 0, -3.85]} color="#9f675b" progress={apartmentDoorProgress} />
      </group>

      <pointLight position={[-1.5, 3.4, 1]} intensity={1.7} color="#ffd99d" distance={13} decay={2} />
    </group>
  )
}

function Street({ active }) {
  const buildings = useMemo(
    () => Array.from({ length: 7 }, (_, index) => ({
      z: -24 - index * 7,
      height: 4.2 + (index % 3) * 1.15,
      left: ['#c7776d', '#8797a6', '#d0a05f'][index % 3],
      right: ['#82998a', '#b98670', '#7c7895'][(index + 1) % 3],
    })),
    [],
  )

  return (
    <group>
      <Box position={[0, -0.14, -43]} size={[4.8, 0.24, 56]} color="#b39d87" />
      <Box position={[5.1, -0.22, -43]} size={[5.3, 0.16, 56]} color="#656872" />
      <Box position={[2.52, -0.04, -43]} size={[0.18, 0.24, 56]} color="#d8c1a6" />
      <Box position={[7.85, -0.09, -43]} size={[0.18, 0.2, 56]} color="#d2b785" />

      {buildings.map((building, index) => (
        <group key={building.z}>
          <Box position={[-6.4, building.height / 2, building.z]} size={[6.2, building.height, 5.8]} color={building.left} />
          <Box position={[11.4, (building.height + 0.7) / 2, building.z - 2]} size={[6.2, building.height + 0.7, 5.8]} color={building.right} />
          {Array.from({ length: 3 }, (_, windowIndex) => (
            <Box
              key={windowIndex}
              position={[-3.22, 1.4 + windowIndex * 1.1, building.z]}
              size={[0.08, 0.64, 0.78]}
              color="#d8d9bd"
              opacity={0.82}
            />
          ))}
          {index % 2 === 0 && <Lamp position={[-2.25, 0, building.z + 2]} />}
          {index % 2 === 1 && <Tree position={[-1.8, 0, building.z + 1]} scale={0.78} />}
        </group>
      ))}

      <WalkingNpc start={[-1.2, 0, -22]} end={[-1.2, 0, -62]} duration={12} offset={2.4} color="#637f91" accent="#3f4853" active={active} />
      <WalkingNpc start={[1.2, 0, -61]} end={[1.2, 0, -25]} duration={14} offset={7.1} color="#a8656d" accent="#4c4050" active={active} scale={0.95} />
      <WalkingNpc start={[2.2, 0, -43]} end={[8.2, 0, -43]} duration={9} offset={4.8} color="#7d9066" accent="#4e5349" active={active} scale={0.92} />
      <AnimatedPerson position={[-1.55, 0, -67.5]} rotation={[0, 0.5, 0]} color="#c98a5f" accent="#56464e" mode="idle" active={active} phase={1.8} />
    </group>
  )
}

function CafeFacade({ elapsed }) {
  const cafeDoorProgress = clamp01((elapsed - 24.5) / 1.6)

  return (
    <group>
      <Box position={[0, 2.6, -73.6]} size={[14, 5.2, 0.32]} color="#724f46" />
      <Box position={[-4.6, 2.25, -73.38]} size={[3.6, 3.6, 0.08]} color="#adc1bf" opacity={0.62} />
      <Box position={[4.6, 2.25, -73.38]} size={[3.6, 3.6, 0.08]} color="#adc1bf" opacity={0.62} />
      <Box position={[0, 4.25, -73.22]} size={[13.8, 0.48, 0.65]} color="#d1a55f" />
      <Label text="CAFÉ" position={[0, 4.38, -72.86]} size={[3.9, 1.08]} />
      <Door position={[-0.95, 0, -73.25]} color="#4f5961" progress={cafeDoorProgress} openAngle={Math.PI * 0.5} />
      <Box position={[0, 0.02, -72.9]} size={[2.6, 0.08, 1.1]} color="#8f725c" />
    </group>
  )
}

function CafeInterior({ elapsed, active }) {
  const maraMode = elapsed >= 25 && elapsed < 31 ? 'wave' : 'idle'
  const chairSlide = smoothstep((elapsed - 40.5) / 3)

  return (
    <group>
      <Box position={[0, -0.12, -87]} size={[14, 0.24, 27]} color="#8a725f" />
      <Box position={[-7, 2.7, -87]} size={[0.24, 5.4, 27]} color="#704f49" />
      <Box position={[7, 2.7, -87]} size={[0.24, 5.4, 27]} color="#704f49" />
      <Box position={[0, 2.7, -100.4]} size={[14, 5.4, 0.24]} color="#6f514c" />

      <group position={[0, 0, -94]}>
        <Box position={[-1.3, 1.0, 0]} size={[8.6, 1.8, 1.15]} color="#4f5961" />
        <Box position={[-1.3, 1.94, 0]} size={[8.9, 0.18, 1.45]} color="#d1a55f" />
        <Box position={[-3.65, 2.55, -0.1]} size={[1.25, 1.05, 0.75]} color="#34363e" />
        <Cylinder position={[-3.9, 3.16, -0.05]} args={[0.18, 0.18, 0.65, 8]} color="#777c83" />
        <Cylinder position={[-3.35, 3.16, -0.05]} args={[0.18, 0.18, 0.65, 8]} color="#777c83" />
        <Box position={[1.9, 2.37, 0]} size={[1.7, 0.65, 0.8]} color="#b48261" opacity={0.88} />
      </group>

      <AnimatedPerson
        position={[-1, 0, -92.1]}
        rotation={[0, Math.PI, 0]}
        color="#a65d63"
        accent="#493e4a"
        mode={maraMode}
        active={active}
        phase={0.3}
      />

      <group position={[-4.25, 0, -84.8]}>
        <Table position={[0, 0, 0]} size={[2.2, 0.16, 1.55]} color="#b48261" />
        <Chair position={[-1.45, 0, 0]} rotation={[0, Math.PI / 2, 0]} />
        <Chair position={[1.45, 0, 0]} rotation={[0, -Math.PI / 2, 0]} />
        <AnimatedPerson position={[-1.45, 0.72, 0]} rotation={[0, Math.PI / 2, 0]} color="#637f91" accent="#3e4650" mode="seated" active={active} phase={2.2} scale={0.92} />
        <AnimatedPerson position={[1.45, 0.72, 0]} rotation={[0, -Math.PI / 2, 0]} color="#bc7d62" accent="#50434b" mode="seated" active={active} phase={5.1} scale={0.94} />
      </group>

      <group position={[4.2, 0, -90]}>
        <Table position={[0, 0, 0]} size={[2.55, 0.16, 1.75]} color="#b48261" />
        <Chair position={[0, 0, 1.75 + chairSlide * 0.45]} rotation={[0, Math.PI, 0]} color="#684c45" />
        <Chair position={[0, 0, -1.6]} color="#684c45" />
        <Cylinder position={[-0.35, 1.18, -0.08]} args={[0.14, 0.12, 0.28, 9]} color="#eee1d2" />
        <Cylinder position={[0.35, 1.18, 0.08]} args={[0.14, 0.12, 0.28, 9]} color="#eee1d2" />
      </group>

      <group position={[6.78, 0, -87]}>
        {[-5, 0, 5].map((offset) => (
          <group key={offset} position={[0, 0, offset]}>
            <Box position={[0, 2.55, 0]} size={[0.08, 4.5, 3.5]} color="#a8c1c4" opacity={0.48} />
            <Box position={[-0.08, 2.55, 0]} size={[0.12, 4.7, 0.12]} color="#554448" />
            <Box position={[-0.08, 2.55, -1.7]} size={[0.12, 4.7, 0.12]} color="#554448" />
            <Box position={[-0.08, 2.55, 1.7]} size={[0.12, 4.7, 0.12]} color="#554448" />
          </group>
        ))}
      </group>

      <Lamp position={[-4.2, 0, -88]} color="#f1c779" />
      <Lamp position={[3.9, 0, -85]} color="#f1c779" />
      <pointLight position={[0, 4.4, -91]} intensity={2.4} color="#ffd5a0" distance={18} decay={2} />
    </group>
  )
}

function World({ elapsed, active }) {
  return (
    <group>
      <Bedroom elapsed={elapsed} />
      <Street active={active} />
      <CafeFacade elapsed={elapsed} />
      <CafeInterior elapsed={elapsed} active={active} />
    </group>
  )
}

export function AuthoredJourneyScene({ elapsed, active, dialogueOpen = false }) {
  return (
    <>
      <Atmosphere elapsed={elapsed} />
      <hemisphereLight args={['#dbe9ee', '#5c4c4c', 1.15]} />
      <directionalLight position={[8, 14, 6]} intensity={2.1} color="#fff2d1" castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <CameraRig elapsed={elapsed} active={active} dialogueOpen={dialogueOpen} />
      <World elapsed={elapsed} active={active} />
    </>
  )
}
