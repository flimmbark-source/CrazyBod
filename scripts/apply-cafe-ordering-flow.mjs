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
  `const MARA_DIALOGUE = {
  speaker: 'Mara',
  line: 'Hey! You made it. Do you still want to sit by the window?',
  options: [
    'Yeah, the window is good.',
    'Sorry, could you say that again?',
    'Anywhere is fine. I just need to sit.',
  ],
}

const ORDER_DIALOGUE = {
  speaker: 'Barista',
  line: 'Hi. What can I get started for you?',
  options: [
    'A small coffee, please.',
    'Could I have tea instead?',
    'Just water for now, thanks.',
  ],
}`,
  'dialogue definitions',
)

app = replaceOnce(
  app,
  `  const [dialogueOpen, setDialogueOpen] = useState(false)
  const [dialogueAnswered, setDialogueAnswered] = useState(false)`,
  `  const [dialogueOpen, setDialogueOpen] = useState(false)
  const [dialogueAnswered, setDialogueAnswered] = useState(false)
  const [orderDialogueOpen, setOrderDialogueOpen] = useState(false)
  const [orderDialogueAnswered, setOrderDialogueAnswered] = useState(false)`,
  'ordering dialogue state',
)

app = replaceOnce(
  app,
  `  const tutorialPaused = status === 'playing' && tutorialStep !== 'none'`,
  `  const tutorialPaused = status === 'playing' && tutorialStep !== 'none'
  const orderingPaused = status === 'playing' && orderDialogueOpen
  const gameplayPaused = tutorialPaused || orderingPaused`,
  'gameplay pause state',
)

app = replaceOnce(
  app,
  `    setDialogueOpen(false)
    setDialogueAnswered(false)`,
  `    setDialogueOpen(false)
    setDialogueAnswered(false)
    setOrderDialogueOpen(false)
    setOrderDialogueAnswered(false)`,
  'dialogue reset',
)

app = replaceOnce(
  app,
  `    if (tutorialPaused && pauseStartedRef.current === null) {`,
  `    if (gameplayPaused && pauseStartedRef.current === null) {`,
  'pause start condition',
)

app = replaceOnce(
  app,
  `    if (!tutorialPaused && pauseStartedRef.current !== null) {`,
  `    if (!gameplayPaused && pauseStartedRef.current !== null) {`,
  'pause end condition',
)

app = replaceOnce(
  app,
  `  }, [status, tutorialPaused])`,
  `  }, [gameplayPaused, status])`,
  'pause effect dependencies',
)

app = replaceOnce(
  app,
  `    if (status !== 'playing' || tutorialPaused) return undefined`,
  `    if (status !== 'playing' || gameplayPaused) return undefined`,
  'clock pause condition',
)

app = replaceOnce(
  app,
  `  }, [status, tutorialPaused])`,
  `  }, [gameplayPaused, status])`,
  'clock effect dependencies',
)

app = replaceOnce(
  app,
  `    if (status !== 'playing' || tutorialPaused || !directorReady) return`,
  `    if (status !== 'playing' || gameplayPaused || !directorReady) return`,
  'director pause condition',
)

app = replaceOnce(
  app,
  `  }, [directorReady, elapsed, load, spawnMicrogame, status, tutorialPaused])`,
  `  }, [directorReady, elapsed, gameplayPaused, load, spawnMicrogame, status])`,
  'director dependencies',
)

app = replaceOnce(
  app,
  `  useEffect(() => {
    if (status !== 'playing') return
    if (elapsed >= 25 && !dialogueAnswered) setDialogueOpen(true)
  }, [elapsed, status, dialogueAnswered])`,
  `  useEffect(() => {
    if (status !== 'playing') return
    if (elapsed >= 25 && !dialogueAnswered) setDialogueOpen(true)
  }, [elapsed, status, dialogueAnswered])

  useEffect(() => {
    if (status !== 'playing') return
    if (elapsed >= 35 && dialogueAnswered && !orderDialogueAnswered) {
      setOrderDialogueOpen(true)
    }
  }, [dialogueAnswered, elapsed, orderDialogueAnswered, status])`,
  'separate dialogue triggers',
)

app = replaceOnce(
  app,
  `  const answerDialogue = () => {
    setDialogueAnswered(true)
    setDialogueOpen(false)
  }`,
  `  const answerDialogue = () => {
    setDialogueAnswered(true)
    setDialogueOpen(false)
  }

  const answerOrderDialogue = () => {
    setOrderDialogueAnswered(true)
    setOrderDialogueOpen(false)
  }`,
  'order dialogue answer',
)

app = replaceOnce(
  app,
  `            active={status === 'playing' && !tutorialPaused}
            dialogueOpen={dialogueOpen}
            dialogueAnswered={dialogueAnswered}`,
  `            active={status === 'playing' && !gameplayPaused}
            dialogueStage={dialogueOpen ? 'mara' : orderDialogueOpen ? 'order' : null}`,
  'scene dialogue props',
)

app = replaceOnce(
  app,
  `          {dialogueOpen && (
            <DialogueBox
              load={load}
              distortion={distortion}
              onAnswer={answerDialogue}
            />
          )}`,
  `          {dialogueOpen && (
            <DialogueBox
              dialogue={MARA_DIALOGUE}
              load={load}
              distortion={distortion}
              onAnswer={answerDialogue}
            />
          )}

          {orderDialogueOpen && (
            <DialogueBox
              dialogue={ORDER_DIALOGUE}
              load={load}
              distortion={distortion}
              onAnswer={answerOrderDialogue}
            />
          )}`,
  'dialogue rendering',
)

app = replaceOnce(
  app,
  `          <button className="go-home" type="button" onClick={goHome} disabled={tutorialPaused}>`,
  `          <button className="go-home" type="button" onClick={goHome} disabled={gameplayPaused}>`,
  'go home pause state',
)

app = replaceOnce(
  app,
  `function DialogueBox({ load, distortion, onAnswer }) {`,
  `function DialogueBox({ dialogue, load, distortion, onAnswer }) {`,
  'dialogue component props',
)

app = replaceOnce(
  app,
  `<span className="portrait">M</span>
        <div>
          <strong>{DIALOGUE.speaker}</strong>
          <p>{scrambleText(DIALOGUE.line, distortion)}</p>`,
  `<span className="portrait">{dialogue.speaker.slice(0, 1)}</span>
        <div>
          <strong>{dialogue.speaker}</strong>
          <p>{scrambleText(dialogue.line, distortion)}</p>`,
  'dialogue speaker copy',
)

app = replaceOnce(
  app,
  `{DIALOGUE.options.map((option, index) => (`,
  `{dialogue.options.map((option, index) => (`,
  'dialogue options',
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
  `  // Walking to the café: keep the existing Mara greeting, then enter through the doorway.
  { at: 20, position: [-0.4, 1.65, -37], look: [0, 1.42, -45], walk: 1, fov: 68 },
  { at: 24.2, position: [0, 1.65, -65.5], look: [-1.8, 1.48, -70.8], walk: 1, fov: 68 },
  { at: 25, position: [0, 1.65, -68.2], look: [-2.2, 1.48, -70.9], walk: 0.55, fov: 67 },
  { at: 28.1, position: [0, 1.65, -68.2], look: [-2.2, 1.48, -70.9], walk: 0, fov: 66 },
  { at: 28.8, position: [0, 1.65, -70.8], look: [0, 1.5, -77], walk: 0.6, fov: 67 },
  { at: 29.8, position: [0, 1.65, -70.8], look: [0, 1.5, -80], walk: 0, fov: 67 },
  { at: 31.2, position: [0, 1.65, -79], look: [0, 1.5, -87], walk: 0.82, fov: 67 },

  // Ordering: turn toward the counter, approach the barista and stop for the order.
  { at: 33.4, position: [0, 1.65, -85], look: [-1.3, 1.48, -95.15], walk: 0.78, fov: 67 },
  { at: 35, position: [-0.6, 1.65, -89], look: [-1.3, 1.48, -95.15], walk: 0.45, fov: 65 },
  { at: 36, position: [-0.6, 1.65, -89], look: [5.7, 1.35, -86.3], walk: 0, fov: 66 },

  // Sitting down: use the aisle beside the table, approach the seat from behind, then lower into it.
  { at: 40.5, position: [5.7, 1.65, -86.3], look: [5.7, 1.3, -90], walk: 0.74, fov: 66 },
  { at: 44, position: [5.7, 1.65, -88.25], look: [4.2, 1.25, -90], walk: 0.58, fov: 65 },
  { at: 46, position: [4.2, 1.65, -88.25], look: [0.5, 1.3, -90], walk: 0.35, fov: 64 },
  { at: 48, position: [4.2, 1.15, -88.25], look: [0.5, 1.25, -90], walk: 0, fov: 63 },
  { at: 50, position: [4.2, 1.15, -88.25], look: [0.5, 1.25, -90], walk: 0, fov: 63 },`,
  'café player path',
)

scene = replaceOnce(
  scene,
  `const MARA_LOOK = new THREE.Vector3(-2.2, 1.48, -70.9)
const SHARED_BOX_GEOMETRY = new THREE.BoxGeometry(1, 1, 1)`,
  `const MARA_LOOK = new THREE.Vector3(-2.2, 1.48, -70.9)
const BARISTA_LOOK = new THREE.Vector3(-1.3, 1.48, -95.15)
const SHARED_BOX_GEOMETRY = new THREE.BoxGeometry(1, 1, 1)`,
  'dialogue look targets',
)

scene = replaceOnce(
  scene,
  `function CameraRig({ elapsed, active, dialogueOpen }) {`,
  `function CameraRig({ elapsed, active, dialogueStage }) {`,
  'camera dialogue props',
)

scene = replaceOnce(
  scene,
  `    if (dialogueOpen && elapsed >= 24.5 && elapsed < 29.4) targetLook.lerp(MARA_LOOK, 0.82)`,
  `    if (dialogueStage === 'mara' && elapsed >= 24.5 && elapsed < 29.4) {
      targetLook.lerp(MARA_LOOK, 0.82)
    }
    if (dialogueStage === 'order') targetLook.lerp(BARISTA_LOOK, 0.9)`,
  'separate dialogue focus',
)

scene = replaceOnce(
  scene,
  `function CafeInterior({ elapsed, active }) {
  const chairSlide = smoothstep((elapsed - 40.5) / 3)

  return (`,
  `function CafeInterior({ elapsed, active }) {
  return (`,
  'chair animation setup',
)

scene = replaceOnce(
  scene,
  `        <Box position={[1.9, 2.37, 0]} size={[1.7, 0.65, 0.8]} color="#b48261" opacity={0.88} />
      </group>

      <group position={[-4.25, 0, -84.8]}>`,
  `        <Box position={[1.9, 2.37, 0]} size={[1.7, 0.65, 0.8]} color="#b48261" opacity={0.88} />
        <Box position={[2.5, 2.34, 0]} size={[0.52, 0.48, 0.42]} color="#34363e" />
      </group>

      <Label
        text="ORDER HERE"
        position={[-1.3, 3.35, -99.96]}
        size={[3.5, 0.78]}
        background="#3d4547"
      />
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
  'barista and order focal point',
)

scene = replaceOnce(
  scene,
  `        <Chair position={[0, 0, 1.75 + chairSlide * 0.45]} rotation={[0, Math.PI, 0]} color="#684c45" />
        <Chair position={[0, 0, -1.6]} color="#684c45" />`,
  `        <Chair position={[0, 0, -1.6]} color="#684c45" />`,
  'remove player chair clipping',
)

scene = replaceOnce(
  scene,
  `export function AuthoredJourneyScene({ elapsed, active, dialogueOpen = false }) {`,
  `export function AuthoredJourneyScene({ elapsed, active, dialogueStage = null }) {`,
  'scene dialogue props',
)

scene = replaceOnce(
  scene,
  `<CameraRig elapsed={elapsed} active={active} dialogueOpen={dialogueOpen} />`,
  `<CameraRig elapsed={elapsed} active={active} dialogueStage={dialogueStage} />`,
  'camera dialogue wiring',
)

fs.writeFileSync('src/world/JourneyScene.jsx', scene)
