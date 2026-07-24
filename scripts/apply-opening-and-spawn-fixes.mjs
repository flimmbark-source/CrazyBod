import fs from 'node:fs'

function replaceOnce(source, search, replacement, label) {
  if (!source.includes(search)) throw new Error(`Could not find ${label}`)
  return source.replace(search, replacement)
}

const appPath = 'src/App.jsx'
let app = fs.readFileSync(appPath, 'utf8')

const oldPositionFor = `function positionFor(index) {
  const positions = [
    [7, 12],
    [39, 8],
    [68, 13],
    [12, 47],
    [44, 43],
    [70, 49],
    [25, 25],
    [56, 27],
  ]
  const [left, top] = positions[index % positions.length]
  return {
    left: \`${'${left + ((index * 7) % 5)}'}%\`,
    top: \`${'${top + ((index * 11) % 7)}'}%\`,
  }
}`

const newPositionFor = `function seededFraction(seed, value) {
  let next = (seed ^ Math.imul(value + 1, 0x9e3779b9)) >>> 0
  next ^= next >>> 16
  next = Math.imul(next, 0x7feb352d)
  next ^= next >>> 15
  next = Math.imul(next, 0x846ca68b)
  next ^= next >>> 16
  return (next >>> 0) / 4294967296
}

function positionFor(seed, index, existingGames) {
  let fallback = { left: 39, top: 38 }

  for (let attempt = 0; attempt < 14; attempt += 1) {
    const left = 6 + seededFraction(seed, index * 31 + attempt * 2) * 66
    const top = 15 + seededFraction(seed, index * 31 + attempt * 2 + 1) * 47
    const candidate = { left, top }
    fallback = candidate

    const separated = existingGames.every((game) => {
      const previousLeft = Number.parseFloat(game.position.left)
      const previousTop = Number.parseFloat(game.position.top)
      return Math.hypot(left - previousLeft, top - previousTop) >= 19
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
}`

app = replaceOnce(app, oldPositionFor, newPositionFor, 'fixed spawn position function')
app = replaceOnce(
  app,
  '      position: positionFor(index),',
  '      position: positionFor(directorRef.current.seed, index, microgamesRef.current),',
  'spawn position call',
)
app = replaceOnce(
  app,
  'camera={{ position: [-1.8, 0.92, 2.8], fov: 71, near: 0.08, far: 150 }}',
  'camera={{ position: [-1.8, 1.65, 3.1], fov: 68, near: 0.08, far: 150 }}',
  'initial camera position',
)

fs.writeFileSync(appPath, app)

const journeyPath = 'src/world/JourneyScene.jsx'
let journey = fs.readFileSync(journeyPath, 'utf8')

const oldPlayerPath = `const PLAYER_PATH = [
  { at: 0, position: [-1.8, 0.92, 2.8], look: [-1.7, 1.0, -0.5], walk: 0, fov: 71 },
  { at: 2, position: [-1.8, 1.06, 2.2], look: [1.8, 1.12, 0.0], walk: 0, fov: 70 },
  { at: 5, position: [-1.3, 1.48, 1.2], look: [2.4, 1.38, -1.5], walk: 0.15, fov: 68 },
  { at: 8, position: [1.6, 1.65, -1.2], look: [2.9, 1.45, -2.0], walk: 0.25, fov: 67 },
  { at: 11, position: [0.8, 1.65, -5.2], look: [0, 1.45, -10], walk: 0.55, fov: 67 },
  { at: 16, position: [0, 1.65, -15], look: [0, 1.48, -23], walk: 0.8, fov: 67 },
  { at: 20, position: [-0.4, 1.65, -37], look: [0, 1.42, -45], walk: 1, fov: 68 },
  { at: 25, position: [0, 1.65, -68], look: [0, 1.55, -75], walk: 1, fov: 68 },
  { at: 28, position: [0, 1.65, -77], look: [0, 1.5, -87], walk: 0.65, fov: 67 },
  { at: 32, position: [-0.8, 1.65, -87], look: [-1, 1.48, -92], walk: 0.25, fov: 66 },
  { at: 37, position: [-0.8, 1.65, -87.2], look: [-1, 1.45, -92], walk: 0, fov: 65 },
  { at: 40, position: [1.8, 1.65, -87], look: [4.2, 1.2, -89.5], walk: 0.45, fov: 66 },
  { at: 43, position: [4.2, 1.65, -87.8], look: [4.2, 1.1, -90], walk: 0.35, fov: 65 },
  { at: 46, position: [4.2, 1.15, -89.2], look: [0.5, 1.3, -90], walk: 0, fov: 63 },
  { at: 50, position: [4.2, 1.15, -89.2], look: [0.5, 1.25, -90], walk: 0, fov: 63 },
]`

const newPlayerPath = `const PLAYER_PATH = [
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
]`

journey = replaceOnce(journey, oldPlayerPath, newPlayerPath, 'player path')
journey = replaceOnce(
  journey,
  '  const apartmentDoorProgress = clamp01((elapsed - 13) / 1.7)',
  '  const apartmentDoorProgress = clamp01((elapsed - 13.65) / 1.25)',
  'apartment door timing',
)

fs.writeFileSync(journeyPath, journey)
