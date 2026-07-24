import fs from 'node:fs'

function replacePattern(source, pattern, replacement, label) {
  if (!pattern.test(source)) throw new Error(`Could not find ${label}`)
  return source.replace(pattern, replacement)
}

function replaceOnce(source, search, replacement, label) {
  if (!source.includes(search)) throw new Error(`Could not find ${label}`)
  return source.replace(search, replacement)
}

const worldPath = 'src/world/JourneyScene.jsx'
let world = fs.readFileSync(worldPath, 'utf8')

world = replacePattern(
  world,
  /const PLAYER_PATH = \[[\s\S]*?\n\]\n\nconst BEDROOM_COLOR/,
  `const PLAYER_PATH = [
  // Waking up: start beside the bed and move immediately when START! appears.
  { at: 0, position: [0.25, 1.65, 3.1], look: [0.25, 1.45, -3.5], walk: 0.82, fov: 68 },
  { at: 4.5, position: [0.25, 1.65, -1.0], look: [0.25, 1.45, -5.2], walk: 0.82, fov: 68 },
  { at: 5.2, position: [0.25, 1.65, -1.0], look: [0.25, 1.45, -5.2], walk: 0, fov: 68 },
  { at: 7.4, position: [0.25, 1.65, -1.0], look: [2.65, 1.4, -1.7], walk: 0, fov: 67 },

  // Getting ready: turn toward the apartment door, walk to it, and wait for it to open.
  { at: 8, position: [0.25, 1.65, -1.0], look: [0, 1.45, -10], walk: 0, fov: 67 },
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

const BEDROOM_COLOR`,
  'player path',
)

world = replaceOnce(
  world,
  `  const span = Math.max(0.001, next.at - previous.at)
  const mix = smoothstep((elapsed - previous.at) / span)

  return {
    position: previous.position.map((value, index) => THREE.MathUtils.lerp(value, next.position[index], mix)),
    look: previous.look.map((value, index) => THREE.MathUtils.lerp(value, next.look[index], mix)),
    walk: THREE.MathUtils.lerp(previous.walk, next.walk, mix),
    fov: THREE.MathUtils.lerp(previous.fov, next.fov, mix),
  }`,
  `  const span = Math.max(0.001, next.at - previous.at)
  const progress = clamp01((elapsed - previous.at) / span)
  const lookMix = smoothstep(progress)

  return {
    position: previous.position.map((value, index) => THREE.MathUtils.lerp(value, next.position[index], progress)),
    look: previous.look.map((value, index) => THREE.MathUtils.lerp(value, next.look[index], lookMix)),
    walk: THREE.MathUtils.lerp(previous.walk, next.walk, progress),
    fov: THREE.MathUtils.lerp(previous.fov, next.fov, lookMix),
  }`,
  'linear movement sampling',
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

  useFrame(({ camera }, delta) => {
    if (active) {
      gaitTimeRef.current += delta
      cameraElapsedRef.current += delta
      if (Math.abs(cameraElapsedRef.current - elapsed) > 0.18) {
        cameraElapsedRef.current = elapsed
      }
    } else {
      cameraElapsedRef.current = elapsed
    }

    const sample = samplePlayerPath(cameraElapsedRef.current)
    const gait = gaitTimeRef.current
    const bob = active ? Math.sin(gait * 10.5) * 0.035 * sample.walk : 0
    const sway = active ? Math.sin(gait * 5.25) * 0.022 * sample.walk : 0

    targetPosition.set(sample.position[0] + sway, sample.position[1] + bob, sample.position[2])
    targetLook.set(...sample.look)
    if (dialogueOpen && elapsed >= 25 && elapsed < 40) targetLook.lerp(MARA_LOOK, 0.72)

    camera.position.copy(targetPosition)
    smoothedLook.lerp(targetLook, 1 - Math.exp(-delta * 8.5))
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

fs.writeFileSync(worldPath, world)

const appPath = 'src/App.jsx'
let app = fs.readFileSync(appPath, 'utf8')
app = replaceOnce(
  app,
  `camera={{ position: [-1.8, 1.65, 3.1], fov: 68, near: 0.08, far: 150 }}`,
  `camera={{ position: [0.25, 1.65, 3.1], fov: 68, near: 0.08, far: 150 }}`,
  'initial canvas camera',
)
fs.writeFileSync(appPath, app)

const physicalPath = 'src/minigames/physical.jsx'
let physical = fs.readFileSync(physicalPath, 'utf8')

physical = replacePattern(
  physical,
  /export function BalanceGame\(\{ onResolve \}\) \{[\s\S]*?\n\}\n\nexport function TremorGame/,
  `export function BalanceGame({ onResolve }) {
  const rootRef = useRef(null)
  const markerRef = useRef(50)
  const velocityRef = useRef(0)
  const heldRef = useRef(0)
  const steadyRef = useRef(0)
  const [marker, setMarker] = useState(50)
  const [steady, setSteady] = useState(0)
  const resolve = useOnceResolve(onResolve)

  useMicrogameKeys(rootRef, {
    hint: 'A / D',
    onKeyDown: (event) => {
      const direction = keyDirection(event.code)
      if (!direction) return false
      heldRef.current = direction
      return true
    },
    onKeyUp: (event) => {
      const direction = keyDirection(event.code)
      if (!direction) return false
      if (heldRef.current === direction) heldRef.current = 0
      return true
    },
  })

  useAnimationFrame((now, delta) => {
    const externalForce = (
      Math.sin(now / 260) * 0.00050
      + Math.sin(now / 95 + 1.8) * 0.00030
      + Math.sign(Math.sin(now / 620) || 1) * 0.00020
    )
    const controlForce = heldRef.current * 0.00095

    velocityRef.current += (externalForce + controlForce) * delta
    velocityRef.current *= Math.pow(0.9, delta / 16.67)
    velocityRef.current = clamp(velocityRef.current, -0.095, 0.095)
    markerRef.current += velocityRef.current * delta

    if (markerRef.current <= 4 || markerRef.current >= 96) {
      markerRef.current = clamp(markerRef.current, 4, 96)
      velocityRef.current *= -0.65
    }

    const centered = markerRef.current >= 42 && markerRef.current <= 58
    steadyRef.current = clamp(steadyRef.current + (centered ? delta : -delta * 1.15), 0, 1500)
    setMarker(markerRef.current)
    setSteady(steadyRef.current)
    if (steadyRef.current >= 1500) resolve()
  })

  const setHeld = (direction) => () => { heldRef.current = direction }
  const release = () => { heldRef.current = 0 }

  return (
    <div ref={rootRef} className="new-minigame balance-game">
      <small>FIGHT THE PULL. KEEP IT CENTERED.</small>
      <div className="balance-track">
        <i className="balance-zone" />
        <b style={{ left: \`${marker}%\` }} />
      </div>
      <div className="mini-button-row">
        <button type="button" onPointerDown={setHeld(-1)} onPointerUp={release} onPointerLeave={release}>A</button>
        <button type="button" onPointerDown={setHeld(1)} onPointerUp={release} onPointerLeave={release}>D</button>
      </div>
      <Progress value={(steady / 1500) * 100} />
    </div>
  )
}

export function TremorGame`,
  'balance game',
)

physical = replacePattern(
  physical,
  /export function JointSlipGame\(\{ onResolve \}\) \{[\s\S]*?\n\}\n\nexport function MuscleLockGame/,
  `export function JointSlipGame({ onResolve }) {
  const rootRef = useRef(null)
  const positionRef = useRef({ x: 24, y: 56 })
  const draggingRef = useRef(false)
  const settledRef = useRef(0)
  const [position, setPosition] = useState(positionRef.current)
  const [settled, setSettled] = useState(0)
  const [socketed, setSocketed] = useState(false)
  const resolve = useOnceResolve(onResolve)

  useAnimationFrame((_, delta) => {
    const distance = Math.hypot(positionRef.current.x - 76, positionRef.current.y - 48)
    const inSocket = distance < 15
    settledRef.current = clamp(settledRef.current + (inSocket ? delta : -delta * 1.5), 0, 700)
    setSettled(settledRef.current)
    if (settledRef.current >= 700) resolve()
  })

  const start = (event) => {
    if (socketed) return
    draggingRef.current = true
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const move = (event) => {
    if (!draggingRef.current) return
    const rect = rootRef.current.querySelector('.joint-field').getBoundingClientRect()
    const next = {
      x: clamp(((event.clientX - rect.left) / rect.width) * 100, 8, 92),
      y: clamp(((event.clientY - rect.top) / rect.height) * 100, 12, 88),
    }
    const distance = Math.hypot(next.x - 76, next.y - 48)

    if (distance < 15) {
      positionRef.current = { x: 76, y: 48 }
      draggingRef.current = false
      setSocketed(true)
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
    } else {
      positionRef.current = next
    }

    setPosition(positionRef.current)
  }

  const stop = () => { draggingRef.current = false }

  return (
    <div ref={rootRef} className="new-minigame joint-game">
      <small>DRAG INTO THE DOTTED CIRCLE</small>
      <div className="joint-field">
        <i className={socketed ? 'joint-socket filled' : 'joint-socket'} />
        <button
          type="button"
          className={socketed ? 'joint-piece socketed' : 'joint-piece'}
          style={{ left: \`${position.x}%\`, top: \`${position.y}%\` }}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={stop}
          onPointerCancel={stop}
          disabled={socketed}
          aria-label="Drag the loose circle into the dotted circle"
        />
      </div>
      <Progress value={(settled / 700) * 100} />
    </div>
  )
}

export function MuscleLockGame`,
  'joint slip game',
)

fs.writeFileSync(physicalPath, physical)

const cssPath = 'src/minigames.css'
let css = fs.readFileSync(cssPath, 'utf8')
const marker = '/* Joint Slip socket feedback */'
if (!css.includes(marker)) {
  css += `\n\n${marker}\n.joint-socket.filled {\n  border-style: solid;\n  background: rgba(155, 185, 144, 0.52);\n}\n.joint-piece.socketed,\n.joint-piece.socketed:disabled {\n  opacity: 1;\n  background: #9bb990 !important;\n  box-shadow: 0 0 0 5px rgba(155, 185, 144, 0.3), 0 3px 0 #302b38;\n  cursor: default;\n}\n`
}
fs.writeFileSync(cssPath, css)
