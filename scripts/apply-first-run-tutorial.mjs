import fs from 'node:fs'

const appPath = 'src/App.jsx'
const mainPath = 'src/main.jsx'
const endScreensPath = 'src/endScreens.js'
let app = fs.readFileSync(appPath, 'utf8')
let main = fs.readFileSync(mainPath, 'utf8')
let endScreens = fs.readFileSync(endScreensPath, 'utf8')

function replaceOnce(source, needle, replacement, label) {
  if (!source.includes(needle)) throw new Error(`Could not find ${label}`)
  return source.replace(needle, replacement)
}

if (!app.includes('TUTORIAL_STORAGE_KEY')) {
  app = replaceOnce(
    app,
    `const SCORE_PER_SECOND = 10`,
    `const SCORE_PER_SECOND = 10
const TUTORIAL_STORAGE_KEY = 'crazybod:tutorial-complete'
const TUTORIAL_FIRST_ID = 'fatigue-0'
const TUTORIAL_SECOND_ID = 'brainFog-1'`,
    'tutorial constants',
  )

  app = replaceOnce(
    app,
    `  const [finalScore, setFinalScore] = useState(0)
  const [completionEffects, setCompletionEffects] = useState([])
  const startTimeRef = useRef(0)
  const spawnedRef = useRef(new Set())
  const resolvedGamesRef = useRef(new Set())
  const completionEffectIdRef = useRef(0)`,
    `  const [finalScore, setFinalScore] = useState(0)
  const [completionEffects, setCompletionEffects] = useState([])
  const [tutorialEnabled, setTutorialEnabled] = useState(() => {
    try {
      return window.localStorage.getItem(TUTORIAL_STORAGE_KEY) !== 'true'
    } catch {
      return true
    }
  })
  const [tutorialRun, setTutorialRun] = useState(false)
  const [tutorialStep, setTutorialStep] = useState('none')
  const startTimeRef = useRef(0)
  const spawnedRef = useRef(new Set())
  const resolvedGamesRef = useRef(new Set())
  const completionEffectIdRef = useRef(0)
  const pauseStartedRef = useRef(null)
  const pausedDurationRef = useRef(0)
  const tutorialFirstSeenRef = useRef(false)
  const tutorialSecondSeenRef = useRef(false)`,
    'tutorial state',
  )

  app = replaceOnce(
    app,
    `  const distortion = load >= 5 ? 3 : load >= 4 ? 2 : load >= 3 ? 1 : 0

  const startGame = useCallback(() => {
    startTimeRef.current = performance.now()
    spawnedRef.current = new Set()
    resolvedGamesRef.current = new Set()
    setElapsed(0)
    setMicrogames([])
    setCompletionEffects([])
    setDialogueOpen(false)
    setDialogueAnswered(false)
    setFinalScore(0)
    setStatus('playing')
  }, [])`,
    `  const distortion = load >= 5 ? 3 : load >= 4 ? 2 : load >= 3 ? 1 : 0
  const tutorialPaused = status === 'playing' && tutorialStep !== 'none'

  const beginGame = useCallback((withTutorial) => {
    startTimeRef.current = performance.now()
    pausedDurationRef.current = 0
    pauseStartedRef.current = null
    spawnedRef.current = new Set()
    resolvedGamesRef.current = new Set()
    tutorialFirstSeenRef.current = false
    tutorialSecondSeenRef.current = false
    setElapsed(0)
    setMicrogames([])
    setCompletionEffects([])
    setDialogueOpen(false)
    setDialogueAnswered(false)
    setFinalScore(0)
    setTutorialRun(withTutorial)
    setTutorialStep('none')
    setStatus('playing')
  }, [])

  const startGame = useCallback(() => {
    beginGame(tutorialEnabled)
  }, [beginGame, tutorialEnabled])

  const startTutorialGame = useCallback(() => {
    setTutorialEnabled(true)
    try {
      window.localStorage.removeItem(TUTORIAL_STORAGE_KEY)
    } catch {
      // Local storage is optional; the current run can still use the tutorial.
    }
    beginGame(true)
  }, [beginGame])

  const toggleTutorial = () => {
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
  }`,
    'game start flow',
  )

  app = replaceOnce(
    app,
    `  useEffect(() => {
    if (status !== 'playing') return undefined

    const timer = window.setInterval(() => {
      const nextElapsed = Math.min((performance.now() - startTimeRef.current) / 1000, DAY_LENGTH)
      setElapsed(nextElapsed)
    }, 100)

    return () => window.clearInterval(timer)
  }, [status])`,
    `  useEffect(() => {
    const handleTutorialRestart = () => startTutorialGame()
    window.addEventListener('crazybod:start-tutorial', handleTutorialRestart)
    return () => window.removeEventListener('crazybod:start-tutorial', handleTutorialRestart)
  }, [startTutorialGame])

  useEffect(() => {
    if (status !== 'playing') {
      pauseStartedRef.current = null
      return
    }

    if (tutorialPaused && pauseStartedRef.current === null) {
      pauseStartedRef.current = performance.now()
      return
    }

    if (!tutorialPaused && pauseStartedRef.current !== null) {
      pausedDurationRef.current += performance.now() - pauseStartedRef.current
      pauseStartedRef.current = null
    }
  }, [status, tutorialPaused])

  useEffect(() => {
    if (status !== 'playing' || tutorialPaused) return undefined

    const timer = window.setInterval(() => {
      const nextElapsed = Math.min(
        (performance.now() - startTimeRef.current - pausedDurationRef.current) / 1000,
        DAY_LENGTH,
      )
      setElapsed(nextElapsed)
    }, 100)

    return () => window.clearInterval(timer)
  }, [status, tutorialPaused])

  useEffect(() => {
    if (status !== 'playing' || !tutorialRun) return

    if (!tutorialFirstSeenRef.current && microgames.some((game) => game.id === TUTORIAL_FIRST_ID)) {
      tutorialFirstSeenRef.current = true
      setTutorialStep('first')
      return
    }

    if (
      tutorialFirstSeenRef.current
      && !tutorialSecondSeenRef.current
      && microgames.some((game) => game.id === TUTORIAL_SECOND_ID)
    ) {
      tutorialSecondSeenRef.current = true
      setTutorialStep('second')
    }
  }, [microgames, status, tutorialRun])`,
    'paused game clock',
  )

  app = replaceOnce(
    app,
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

    if (tutorialRun && tutorialStep === 'first' && id === TUTORIAL_FIRST_ID) {
      setTutorialStep('none')
    }
    if (tutorialRun && tutorialStep === 'second' && id === TUTORIAL_SECOND_ID) {
      setTutorialStep('summary')
    }
  }, [tutorialRun, tutorialStep])`,
    'tutorial resolution transitions',
  )

  app = replaceOnce(
    app,
    `  const answerDialogue = () => {
    setDialogueAnswered(true)
    setDialogueOpen(false)
  }

  return (`,
    `  const answerDialogue = () => {
    setDialogueAnswered(true)
    setDialogueOpen(false)
  }

  const finishTutorial = () => {
    try {
      window.localStorage.setItem(TUTORIAL_STORAGE_KEY, 'true')
    } catch {
      // The tutorial still finishes for this session without storage.
    }
    setTutorialEnabled(false)
    setTutorialStep('none')
  }

  const tutorialTarget = tutorialStep === 'first'
    ? microgames.find((game) => game.id === TUTORIAL_FIRST_ID)
    : tutorialStep === 'second'
      ? microgames.find((game) => game.id === TUTORIAL_SECOND_ID)
      : null

  return (`,
    'tutorial completion flow',
  )

  app = replaceOnce(
    app,
    `<JourneyScene elapsed={elapsed} active={status === 'playing'} />`,
    `<JourneyScene elapsed={elapsed} active={status === 'playing' && !tutorialPaused} />`,
    'paused world movement',
  )

  app = replaceOnce(
    app,
    `                load={load}
                onResolve={resolveMicrogame}`,
    `                load={load}
                tutorialTarget={tutorialTarget?.id === game.id}
                onResolve={resolveMicrogame}`,
    'tutorial microgame prop',
  )

  app = replaceOnce(
    app,
    `          </section>

          <section className="completion-fx-layer" aria-hidden="true">`,
    `          </section>

          {tutorialStep !== 'none' && (
            <TutorialCallout
              step={tutorialStep}
              target={tutorialTarget}
              onProceed={finishTutorial}
            />
          )}

          <section className="completion-fx-layer" aria-hidden="true">`,
    'tutorial callout render',
  )

  app = replaceOnce(
    app,
    `<button className="go-home" type="button" onClick={goHome}>`,
    `<button className="go-home" type="button" onClick={goHome} disabled={tutorialPaused}>`,
    'tutorial go home lock',
  )

  app = replaceOnce(
    app,
    `          <p>
            The day moves without waiting. Clear whatever surfaces, stay out for points,
            and go home before everything becomes too much.
          </p>
          <button type="button" onClick={startGame}>START THE DAY</button>`,
    `          <p>
            The day moves without waiting. Clear whatever surfaces, stay out for points,
            and go home before everything becomes too much.
          </p>
          <button
            className="tutorial-toggle"
            type="button"
            aria-pressed={tutorialEnabled}
            onClick={toggleTutorial}
          >
            <span>TUTORIAL</span>
            <strong>{tutorialEnabled ? 'ON' : 'OFF'}</strong>
          </button>
          <button type="button" onClick={startGame}>START THE DAY</button>`,
    'intro tutorial toggle',
  )

  app = replaceOnce(
    app,
    `function OverlayCard({ eyebrow, title, children }) {`,
    `function TutorialCallout({ step, target, onProceed }) {
  if (step === 'summary') {
    return (
      <section className="tutorial-layer tutorial-layer-summary" role="dialog" aria-modal="true">
        <div className="tutorial-callout tutorial-callout-summary">
          <span>HOW THE DAY WORKS</span>
          <strong>Keep the screen clear.</strong>
          <p>
            More minigames will appear as the day continues. Clear them before six pile up
            and you become overwhelmed.
          </p>
          <button type="button" onClick={onProceed}>PROCEED</button>
        </div>
      </section>
    )
  }

  const copy = step === 'first'
    ? {
        eyebrow: 'FIRST MINIGAME',
        title: 'Hold to clear it.',
        body: 'Hold the button or Space until it clears. Release when it tells you to.',
      }
    : {
        eyebrow: 'A DIFFERENT MINIGAME',
        title: 'This one uses movement.',
        body: 'Click the box, then use the arrow keys or WASD to reach the exit.',
      }

  return (
    <section className={\`tutorial-layer tutorial-layer-\${step}\`} aria-live="polite">
      <aside
        className={\`tutorial-callout tutorial-callout-\${step}\`}
        style={{
          '--tutorial-left': target?.position.left ?? '50%',
          '--tutorial-top': target?.position.top ?? '30%',
        }}
      >
        <span>{copy.eyebrow}</span>
        <strong>{copy.title}</strong>
        <p>{copy.body}</p>
      </aside>
    </section>
  )
}

function OverlayCard({ eyebrow, title, children }) {`,
    'tutorial callout component',
  )

  app = replaceOnce(
    app,
    `function MicrogameWindow({ game, index, load, onResolve }) {`,
    `function MicrogameWindow({ game, index, load, tutorialTarget, onResolve }) {`,
    'tutorial microgame signature',
  )

  app = replaceOnce(
    app,
    `      className={\`microgame microgame-\${game.kind}\`}`,
    `      className={\`microgame microgame-\${game.kind}\${tutorialTarget ? ' tutorial-target' : ''}\`}`,
    'tutorial target class',
  )
}

if (!main.includes("import './tutorial.css'")) {
  main = replaceOnce(
    main,
    `import './endScreensResponsive.css'`,
    `import './endScreensResponsive.css'\nimport './tutorial.css'`,
    'tutorial stylesheet import',
  )
}

if (!endScreens.includes('results-tutorial')) {
  endScreens = replaceOnce(
    endScreens,
    `        <button class="results-restart" type="button">TRY ANOTHER DAY</button>`,
    `        <div class="results-actions">
          <button class="results-restart" type="button">TRY ANOTHER DAY</button>
          <button class="results-tutorial" type="button">PLAY TUTORIAL</button>
        </div>`,
    'results tutorial button',
  )

  endScreens = replaceOnce(
    endScreens,
    `  root.querySelector('.results-restart')?.addEventListener('click', () => {
    removeEndSequence()
    resetRunSnapshot()
    originalRestartButton.click()
  }, { once: true })`,
    `  root.querySelector('.results-restart')?.addEventListener('click', () => {
    removeEndSequence()
    resetRunSnapshot()
    originalRestartButton.click()
  }, { once: true })

  root.querySelector('.results-tutorial')?.addEventListener('click', () => {
    removeEndSequence()
    resetRunSnapshot()
    window.dispatchEvent(new Event('crazybod:start-tutorial'))
  }, { once: true })`,
    'results tutorial restart event',
  )
}

fs.writeFileSync(appPath, app)
fs.writeFileSync(mainPath, main)
fs.writeFileSync(endScreensPath, endScreens)
console.log('Applied first-run tutorial flow.')
