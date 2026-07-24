import fs from 'node:fs'

function replaceOnce(source, search, replacement, label) {
  if (!source.includes(search)) throw new Error(`Could not find ${label}`)
  return source.replace(search, replacement)
}

function replacePattern(source, pattern, replacement, label) {
  if (!pattern.test(source)) throw new Error(`Could not find ${label}`)
  return source.replace(pattern, replacement)
}

const worldPath = 'src/world/JourneyScene.jsx'
let world = fs.readFileSync(worldPath, 'utf8')

world = replaceOnce(
  world,
  "import { useFrame } from '@react-three/fiber'",
  "import { useFrame, useThree } from '@react-three/fiber'",
  'fiber import',
)
world = replaceOnce(
  world,
  "import { useMemo, useRef } from 'react'",
  "import { useEffect, useMemo, useRef } from 'react'",
  'react import',
)

world = replacePattern(
  world,
  /const PLAYER_PATH = \[[\s\S]*?\n\]\n\nconst BEDROOM_COLOR/,
  `const PLAYER_PATH = [
  // Waking up: begin beside the bed and walk straight to the bathroom.
  { at: 0, position: [0.55, 1.65, 3.1], look: [0.4, 1.43, -4.2], walk: 0.9, fov: 68 },
  { at: 4.4, position: [0.55, 1.65, -1.2], look: [0.4, 1.43, -5.4], walk: 0.9, fov: 68 },
  { at: 4.9, position: [0.55, 1.65, -1.2], look: [2.85, 1.42, -1.7], walk: 0, fov: 67 },
  { at: 7.35, position: [0.55, 1.65, -1.2], look: [2.85, 1.42, -1.7], walk: 0, fov: 67 },

  // Getting ready: turn into the hall, approach the door, stop, then leave after it opens.
  { at: 8, position: [0.55, 1.65, -1.2], look: [0, 1.45, -10.4], walk: 0, fov: 67 },
  { at: 12.15, position: [0, 1.65, -10.7], look: [0, 1.45, -14.7], walk: 0.9, fov: 67 },
  { at: 13.05, position: [0, 1.65, -13.0], look: [0, 1.43, -14.85], walk: 0.55, fov: 67 },
  { at: 14.55, position: [0, 1.65, -13.0], look: [0, 1.43, -16.8], walk: 0, fov: 67 },
  { at: 15.0, position: [0, 1.65, -13.0], look: [0, 1.45, -22], walk: 0, fov: 67 },
  { at: 16, position: [0, 1.65, -17.4], look: [0, 1.48, -26], walk: 0.92, fov: 68 },

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

const BEDROOM_COLOR`,
  'player path',
)

world = replacePattern(
  world,
  /function CameraRig\(\{ elapsed, active, dialogueOpen \}\) \{[\s\S]*?\n  return null\n\}/,
  `function CameraRig({ elapsed, active, dialogueOpen }) {
  const targetPosition = useMemo(() => new THREE.Vector3(), [])
  const targetLook = useMemo(() => new THREE.Vector3(), [])
  const smoothedLook = useMemo(() => new THREE.Vector3(...PLAYER_PATH[0].look), [])
  const gaitTimeRef = useRef(0)
  const cameraElapsedRef = useRef(0)
  const wasActiveRef = useRef(false)

  useFrame(({ camera }, delta) => {
    if (active) {
      if (!wasActiveRef.current) cameraElapsedRef.current = elapsed
      gaitTimeRef.current += delta
      cameraElapsedRef.current += delta
    } else {
      cameraElapsedRef.current = elapsed
    }
    wasActiveRef.current = active

    const sample = samplePlayerPath(cameraElapsedRef.current)
    const gait = gaitTimeRef.current
    const bob = active ? Math.sin(gait * 10.5) * 0.035 * sample.walk : 0
    const sway = active ? Math.sin(gait * 5.25) * 0.022 * sample.walk : 0

    targetPosition.set(sample.position[0] + sway, sample.position[1] + bob, sample.position[2])
    targetLook.set(...sample.look)
    if (dialogueOpen && elapsed >= 25 && elapsed < 40) targetLook.lerp(MARA_LOOK, 0.72)

    camera.position.copy(targetPosition)
    smoothedLook.lerp(targetLook, 1 - Math.exp(-delta * 9.5))
    camera.lookAt(smoothedLook)

    const nextFov = THREE.MathUtils.lerp(camera.fov, sample.fov, 1 - Math.exp(-delta * 5))
    if (Math.abs(nextFov - camera.fov) > 0.01) {
      camera.fov = nextFov
      camera.updateProjectionMatrix()
    }
  })

  return null
}`,
  'camera rig',
)

world = replacePattern(
  world,
  /function Bedroom\(\{ elapsed \}\) \{[\s\S]*?\n\}\n\nfunction Street/,
  `function Bedroom({ elapsed }) {
  const apartmentDoorProgress = clamp01((elapsed - 13.05) / 1.15)

  return (
    <group>
      <Box position={[0, -0.12, -1]} size={[8, 0.24, 14]} color="#9b806d" />
      <Box position={[0, 4.35, -1]} size={[8, 0.18, 14]} color="#d8c5ae" castShadow={false} />
      <Box position={[-4, 2.2, -1]} size={[0.22, 4.4, 14]} color="#d2b69d" />
      <Box position={[4, 2.2, -1]} size={[0.22, 4.4, 14]} color="#d2b69d" />
      <Box position={[0, 2.2, 6]} size={[8, 4.4, 0.22]} color="#c79e89" />
      <Box position={[-3.86, 0.15, -1]} size={[0.12, 0.28, 13.7]} color="#876c62" />
      <Box position={[3.86, 0.15, -1]} size={[0.12, 0.28, 13.7]} color="#876c62" />

      <group position={[-2.05, 0, 1.9]}>
        <Box position={[0, 0.42, 0]} size={[2.35, 0.72, 4.25]} color="#725b65" />
        <Box position={[0, 0.82, 0]} size={[2.18, 0.26, 4.0]} color="#d7c4b8" />
        <Box position={[0, 1.12, 1.78]} size={[2.4, 1.45, 0.18]} color="#604d59" />
        <Box position={[-0.48, 1.0, -1.35]} size={[0.95, 0.25, 0.7]} color="#eee1d2" />
        <Box position={[0.15, 1.08, 0.3]} size={[2.0, 0.2, 2.65]} color="#86748d" rotation={[-0.04, 0, -0.03]} />
      </group>

      <group position={[-0.48, 0, 2.75]}>
        <Box position={[0, 0.46, 0]} size={[0.68, 0.92, 0.72]} color="#6a574f" />
        <Cylinder position={[0, 1.04, 0]} args={[0.12, 0.16, 0.34, 8]} color="#d7b86b" castShadow={false} />
        <mesh position={[0, 1.34, 0]} castShadow={false}>
          <sphereGeometry args={[0.2, 8, 6]} />
          <meshStandardMaterial color="#f2c97b" emissive="#f2c97b" emissiveIntensity={0.45} />
        </mesh>
      </group>

      <Box position={[1.35, 0.04, 1.55]} size={[2.1, 0.08, 2.75]} color="#b57669" />

      <group>
        <Box position={[1.62, 1.9, -2.65]} size={[0.16, 3.8, 2.1]} color="#bfa78f" />
        <Box position={[2.8, 3.62, -2.65]} size={[2.5, 0.34, 2.1]} color="#bfa78f" />
        <Box position={[2.8, 0.025, -1.75]} size={[2.2, 0.05, 2.55]} color="#b8c0b8" />
        <Box position={[3.1, 0.7, -1.75]} size={[1.45, 1.35, 0.62]} color="#66766f" />
        <Cylinder position={[3.1, 1.44, -1.72]} args={[0.42, 0.34, 0.18, 12]} color="#e2ddd0" castShadow={false} />
        <Cylinder position={[3.1, 1.73, -1.72]} args={[0.045, 0.055, 0.42, 8]} color="#777c83" castShadow={false} />
        <Box position={[3.1, 2.42, -1.41]} size={[1.4, 1.08, 0.07]} color="#9bb5bb" opacity={0.72} castShadow={false} />
        <Box position={[2.15, 1.76, -2.62]} size={[0.58, 0.1, 0.08]} color="#564c4d" />
        <Box position={[2.15, 1.48, -2.57]} size={[0.5, 0.52, 0.05]} color="#c98670" />
      </group>

      <group position={[0, 0, -10.8]}>
        <Box position={[0, -0.02, 0]} size={[4.4, 0.2, 9]} color="#8f7e6c" />
        <Box position={[0, 3.76, 0]} size={[4.4, 0.16, 9]} color="#b49b86" castShadow={false} />
        <Box position={[-2.2, 1.9, 0]} size={[0.18, 3.8, 9]} color="#c8b49a" />
        <Box position={[2.2, 1.9, 0]} size={[0.18, 3.8, 9]} color="#c8b49a" />
        <Box position={[-1.62, 1.9, -4.0]} size={[1.25, 3.8, 0.2]} color="#b49b86" />
        <Box position={[1.62, 1.9, -4.0]} size={[1.25, 3.8, 0.2]} color="#b49b86" />
        <Box position={[0, 3.5, -4.0]} size={[2.0, 0.6, 0.2]} color="#b49b86" />
        <Box position={[0, 0.04, -3.85]} size={[2.25, 0.08, 0.75]} color="#725f54" />
        <mesh position={[0, 1.7, -4.13]} rotation={[0, 0, 0]}>
          <planeGeometry args={[1.88, 3.35]} />
          <meshBasicMaterial color="#dce8d5" toneMapped={false} />
        </mesh>
        <Door
          position={[-0.95, 0, -3.86]}
          color="#9f675b"
          progress={apartmentDoorProgress}
          openAngle={Math.PI * 0.49}
        />
        <Box position={[-1.7, 1.75, -1.3]} size={[0.12, 1.2, 0.45]} color="#725f54" />
        <Cylinder position={[-1.55, 2.1, -1.05]} args={[0.05, 0.05, 0.35, 7]} color="#4f4c52" castShadow={false} />
        <Cylinder position={[-1.55, 1.72, -1.05]} args={[0.05, 0.05, 0.35, 7]} color="#4f4c52" castShadow={false} />
      </group>

      <pointLight position={[-0.8, 3.4, 1.2]} intensity={1.45} color="#ffd99d" distance={13} decay={2} />
    </group>
  )
}

function Street`,
  'bedroom',
)

world = replaceOnce(
  world,
  `function Atmosphere({ elapsed }) {`,
  `function SceneWarmup() {
  const { gl, scene, camera } = useThree()

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const states = []
      scene.traverse((object) => {
        states.push([object, object.visible, object.frustumCulled])
        object.visible = true
        object.frustumCulled = false
      })
      gl.compile(scene, camera)
      states.forEach(([object, visible, frustumCulled]) => {
        object.visible = visible
        object.frustumCulled = frustumCulled
      })
    })

    return () => window.cancelAnimationFrame(frame)
  }, [camera, gl, scene])

  return null
}

function Atmosphere({ elapsed }) {`,
  'scene warmup',
)

world = replaceOnce(
  world,
  `    <>
      <Atmosphere elapsed={elapsed} />`,
  `    <>
      <SceneWarmup />
      <Atmosphere elapsed={elapsed} />`,
  'warmup mount',
)

fs.writeFileSync(worldPath, world)

const appPath = 'src/App.jsx'
let app = fs.readFileSync(appPath, 'utf8')
app = replaceOnce(
  app,
  '<main className={`game-shell load-${Math.min(load, 5)}`}>',
  '<main className={`game-shell status-${status} load-${Math.min(load, 5)}`}>',
  'status class',
)
app = replaceOnce(
  app,
  `camera={{ position: [0.25, 1.65, 3.1], fov: 68, near: 0.08, far: 150 }}`,
  `camera={{ position: [0.55, 1.65, 3.1], fov: 68, near: 0.08, far: 150 }}`,
  'camera start',
)
app = replaceOnce(
  app,
  `{status === 'playing' && (`,
  `{['countdown', 'playing'].includes(status) && (`,
  'pre-mounted gameplay UI',
)
fs.writeFileSync(appPath, app)

const stylesPath = 'src/styles.css'
let styles = fs.readFileSync(stylesPath, 'utf8')
styles += `

/* Build the gameplay chrome during Ready? so START! does not mount a full UI tree. */
.status-countdown .hud,
.status-countdown .load-meter,
.status-countdown .microgame-layer,
.status-countdown .completion-fx-layer,
.status-countdown .dialogue-box,
.status-countdown .go-home {
  visibility: hidden;
  pointer-events: none;
}
`
fs.writeFileSync(stylesPath, styles)
