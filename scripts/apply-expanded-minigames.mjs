import fs from 'node:fs'

function replaceOnce(source, search, replacement, label) {
  if (!source.includes(search)) throw new Error(`Could not find ${label}`)
  return source.replace(search, replacement)
}

const appPath = 'src/App.jsx'
let app = fs.readFileSync(appPath, 'utf8')

app = replaceOnce(
  app,
  "import * as THREE from 'three'\n",
  "import * as THREE from 'three'\nimport { MICROGAME_NAMES as EXPANDED_MICROGAME_NAMES, NewMicrogameContent } from './minigames/catalog.jsx'\n",
  'App import anchor',
)

app = replaceOnce(
  app,
  `const MICROGAME_NAMES = {\n  discomfort: 'DISCOMFORT',\n  anxiety: 'ANXIETY',\n  brainFog: 'BRAIN FOG',\n  fatigue: 'FATIGUE',\n}\n`,
  'const MICROGAME_NAMES = EXPANDED_MICROGAME_NAMES\n',
  'microgame name registry',
)

app = replaceOnce(
  app,
  "        {game.kind === 'fatigue' && <FatigueGame onResolve={resolve} />}\n",
  "        {game.kind === 'fatigue' && <FatigueGame onResolve={resolve} />}\n        <NewMicrogameContent kind={game.kind} onResolve={resolve} />\n",
  'microgame content registry',
)

fs.writeFileSync(appPath, app)

const enhancementsPath = 'src/microgameEnhancements.js'
let enhancements = fs.readFileSync(enhancementsPath, 'utf8')

enhancements = replaceOnce(
  enhancements,
  `function setupMicrogame(windowElement) {\n  if (windowElement.dataset.enhanced === 'true') return\n  const kind = kindFor(windowElement)\n  if (!kind) return\n\n  const variant = drawVariant(kind)\n  windowElement.dataset.enhanced = 'true'\n  windowElement.dataset.variant = variant\n  windowElement.addEventListener('pointerdown', () => setActive(windowElement), { capture: true })\n  windowElement.addEventListener('focusin', () => setActive(windowElement))\n\n  if (kind === 'discomfort') setupDiscomfort(windowElement, variant)\n  if (kind === 'anxiety') setupAnxiety(windowElement, variant)\n  if (kind === 'brainFog') setupBrainFog(windowElement, variant)\n  if (kind === 'fatigue') setupFatigue(windowElement, variant)\n}\n`,
  `function setupMicrogame(windowElement) {\n  if (windowElement.dataset.enhanced === 'true') return\n  const kind = kindFor(windowElement)\n\n  windowElement.dataset.enhanced = 'true'\n  windowElement.addEventListener('pointerdown', () => setActive(windowElement), { capture: true })\n  windowElement.addEventListener('focusin', () => setActive(windowElement))\n\n  if (!kind) return\n\n  const variant = drawVariant(kind)\n  windowElement.dataset.variant = variant\n  if (kind === 'discomfort') setupDiscomfort(windowElement, variant)\n  if (kind === 'anxiety') setupAnxiety(windowElement, variant)\n  if (kind === 'brainFog') setupBrainFog(windowElement, variant)\n  if (kind === 'fatigue') setupFatigue(windowElement, variant)\n}\n`,
  'generic microgame focus setup',
)

fs.writeFileSync(enhancementsPath, enhancements)

// trigger workflow
