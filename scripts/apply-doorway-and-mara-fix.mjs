import fs from 'node:fs'

function replaceOnce(source, search, replacement, label) {
  if (!source.includes(search)) throw new Error(`Could not find ${label}`)
  return source.replace(search, replacement)
}

function replacePattern(source, pattern, replacement, label) {
  if (!pattern.test(source)) throw new Error(`Could not find ${label}`)
  return source.replace(pattern, replacement)
}

const path = 'src/world/JourneyScene.jsx'
let source = fs.readFileSync(path, 'utf8')

source = replaceOnce(
  source,
  `  // Walking to the café and the existing café sequence.
  { at: 20, position: [-0.4, 1.65, -37], look: [0, 1.42, -45], walk: 1, fov: 68 },
  { at: 25, position: [0, 1.65, -68], look: [0, 1.55, -75], walk: 1, fov: 68 },
  { at: 28, position: [0, 1.65, -77], look: [0, 1.5, -87], walk: 0.65, fov: 67 },
  { at: 32, position: [-0.8, 1.65, -87], look: [-1, 1.48, -92], walk: 0.25, fov: 66 },`,
  `  // Walking to the café: meet Mara outside, pause, then enter through the open doorway.
  { at: 20, position: [-0.4, 1.65, -37], look: [0, 1.42, -45], walk: 1, fov: 68 },
  { at: 24.2, position: [0, 1.65, -65.5], look: [-1.8, 1.48, -70.8], walk: 1, fov: 68 },
  { at: 25, position: [0, 1.65, -68.2], look: [-2.2, 1.48, -70.9], walk: 0.55, fov: 67 },
  { at: 28.1, position: [0, 1.65, -68.2], look: [-2.2, 1.48, -70.9], walk: 0, fov: 66 },
  { at: 28.8, position: [0, 1.65, -70.8], look: [0, 1.5, -77], walk: 0.6, fov: 67 },
  { at: 29.8, position: [0, 1.65, -70.8], look: [0, 1.5, -80], walk: 0, fov: 67 },
  { at: 31.2, position: [0, 1.65, -79], look: [0, 1.5, -87], walk: 0.82, fov: 67 },
  { at: 33, position: [-0.8, 1.65, -87], look: [-1, 1.48, -92], walk: 0.25, fov: 66 },`,
  'cafe approach path',
)

source = replaceOnce(
  source,
  `const MARA_LOOK = new THREE.Vector3(-1, 1.45, -92)`,
  `const MARA_LOOK = new THREE.Vector3(-2.2, 1.48, -70.9)`,
  'Mara look target',
)

source = replaceOnce(
  source,
  `    if (dialogueOpen && elapsed >= 25 && elapsed < 40) targetLook.lerp(MARA_LOOK, 0.72)`,
  `    if (dialogueOpen && elapsed >= 24.5 && elapsed < 29.4) targetLook.lerp(MARA_LOOK, 0.82)`,
  'dialogue look timing',
)

source = replaceOnce(
  source,
  `        <Box position={[1.62, 1.9, -2.65]} size={[0.16, 3.8, 2.1]} color="#bfa78f" />
        <Box position={[2.8, 3.62, -2.65]} size={[2.5, 0.34, 2.1]} color="#bfa78f" />
`,
  ``,
  'bathroom divider wall',
)

source = replaceOnce(
  source,
  `        <mesh position={[0, 1.7, -4.13]} rotation={[0, 0, 0]}>
          <planeGeometry args={[1.88, 3.35]} />
          <meshBasicMaterial color="#dce8d5" toneMapped={false} />
        </mesh>
`,
  ``,
  'apartment doorway plane',
)

source = replacePattern(
  source,
  /function CafeFacade\(\{ elapsed \}\) \{[\s\S]*?\n\}\n\nfunction CafeInterior/,
  `function CafeFacade({ elapsed, active }) {
  const cafeDoorProgress = clamp01((elapsed - 28.75) / 0.9)
  const maraMode = elapsed >= 24 && elapsed < 29.2 ? 'wave' : 'idle'

  return (
    <group>
      <Box position={[-4.15, 2.6, -73.6]} size={[5.7, 5.2, 0.32]} color="#724f46" />
      <Box position={[4.15, 2.6, -73.6]} size={[5.7, 5.2, 0.32]} color="#724f46" />
      <Box position={[0, 4.35, -73.6]} size={[2.6, 1.7, 0.32]} color="#724f46" />
      <Box position={[-4.6, 2.25, -73.38]} size={[3.6, 3.6, 0.08]} color="#adc1bf" opacity={0.62} />
      <Box position={[4.6, 2.25, -73.38]} size={[3.6, 3.6, 0.08]} color="#adc1bf" opacity={0.62} />
      <Box position={[0, 4.25, -73.22]} size={[13.8, 0.48, 0.65]} color="#d1a55f" />
      <Label text="CAFÉ" position={[0, 4.38, -72.86]} size={[3.9, 1.08]} />
      <Door position={[-0.95, 0, -73.25]} color="#4f5961" progress={cafeDoorProgress} openAngle={Math.PI * 0.5} />
      <Box position={[0, 0.02, -72.9]} size={[2.6, 0.08, 1.1]} color="#8f725c" />

      <AnimatedPerson
        position={[-2.2, 0, -70.9]}
        rotation={[0, Math.PI, 0]}
        color="#a65d63"
        accent="#493e4a"
        mode={maraMode}
        active={active}
        phase={0.3}
      />
    </group>
  )
}

function CafeInterior`,
  'cafe facade',
)

source = replaceOnce(
  source,
  `  const maraMode = elapsed >= 25 && elapsed < 31 ? 'wave' : 'idle'
  const chairSlide = smoothstep((elapsed - 40.5) / 3)`,
  `  const chairSlide = smoothstep((elapsed - 40.5) / 3)`,
  'interior Mara mode',
)

source = replacePattern(
  source,
  /\n      <AnimatedPerson\n        position=\{\[-1, 0, -92\.1\]\}[\s\S]*?phase=\{0\.3\}\n      \/>\n/,
  `\n`,
  'interior Mara model',
)

source = replaceOnce(
  source,
  `        <CafeFacade elapsed={elapsed} />`,
  `        <CafeFacade elapsed={elapsed} active={active && cafeVisible} />`,
  'CafeFacade world call',
)

fs.writeFileSync(path, source)
