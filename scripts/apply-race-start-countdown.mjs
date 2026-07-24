import fs from 'node:fs'

function replaceOnce(source, search, replacement, label) {
  if (!source.includes(search)) throw new Error(`Could not find ${label}`)
  return source.replace(search, replacement)
}

const appPath = 'src/App.jsx'
let app = fs.readFileSync(appPath, 'utf8')

app = replaceOnce(
  app,
  "const TUTORIAL_STORAGE_KEY = 'crazybod:tutorial-complete'",
  "const TUTORIAL_STORAGE_KEY = 'crazybod:tutorial-complete'\nconst READY_CUE_MS = 1150\nconst START_CUE_MS = 650",
  'tutorial storage constant',
)

app = replaceOnce(
  app,
  "  const [directorReady, setDirectorReady] = useState(false)\n  const startTimeRef = useRef(0)",
  "  const [directorReady, setDirectorReady] = useState(false)\n  const [startCue, setStartCue] = useState(null)\n  const startTimeRef = useRef(0)",
  'director state',
)

app = replaceOnce(
  app,
  "  const score = Math.floor(elapsed * SCORE_PER_SECOND)\n  const load = microgames.length",
  "  const score = Math.floor(elapsed * SCORE_PER_SECOND)\n  const remainingTime = Math.max(0, Math.ceil(DAY_LENGTH - elapsed))\n  const load = microgames.length",
  'score calculation',
)

app = replaceOnce(
  app,
  "    startTimeRef.current = performance.now()",
  "    startTimeRef.current = 0",
  'game start timestamp',
)

app = replaceOnce(
  app,
  "    setTutorialStep('none')\n    setDirectorReady(!withTutorial)\n    setStatus('playing')",
  "    setTutorialStep('none')\n    setDirectorReady(!withTutorial)\n    setStartCue('ready')\n    setStatus('countdown')",
  'begin game state',
)

const toggleBlock = `  const toggleTutorial = () => {
    setTutorialEnabled((current) => {
      const next = !current
      try {
        if (next) window.localStorage.removeItem(TUTORIAL_STORAGE_KEY)
        else window.localStorage.setItem(TUTORIAL_STORAGE_KEY, 'true')
      } catch {
        // Keep the in-memory toggle even if storage is unavailable.
      }
      return next
    })
  }
`

const startEffects = `${toggleBlock}
  useEffect(() => {
    if (status !== 'countdown') return undefined

    const timer = window.setTimeout(() => {
      startTimeRef.current = performance.now()
      pausedDurationRef.current = 0
      pauseStartedRef.current = null
      setStartCue('start')
      setStatus('playing')
    }, READY_CUE_MS)

    return () => window.clearTimeout(timer)
  }, [status])

  useEffect(() => {
    if (startCue !== 'start') return undefined
    const timer = window.setTimeout(() => setStartCue(null), START_CUE_MS)
    return () => window.clearTimeout(timer)
  }, [startCue])
`

app = replaceOnce(app, toggleBlock, startEffects, 'tutorial toggle block')

app = replaceOnce(
  app,
  "              <span className=\"hud-label\">OUT</span>\n              <strong>{Math.floor(elapsed)}s</strong>",
  "              <span className=\"hud-label\">TIME</span>\n              <strong>{remainingTime}s</strong>",
  'HUD time panel',
)

app = replaceOnce(
  app,
  `      </div>\n\n      {status === 'playing' && (`,
  `      </div>\n\n      {startCue && (\n        <section\n          className={\`race-start-cue race-start-cue-\${startCue}\`}\n          aria-live=\"assertive\"\n          aria-atomic=\"true\"\n        >\n          <strong key={startCue}>{startCue === 'ready' ? 'Ready?' : 'START!'}</strong>\n        </section>\n      )}\n\n      {status === 'playing' && (`,
  'start cue insertion point',
)

app = replaceOnce(
  app,
  "      {status !== 'intro' && status !== 'playing' && (",
  "      {!['intro', 'countdown', 'playing'].includes(status) && (",
  'end card condition',
)

fs.writeFileSync(appPath, app)

const mainPath = 'src/main.jsx'
let main = fs.readFileSync(mainPath, 'utf8')
main = replaceOnce(
  main,
  "import './minigames.css'",
  "import './minigames.css'\nimport './startSequence.css'",
  'main stylesheet imports',
)
fs.writeFileSync(mainPath, main)
