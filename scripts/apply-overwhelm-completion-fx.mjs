import fs from 'node:fs'

const appPath = 'src/App.jsx'
const mainPath = 'src/main.jsx'
let app = fs.readFileSync(appPath, 'utf8')
let main = fs.readFileSync(mainPath, 'utf8')

function replaceOnce(source, needle, replacement, label) {
  if (!source.includes(needle)) {
    if (source.includes(replacement)) return source
    throw new Error(`Could not find ${label}`)
  }
  return source.replace(needle, replacement)
}

const oldPacing = `const DAY_LENGTH = 92
const OVERLOAD_LIMIT = 6
const SCORE_PER_SECOND = 10

const MICROGAME_SCRIPT = [
  { at: 5, kind: 'fatigue' },
  { at: 11, kind: 'brainFog' },
  { at: 18, kind: 'discomfort' },
  { at: 27, kind: 'anxiety' },
  { at: 34, kind: 'brainFog' },
  { at: 41, kind: 'discomfort' },
  { at: 48, kind: 'fatigue' },
  { at: 55, kind: 'anxiety' },
  { at: 61, kind: 'brainFog' },
  { at: 67, kind: 'discomfort' },
  { at: 72, kind: 'anxiety' },
  { at: 77, kind: 'fatigue' },
  { at: 82, kind: 'brainFog' },
  { at: 87, kind: 'anxiety' },
]`

const newPacing = `const DAY_LENGTH = 50
const OVERLOAD_LIMIT = 6
const SCORE_PER_SECOND = 10

const MICROGAME_SCRIPT = [
  { at: 2.5, kind: 'fatigue' },
  { at: 8.5, kind: 'brainFog' },
  { at: 13, kind: 'discomfort' },
  { at: 16.5, kind: 'anxiety' },
  { at: 16.5, kind: 'fatigue' },
  { at: 20, kind: 'brainFog' },
  { at: 22.5, kind: 'discomfort' },
  { at: 22.5, kind: 'anxiety' },
  { at: 26.5, kind: 'fatigue' },
  { at: 28.5, kind: 'brainFog' },
  { at: 30.5, kind: 'discomfort' },
  { at: 30.5, kind: 'anxiety' },
  { at: 33, kind: 'fatigue' },
  { at: 35, kind: 'brainFog' },
  { at: 35, kind: 'discomfort' },
  { at: 37, kind: 'anxiety' },
  { at: 39, kind: 'fatigue' },
  { at: 39, kind: 'brainFog' },
  { at: 41, kind: 'discomfort' },
  { at: 43, kind: 'anxiety' },
  { at: 43, kind: 'fatigue' },
  { at: 45, kind: 'brainFog' },
  { at: 46.5, kind: 'discomfort' },
  { at: 46.5, kind: 'anxiety' },
  { at: 48, kind: 'fatigue' },
  { at: 48, kind: 'brainFog' },
]`

app = replaceOnce(app, oldPacing, newPacing, 'pacing script')

app = replaceOnce(
  app,
  `function getPhase(elapsed) {
  if (elapsed < 12) return 'WAKING UP'
  if (elapsed < 28) return 'GETTING READY'
  if (elapsed < 61) return 'WALKING TO THE CAFÉ'
  if (elapsed < 84) return 'ORDERING'
  return 'SITTING DOWN'
}`,
  `function getPhase(elapsed) {
  if (elapsed < 8) return 'WAKING UP'
  if (elapsed < 16) return 'GETTING READY'
  if (elapsed < 25) return 'WALKING TO THE CAFÉ'
  if (elapsed < 42) return 'ORDERING'
  return 'SITTING DOWN'
}`,
  'phase timing',
)

app = replaceOnce(
  app,
  `const DIALOGUE = {`,
  `const COMPLETION_SHARDS = [
  { dx: '-118px', dy: '-78px', start: '-12deg', end: '-185deg', width: '34px', height: '20px' },
  { dx: '-52px', dy: '-116px', start: '8deg', end: '215deg', width: '24px', height: '38px' },
  { dx: '40px', dy: '-122px', start: '-5deg', end: '165deg', width: '42px', height: '18px' },
  { dx: '118px', dy: '-66px', start: '14deg', end: '224deg', width: '29px', height: '30px' },
  { dx: '132px', dy: '22px', start: '-8deg', end: '-160deg', width: '45px', height: '19px' },
  { dx: '72px', dy: '92px', start: '6deg', end: '198deg', width: '26px', height: '35px' },
  { dx: '-34px', dy: '112px', start: '-15deg', end: '-210deg', width: '39px', height: '21px' },
  { dx: '-126px', dy: '54px', start: '11deg', end: '175deg', width: '28px', height: '32px' },
]

const DIALOGUE = {`,
  'completion shard constants',
)

app = replaceOnce(
  app,
  `  const [finalScore, setFinalScore] = useState(0)
  const startTimeRef = useRef(0)
  const spawnedRef = useRef(new Set())`,
  `  const [finalScore, setFinalScore] = useState(0)
  const [completionEffects, setCompletionEffects] = useState([])
  const startTimeRef = useRef(0)
  const spawnedRef = useRef(new Set())
  const resolvedGamesRef = useRef(new Set())
  const completionEffectIdRef = useRef(0)`,
  'completion state',
)

app = replaceOnce(
  app,
  `    spawnedRef.current = new Set()
    setElapsed(0)
    setMicrogames([])`,
  `    spawnedRef.current = new Set()
    resolvedGamesRef.current = new Set()
    setElapsed(0)
    setMicrogames([])
    setCompletionEffects([])`,
  'completion reset',
)

app = replaceOnce(app, `if (elapsed >= 64 && !dialogueAnswered) setDialogueOpen(true)`, `if (elapsed >= 25 && !dialogueAnswered) setDialogueOpen(true)`, 'dialogue timing')

app = replaceOnce(
  app,
  `  const resolveMicrogame = useCallback((id) => {
    setMicrogames((current) => current.filter((game) => game.id !== id))
  }, [])`,
  `  const resolveMicrogame = useCallback((id) => {
    if (resolvedGamesRef.current.has(id)) return
    resolvedGamesRef.current.add(id)

    const gameElement = document.querySelector(\`[data-game-id="\${id}"]\`)
    const rect = gameElement?.getBoundingClientRect()
    if (rect && rect.width > 0 && rect.height > 0) {
      const effectId = completionEffectIdRef.current
      completionEffectIdRef.current += 1
      setCompletionEffects((current) => [
        ...current,
        {
          id: effectId,
          kind: gameElement.dataset.gameKind || 'discomfort',
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        },
      ])
      window.setTimeout(() => {
        setCompletionEffects((current) => current.filter((effect) => effect.id !== effectId))
      }, 900)
    }

    setMicrogames((current) => current.filter((game) => game.id !== id))
  }, [])`,
  'completion resolver',
)

app = replaceOnce(
  app,
  `          </section>

          {dialogueOpen && (`,
  `          </section>

          <section className="completion-fx-layer" aria-hidden="true">
            {completionEffects.map((effect) => (
              <CompletionBurst key={effect.id} effect={effect} />
            ))}
          </section>

          {dialogueOpen && (`,
  'completion layer',
)

app = replaceOnce(
  app,
  `function MicrogameWindow({ game, index, load, onResolve }) {`,
  `function CompletionBurst({ effect }) {
  return (
    <div
      className={\`completion-burst kind-\${effect.kind}\`}
      style={{ '--burst-x': \`\${effect.x}px\`, '--burst-y': \`\${effect.y}px\` }}
    >
      <span className="completion-flash" />
      {COMPLETION_SHARDS.map((shard, index) => (
        <span
          key={index}
          className="completion-shard"
          style={{
            '--dx': shard.dx,
            '--dy': shard.dy,
            '--start-rotation': shard.start,
            '--end-rotation': shard.end,
            '--shard-width': shard.width,
            '--shard-height': shard.height,
          }}
        />
      ))}
      <strong className="completion-get">GET!</strong>
    </div>
  )
}

function MicrogameWindow({ game, index, load, onResolve }) {`,
  'completion component',
)

app = replaceOnce(
  app,
  `      className={\`microgame microgame-\${game.kind}\`}
      style={{`,
  `      className={\`microgame microgame-\${game.kind}\`}
      data-game-id={game.id}
      data-game-kind={game.kind}
      style={{`,
  'microgame data attributes',
)

if (!main.includes("import './completionEffects.css'")) {
  main = replaceOnce(main, "import './microgameEnhancements.css'", "import './microgameEnhancements.css'\nimport './completionEffects.css'", 'completion stylesheet import')
}

fs.writeFileSync(appPath, app)
fs.writeFileSync(mainPath, main)
console.log('Applied rapid overwhelm pacing and completion FX.')
