import fs from 'node:fs'

function replaceOnce(source, search, replacement, label) {
  if (!source.includes(search)) throw new Error(`Could not find ${label}`)
  return source.replace(search, replacement)
}

let app = fs.readFileSync('src/App.jsx', 'utf8')

app = replaceOnce(
  app,
  `const DIALOGUE = {
  speaker: 'Mara',
  line: 'Hey! You made it. Do you still want to sit by the window?',
  options: [
    'Yeah, the window is good.',
    'Sorry, could you say that again?',
    'Anywhere is fine. I just need to sit.',
  ],
}`,
  `const DIALOGUE = {
  speaker: 'Barista',
  line: 'Hi. What can I get started for you?',
  options: [
    'A small coffee, please.',
    'Could I have tea instead?',
    'Just water for now, thanks.',
  ],
}`,
  'dialogue copy',
)

app = replaceOnce(
  app,
  `    if (elapsed >= 25 && !dialogueAnswered) setDialogueOpen(true)`,
  `    if (elapsed >= 35 && !dialogueAnswered) setDialogueOpen(true)`,
  'ordering dialogue trigger',
)

app = replaceOnce(
  app,
  `<span className="portrait">M</span>`,
  `<span className="portrait">B</span>`,
  'dialogue portrait initial',
)

fs.writeFileSync('src/App.jsx', app)

let scene = fs.readFileSync('src/world/JourneyScene.jsx', 'utf8')

scene = replaceOnce(
  scene,
  `  // Walking to the café: meet Mara outside, pause, then enter through the open doorway.
  { at: 20, position: [-0.4, 1.65, -37], look: [0, 1.42, -45], walk: 1, fov: 68 },
  { at: 24.2, position: [0, 1.65, -65.5], look: [-1.8, 1.48, -70.8], walk: 1, fov: 68 },
  { at: 25, position: [0, 1.65, -68.2], look: [-2.2, 1.48, -70.9], walk: 0.55, fov: 67 },
  { at: 28.1, position: [0, 1.65, -68.2], look: [-2.2, 1.48, -70.9], walk: 0, fov: 66 },
  { at: 28.8, position: [0, 1.65, -70.8], look: [0, 1.5, -77], walk: 0.6, fov: 67 },
  { at: 29.8, position: [0, 1.65, -70.8], look: [0, 1.5, -80], walk: 0, fov: 67 },
  { at: 31.2, position: [0, 1.65, -79], look: [0, 1.5, -87], walk: 0.82, fov: 67 },
  { at: 33, position: [-0.8, 1.65, -87], look: [-1, 1.48, -92], walk: 0.25, fov: 66 },
  { at: 37, position: [-0.8, 1.65, -87.2], look: [-1, 1.45, -92], walk: 0, fov: 65 },
  { at: 40, position: [1.8, 1.65, -87], look: [4.2, 1.2, -89.5], walk: 0.45, fov: 66 },
  { at: 43, position: [4.2, 1.65, -87.8], look: [4.2, 1.1, -90], walk: 0.35, fov: 65 },
  { at: 46, position: [4.2, 1.15, -89.2], look: [0.5, 1.3, -90], walk: 0, fov: 63 },
  { at: 50, position: [4.2, 1.15, -89.2], look: [0.5, 1.25, -90], walk: 0, fov: 63 },`,
  `  // Walking to the café: meet Mara, enter, order, then walk around the chair to sit.
  { at: 20, position: [-0.4, 1.65, -37], look: [0, 1.42, -45], walk: 1, fov: 68 },
  { at: 24.2, position: [0, 1.65, -65.5], look: [-1.8, 1.48, -70.8], walk: 1, fov: 68 },
  { at: 25, position: [0, 1.65, -68.2], look: [-2.2, 1.48, -70.9], walk: 0.55, fov: 67 },
  { at: 28.1, position: [0, 1.65, -68.2], look: [-2.2, 1.48, -70.9], walk: 0, fov: 66 },
  { at: 28.8, position: [0, 1.65, -70.8], look: [0, 1.5, -77], walk: 0.6, fov: 67 },
  { at: 29.8, position: [0, 1.65, -70.8], look: [0, 1.5, -80], walk: 0, fov: 67 },
  { at: 31.2, position: [0, 1.65, -79], look: [0, 1.5, -87], walk: 0.82, fov: 67 },

  // Ordering: enter facing the service counter, approach the barista and stop for the order.
  { at: 33.4, position: [0, 1.65, -85], look: [-1.3, 1.48, -95.15], walk: 0.78, fov: 67 },
  { at: 35, position: [-0.6, 1.65, -89], look: [-1.3, 1.48, -95.15], walk: 0.45, fov: 65 },
  { at: 38, position: [-0.6, 1.65, -89], look: [-1.3, 1.48, -95.15], walk: 0, fov: 65 },
  { at: 39, position: [-0.6, 1.65, -89], look: [5.6, 1.35, -87.5], walk: 0, fov: 66 },

  // Sitting down: take the open aisle around the chair, step beside the table, then lower into the seat.
  { at: 42, position: [5.6, 1.65, -86.2], look: [5.6, 1.3, -90], walk: 0.72, fov: 66 },
  { at: 44.5, position: [5.6, 1.65, -89.25], look: [4.2, 1.25, -90], walk: 0.6, fov: 65 },
  { at: 46, position: [4.2, 1.65, -89.25], look: [0.5, 1.3, -90], walk: 0.35, fov: 64 },
  { at: 48, position: [4.2, 1.15, -89.25], look: [0.5, 1.25, -90], walk: 0, fov: 63 },
  { at: 50, position: [4.2, 1.15, -89.25], look: [0.5, 1.25, -90], walk: 0, fov: 63 },`,
  'café player path',
)

scene = replaceOnce(
  scene,
  `const MARA_LOOK = new THREE.Vector3(-2.2, 1.48, -70.9)
const SHARED_BOX_GEOMETRY = new THREE.BoxGeometry(1, 1, 1)`,
  `const BARISTA_LOOK = new THREE.Vector3(-1.3, 1.48, -95.15)
const SHARED_BOX_GEOMETRY = new THREE.BoxGeometry(1, 1, 1)`,
  'dialogue look target',
)

scene = replaceOnce(
  scene,
  `function CameraRig({ elapsed, active, dialogueOpen }) {`,
  `function CameraRig({ elapsed, active, dialogueOpen, dialogueAnswered }) {`,
  'camera props',
)

scene = replaceOnce(
  scene,
  `  useFrame(({ camera }, delta) => {
    if (active) {
      if (!wasActiveRef.current) cameraElapsedRef.current = elapsed
      gaitTimeRef.current += delta
      cameraElapsedRef.current += delta
    } else {
      cameraElapsedRef.current = elapsed
    }
    wasActiveRef.current = active`,
  `  useFrame(({ camera }, delta) => {
    if (active) {
      if (!wasActiveRef.current) cameraElapsedRef.current = Math.min(elapsed, 35)
      gaitTimeRef.current += delta
      if (dialogueAnswered || cameraElapsedRef.current < 35) cameraElapsedRef.current += delta
      if (!dialogueAnswered && cameraElapsedRef.current > 35) cameraElapsedRef.current = 35
    } else {
      cameraElapsedRef.current = Math.min(elapsed, dialogueAnswered ? elapsed : 35)
    }
    wasActiveRef.current = active`,
  'ordering camera hold',
)

scene = replaceOnce(
  scene,
  `    if (dialogueOpen && elapsed >= 24.5 && elapsed < 29.4) targetLook.lerp(MARA_LOOK, 0.82)`,
  `    if (dialogueOpen) targetLook.lerp(BARISTA_LOOK, 0.9)`,
  'dialogue camera focus',
)

scene = replaceOnce(
  scene,
  `function CafeInterior({ elapsed, active }) {
  const chairSlide = smoothstep((elapsed - 40.5) / 3)

  return (`,
  `function CafeInterior({ elapsed, active }) {
  return (`,
  'chair slide setup',
)

scene = replaceOnce(
  scene,
  `        <Box position={[1.9, 2.37, 0]} size={[1.7, 0.65, 0.8]} color="#b48261" opacity={0.88} />
      </group>

      <group position={[-4.25, 0, -84.8]}>`,
  `        <Box position={[1.9, 2.37, 0]} size={[1.7, 0.65, 0.8]} color="#b48261" opacity={0.88} />
        <Box position={[2.5, 2.34, 0]} size={[0.52, 0.48, 0.42]} color="#34363e" />
      </group>

      <Box position={[-1.3, 3.45, -100.24]} size={[5.4, 1.45, 0.08]} color="#3d4547" castShadow={false} />
      <Box position={[-1.3, 2.35, -100.18]} size={[4.8, 0.12, 0.16]} color="#d1a55f" castShadow={false} />
      <AnimatedPerson
        position={[-1.3, 0, -95.15]}
        rotation={[0, 0, 0]}
        color="#5f7e82"
        accent="#3d414a"
        mode="idle"
        active={active}
        phase={1.1}
      />

      <group position={[-4.25, 0, -84.8]}>`,
  'barista and ordering focal point',
)

scene = replaceOnce(
  scene,
  `<Chair position={[0, 0, 1.75 + chairSlide * 0.45]} rotation={[0, Math.PI, 0]} color="#684c45" />`,
  `<Chair position={[0, 0, 1.75]} rotation={[0, Math.PI, 0]} color="#684c45" />`,
  'fixed table chair',
)

scene = replaceOnce(
  scene,
  `export function AuthoredJourneyScene({ elapsed, active, dialogueOpen = false }) {`,
  `export function AuthoredJourneyScene({ elapsed, active, dialogueOpen = false, dialogueAnswered = false }) {`,
  'scene props',
)

scene = replaceOnce(
  scene,
  `<CameraRig elapsed={elapsed} active={active} dialogueOpen={dialogueOpen} />`,
  `<CameraRig
        elapsed={elapsed}
        active={active}
        dialogueOpen={dialogueOpen}
        dialogueAnswered={dialogueAnswered}
      />`,
  'camera prop wiring',
)

fs.writeFileSync('src/world/JourneyScene.jsx', scene)
