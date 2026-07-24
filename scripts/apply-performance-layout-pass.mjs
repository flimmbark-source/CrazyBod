import fs from 'node:fs'

function replaceOnce(source, search, replacement, label) {
  if (!source.includes(search)) throw new Error(`Could not find ${label}`)
  return source.replace(search, replacement)
}

function replacePattern(source, pattern, replacement, label) {
  if (!pattern.test(source)) throw new Error(`Could not find ${label}`)
  return source.replace(pattern, replacement)
}

const appPath = 'src/App.jsx'
let app = fs.readFileSync(appPath, 'utf8')

app = replaceOnce(
  app,
  "import { useCallback, useEffect, useMemo, useRef, useState } from 'react'",
  "import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'",
  'React imports',
)

app = replacePattern(
  app,
  /function positionFor\(seed, index, existingGames\) \{[\s\S]*?\n\}\n\nfunction scrambleText/,
  `function microgameViewportSize() {
  const viewportWidth = Math.max(window.innerWidth || 0, 320)
  const viewportHeight = Math.max(window.innerHeight || 0, 480)
  const compact = viewportWidth <= 820
  const width = compact
    ? Math.min(220, viewportWidth * 0.72)
    : Math.min(252, Math.max(232, viewportWidth * 0.24))
  const height = compact
    ? 178
    : Math.min(202, Math.max(184, viewportHeight * 0.24))

  return { viewportWidth, viewportHeight, width, height, compact }
}

function positionFor(seed, index, existingGames) {
  const { viewportWidth, viewportHeight, width, height, compact } = microgameViewportSize()
  const minimumLeft = compact ? 2.5 : 3
  const maximumLeft = Math.max(
    minimumLeft,
    ((viewportWidth - width - 10) / viewportWidth) * 100,
  )
  const minimumTop = compact ? 18 : 15
  const maximumTop = Math.max(
    minimumTop,
    ((viewportHeight - height - 14) / viewportHeight) * 100,
  )
  let fallback = { left: minimumLeft, top: minimumTop }

  for (let attempt = 0; attempt < 14; attempt += 1) {
    const left = minimumLeft
      + seededFraction(seed, index * 31 + attempt * 2) * (maximumLeft - minimumLeft)
    const top = minimumTop
      + seededFraction(seed, index * 31 + attempt * 2 + 1) * (maximumTop - minimumTop)
    const candidate = { left, top }
    fallback = candidate

    const separated = existingGames.every((game) => {
      const previousLeft = Number.parseFloat(game.position.left)
      const previousTop = Number.parseFloat(game.position.top)
      const horizontalDistance = ((left - previousLeft) / 100) * viewportWidth
      const verticalDistance = ((top - previousTop) / 100) * viewportHeight
      return Math.hypot(horizontalDistance, verticalDistance) >= Math.min(width, height) * 0.78
    })

    if (separated) {
      return {
        left: \`${'${left.toFixed(1)}'}%\`,
        top: \`${'${top.toFixed(1)}'}%\`,
      }
    }
  }

  return {
    left: \`${'${fallback.left.toFixed(1)}'}%\`,
    top: \`${'${fallback.top.toFixed(1)}'}%\`,
  }
}

function scrambleText`,
  'spawn position function',
)

app = replaceOnce(
  app,
  '<Canvas shadows camera={{ position: [-1.8, 1.65, 3.1], fov: 68, near: 0.08, far: 150 }} dpr={[1, 1.5]}>',
  `<Canvas
          shadows="basic"
          camera={{ position: [-1.8, 1.65, 3.1], fov: 68, near: 0.08, far: 150 }}
          dpr={[1, 1.25]}
          gl={{
            antialias: false,
            alpha: false,
            stencil: false,
            powerPreference: 'high-performance',
            precision: 'mediump',
          }}
          performance={{ min: 0.6 }}
        >`,
  'Canvas configuration',
)

app = replaceOnce(
  app,
  'function MicrogameWindow({ game, index, load, tutorialTarget, onResolve }) {',
  'const MicrogameWindow = memo(function MicrogameWindow({ game, index, load, tutorialTarget, onResolve }) {',
  'MicrogameWindow declaration',
)

app = replaceOnce(
  app,
  `  )
}

function DiscomfortGame`,
  `  )
})

function DiscomfortGame`,
  'MicrogameWindow closing',
)

fs.writeFileSync(appPath, app)

const sharedPath = 'src/minigames/shared.jsx'
let shared = fs.readFileSync(sharedPath, 'utf8')
shared = replacePattern(
  shared,
  /export function useAnimationFrame\(callback, active = true\) \{[\s\S]*?\n\}\n\nexport function useMicrogameKeys/,
  `export function useAnimationFrame(callback, active = true, framesPerSecond = 30) {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    if (!active) return undefined
    let frame = 0
    let previous = performance.now()
    let accumulated = 0
    const frameInterval = 1000 / Math.max(1, framesPerSecond)

    const tick = (now) => {
      const rawDelta = Math.min(now - previous, 80)
      previous = now
      accumulated += rawDelta

      if (accumulated >= frameInterval) {
        const delta = Math.min(accumulated, 80)
        accumulated %= frameInterval
        callbackRef.current(now, delta)
      }

      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [active, framesPerSecond])
}

export function useMicrogameKeys`,
  'animation frame hook',
)
fs.writeFileSync(sharedPath, shared)

const stylesPath = 'src/styles.css'
let styles = fs.readFileSync(stylesPath, 'utf8')
styles = replaceOnce(
  styles,
  `  background: #1a1821;
  isolation: isolate;
}`,
  `  background: #1a1821;
  isolation: isolate;
  --microgame-width: clamp(232px, 24vw, 252px);
  --microgame-height: clamp(184px, 24vh, 202px);
}`,
  'game shell variables',
)

styles = replacePattern(
  styles,
  /\.microgame \{[\s\S]*?\n\}\n\n\.microgame-header/,
  `.microgame {
  position: absolute;
  display: grid;
  grid-template-rows: 31px minmax(0, 1fr);
  width: var(--microgame-width);
  min-width: 0;
  height: var(--microgame-height);
  min-height: 0;
  overflow: hidden;
  contain: layout style;
  isolation: isolate;
  border: 3px solid #282331;
  border-radius: 11px;
  color: #282331;
  background: #f4ebdf;
  box-shadow: 7px 8px 0 rgba(40, 35, 49, 0.72);
  pointer-events: auto;
  transform: rotate(calc((var(--window-index) - 2) * 0.35deg));
  animation: window-arrive 180ms cubic-bezier(.2,.9,.35,1.2);
}

.microgame-header`,
  'microgame container',
)

styles = replaceOnce(
  styles,
  `.microgame-header {
  height: 29px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 9px;
  border-bottom: 3px solid #282331;
  color: #fffaf4;
  background: #6b5d76;
  font-size: 10px;
  font-weight: 950;
  letter-spacing: 0.12em;
}`,
  `.microgame-header {
  min-width: 0;
  min-height: 31px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 10px;
  border-bottom: 3px solid #282331;
  color: #fffaf4;
  background: #6b5d76;
  font-size: 10px;
  font-weight: 950;
  letter-spacing: 0.1em;
}
.microgame-header span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }`,
  'microgame header',
)

styles = replaceOnce(
  styles,
  '.microgame-body { height: calc(100% - 29px); padding: 10px; }',
  `.microgame-body {
  min-width: 0;
  min-height: 0;
  display: grid;
  overflow: hidden;
  padding: 10px 11px 11px;
}
.microgame-body > * { min-width: 0; min-height: 0; }`,
  'microgame body',
)

styles = replaceOnce(
  styles,
  '  .microgame { width: 210px; min-width: 0; height: 165px; }',
  `  .game-shell {
    --microgame-width: min(220px, 72vw);
    --microgame-height: 178px;
  }`,
  'compact microgame sizing',
)
fs.writeFileSync(stylesPath, styles)

const compatPath = 'src/compat.css'
fs.writeFileSync(compatPath, `.microgame:nth-child(odd) { transform: rotate(-0.45deg); }
.microgame:nth-child(even) { transform: rotate(0.45deg); }

.load-0 .microgame,
.load-1 .microgame,
.load-2 .microgame,
.load-3 .microgame {
  animation: window-arrive 180ms cubic-bezier(.2,.9,.35,1.2);
}
.load-4 .microgame {
  animation: window-arrive 180ms cubic-bezier(.2,.9,.35,1.2), crowd-jitter 0.34s steps(2) infinite;
}
.load-5 .microgame {
  animation: window-arrive 180ms cubic-bezier(.2,.9,.35,1.2), crowd-jitter 0.22s steps(2) infinite;
}

@keyframes crowd-jitter {
  0%, 100% { translate: 0 0; }
  25% { translate: 1px -1px; }
  50% { translate: -1px 0; }
  75% { translate: 1px 1px; }
}

.distortion-2 .dialogue-options button:nth-child(1) { transform: translate(-5px, 0) rotate(-1deg); }
.distortion-2 .dialogue-options button:nth-child(2) { transform: translate(0, 4px); }
.distortion-2 .dialogue-options button:nth-child(3) { transform: translate(5px, 0) rotate(1deg); }
`)

const minigamesPath = 'src/minigames.css'
let minigames = fs.readFileSync(minigamesPath, 'utf8')
const normalizedLayout = `/* Shared sizing keeps all twenty-four games inside the same body box. */
.new-minigame {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  gap: 6px;
}

.new-minigame > * { min-width: 0; }
.new-minigame > small {
  min-height: 11px;
  line-height: 1.15;
  font-size: 9px;
}
.new-minigame button {
  min-height: 30px;
  padding: 4px 8px;
  line-height: 1.05;
}
.mini-button-row { min-height: 30px; align-items: center; }
.mini-progress { flex: none; height: 9px; }

.tremor-field,
.pressure-field,
.joint-field,
.spiral-field { height: min(92px, 100%); min-height: 54px; }

.balance-track,
.horizon { flex: none; }
.memory-sequence,
.thought-sequence,
.two-eyes,
.beat-pips,
.pins-grid { max-width: 100%; }
.thought-popup { min-height: 0; padding: 8px; }
.checking-switches,
.switch-grid,
.packing-grid,
.thought-options,
.afterimage-options { min-height: 0; }

`
minigames = replaceOnce(
  minigames,
  '@media (max-width: 760px) {',
  `${normalizedLayout}@media (max-width: 760px) {`,
  'minigame responsive marker',
)
fs.writeFileSync(minigamesPath, minigames)

const worldPath = 'src/world/JourneyScene.jsx'
let world = fs.readFileSync(worldPath, 'utf8')
world = replaceOnce(
  world,
  "const MARA_LOOK = new THREE.Vector3(-1, 1.45, -92)",
  "const MARA_LOOK = new THREE.Vector3(-1, 1.45, -92)\nconst SHARED_BOX_GEOMETRY = new THREE.BoxGeometry(1, 1, 1)",
  'world constants',
)

world = replacePattern(
  world,
  /function Box\(\{ position, size, color, rotation = \[0, 0, 0\], castShadow = true, receiveShadow = true, opacity = 1 \}\) \{[\s\S]*?\n\}/,
  `function Box({ position, size, color, rotation = [0, 0, 0], castShadow, receiveShadow, opacity = 1 }) {
  const shouldCastShadow = castShadow ?? (
    size[1] > 0.3 && size[0] < 9 && size[2] < 9
  )
  const shouldReceiveShadow = receiveShadow ?? size[1] <= 0.3

  return (
    <mesh
      position={position}
      rotation={rotation}
      scale={size}
      geometry={SHARED_BOX_GEOMETRY}
      castShadow={shouldCastShadow}
      receiveShadow={shouldReceiveShadow}
      dispose={null}
    >
      <meshStandardMaterial
        color={color}
        roughness={0.82}
        transparent={opacity < 1}
        opacity={opacity}
        depthWrite={opacity >= 1}
      />
    </mesh>
  )
}`,
  'Box component',
)

world = replaceOnce(
  world,
  `      <pointLight position={[0, 2.7, 0]} color={color} intensity={1.2} distance={8} decay={2} />\n`,
  '',
  'lamp point light',
)

world = replaceOnce(
  world,
  `function World({ elapsed, active }) {
  return (
    <group>
      <Bedroom elapsed={elapsed} />
      <Street active={active} />
      <CafeFacade elapsed={elapsed} />
      <CafeInterior elapsed={elapsed} active={active} />
    </group>
  )
}`,
  `function World({ elapsed, active }) {
  const bedroomVisible = elapsed < 19
  const streetVisible = elapsed >= 10 && elapsed < 35
  const cafeVisible = elapsed >= 18

  return (
    <group>
      <group visible={bedroomVisible}>
        <Bedroom elapsed={elapsed} />
      </group>
      <group visible={streetVisible}>
        <Street active={active && streetVisible} />
      </group>
      <group visible={cafeVisible}>
        <CafeFacade elapsed={elapsed} />
        <CafeInterior elapsed={elapsed} active={active && cafeVisible} />
      </group>
    </group>
  )
}`,
  'World visibility groups',
)

world = replaceOnce(
  world,
  `      <directionalLight position={[8, 14, 6]} intensity={2.1} color="#fff2d1" castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />`,
  `      <directionalLight
        position={[8, 14, 6]}
        intensity={2.1}
        color="#fff2d1"
        castShadow
        shadow-mapSize-width={512}
        shadow-mapSize-height={512}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-camera-near={1}
        shadow-camera-far={45}
      />`,
  'directional light',
)
fs.writeFileSync(worldPath, world)
