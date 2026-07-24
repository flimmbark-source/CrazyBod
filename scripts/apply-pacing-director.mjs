import fs from 'node:fs'

const path = 'src/App.jsx'
let source = fs.readFileSync(path, 'utf8')

function replaceOnce(search, replacement, label) {
  if (!source.includes(search)) throw new Error(`Could not find ${label}`)
  source = source.replace(search, replacement)
}

replaceOnce(
  "import * as THREE from 'three'\n\nconst DAY_LENGTH = 50\nconst OVERLOAD_LIMIT = 6\nconst SCORE_PER_SECOND = 10\nconst TUTORIAL_STORAGE_KEY = 'crazybod:tutorial-complete'\nconst TUTORIAL_FIRST_ID = 'fatigue-0'\nconst TUTORIAL_SECOND_ID = 'brainFog-1'\n\nconst MICROGAME_SCRIPT = [\n  { at: 2.5, kind: 'fatigue' },\n  { at: 8.5, kind: 'brainFog' },\n  { at: 13, kind: 'discomfort' },\n  { at: 16.5, kind: 'anxiety' },\n  { at: 16.5, kind: 'fatigue' },\n  { at: 20, kind: 'brainFog' },\n  { at: 22.5, kind: 'discomfort' },\n  { at: 22.5, kind: 'anxiety' },\n  { at: 26.5, kind: 'fatigue' },\n  { at: 28.5, kind: 'brainFog' },\n  { at: 30.5, kind: 'discomfort' },\n  { at: 30.5, kind: 'anxiety' },\n  { at: 33, kind: 'fatigue' },\n  { at: 35, kind: 'brainFog' },\n  { at: 35, kind: 'discomfort' },\n  { at: 37, kind: 'anxiety' },\n  { at: 39, kind: 'fatigue' },\n  { at: 39, kind: 'brainFog' },\n  { at: 41, kind: 'discomfort' },\n  { at: 43, kind: 'anxiety' },\n  { at: 43, kind: 'fatigue' },\n  { at: 45, kind: 'brainFog' },\n  { at: 46.5, kind: 'discomfort' },\n  { at: 46.5, kind: 'anxiety' },\n  { at: 48, kind: 'fatigue' },\n  { at: 48, kind: 'brainFog' },\n]\n",
  "import * as THREE from 'three'\nimport { TUTORIAL_SEQUENCE } from './pacingConfig.js'\nimport {\n  createPacingDirector,\n  initializePacingDirector,\n  takeSpawnBatch,\n} from './pacingDirector.js'\n\nconst DAY_LENGTH = 50\nconst OVERLOAD_LIMIT = 6\nconst SCORE_PER_SECOND = 10\nconst TUTORIAL_STORAGE_KEY = 'crazybod:tutorial-complete'\n",
  'scripted pacing constants',
)

replaceOnce(
  "  const [tutorialRun, setTutorialRun] = useState(false)\n  const [tutorialStep, setTutorialStep] = useState('none')\n  const startTimeRef = useRef(0)\n  const spawnedRef = useRef(new Set())\n  const resolvedGamesRef = useRef(new Set())\n  const completionEffectIdRef = useRef(0)\n  const pauseStartedRef = useRef(null)\n  const pausedDurationRef = useRef(0)\n  const tutorialFirstSeenRef = useRef(false)\n  const tutorialSecondSeenRef = useRef(false)\n",
  "  const [tutorialRun, setTutorialRun] = useState(false)\n  const [tutorialStep, setTutorialStep] = useState('none')\n  const [directorReady, setDirectorReady] = useState(false)\n  const startTimeRef = useRef(0)\n  const directorRef = useRef(createPacingDirector())\n  const spawnCounterRef = useRef(0)\n  const microgamesRef = useRef([])\n  const resolvedGamesRef = useRef(new Set())\n  const completionEffectIdRef = useRef(0)\n  const pauseStartedRef = useRef(null)\n  const pausedDurationRef = useRef(0)\n  const tutorialFirstSeenRef = useRef(false)\n  const tutorialSecondSeenRef = useRef(false)\n",
  'pacing refs',
)

replaceOnce(
  "  const beginGame = useCallback((withTutorial) => {\n    startTimeRef.current = performance.now()\n    pausedDurationRef.current = 0\n    pauseStartedRef.current = null\n    spawnedRef.current = new Set()\n    resolvedGamesRef.current = new Set()\n    tutorialFirstSeenRef.current = false\n    tutorialSecondSeenRef.current = false\n    setElapsed(0)\n    setMicrogames([])\n    setCompletionEffects([])\n    setDialogueOpen(false)\n    setDialogueAnswered(false)\n    setFinalScore(0)\n    setTutorialRun(withTutorial)\n    setTutorialStep('none')\n    setStatus('playing')\n  }, [])\n",
  "  const beginGame = useCallback((withTutorial) => {\n    const seed = (Date.now() ^ Math.floor(performance.now() * 1000)) >>> 0\n    startTimeRef.current = performance.now()\n    pausedDurationRef.current = 0\n    pauseStartedRef.current = null\n    directorRef.current = createPacingDirector(seed)\n    spawnCounterRef.current = 0\n    microgamesRef.current = []\n    resolvedGamesRef.current = new Set()\n    tutorialFirstSeenRef.current = false\n    tutorialSecondSeenRef.current = false\n    setElapsed(0)\n    setMicrogames([])\n    setCompletionEffects([])\n    setDialogueOpen(false)\n    setDialogueAnswered(false)\n    setFinalScore(0)\n    setTutorialRun(withTutorial)\n    setTutorialStep('none')\n    setDirectorReady(!withTutorial)\n    setStatus('playing')\n  }, [])\n",
  'beginGame reset',
)

replaceOnce(
  "  const toggleTutorial = () => {\n    setTutorialEnabled((current) => {\n      const next = !current\n      try {\n        if (next) window.localStorage.removeItem(TUTORIAL_STORAGE_KEY)\n        else window.localStorage.setItem(TUTORIAL_STORAGE_KEY, 'true')\n      } catch {\n        // Keep the in-memory toggle even if storage is unavailable.\n      }\n      return next\n    })\n  }\n\n  useEffect(() => {\n    const handleTutorialRestart = () => startTutorialGame()\n",
  "  const toggleTutorial = () => {\n    setTutorialEnabled((current) => {\n      const next = !current\n      try {\n        if (next) window.localStorage.removeItem(TUTORIAL_STORAGE_KEY)\n        else window.localStorage.setItem(TUTORIAL_STORAGE_KEY, 'true')\n      } catch {\n        // Keep the in-memory toggle even if storage is unavailable.\n      }\n      return next\n    })\n  }\n\n  const spawnMicrogame = useCallback((kind, tutorialRole = null) => {\n    const index = spawnCounterRef.current\n    spawnCounterRef.current += 1\n    const game = {\n      id: `${kind}-${directorRef.current.seed}-${index}`,\n      kind,\n      tutorialRole,\n      position: positionFor(index),\n    }\n    setMicrogames((current) => {\n      const next = [...current, game]\n      microgamesRef.current = next\n      return next\n    })\n    return game\n  }, [])\n\n  useEffect(() => {\n    const handleTutorialRestart = () => startTutorialGame()\n",
  'spawn callback insertion',
)

replaceOnce(
  "  useEffect(() => {\n    if (status !== 'playing' || !tutorialRun) return\n\n    if (!tutorialFirstSeenRef.current && microgames.some((game) => game.id === TUTORIAL_FIRST_ID)) {\n      tutorialFirstSeenRef.current = true\n      setTutorialStep('first')\n      return\n    }\n\n    if (\n      tutorialFirstSeenRef.current\n      && !tutorialSecondSeenRef.current\n      && microgames.some((game) => game.id === TUTORIAL_SECOND_ID)\n    ) {\n      tutorialSecondSeenRef.current = true\n      setTutorialStep('second')\n    }\n  }, [microgames, status, tutorialRun])\n\n  useEffect(() => {\n    if (status !== 'playing') return\n\n    const due = MICROGAME_SCRIPT.filter(\n      (event, index) => elapsed >= event.at && !spawnedRef.current.has(index),\n    )\n\n    if (due.length > 0) {\n      setMicrogames((current) => {\n        const next = [...current]\n        for (const event of due) {\n          const scriptIndex = MICROGAME_SCRIPT.indexOf(event)\n          spawnedRef.current.add(scriptIndex)\n          next.push({\n            id: `${event.kind}-${scriptIndex}`,\n            kind: event.kind,\n            position: positionFor(scriptIndex),\n          })\n        }\n        return next\n      })\n    }\n\n    if (elapsed >= 25 && !dialogueAnswered) setDialogueOpen(true)\n  }, [elapsed, status, dialogueAnswered])\n",
  "  useEffect(() => {\n    if (status !== 'playing' || !tutorialRun || tutorialStep !== 'none') return\n\n    const first = TUTORIAL_SEQUENCE[0]\n    const second = TUTORIAL_SEQUENCE[1]\n\n    if (!tutorialFirstSeenRef.current && elapsed >= first.at) {\n      tutorialFirstSeenRef.current = true\n      spawnMicrogame(first.kind, first.role)\n      setTutorialStep(first.role)\n      return\n    }\n\n    if (\n      tutorialFirstSeenRef.current\n      && !tutorialSecondSeenRef.current\n      && elapsed >= second.at\n    ) {\n      tutorialSecondSeenRef.current = true\n      spawnMicrogame(second.kind, second.role)\n      setTutorialStep(second.role)\n    }\n  }, [elapsed, spawnMicrogame, status, tutorialRun, tutorialStep])\n\n  useEffect(() => {\n    if (status !== 'playing' || tutorialPaused || !directorReady) return\n\n    const director = directorRef.current\n    if (director.nextSpawnAt === null) {\n      initializePacingDirector(director, elapsed)\n      return\n    }\n    if (elapsed < director.nextSpawnAt) return\n\n    const batch = takeSpawnBatch(director, {\n      elapsed,\n      activeGames: load,\n      overloadLimit: OVERLOAD_LIMIT,\n    })\n    batch.kinds.forEach((kind) => spawnMicrogame(kind))\n  }, [directorReady, elapsed, load, spawnMicrogame, status, tutorialPaused])\n\n  useEffect(() => {\n    if (status !== 'playing') return\n    if (elapsed >= 25 && !dialogueAnswered) setDialogueOpen(true)\n  }, [elapsed, status, dialogueAnswered])\n",
  'tutorial and scripted spawn effects',
)

replaceOnce(
  "    setMicrogames((current) => current.filter((game) => game.id !== id))\n\n    if (tutorialRun && tutorialStep === 'first' && id === TUTORIAL_FIRST_ID) {\n      setTutorialStep('none')\n    }\n    if (tutorialRun && tutorialStep === 'second' && id === TUTORIAL_SECOND_ID) {\n      setTutorialStep('summary')\n    }\n  }, [tutorialRun, tutorialStep])\n",
  "    const resolvedGame = microgamesRef.current.find((game) => game.id === id)\n    setMicrogames((current) => {\n      const next = current.filter((game) => game.id !== id)\n      microgamesRef.current = next\n      return next\n    })\n\n    if (tutorialRun && tutorialStep === 'first' && resolvedGame?.tutorialRole === 'first') {\n      setTutorialStep('none')\n    }\n    if (tutorialRun && tutorialStep === 'second' && resolvedGame?.tutorialRole === 'second') {\n      setTutorialStep('summary')\n    }\n  }, [tutorialRun, tutorialStep])\n",
  'tutorial resolution roles',
)

replaceOnce(
  "    setTutorialEnabled(false)\n    setTutorialStep('none')\n  }\n\n  const tutorialTarget = tutorialStep === 'first'\n    ? microgames.find((game) => game.id === TUTORIAL_FIRST_ID)\n    : tutorialStep === 'second'\n      ? microgames.find((game) => game.id === TUTORIAL_SECOND_ID)\n      : null\n",
  "    setTutorialEnabled(false)\n    setDirectorReady(true)\n    setTutorialStep('none')\n  }\n\n  const tutorialTarget = tutorialStep === 'first' || tutorialStep === 'second'\n    ? microgames.find((game) => game.tutorialRole === tutorialStep)\n    : null\n",
  'tutorial completion and target lookup',
)

replaceOnce(
  "      data-game-id={game.id}\n      data-game-kind={game.kind}\n",
  "      data-game-id={game.id}\n      data-game-kind={game.kind}\n      data-tutorial-role={game.tutorialRole || undefined}\n",
  'tutorial role data attribute',
)

fs.writeFileSync(path, source)
