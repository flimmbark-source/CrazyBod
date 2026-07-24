import fs from 'node:fs'

const appPath = 'src/App.jsx'
let app = fs.readFileSync(appPath, 'utf8')

function replaceOnce(source, search, replacement, label) {
  if (!source.includes(search)) throw new Error(`Could not find ${label}`)
  return source.replace(search, replacement)
}

app = replaceOnce(
  app,
  "import * as THREE from 'three'\n",
  "import * as THREE from 'three'\nimport { AuthoredJourneyScene } from './world/JourneyScene.jsx'\n",
  'Three import',
)

app = replaceOnce(
  app,
  `        <Canvas camera={{ position: [0, 1.65, 5], fov: 67 }} dpr={[1, 1.5]}>\n          <JourneyScene elapsed={elapsed} active={status === 'playing' && !tutorialPaused} />\n        </Canvas>`,
  `        <Canvas shadows camera={{ position: [-1.8, 0.92, 2.8], fov: 71, near: 0.08, far: 150 }} dpr={[1, 1.5]}>\n          <AuthoredJourneyScene\n            elapsed={elapsed}\n            active={status === 'playing' && !tutorialPaused}\n            dialogueOpen={dialogueOpen}\n            dialogueAnswered={dialogueAnswered}\n          />\n        </Canvas>`,
  'JourneyScene Canvas',
)

fs.writeFileSync(appPath, app)
