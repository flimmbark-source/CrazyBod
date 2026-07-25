import { Canvas, useFrame } from '@react-three/fiber'
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { AuthoredJourneyScene } from './world/JourneyScene.jsx'
import { MICROGAME_NAMES as EXPANDED_MICROGAME_NAMES, NewMicrogameContent } from './minigames/catalog.jsx'
import { TUTORIAL_SEQUENCE } from './pacingConfig.js'
import {
  createPacingDirector,
  initializePacingDirector,
  takeSpawnBatch,
  drawSpawnKinds,
} from './pacingDirector.js'
import RehearsalTechnique from './techniques/RehearsalTechnique.jsx'
import { REHEARSAL_SEQUENCE, rehearsalSucceeded } from './techniques/techniqueEngine.js'
import { getNode } from './progression/skillTreeConfig.js'
import {
  DAY_LENGTH,
  OVERLOAD_SCORE_MULTIPLIER,
  phaseFor,
  phaseLabel,
  scoreForElapsed,
} from './config/gameConfig.js'
import ResultsScreen from './results/ResultsScreen.jsx'
import { useProgression } from './progression/useProgression.js'
import { computeCapacity } from './progression/progressionStore.js'
import SkillTreeScreen from './progression/SkillTreeScreen.jsx'
import SkillTreeUnlock from './progression/SkillTreeUnlock.jsx'

const TUTORIAL_STORAGE_KEY = 'crazybod:tutorial-complete'
const READY_CUE_MS = 1150
const START_CUE_MS = 650

const MICROGAME_NAMES = EXPANDED_MICROGAME_NAMES

const COMPLETION_SHARDS = [
  { dx: '-118px', dy: '-78px', start: '-12deg', end: '-185deg', width: '34px', height: '20px' },
  { dx: '-52px', dy: '-116px', start: '8deg', end: '215deg', width: '24px', height: '38px' },
  { dx: '40px', dy: '-122px', start: '-5deg', end: '165deg', width: '42px', height: '18px' },
  { dx: '118px', dy: '-66px', start: '14deg', end: '224deg', width: '29px', height: '30px' },
  { dx: '132px', dy: '22px', start: '-8deg', end: '-160deg', width: '45px', height: '19px' },
  { dx: '72px', dy: '92px', start: '6deg', end: '198deg', width: '26px', height: '35px' },
  { dx: '-34px', dy: '112px', start: '-15deg', end: '-210deg', width: '39px', height: '21px' },
  { dx: '-126px', dy: '54px', start: '11deg', end: '175deg', width: '28px', height: '32px' },
]

const MARA_DIALOGUE = {
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
}

function getPhase(elapsed) {
  return phaseLabel(elapsed)
}

function seededFraction(seed, value) {
  let next = (seed ^ Math.imul(value + 1, 0x9e3779b9)) >>> 0
  next ^= next >>> 16
  next = Math.imul(next, 0x7feb352d)
  next ^= next >>> 15
  next = Math.imul(next, 0x846ca68b)
  next ^= next >>> 16
  return (next >>> 0) / 4294967296
}

function microgameViewportSize() {
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
  const goHomeRect = document.querySelector('.go-home')?.getBoundingClientRect()
  const reserved = goHomeRect && goHomeRect.width > 0 && goHomeRect.height > 0
    ? {
        left: goHomeRect.left - 18,
        right: goHomeRect.right + 18,
        top: goHomeRect.top - 18,
        bottom: goHomeRect.bottom + 18,
      }
    : null
  let fallback = { left: minimumLeft, top: minimumTop }
  let hasSafeFallback = false

  for (let attempt = 0; attempt < 32; attempt += 1) {
    const left = minimumLeft
      + seededFraction(seed, index * 31 + attempt * 2) * (maximumLeft - minimumLeft)
    const top = minimumTop
      + seededFraction(seed, index * 31 + attempt * 2 + 1) * (maximumTop - minimumTop)
    const candidateLeft = (left / 100) * viewportWidth
    const candidateTop = (top / 100) * viewportHeight
    const candidateRight = candidateLeft + width
    const candidateBottom = candidateTop + height
    const clearOfGoHome = !reserved || (
      candidateRight <= reserved.left
      || candidateLeft >= reserved.right
      || candidateBottom <= reserved.top
      || candidateTop >= reserved.bottom
    )

    if (!clearOfGoHome) continue
    const candidate = { left, top }
    if (!hasSafeFallback) {
      fallback = candidate
      hasSafeFallback = true
    }

    const separated = existingGames.every((game) => {
      const previousLeft = Number.parseFloat(game.position.left)
      const previousTop = Number.parseFloat(game.position.top)
      const horizontalDistance = ((left - previousLeft) / 100) * viewportWidth
      const verticalDistance = ((top - previousTop) / 100) * viewportHeight
      return Math.hypot(horizontalDistance, verticalDistance) >= Math.min(width, height) * 0.78
    })

    if (separated) {
      return {
        left: `${left.toFixed(1)}%`,
        top: `${top.toFixed(1)}%`,
      }
    }
  }

  return {
    left: `${fallback.left.toFixed(1)}%`,
    top: `${fallback.top.toFixed(1)}%`,
  }
}

function scrambleText(text, intensity) {
  if (intensity <= 0) return text
  const words = text.split(' ')
  if (intensity >= 2 && words.length > 4) {
    const second = words[1]
    words[1] = words[3]
    words[3] = second
  }
  if (intensity >= 3) {
    for (let i = 2; i < words.length; i += 4) words[i] = '▒▒▒'
  }
  return words.join(' ')
}

function App() {
  const [status, setStatus] = useState('intro')
  // Three clocks, split from the single `elapsed` value:
  //  - dayElapsed  : scored day time. Drives score, phase, world, completion.
  //                  Pauses during techniques, tutorial and order dialogue.
  //  - spawnElapsed: the spawn clock. Advances only while spawning is enabled.
  //  - runElapsed  : real time since the run began. Drives technique scheduling
  //                  and run statistics.
  const [dayElapsed, setDayElapsed] = useState(0)
  const [spawnElapsed, setSpawnElapsed] = useState(0)
  const [runElapsed, setRunElapsed] = useState(0)
  const [activeTechnique, setActiveTechnique] = useState(null)
  const [microgames, setMicrogames] = useState([])
  const [dialogueOpen, setDialogueOpen] = useState(false)
  const [dialogueAnswered, setDialogueAnswered] = useState(false)
  const [orderDialogueOpen, setOrderDialogueOpen] = useState(false)
  const [orderDialogueAnswered, setOrderDialogueAnswered] = useState(false)
  const [result, setResult] = useState(null)
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
  const [directorReady, setDirectorReady] = useState(false)
  const [startCue, setStartCue] = useState(null)
  const { progression, purchaseNode, toggleNode, depositRun, resetTree, resetFull } = useProgression()
  const [firstUnlockPending, setFirstUnlockPending] = useState(false)
  const [treeFirstView, setTreeFirstView] = useState(false)
  const [runCapacityBonus, setRunCapacityBonus] = useState(0)
  const prevUnlockedRef = useRef(progression.treeUnlocked)
  const capacityRef = useRef(0)
  const rehearsalFiredRef = useRef(false)
  const techniqueOutcomesRef = useRef({})
  const directorRef = useRef(createPacingDirector())
  const spawnCounterRef = useRef(0)
  const microgamesRef = useRef([])
  const resolvedGamesRef = useRef(new Set())
  const completionEffectIdRef = useRef(0)
  const tutorialFirstSeenRef = useRef(false)
  const tutorialSecondSeenRef = useRef(false)
  const lastTickRef = useRef(0)
  const dayElapsedRef = useRef(0)
  const spawnElapsedRef = useRef(0)
  const runElapsedRef = useRef(0)
  const dayAdvancingRef = useRef(false)
  const spawningEnabledRef = useRef(false)
  const clearedCountRef = useRef(0)
  const peakLoadRef = useRef(0)
  const spawnedCountRef = useRef(0)
  const suppressedCountRef = useRef(0)
  const runFinishedRef = useRef(false)

  const score = scoreForElapsed(dayElapsed)
  const remainingTime = Math.max(0, Math.ceil(DAY_LENGTH - dayElapsed))
  const currentPhaseId = phaseFor(dayElapsed).id
  // Capacity is derived from the enabled skill nodes plus any per-run bonus
  // (e.g. a successful rehearsal). First run with nothing enabled is 5.
  const capacity = computeCapacity(progression.enabledNodeIds, runCapacityBonus)
  capacityRef.current = capacity
  const load = microgames.length
  const overloadRatio = Math.min(1, load / capacity)
  const overloadShake = Math.max(0, load - 2) * 0.8
  const homeShake = Math.max(0, load - 1) * 0.85
  const distortion = load >= 5 ? 3 : load >= 4 ? 2 : load >= 3 ? 1 : 0
  const tutorialPaused = status === 'playing' && tutorialStep !== 'none'
  const orderingPaused = status === 'playing' && orderDialogueOpen
  const gameplayPaused = tutorialPaused || orderingPaused
  // Subsystem gates. Techniques (added later) can pause the day and/or spawns
  // independently; the tutorial and order dialogue pause both.
  const dayAdvancing = status === 'playing'
    && !tutorialPaused
    && !orderingPaused
    && !activeTechnique?.pausesDay
  const spawningEnabled = status === 'playing'
    && directorReady
    && !tutorialPaused
    && !orderingPaused
    && !activeTechnique?.pausesSpawns

  const beginGame = useCallback((withTutorial) => {
    const seed = (Date.now() ^ Math.floor(performance.now() * 1000)) >>> 0
    directorRef.current = createPacingDirector(seed)
    spawnCounterRef.current = 0
    microgamesRef.current = []
    resolvedGamesRef.current = new Set()
    tutorialFirstSeenRef.current = false
    tutorialSecondSeenRef.current = false
    rehearsalFiredRef.current = false
    techniqueOutcomesRef.current = {}
    lastTickRef.current = 0
    dayElapsedRef.current = 0
    spawnElapsedRef.current = 0
    runElapsedRef.current = 0
    clearedCountRef.current = 0
    peakLoadRef.current = 0
    spawnedCountRef.current = 0
    suppressedCountRef.current = 0
    runFinishedRef.current = false
    setDayElapsed(0)
    setSpawnElapsed(0)
    setRunElapsed(0)
    setActiveTechnique(null)
    setRunCapacityBonus(0)
    setMicrogames([])
    setCompletionEffects([])
    setDialogueOpen(false)
    setDialogueAnswered(false)
    setOrderDialogueOpen(false)
    setOrderDialogueAnswered(false)
    setResult(null)
    setTutorialRun(withTutorial)
    setTutorialStep('none')
    setDirectorReady(!withTutorial)
    setStartCue('ready')
    setStatus('countdown')
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
  }

  useEffect(() => {
    if (status !== 'countdown') return undefined

    const timer = window.setTimeout(() => {
      lastTickRef.current = performance.now()
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

  const spawnMicrogame = useCallback((kind, tutorialRole = null) => {
    const index = spawnCounterRef.current
    spawnCounterRef.current += 1
    spawnedCountRef.current += 1
    const game = {
      id: `${kind}-${directorRef.current.seed}-${index}`,
      kind,
      tutorialRole,
      position: positionFor(directorRef.current.seed, index, microgamesRef.current),
    }
    setMicrogames((current) => {
      const next = [...current, game]
      microgamesRef.current = next
      return next
    })
    return game
  }, [])

  useEffect(() => {
    const handleTutorialRestart = () => startTutorialGame()
    window.addEventListener('crazybod:start-tutorial', handleTutorialRestart)
    return () => window.removeEventListener('crazybod:start-tutorial', handleTutorialRestart)
  }, [startTutorialGame])

  // Keep the gating flags the tick reads in refs, so the interval always sees
  // the current values without being torn down and rebuilt each pause.
  useEffect(() => {
    dayAdvancingRef.current = dayAdvancing
    spawningEnabledRef.current = spawningEnabled
  }, [dayAdvancing, spawningEnabled])

  // Single ticking clock. Each tick distributes real elapsed time to whichever
  // subsystems are currently advancing.
  useEffect(() => {
    if (status !== 'playing') return undefined

    lastTickRef.current = performance.now()
    const timer = window.setInterval(() => {
      const now = performance.now()
      const delta = (now - lastTickRef.current) / 1000
      lastTickRef.current = now

      runElapsedRef.current += delta
      if (dayAdvancingRef.current) {
        dayElapsedRef.current = Math.min(dayElapsedRef.current + delta, DAY_LENGTH)
      }
      if (spawningEnabledRef.current) {
        spawnElapsedRef.current += delta
      }

      setRunElapsed(runElapsedRef.current)
      setDayElapsed(dayElapsedRef.current)
      setSpawnElapsed(spawnElapsedRef.current)
    }, 100)

    return () => window.clearInterval(timer)
  }, [status])

  useEffect(() => {
    if (status !== 'playing' || !tutorialRun || tutorialStep !== 'none') return

    const first = TUTORIAL_SEQUENCE[0]
    const second = TUTORIAL_SEQUENCE[1]

    if (!tutorialFirstSeenRef.current && dayElapsed >= first.at) {
      tutorialFirstSeenRef.current = true
      spawnMicrogame(first.kind, first.role)
      setTutorialStep(first.role)
      return
    }

    if (
      tutorialFirstSeenRef.current
      && !tutorialSecondSeenRef.current
      && dayElapsed >= second.at
    ) {
      tutorialSecondSeenRef.current = true
      spawnMicrogame(second.kind, second.role)
      setTutorialStep(second.role)
    }
  }, [dayElapsed, spawnMicrogame, status, tutorialRun, tutorialStep])

  useEffect(() => {
    if (!spawningEnabled) return

    const director = directorRef.current
    if (director.nextSpawnAt === null) {
      initializePacingDirector(director, spawnElapsed)
      return
    }
    if (spawnElapsed < director.nextSpawnAt) return

    const batch = takeSpawnBatch(director, {
      spawnElapsed,
      phaseId: currentPhaseId,
    })
    batch.kinds.forEach(({ kind }) => spawnMicrogame(kind))
  }, [spawningEnabled, spawnElapsed, currentPhaseId, spawnMicrogame])

  useEffect(() => {
    if (status !== 'playing') return
    if (dayElapsed >= 25 && !dialogueAnswered) setDialogueOpen(true)
  }, [dayElapsed, status, dialogueAnswered])

  useEffect(() => {
    if (status !== 'playing') return
    if (dayElapsed >= 35 && dialogueAnswered && !orderDialogueAnswered) {
      setOrderDialogueOpen(true)
    }
  }, [dialogueAnswered, dayElapsed, orderDialogueAnswered, status])

  useEffect(() => {
    if (status !== 'playing') return
    peakLoadRef.current = Math.max(peakLoadRef.current, load)
  }, [load, status])

  // One authoritative end-of-run transaction. Builds the result from real run
  // data (not from rendered DOM), so it survives unscored technique time.
  const finishRun = useCallback((outcome) => {
    if (runFinishedRef.current) return
    runFinishedRef.current = true

    const finishedDay = Math.min(DAY_LENGTH, dayElapsedRef.current)
    const rawScore = scoreForElapsed(finishedDay)
    const capacity = capacityRef.current
    const finalScore = outcome === 'overload'
      ? Math.floor(rawScore * OVERLOAD_SCORE_MULTIPLIER)
      : rawScore
    const activeAtEnd = outcome === 'overload' ? capacity : microgamesRef.current.length
    const cleared = clearedCountRef.current
    const peakLoad = Math.max(peakLoadRef.current, outcome === 'overload' ? capacity : 0)

    setResult({
      runId: `${directorRef.current.seed}`,
      outcome,
      rawScore,
      finalScore,
      penalty: Math.max(0, rawScore - finalScore),
      dayElapsed: finishedDay,
      runElapsed: runElapsedRef.current,
      clearedCount: cleared,
      suppressedCount: suppressedCountRef.current,
      peakLoad,
      capacity,
      activeAtEnd,
      appeared: Math.max(spawnedCountRef.current, cleared + activeAtEnd),
      techniques: { ...techniqueOutcomesRef.current },
    })
    setStatus(outcome)
  }, [])

  // Bank the finished run exactly once. depositRun is idempotent by runId, so
  // re-running this effect (e.g. under StrictMode) cannot double-deposit.
  useEffect(() => {
    if (!result) return
    depositRun({ runId: result.runId, finalScore: result.finalScore })
  }, [result, depositRun])

  // Detect the first-ever unlock so the first-run flow can route into the tree.
  useEffect(() => {
    if (progression.treeUnlocked && !prevUnlockedRef.current) {
      setFirstUnlockPending(true)
    }
    prevUnlockedRef.current = progression.treeUnlocked
  }, [progression.treeUnlocked])

  const openSkillTree = useCallback((firstView = false) => {
    setFirstUnlockPending(false)
    setTreeFirstView(firstView)
    setStatus('skillTree')
  }, [])

  const exitToTitle = useCallback(() => {
    setTreeFirstView(false)
    setStatus('intro')
  }, [])

  const handleResetFull = useCallback(() => {
    resetFull()
    setTutorialEnabled(true)
  }, [resetFull])

  // Fire the rehearsal once per run, at its configured day-time trigger, but
  // only when the node is enabled and nothing else is active.
  useEffect(() => {
    if (status !== 'playing' || activeTechnique || rehearsalFiredRef.current) return
    if (!progression.enabledNodeIds.includes('rehearse')) return
    if (dayElapsed < getNode('rehearse').effect.triggerDay) return
    rehearsalFiredRef.current = true
    setActiveTechnique({ id: 'rehearsal', pausesDay: true, pausesSpawns: false })
  }, [status, activeTechnique, dayElapsed, progression.enabledNodeIds])

  const completeRehearsal = useCallback((outcome) => {
    const node = getNode('rehearse')
    const success = rehearsalSucceeded(outcome)
    techniqueOutcomesRef.current.rehearsal = success ? 'success' : 'failure'
    if (success) {
      setRunCapacityBonus((bonus) => bonus + (node.effect.runCapacityBonus ?? 1))
    } else {
      const phaseId = phaseFor(dayElapsedRef.current).id
      drawSpawnKinds(directorRef.current, {
        phaseId,
        count: node.effect.failureSpawnCount ?? 2,
      }).forEach((kind) => spawnMicrogame(kind))
    }
    setActiveTechnique(null)
  }, [spawnMicrogame])

  useEffect(() => {
    if (status !== 'playing' || load < capacity) return
    finishRun('overload')
  }, [load, status, capacity, finishRun])

  useEffect(() => {
    if (status !== 'playing' || dayElapsed < DAY_LENGTH) return
    finishRun('complete')
  }, [dayElapsed, status, finishRun])

  const resolveMicrogame = useCallback((id) => {
    if (resolvedGamesRef.current.has(id)) return
    resolvedGamesRef.current.add(id)
    clearedCountRef.current += 1

    const gameElement = document.querySelector(`[data-game-id="${id}"]`)
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

    const resolvedGame = microgamesRef.current.find((game) => game.id === id)
    setMicrogames((current) => {
      const next = current.filter((game) => game.id !== id)
      microgamesRef.current = next
      return next
    })

    if (tutorialRun && tutorialStep === 'first' && resolvedGame?.tutorialRole === 'first') {
      setTutorialStep('none')
    }
    if (tutorialRun && tutorialStep === 'second' && resolvedGame?.tutorialRole === 'second') {
      setTutorialStep('home')
    }
  }, [tutorialRun, tutorialStep])

  const goHome = () => {
    finishRun('home')
  }

  const answerDialogue = () => {
    setDialogueAnswered(true)
    setDialogueOpen(false)
  }

  const answerOrderDialogue = () => {
    setOrderDialogueAnswered(true)
    setOrderDialogueOpen(false)
  }

  const finishTutorial = () => {
    try {
      window.localStorage.setItem(TUTORIAL_STORAGE_KEY, 'true')
    } catch {
      // The tutorial still finishes for this session without storage.
    }
    setTutorialEnabled(false)
    setDirectorReady(true)
    setTutorialStep('none')
  }

  const advanceTutorial = () => {
  if (tutorialStep === 'home') {
    setTutorialStep('summary')
    return
  }
  finishTutorial()
}

  const tutorialTarget = tutorialStep === 'first' || tutorialStep === 'second'
    ? microgames.find((game) => game.tutorialRole === tutorialStep)
    : null

  return (
    <main className={`game-shell status-${status} load-${Math.min(load, 5)}`}>
      <div className="world-layer">
        <Canvas
          shadows="basic"
          camera={{ position: [0.55, 1.65, 3.1], fov: 68, near: 0.08, far: 150 }}
          dpr={[1, 1.25]}
          gl={{
            antialias: false,
            alpha: false,
            stencil: false,
            powerPreference: 'high-performance',
            precision: 'mediump',
          }}
          performance={{ min: 0.6 }}
        >
          <AuthoredJourneyScene
            elapsed={dayElapsed}
            active={dayAdvancing}
            dialogueStage={dialogueOpen ? 'mara' : orderDialogueOpen ? 'order' : null}
          />
        </Canvas>
      </div>

      {startCue && (
        <section
          className={`race-start-cue race-start-cue-${startCue}`}
          aria-live="assertive"
          aria-atomic="true"
        >
          <strong key={startCue}>{startCue === 'ready' ? 'Ready?' : 'START!'}</strong>
        </section>
      )}

      {['countdown', 'playing'].includes(status) && (
        <>
          <header className="hud">
            <div className="hud-panel">
              <span className="hud-label">TIME</span>
              <strong>{remainingTime}s</strong>
            </div>
            <div className="phase-label">{getPhase(dayElapsed)}</div>
            <div className="hud-panel score-panel">
              <span className="hud-label">SCORE</span>
              <strong>{score}</strong>
            </div>
          </header>

          <div
            className="load-meter"
            aria-label={`Overload ${load} of ${capacity}`}
            style={{
              '--overload': overloadRatio,
              '--overload-scale': 1 + overloadRatio * 0.16,
              '--overload-saturation': 1 + overloadRatio * 0.8,
              '--overload-contrast': 1 + overloadRatio * 0.14,
              '--overload-alpha': overloadRatio * 0.72,
              '--overload-shake': `${overloadShake}px`,
              '--overload-shake-neg': `${-overloadShake}px`,
            }}
          >
            <span>OVERLOAD</span>
            <div className="load-pips">
              {Array.from({ length: capacity }).map((_, index) => (
                <i key={index} className={index >= capacity - load ? 'filled' : ''} />
              ))}
            </div>
          </div>

          <section className="microgame-layer" aria-live="polite">
            {microgames.map((game, index) => (
              <MicrogameWindow
                key={game.id}
                game={game}
                index={index}
                load={load}
                tutorialTarget={tutorialTarget?.id === game.id}
                onResolve={resolveMicrogame}
              />
            ))}
          </section>

          {tutorialStep !== 'none' && (
            <TutorialCallout
              step={tutorialStep}
              target={tutorialTarget}
              onProceed={advanceTutorial}
            />
          )}

          <section className="completion-fx-layer" aria-hidden="true">
            {completionEffects.map((effect) => (
              <CompletionBurst key={effect.id} effect={effect} />
            ))}
          </section>

          {dialogueOpen && (
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
          )}

          {activeTechnique?.id === 'rehearsal' && (
            <RehearsalTechnique
              prompts={REHEARSAL_SEQUENCE.prompts}
              timeLimitSeconds={getNode('rehearse').effect.addedSeconds}
              onComplete={completeRehearsal}
            />
          )}

          <button
            className={`go-home${tutorialStep === 'home' ? ' tutorial-target tutorial-home-target' : ''}`}
            type="button"
            onClick={goHome}
            disabled={gameplayPaused}
            style={{
              '--overload': overloadRatio,
              '--home-scale': 1 + overloadRatio * 0.1,
              '--home-shake': `${homeShake}px`,
              '--home-shake-neg': `${-homeShake}px`,
            }}
          >
            <span>GO HOME</span>
            <small>cash out {score}</small>
          </button>
        </>
      )}

      {status === 'intro' && (
        <OverlayCard eyebrow="" title="CRAZYBOD">
          <p>
            Try to finish your day. Minigames will pop up, too many on the screen and you'll CRASH.
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
          <button type="button" onClick={startGame}>START THE DAY</button>
          {progression.treeUnlocked && (
            <button type="button" className="title-skill-tree" onClick={() => openSkillTree(false)}>
              SKILL TREE
            </button>
          )}
        </OverlayCard>
      )}

      {status === 'skillTree' && (
        <SkillTreeScreen
          progression={progression}
          firstUnlock={treeFirstView}
          onStartDay={startGame}
          onExit={exitToTitle}
          onPurchase={purchaseNode}
          onToggle={toggleNode}
          onResetTree={resetTree}
          onResetFull={handleResetFull}
        />
      )}

      {['overload', 'home', 'complete'].includes(status) && result && (
        firstUnlockPending ? (
          <SkillTreeUnlock
            finalScore={result.finalScore}
            bank={progression.bank}
            onOpenTree={() => openSkillTree(true)}
          />
        ) : (
          <ResultsScreen
            result={result}
            capacity={result.capacity}
            banked={progression.treeUnlocked ? progression.bank : null}
            onRestart={startGame}
            onTutorial={startTutorialGame}
            onSkillTree={progression.treeUnlocked ? () => openSkillTree(false) : undefined}
          />
        )
      )}
    </main>
  )
}

function TutorialCallout({ step, target, onProceed }) {
  const calloutRef = useRef(null)
  const [calloutPosition, setCalloutPosition] = useState({ left: 12, top: 92, direction: 'right' })
  const targetId = target?.id ?? null

  useLayoutEffect(() => {
    if (step === 'summary') return undefined

    const positionCallout = () => {
      const callout = calloutRef.current
      const targetElement = step === 'home'
        ? document.querySelector('.go-home')
        : targetId
          ? document.querySelector(`[data-game-id="${targetId}"]`)
          : null
      if (!callout || !targetElement) return

      const targetRect = targetElement.getBoundingClientRect()
      const calloutWidth = callout.offsetWidth
      const calloutHeight = callout.offsetHeight
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      const edge = 12
      const gap = 28
      const centerX = targetRect.left + targetRect.width / 2
      const centerY = targetRect.top + targetRect.height / 2
      const clampLeft = (left) => Math.max(edge, Math.min(left, viewportWidth - calloutWidth - edge))
      const clampTop = (top) => Math.max(edge, Math.min(top, viewportHeight - calloutHeight - edge))
      const candidates = [
        { direction: 'right', left: targetRect.right + gap, top: centerY - calloutHeight / 2 },
        { direction: 'left', left: targetRect.left - calloutWidth - gap, top: centerY - calloutHeight / 2 },
        { direction: 'below', left: centerX - calloutWidth / 2, top: targetRect.bottom + gap },
        { direction: 'above', left: centerX - calloutWidth / 2, top: targetRect.top - calloutHeight - gap },
        { direction: 'below', left: edge, top: edge },
        { direction: 'above', left: viewportWidth - calloutWidth - edge, top: viewportHeight - calloutHeight - edge },
      ].map((candidate) => ({
        ...candidate,
        left: clampLeft(candidate.left),
        top: clampTop(candidate.top),
      }))

      const blockedRects = [
        ...Array.from(document.querySelectorAll('.microgame'), (element) => element.getBoundingClientRect()),
        targetRect,
      ]
      const candidateRect = (candidate) => ({
        left: candidate.left,
        top: candidate.top,
        right: candidate.left + calloutWidth,
        bottom: candidate.top + calloutHeight,
      })
      const overlaps = (a, b, margin = 10) => (
        a.left < b.right + margin
        && a.right > b.left - margin
        && a.top < b.bottom + margin
        && a.bottom > b.top - margin
      )
      const overlapArea = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
        * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
      const clearCandidate = candidates.find((candidate) => {
        const rect = candidateRect(candidate)
        return blockedRects.every((blocked) => !overlaps(rect, blocked))
      })
      const chosen = clearCandidate ?? candidates.reduce((best, candidate) => {
        const rect = candidateRect(candidate)
        const score = blockedRects.reduce((total, blocked) => total + overlapArea(rect, blocked), 0)
        return score < best.score ? { candidate, score } : best
      }, { candidate: candidates[0], score: Number.POSITIVE_INFINITY }).candidate

      setCalloutPosition(chosen)
    }

    const frame = window.requestAnimationFrame(positionCallout)
    window.addEventListener('resize', positionCallout)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', positionCallout)
    }
  }, [step, targetId])

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
    : step === 'second'
      ? {
          eyebrow: 'A DIFFERENT MINIGAME',
          title: 'This one uses movement.',
          body: 'Click the box, then use the arrow keys or WASD to reach the exit.',
        }
      : {
          eyebrow: 'WHEN IT IS TOO MUCH',
          title: 'Go Home if you feel overwhelmed.',
          body: '',
        }

  return (
    <section className={`tutorial-layer tutorial-layer-${step}`} aria-live="polite">
      <aside
        ref={calloutRef}
        className={`tutorial-callout tutorial-callout-${step} placement-${calloutPosition.direction}`}
        style={{ left: `${calloutPosition.left}px`, top: `${calloutPosition.top}px` }}
      >
        <i className="tutorial-pointer" aria-hidden="true" />
        <span>{copy.eyebrow}</span>
        <strong>{copy.title}</strong>
        {copy.body && <p>{copy.body}</p>}
        {step === 'home' && (
          <button className="tutorial-next" type="button" onClick={onProceed}>GOT IT</button>
        )}
      </aside>
    </section>
  )
}

function OverlayCard({ eyebrow, title, children }) {
  return (
    <div className="screen-overlay">
      <section className="overlay-card">
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        {children}
      </section>
    </div>
  )
}

function DialogueBox({ dialogue, load, distortion, onAnswer }) {
  return (
    <section className={`dialogue-box distortion-${distortion}`}>
      <div className="speaker-row">
        <span className="portrait">{dialogue.speaker.slice(0, 1)}</span>
        <div>
          <strong>{dialogue.speaker}</strong>
          <p>{scrambleText(dialogue.line, distortion)}</p>
        </div>
      </div>
      <div className="dialogue-options">
        {dialogue.options.map((option, index) => (
          <button
            key={option}
            type="button"
            style={{ '--option-index': index, '--load': load }}
            onClick={onAnswer}
          >
            {scrambleText(option, distortion >= 3 ? 2 : distortion - 1)}
          </button>
        ))}
      </div>
    </section>
  )
}

function CompletionBurst({ effect }) {
  return (
    <div
      className={`completion-burst kind-${effect.kind}`}
      style={{ '--burst-x': `${effect.x}px`, '--burst-y': `${effect.y}px` }}
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

const MicrogameWindow = memo(function MicrogameWindow({ game, index, load, tutorialTarget, onResolve }) {
  const resolve = useCallback(() => onResolve(game.id), [game.id, onResolve])

  return (
    <article
      className={`microgame microgame-${game.kind}${tutorialTarget ? ' tutorial-target' : ''}`}
      data-game-id={game.id}
      data-game-kind={game.kind}
      data-tutorial-role={game.tutorialRole || undefined}
      style={{
        ...game.position,
        '--window-index': index,
        '--load': load,
        '--jitter': `${Math.max(0, load - 3)}px`,
        '--jitter-duration': `${Math.max(0.2, 0.5 - Math.min(load, 4) * 0.06)}s`,
      }}
    >
      <div className="microgame-header">
        <span>{MICROGAME_NAMES[game.kind]}</span>
        <i />
      </div>
      <div className="microgame-body">
        {game.kind === 'discomfort' && <DiscomfortGame onResolve={resolve} />}
        {game.kind === 'anxiety' && <AnxietyGame onResolve={resolve} />}
        {game.kind === 'brainFog' && <BrainFogGame onResolve={resolve} />}
        {game.kind === 'fatigue' && <FatigueGame onResolve={resolve} />}
        <NewMicrogameContent kind={game.kind} onResolve={resolve} />
      </div>
    </article>
  )
})

function DiscomfortGame({ onResolve }) {
  const [presses, setPresses] = useState(0)
  const needed = 6
  const shift = () => {
    const next = presses + 1
    setPresses(next)
    if (next >= needed) onResolve()
  }

  return (
    <div className="discomfort-game">
      <div className="body-shape">
        {Array.from({ length: 4 }).map((_, index) => (
          <span key={index} style={{ opacity: (presses + index) % 4 === 0 ? 1 : 0.35 }} />
        ))}
      </div>
      <button type="button" onClick={shift} style={{ transform: `translateX(${(presses % 3 - 1) * 16}px)` }}>
        ADJUST
      </button>
      <div className="tiny-progress"><i style={{ width: `${(presses / needed) * 100}%` }} /></div>
    </div>
  )
}

function AnxietyGame({ onResolve }) {
  const [hits, setHits] = useState(0)
  const targets = useMemo(
    () => [[18, 22], [72, 18], [43, 48], [78, 72], [24, 76]],
    [],
  )

  const hit = () => {
    const next = hits + 1
    setHits(next)
    if (next >= targets.length) onResolve()
  }

  return (
    <div className="anxiety-game">
      <div className="pulse-ring" />
      {targets.map(([left, top], index) => (
        <button
          key={`${left}-${top}`}
          type="button"
          className={index === hits ? 'active-target' : index < hits ? 'hit-target' : ''}
          style={{ left: `${left}%`, top: `${top}%` }}
          onClick={index === hits ? hit : undefined}
          aria-label={index === hits ? 'Catch pulse' : undefined}
        />
      ))}
    </div>
  )
}

function BrainFogGame({ onResolve }) {
  const [position, setPosition] = useState(0)
  const path = [1, 4, 5, 8]

  const move = (direction) => {
    const next = position + direction
    if (next < 0 || next > 8) return
    const currentRow = Math.floor(position / 3)
    const nextRow = Math.floor(next / 3)
    if (Math.abs(direction) === 1 && currentRow !== nextRow) return
    if (!path.includes(next) && next !== 0) {
      setPosition(0)
      return
    }
    setPosition(next)
    if (next === 8) onResolve()
  }

  return (
    <div className="fog-game">
      <div className="fog-grid">
        {Array.from({ length: 9 }).map((_, index) => (
          <span key={index} className={`${path.includes(index) || index === 0 ? 'path' : ''} ${position === index ? 'you' : ''} ${index === 8 ? 'exit' : ''}`} />
        ))}
      </div>
      <div className="fog-controls">
        <button type="button" onClick={() => move(-3)}>↑</button>
        <button type="button" onClick={() => move(-1)}>←</button>
        <button type="button" onClick={() => move(1)}>→</button>
        <button type="button" onClick={() => move(3)}>↓</button>
      </div>
    </div>
  )
}

function FatigueGame({ onResolve }) {
  const [held, setHeld] = useState(0)
  const holdingRef = useRef(false)
  const lastRef = useRef(0)
  const needed = 2400

  useEffect(() => {
    let frame
    const tick = (now) => {
      if (!lastRef.current) lastRef.current = now
      const delta = now - lastRef.current
      lastRef.current = now
      if (holdingRef.current) {
        setHeld((current) => {
          const next = Math.min(current + delta, needed)
          if (next >= needed) queueMicrotask(onResolve)
          return next
        })
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [onResolve])

  const stopHolding = () => {
    holdingRef.current = false
  }

  return (
    <div className="fatigue-game">
      <div className="fatigue-eye">
        <div className="heavy-lid" style={{ transform: `translateY(${44 - (held / needed) * 44}px)` }} />
      </div>
      <button
        type="button"
        onPointerDown={() => { holdingRef.current = true }}
        onPointerUp={stopHolding}
        onPointerLeave={stopHolding}
        onPointerCancel={stopHolding}
      >
        HOLD
      </button>
      <div className="tiny-progress"><i style={{ width: `${(held / needed) * 100}%` }} /></div>
    </div>
  )
}

function JourneyScene({ elapsed, active }) {
  const target = useMemo(() => new THREE.Vector3(), [])
  const look = useMemo(() => new THREE.Vector3(), [])

  useFrame(({ camera }, delta) => {
    const progress = Math.min(elapsed / DAY_LENGTH, 1)
    const z = 5 - progress * 88
    const x = Math.sin(progress * Math.PI * 3) * 0.55
    const bob = active ? Math.sin(elapsed * 6.5) * 0.035 : 0
    target.set(x, 1.65 + bob, z)
    camera.position.lerp(target, 1 - Math.pow(0.001, delta))
    look.set(x * 0.6, 1.5, z - 7)
    camera.lookAt(look)
  })

  return (
    <>
      <color attach="background" args={['#b8a7bb']} />
      <fog attach="fog" args={['#b8a7bb', 13, 45]} />
      <ambientLight intensity={1.3} />
      <directionalLight position={[5, 10, 4]} intensity={2.2} castShadow />
      <World />
    </>
  )
}

function Block({ position, scale, color, rotation = [0, 0, 0] }) {
  return (
    <mesh position={position} scale={scale} rotation={rotation}>
      <boxGeometry />
      <meshStandardMaterial color={color} flatShading />
    </mesh>
  )
}

function Person({ position, color = '#d97862' }) {
  return (
    <group position={position}>
      <mesh position={[0, 1.52, 0]}>
        <icosahedronGeometry args={[0.23, 1]} />
        <meshStandardMaterial color="#d7a982" flatShading />
      </mesh>
      <mesh position={[0, 0.9, 0]}>
        <cylinderGeometry args={[0.23, 0.33, 1, 6]} />
        <meshStandardMaterial color={color} flatShading />
      </mesh>
      <mesh position={[-0.13, 0.25, 0]} rotation={[0, 0, 0.06]}>
        <cylinderGeometry args={[0.07, 0.09, 0.72, 5]} />
        <meshStandardMaterial color="#424253" flatShading />
      </mesh>
      <mesh position={[0.13, 0.25, 0]} rotation={[0, 0, -0.06]}>
        <cylinderGeometry args={[0.07, 0.09, 0.72, 5]} />
        <meshStandardMaterial color="#424253" flatShading />
      </mesh>
    </group>
  )
}

function World() {
  const buildingRows = useMemo(
    () => Array.from({ length: 9 }, (_, index) => ({
      z: -28 - index * 5.4,
      height: 3.2 + (index % 3) * 0.75,
      color: ['#c7776d', '#8797a6', '#d0a05f'][index % 3],
    })),
    [],
  )

  return (
    <group>
      <Block position={[0, -0.18, -38]} scale={[12, 0.25, 92]} color="#756f79" />

      <group>
        <Block position={[0, 0, 1]} scale={[4.6, 0.2, 9]} color="#9b806d" />
        <Block position={[-3.9, 2.1, 0]} scale={[0.25, 4.4, 8]} color="#d2b69d" />
        <Block position={[3.9, 2.1, 0]} scale={[0.25, 4.4, 8]} color="#d2b69d" />
        <Block position={[0, 2.1, 6]} scale={[8, 4.4, 0.25]} color="#c79e89" />
        <Block position={[-1.8, 0.55, -1]} scale={[2.1, 0.8, 3]} color="#725b65" />
        <Block position={[-1.8, 1.02, -1]} scale={[1.85, 0.16, 2.8]} color="#d7c4b8" />
        <Block position={[2.2, 1, -2]} scale={[1.4, 2, 0.7]} color="#6b735f" />
        <Block position={[0, 2.05, -7]} scale={[2.2, 4.1, 0.3]} color="#b47862" />
      </group>

      <group position={[0, 0, -15]}>
        <Block position={[0, 0, 0]} scale={[3.1, 0.2, 13]} color="#9c8b76" />
        <Block position={[-2.9, 1.8, 0]} scale={[0.2, 3.8, 13]} color="#c8b49a" />
        <Block position={[2.9, 1.8, 0]} scale={[0.2, 3.8, 13]} color="#c8b49a" />
        <Block position={[0, 3.55, 0]} scale={[6, 0.18, 13]} color="#b49b86" />
      </group>

      <group>
        <Block position={[0, 0.02, -48]} scale={[4.8, 0.18, 42]} color="#73747d" />
        <Block position={[-4.4, 0.08, -48]} scale={[2, 0.28, 42]} color="#b39d87" />
        <Block position={[4.4, 0.08, -48]} scale={[2, 0.28, 42]} color="#b39d87" />
        {buildingRows.map((building, index) => (
          <group key={building.z}>
            <Block position={[-7.2, building.height / 2, building.z]} scale={[3.5, building.height, 4.4]} color={building.color} />
            <Block position={[7.2, building.height / 2, building.z - 1.8]} scale={[3.5, building.height + 0.8, 4.4]} color={building.color} />
            <Block position={[-4.1, 1.4, building.z + 1.5]} scale={[0.16, 2.8, 0.16]} color="#454653" />
            <mesh position={[-4.1, 2.85, building.z + 1.5]}>
              <octahedronGeometry args={[0.27, 0]} />
              <meshStandardMaterial color="#f3d88b" flatShading />
            </mesh>
            {index % 2 === 0 && <Person position={[2.3, 0, building.z]} color="#637f91" />}
          </group>
        ))}
      </group>

      <group position={[0, 0, -82]}>
        <Block position={[0, 0, 0]} scale={[8.5, 0.24, 15]} color="#8a725f" />
        <Block position={[-6.7, 2.6, 0]} scale={[0.28, 5.3, 15]} color="#724f46" />
        <Block position={[6.7, 2.6, 0]} scale={[0.28, 5.3, 15]} color="#724f46" />
        <Block position={[0, 5.1, 0]} scale={[13.5, 0.25, 15]} color="#6f514c" />
        <Block position={[0, 1, -7]} scale={[8, 1.8, 1.1]} color="#4f5961" />
        <Block position={[0, 1.92, -7]} scale={[8.4, 0.18, 1.4]} color="#d1a55f" />
        <Block position={[-3.5, 0.8, -1.4]} scale={[2.2, 1.2, 2]} color="#b48261" />
        <Block position={[3.5, 0.8, -2.5]} scale={[2.2, 1.2, 2]} color="#b48261" />
        <Person position={[0, 0, -5.6]} color="#a65d63" />
      </group>
    </group>
  )
}

export default App
