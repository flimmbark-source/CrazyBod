import { Canvas } from '@react-three/fiber'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AuthoredJourneyScene } from './world/JourneyScene.jsx'
import { MICROGAME_NAMES as EXPANDED_MICROGAME_NAMES, NewMicrogameContent } from './minigames/catalog.jsx'
import { TUTORIAL_SEQUENCE } from './pacingConfig.js'
import { createPacingDirector, initializePacingDirector, takeSpawnBatch } from './pacingDirector.js'
import { BASE_OVERLOAD_LIMIT, DAY_LENGTH, SCORE_PER_SECOND, phaseForElapsed } from './gameConfig.js'
import {
  createDefaultProgress,
  loadProgress,
  purchaseNode,
  resetSkillTree,
  saveProgress,
  toggleNode,
} from './progression/progressionStore.js'
import { SKILL_NODE_LIST, SKILL_NODES } from './progression/skillTreeConfig.js'

const TUTORIAL_STORAGE_KEY = 'crazybod:tutorial-complete'
const READY_CUE_MS = 1150
const START_CUE_MS = 650
const REHEARSE_TRIGGER = 7.35
const PLAN_TRIGGER = 13.1
const REHEARSE_DURATION = 5
const PLAN_DURATION = 4
const SUPPRESS_PRESSES = 12
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

const REHEARSAL_PROMPTS = [
  {
    line: 'What are you ordering?',
    options: ['Coffee.', 'Tea.', 'Water.'],
    correctOption: null,
  },
  {
    line: 'What do you say at the counter?',
    options: ['A small coffee, please.', 'You know what I want.', 'Anything is fine.'],
    correctOption: 0,
  },
  {
    line: 'What if you miss the question?',
    options: ['Pretend you heard it.', 'Sorry, could you say that again?', 'Leave.'],
    correctOption: 1,
  },
]

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
  const maximumLeft = Math.max(minimumLeft, ((viewportWidth - width - 10) / viewportWidth) * 100)
  const minimumTop = compact ? 18 : 15
  const maximumTop = Math.max(minimumTop, ((viewportHeight - height - 14) / viewportHeight) * 100)
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
      return { left: `${left.toFixed(1)}%`, top: `${top.toFixed(1)}%` }
    }
  }

  return { left: `${fallback.left.toFixed(1)}%`, top: `${fallback.top.toFixed(1)}%` }
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
    for (let index = 2; index < words.length; index += 4) words[index] = '▒▒▒'
  }
  return words.join(' ')
}

function App() {
  const [status, setStatus] = useState('intro')
  const [dayElapsed, setDayElapsed] = useState(0)
  const [runElapsed, setRunElapsed] = useState(0)
  const [microgames, setMicrogames] = useState([])
  const [dialogueOpen, setDialogueOpen] = useState(false)
  const [dialogueAnswered, setDialogueAnswered] = useState(false)
  const [orderDialogueOpen, setOrderDialogueOpen] = useState(false)
  const [orderDialogueAnswered, setOrderDialogueAnswered] = useState(false)
  const [completionEffects, setCompletionEffects] = useState([])
  const [result, setResult] = useState(null)
  const [progress, setProgress] = useState(() => loadProgress())
  const [selectedNodeId, setSelectedNodeId] = useState('normal')
  const [activeTechnique, setActiveTechnique] = useState(null)
  const [runCapacityBonus, setRunCapacityBonus] = useState(0)
  const [suppressedCount, setSuppressedCount] = useState(0)
  const [notice, setNotice] = useState(null)
  const [startCue, setStartCue] = useState(null)
  const [directorReady, setDirectorReady] = useState(false)
  const [tutorialEnabled, setTutorialEnabled] = useState(() => {
    try {
      return window.localStorage.getItem(TUTORIAL_STORAGE_KEY) !== 'true'
    } catch {
      return true
    }
  })
  const [tutorialRun, setTutorialRun] = useState(false)
  const [tutorialStep, setTutorialStep] = useState('none')

  const progressRef = useRef(progress)
  const directorRef = useRef(createPacingDirector())
  const spawnCounterRef = useRef(0)
  const microgamesRef = useRef([])
  const resolvedGamesRef = useRef(new Set())
  const completionEffectIdRef = useRef(0)
  const tutorialFirstSeenRef = useRef(false)
  const tutorialSecondSeenRef = useRef(false)
  const techniqueTriggersRef = useRef(new Set())
  const techniqueOutcomeRef = useRef({})
  const runFinishedRef = useRef(false)
  const clearedCountRef = useRef(0)
  const peakLoadRef = useRef(0)
  const pendingSpawnsRef = useRef([])
  const heldSpawnRef = useRef(null)
  const holdUsedRef = useRef(false)
  const adrenalineUsedRef = useRef(false)
  const suppressUsedRef = useRef(false)
  const spawnBlockedUntilRef = useRef(0)
  const staggerPairsRemainingRef = useRef(0)

  const enabledNodes = useMemo(() => new Set(progress.enabledNodeIds), [progress.enabledNodeIds])
  const overloadLimit = BASE_OVERLOAD_LIMIT
    + (enabledNodes.has('normal') ? 1 : 0)
    + runCapacityBonus
  const currentPhase = phaseForElapsed(dayElapsed)
  const score = Math.floor(dayElapsed * SCORE_PER_SECOND)
  const remainingTime = Math.max(0, Math.ceil(DAY_LENGTH - dayElapsed))
  const load = microgames.length
  const overloadRatio = Math.min(1, load / overloadLimit)
  const overloadShake = Math.max(0, load - 2) * 0.8
  const homeShake = Math.max(0, load - 1) * 0.85
  const distortion = load >= 5 ? 3 : load >= 4 ? 2 : load >= 3 ? 1 : 0
  const tutorialPaused = status === 'playing' && tutorialStep !== 'none'
  const orderingPaused = status === 'playing' && orderDialogueOpen
  const hardPaused = tutorialPaused || orderingPaused
  const dayPaused = hardPaused || Boolean(activeTechnique?.pausesDay)
  const spawningPaused = hardPaused || Boolean(activeTechnique?.pausesSpawns)

  useEffect(() => {
    progressRef.current = progress
  }, [progress])

  const commitProgress = useCallback((updater) => {
    const current = progressRef.current
    const next = typeof updater === 'function' ? updater(current) : updater
    progressRef.current = next
    setProgress(next)
    saveProgress(next)
    return next
  }, [])

  const spawnMicrogame = useCallback((kind, tutorialRole = null) => {
    const index = spawnCounterRef.current
    spawnCounterRef.current += 1
    const game = {
      id: `${kind}-${directorRef.current.seed}-${index}`,
      kind,
      tutorialRole,
      position: positionFor(directorRef.current.seed, index, microgamesRef.current),
    }
    const next = [...microgamesRef.current, game]
    microgamesRef.current = next
    peakLoadRef.current = Math.max(peakLoadRef.current, next.length)
    setMicrogames(next)
    return game
  }, [])

  const queueSpawn = useCallback((kind, releaseAt, mode = 'time') => {
    pendingSpawnsRef.current.push({
      id: `${kind}-${releaseAt}-${pendingSpawnsRef.current.length}`,
      kind,
      releaseAt,
      mode,
    })
  }, [])

  const processSpawnBatch = useCallback((kinds) => {
    if (!kinds.length) return

    if (kinds.length > 1 && staggerPairsRemainingRef.current > 0) {
      spawnMicrogame(kinds[0])
      queueSpawn(kinds[1], runElapsed + 3, 'time')
      staggerPairsRemainingRef.current -= 1
      kinds.slice(2).forEach((kind) => spawnMicrogame(kind))
      return
    }

    kinds.forEach((kind) => {
      const currentLoad = microgamesRef.current.length
      if (
        enabledNodes.has('hold')
        && !holdUsedRef.current
        && currentLoad === overloadLimit - 1
      ) {
        holdUsedRef.current = true
        heldSpawnRef.current = { kind, releaseAt: runElapsed + 5 }
        setNotice('HOLD')
        window.setTimeout(() => setNotice(null), 900)
        return
      }
      spawnMicrogame(kind)
    })
  }, [enabledNodes, overloadLimit, queueSpawn, runElapsed, spawnMicrogame])

  const beginGame = useCallback((withTutorial = false) => {
    const seed = (Date.now() ^ Math.floor(performance.now() * 1000)) >>> 0
    directorRef.current = createPacingDirector(seed)
    spawnCounterRef.current = 0
    microgamesRef.current = []
    resolvedGamesRef.current = new Set()
    tutorialFirstSeenRef.current = false
    tutorialSecondSeenRef.current = false
    techniqueTriggersRef.current = new Set()
    techniqueOutcomeRef.current = {}
    runFinishedRef.current = false
    clearedCountRef.current = 0
    peakLoadRef.current = 0
    pendingSpawnsRef.current = []
    heldSpawnRef.current = null
    holdUsedRef.current = false
    adrenalineUsedRef.current = false
    suppressUsedRef.current = false
    spawnBlockedUntilRef.current = 0
    staggerPairsRemainingRef.current = 0

    setDayElapsed(0)
    setRunElapsed(0)
    setMicrogames([])
    setDialogueOpen(false)
    setDialogueAnswered(false)
    setOrderDialogueOpen(false)
    setOrderDialogueAnswered(false)
    setCompletionEffects([])
    setResult(null)
    setActiveTechnique(null)
    setRunCapacityBonus(0)
    setSuppressedCount(0)
    setNotice(null)
    setTutorialRun(withTutorial)
    setTutorialStep('none')
    setDirectorReady(!withTutorial)
    setStartCue('ready')
    setStatus('countdown')
  }, [])

  const startGame = useCallback(() => beginGame(tutorialEnabled), [beginGame, tutorialEnabled])

  const startTutorialGame = useCallback(() => {
    setTutorialEnabled(true)
    try {
      window.localStorage.removeItem(TUTORIAL_STORAGE_KEY)
    } catch {
      // The current run can still use the tutorial.
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
        // Keep the in-memory value.
      }
      return next
    })
  }

  useEffect(() => {
    if (status !== 'countdown') return undefined
    const timer = window.setTimeout(() => {
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

  useEffect(() => {
    if (status !== 'playing') return undefined
    let last = performance.now()
    const timer = window.setInterval(() => {
      const now = performance.now()
      const delta = Math.min(0.2, (now - last) / 1000)
      last = now
      if (hardPaused) return
      setRunElapsed((current) => current + delta)
      if (!activeTechnique?.pausesDay) {
        setDayElapsed((current) => Math.min(DAY_LENGTH, current + delta))
      }
    }, 50)
    return () => window.clearInterval(timer)
  }, [activeTechnique?.pausesDay, hardPaused, status])

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
    if (status !== 'playing' || spawningPaused || !directorReady) return
    if (runElapsed < spawnBlockedUntilRef.current) return

    const director = directorRef.current
    if (director.nextSpawnAt === null) {
      initializePacingDirector(director, runElapsed)
      return
    }
    if (runElapsed < director.nextSpawnAt) return

    const batch = takeSpawnBatch(director, {
      spawnElapsed: runElapsed,
      phaseId: currentPhase.id,
    })
    processSpawnBatch(batch.kinds)
  }, [currentPhase.id, directorReady, processSpawnBatch, runElapsed, spawningPaused, status])

  useEffect(() => {
    if (status !== 'playing' || spawningPaused) return

    if (heldSpawnRef.current) {
      const shouldRelease = microgames.length <= overloadLimit - 2
        || runElapsed >= heldSpawnRef.current.releaseAt
      if (shouldRelease) {
        const held = heldSpawnRef.current
        heldSpawnRef.current = null
        spawnMicrogame(held.kind)
      }
    }

    if (pendingSpawnsRef.current.length) {
      const ready = pendingSpawnsRef.current.filter((pending) => runElapsed >= pending.releaseAt)
      pendingSpawnsRef.current = pendingSpawnsRef.current.filter((pending) => runElapsed < pending.releaseAt)
      ready.forEach((pending) => spawnMicrogame(pending.kind))
    }
  }, [microgames.length, overloadLimit, runElapsed, spawnMicrogame, spawningPaused, status])

  useEffect(() => {
    if (status !== 'playing' || activeTechnique) return

    if (
      enabledNodes.has('rehearse')
      && !techniqueTriggersRef.current.has('rehearse')
      && dayElapsed >= REHEARSE_TRIGGER
      && dayElapsed < 15
    ) {
      techniqueTriggersRef.current.add('rehearse')
      techniqueOutcomeRef.current = { answered: 0, failed: false }
      setActiveTechnique({
        id: 'rehearse',
        startedAt: runElapsed,
        duration: REHEARSE_DURATION,
        pausesDay: true,
        pausesSpawns: false,
      })
      return
    }

    if (
      enabledNodes.has('plan')
      && !techniqueTriggersRef.current.has('plan')
      && dayElapsed >= PLAN_TRIGGER
      && dayElapsed < 15
    ) {
      techniqueTriggersRef.current.add('plan')
      techniqueOutcomeRef.current = { complete: false, failed: false }
      setActiveTechnique({
        id: 'plan',
        startedAt: runElapsed,
        duration: PLAN_DURATION,
        pausesDay: true,
        pausesSpawns: false,
      })
    }
  }, [activeTechnique, dayElapsed, enabledNodes, runElapsed, status])

  useEffect(() => {
    if (!activeTechnique || activeTechnique.id === 'suppress') return
    if (runElapsed - activeTechnique.startedAt < activeTechnique.duration) return

    if (activeTechnique.id === 'rehearse') {
      const outcome = techniqueOutcomeRef.current
      const success = outcome.answered === REHEARSAL_PROMPTS.length && !outcome.failed
      if (success) {
        setRunCapacityBonus((current) => current + 1)
        setNotice('REHEARSE +1')
      } else {
        const phase = phaseForElapsed(dayElapsed)
        const batch = takeSpawnBatch(directorRef.current, {
          spawnElapsed: runElapsed,
          phaseId: phase.id,
        })
        const fallbackKind = batch.kinds[0]
        processSpawnBatch([fallbackKind, batch.kinds[1] ?? fallbackKind])
        setNotice('REHEARSE FAILED')
      }
      window.setTimeout(() => setNotice(null), 1100)
    }

    if (activeTechnique.id === 'plan') {
      const outcome = techniqueOutcomeRef.current
      if (outcome.complete && !outcome.failed) {
        staggerPairsRemainingRef.current = 2
        setNotice('PLAN READY')
        window.setTimeout(() => setNotice(null), 1100)
      }
    }

    setActiveTechnique(null)
  }, [activeTechnique, dayElapsed, processSpawnBatch, runElapsed])

  useEffect(() => {
    if (status !== 'playing' || activeTechnique) return
    if (!enabledNodes.has('adrenaline') || adrenalineUsedRef.current) return
    if (load < overloadLimit - 1) return

    adrenalineUsedRef.current = true
    spawnBlockedUntilRef.current = Math.max(spawnBlockedUntilRef.current, runElapsed + 6)
    setNotice('ADRENALINE')
    window.setTimeout(() => setNotice(null), 1100)
  }, [activeTechnique, enabledNodes, load, overloadLimit, runElapsed, status])

  const finishRun = useCallback((outcome) => {
    if (runFinishedRef.current) return
    runFinishedRef.current = true

    const rawScore = Math.floor(dayElapsed * SCORE_PER_SECOND)
    const finalScore = outcome === 'overload' ? Math.floor(rawScore * 0.25) : rawScore
    const wasTreeUnlocked = progressRef.current.treeUnlocked
    const nextProgress = {
      ...progressRef.current,
      bank: progressRef.current.bank + finalScore,
      treeUnlocked: true,
      completedRuns: progressRef.current.completedRuns + 1,
      highScore: Math.max(progressRef.current.highScore, finalScore),
    }
    commitProgress(nextProgress)
    setResult({
      outcome,
      rawScore,
      finalScore,
      banked: finalScore,
      dayElapsed,
      runElapsed,
      cleared: clearedCountRef.current,
      suppressed: suppressedCount,
      peakLoad: peakLoadRef.current,
      firstUnlock: !wasTreeUnlocked,
    })
    setActiveTechnique(null)
    setStatus(outcome)
  }, [commitProgress, dayElapsed, runElapsed, suppressedCount])

  useEffect(() => {
    if (status !== 'playing' || activeTechnique?.id === 'suppress') return
    if (load < overloadLimit) return

    if (enabledNodes.has('suppress') && !suppressUsedRef.current) {
      suppressUsedRef.current = true
      setActiveTechnique({
        id: 'suppress',
        startedAt: runElapsed,
        pausesDay: true,
        pausesSpawns: true,
      })
      return
    }

    finishRun('overload')
  }, [activeTechnique?.id, enabledNodes, finishRun, load, overloadLimit, runElapsed, status])

  useEffect(() => {
    if (status !== 'playing' || dayElapsed < DAY_LENGTH) return
    finishRun('complete')
  }, [dayElapsed, finishRun, status])

  useEffect(() => {
    if (!result?.firstUnlock || !['home', 'overload', 'complete'].includes(status)) return undefined
    const timer = window.setTimeout(() => setStatus('tree-unlock'), 2400)
    return () => window.clearTimeout(timer)
  }, [result, status])

  useEffect(() => {
    if (status !== 'tree-unlock') return undefined
    const timer = window.setTimeout(() => setStatus('tree'), 1500)
    return () => window.clearTimeout(timer)
  }, [status])

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
    const next = microgamesRef.current.filter((game) => game.id !== id)
    microgamesRef.current = next
    setMicrogames(next)

    if (tutorialRun && tutorialStep === 'first' && resolvedGame?.tutorialRole === 'first') {
      setTutorialStep('none')
    }
    if (tutorialRun && tutorialStep === 'second' && resolvedGame?.tutorialRole === 'second') {
      setTutorialStep('home')
    }
  }, [tutorialRun, tutorialStep])

  const completeSuppression = useCallback(() => {
    const current = [...microgamesRef.current]
    const count = Math.ceil(current.length / 2)
    const shuffled = [...current].sort(() => Math.random() - 0.5)
    const suppressedIds = new Set(shuffled.slice(0, count).map((game) => game.id))
    const next = current.filter((game) => !suppressedIds.has(game.id))
    microgamesRef.current = next
    setMicrogames(next)
    setSuppressedCount((value) => value + count)
    setActiveTechnique(null)
    setNotice(`SUPPRESSED ${count}`)
    window.setTimeout(() => setNotice(null), 1100)
  }, [])

  const goHome = () => finishRun('home')

  const answerDialogue = () => {
    setDialogueAnswered(true)
    setDialogueOpen(false)
  }

  const answerOrderDialogue = () => {
    setOrderDialogueAnswered(true)
    setOrderDialogueOpen(false)
  }

  useEffect(() => {
    if (status !== 'playing') return
    if (dayElapsed >= 25 && !dialogueAnswered) setDialogueOpen(true)
  }, [dayElapsed, dialogueAnswered, status])

  useEffect(() => {
    if (status !== 'playing') return
    if (dayElapsed >= 35 && dialogueAnswered && !orderDialogueAnswered) {
      setOrderDialogueOpen(true)
    }
  }, [dayElapsed, dialogueAnswered, orderDialogueAnswered, status])

  const finishTutorial = () => {
    try {
      window.localStorage.setItem(TUTORIAL_STORAGE_KEY, 'true')
    } catch {
      // The tutorial still finishes for this session.
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

  const purchaseSelectedNode = () => {
    const next = purchaseNode(progressRef.current, selectedNodeId)
    if (next !== progressRef.current) commitProgress(next)
  }

  const toggleSelectedNode = () => {
    const next = toggleNode(progressRef.current, selectedNodeId)
    if (next !== progressRef.current) commitProgress(next)
  }

  const resetTree = () => {
    if (!window.confirm('Reset the skill tree? Spent score will not be refunded.')) return
    commitProgress(resetSkillTree(progressRef.current))
    setSelectedNodeId('normal')
  }

  const resetSave = () => {
    if (!window.confirm('Reset all CrazyBod progress?')) return
    const next = createDefaultProgress()
    commitProgress(next)
    try {
      window.localStorage.removeItem(TUTORIAL_STORAGE_KEY)
    } catch {
      // Ignore storage failures.
    }
    setTutorialEnabled(true)
    setSelectedNodeId('normal')
    setStatus('intro')
  }

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
            active={status === 'playing' && !dayPaused}
            dialogueStage={dialogueOpen ? 'mara' : orderDialogueOpen ? 'order' : null}
          />
        </Canvas>
      </div>

      {startCue && (
        <section className={`race-start-cue race-start-cue-${startCue}`} aria-live="assertive">
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
            <div className="phase-label">{currentPhase.label}</div>
            <div className="hud-panel score-panel">
              <span className="hud-label">SCORE</span>
              <strong>{score}</strong>
            </div>
          </header>

          <div
            className={`load-meter${activeTechnique?.id === 'suppress' ? ' suppress-active' : ''}`}
            aria-label={`Overload ${load} of ${overloadLimit}`}
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
              {Array.from({ length: overloadLimit }).map((_, index) => (
                <i key={index} className={index >= overloadLimit - load ? 'filled' : ''} />
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
              overloadLimit={overloadLimit}
              onProceed={advanceTutorial}
            />
          )}

          <section className="completion-fx-layer" aria-hidden="true">
            {completionEffects.map((effect) => (
              <CompletionBurst key={effect.id} effect={effect} />
            ))}
          </section>

          {dialogueOpen && (
            <DialogueBox dialogue={MARA_DIALOGUE} load={load} distortion={distortion} onAnswer={answerDialogue} />
          )}

          {orderDialogueOpen && (
            <DialogueBox dialogue={ORDER_DIALOGUE} load={load} distortion={distortion} onAnswer={answerOrderDialogue} />
          )}

          {activeTechnique?.id === 'rehearse' && (
            <RehearsalTechnique
              elapsed={runElapsed - activeTechnique.startedAt}
              onOutcomeChange={(outcome) => { techniqueOutcomeRef.current = outcome }}
            />
          )}

          {activeTechnique?.id === 'plan' && (
            <PlanTechnique
              elapsed={runElapsed - activeTechnique.startedAt}
              onOutcomeChange={(outcome) => { techniqueOutcomeRef.current = outcome }}
            />
          )}

          {activeTechnique?.id === 'suppress' && (
            <SuppressionTechnique pressesNeeded={SUPPRESS_PRESSES} onComplete={completeSuppression} />
          )}

          {notice && <div className="skill-notice">{notice}</div>}

          <button
            className={`go-home${tutorialStep === 'home' ? ' tutorial-target tutorial-home-target' : ''}`}
            type="button"
            onClick={goHome}
            disabled={hardPaused || activeTechnique?.id === 'suppress'}
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
          <p>Try to finish your day. Minigames will pop up. Too many on screen and you will crash.</p>
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
          {progress.treeUnlocked && (
            <button type="button" className="secondary-action" onClick={() => setStatus('tree')}>SKILL TREE</button>
          )}
        </OverlayCard>
      )}

      {['home', 'overload', 'complete'].includes(status) && result && (
        <ResultsScreen
          result={result}
          bank={progress.bank}
          onRestart={startGame}
          onTree={() => setStatus('tree')}
        />
      )}

      {status === 'tree-unlock' && (
        <OverlayCard eyebrow="UNLOCKED" title="SKILL TREE">
          <p>Spend banked score on skills. Purchased skills are active until you switch them off.</p>
          <button type="button" onClick={() => setStatus('tree')}>OPEN SKILL TREE</button>
        </OverlayCard>
      )}

      {status === 'tree' && (
        <SkillTreeScreen
          progress={progress}
          selectedNodeId={selectedNodeId}
          onSelect={setSelectedNodeId}
          onPurchase={purchaseSelectedNode}
          onToggle={toggleSelectedNode}
          onStart={() => beginGame(tutorialEnabled)}
          onBack={() => setStatus('intro')}
          onResetTree={resetTree}
          onResetSave={resetSave}
        />
      )}
    </main>
  )
}

function SkillTreeScreen({
  progress,
  selectedNodeId,
  onSelect,
  onPurchase,
  onToggle,
  onStart,
  onBack,
  onResetTree,
  onResetSave,
}) {
  const selected = SKILL_NODES[selectedNodeId] ?? SKILL_NODES.normal
  const purchased = new Set(progress.purchasedNodeIds)
  const revealed = new Set(progress.revealedNodeIds)
  const enabled = new Set(progress.enabledNodeIds)
  const canAfford = progress.bank >= selected.cost
  const prerequisitesMet = selected.parents.every((id) => purchased.has(id))
  const selectedPurchased = purchased.has(selected.id)

  return (
    <section className="skill-tree-screen" aria-label="Skill tree">
      <header className="skill-tree-header">
        <button type="button" className="tree-back" onClick={onBack}>BACK</button>
        <div>
          <span>SKILL TREE</span>
          <strong>{progress.bank}</strong>
          <small>BANKED SCORE</small>
        </div>
        <button type="button" onClick={onStart}>START THE DAY</button>
      </header>

      <div className="skill-tree-layout">
        <div className="skill-tree-map">
          <svg className="skill-tree-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {SKILL_NODE_LIST.flatMap((node) => node.children.map((childId) => {
              const child = SKILL_NODES[childId]
              if (!revealed.has(childId)) return null
              return (
                <line
                  key={`${node.id}-${childId}`}
                  x1={node.position.x}
                  y1={node.position.y}
                  x2={child.position.x}
                  y2={child.position.y}
                  className={purchased.has(node.id) ? 'owned-line' : ''}
                />
              )
            }))}
          </svg>

          {SKILL_NODE_LIST.map((node) => {
            if (!revealed.has(node.id)) return null
            const isPurchased = purchased.has(node.id)
            const isEnabled = enabled.has(node.id)
            const affordable = progress.bank >= node.cost
            const state = isPurchased
              ? isEnabled ? 'enabled' : 'disabled'
              : affordable ? 'available' : 'unaffordable'
            return (
              <button
                key={node.id}
                type="button"
                className={`skill-node state-${state}${selectedNodeId === node.id ? ' selected' : ''}`}
                style={{ left: `${node.position.x}%`, top: `${node.position.y}%` }}
                onClick={() => onSelect(node.id)}
              >
                <strong>{node.name}</strong>
                <span>{isPurchased ? isEnabled ? 'ON' : 'OFF' : node.cost}</span>
              </button>
            )
          })}
        </div>

        <aside className="skill-detail">
          <span>{selected.type}</span>
          <h2>{selected.name}</h2>
          <div className="skill-detail-meta">
            <strong>{selectedPurchased ? enabled.has(selected.id) ? 'ACTIVE' : 'INACTIVE' : `${selected.cost} SCORE`}</strong>
            <small>{selected.meta}</small>
          </div>
          <p>{selected.description}</p>

          {selectedPurchased ? (
            <button type="button" onClick={onToggle}>{enabled.has(selected.id) ? 'TURN OFF' : 'TURN ON'}</button>
          ) : (
            <button type="button" onClick={onPurchase} disabled={!canAfford || !prerequisitesMet}>
              {!prerequisitesMet ? 'REQUIRES PREVIOUS SKILL' : canAfford ? `BUY FOR ${selected.cost}` : `NEED ${selected.cost - progress.bank} MORE`}
            </button>
          )}
        </aside>
      </div>

      <footer className="skill-tree-footer">
        <button type="button" onClick={onResetTree}>RESET TREE</button>
        <button type="button" onClick={onResetSave}>RESET SAVE</button>
      </footer>
    </section>
  )
}

function ResultsScreen({ result, bank, onRestart, onTree }) {
  const copy = {
    home: { eyebrow: 'DAY RESULT', title: 'SAFE RETURN', note: 'You chose to stop.' },
    overload: { eyebrow: 'DAY RESULT', title: 'OVERLOADED', note: 'Your capacity ran out.' },
    complete: { eyebrow: 'DAY RESULT', title: 'MADE IT', note: 'You finished.' },
  }[result.outcome]

  return (
    <OverlayCard eyebrow={copy.eyebrow} title={copy.title}>
      <p>{copy.note}</p>
      <div className="result-ledger">
        <div><span>EARNED</span><strong>{result.rawScore}</strong></div>
        {result.outcome === 'overload' && (
          <div><span>OVERLOAD</span><strong>-{result.rawScore - result.finalScore}</strong></div>
        )}
        <div className="result-total"><span>BANKED</span><strong>{result.banked}</strong></div>
      </div>
      <div className="result-stats">
        <div><span>RUN TIME</span><strong>{result.runElapsed.toFixed(1)}s</strong></div>
        <div><span>CLEARED</span><strong>{result.cleared}</strong></div>
        <div><span>SUPPRESSED</span><strong>{result.suppressed}</strong></div>
        <div><span>PEAK LOAD</span><strong>{result.peakLoad}</strong></div>
      </div>
      <div className="bank-total"><span>BANK</span><strong>{bank}</strong></div>
      <div className="result-actions-inline">
        <button type="button" onClick={onRestart}>TRY ANOTHER DAY</button>
        <button type="button" className="secondary-action" onClick={onTree}>SKILL TREE</button>
      </div>
    </OverlayCard>
  )
}

function RehearsalTechnique({ elapsed, onOutcomeChange }) {
  const [index, setIndex] = useState(0)
  const [failed, setFailed] = useState(false)
  const prompt = REHEARSAL_PROMPTS[Math.min(index, REHEARSAL_PROMPTS.length - 1)]
  const complete = index >= REHEARSAL_PROMPTS.length

  useEffect(() => {
    onOutcomeChange({ answered: index, failed })
  }, [failed, index, onOutcomeChange])

  const answer = (optionIndex) => {
    if (complete) return
    const wrong = prompt.correctOption !== null && prompt.correctOption !== optionIndex
    if (wrong) setFailed(true)
    setIndex((current) => current + 1)
  }

  return (
    <section className="technique-panel rehearsal-panel" aria-label="Rehearse">
      <header>
        <span>REHEARSE</span>
        <strong>{Math.max(0, REHEARSE_DURATION - elapsed).toFixed(1)}s</strong>
      </header>
      {complete ? (
        <p className={failed ? 'technique-failed' : 'technique-ready'}>{failed ? 'OFF SCRIPT' : 'READY'}</p>
      ) : (
        <>
          <p>{prompt.line}</p>
          <div>
            {prompt.options.map((option, optionIndex) => (
              <button key={option} type="button" onClick={() => answer(optionIndex)}>{option}</button>
            ))}
          </div>
        </>
      )}
    </section>
  )
}

function PlanTechnique({ elapsed, onOutcomeChange }) {
  const steps = ['LEAVE HOME', 'WALK TO CAFÉ', 'ORDER']
  const [nextIndex, setNextIndex] = useState(0)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    onOutcomeChange({ complete: nextIndex === steps.length, failed })
  }, [failed, nextIndex, onOutcomeChange, steps.length])

  const choose = (index) => {
    if (nextIndex >= steps.length) return
    if (index !== nextIndex) {
      setFailed(true)
      return
    }
    setNextIndex((current) => current + 1)
  }

  return (
    <section className="technique-panel plan-panel" aria-label="Plan">
      <header>
        <span>PLAN</span>
        <strong>{Math.max(0, PLAN_DURATION - elapsed).toFixed(1)}s</strong>
      </header>
      <p>Put the day in order.</p>
      <div className="plan-options">
        {[2, 0, 1].map((index) => (
          <button
            key={steps[index]}
            type="button"
            className={index < nextIndex ? 'done' : ''}
            onClick={() => choose(index)}
          >
            {steps[index]}
          </button>
        ))}
      </div>
    </section>
  )
}

function SuppressionTechnique({ pressesNeeded, onComplete }) {
  const [presses, setPresses] = useState(0)
  const finishedRef = useRef(false)

  const squeeze = useCallback(() => {
    if (finishedRef.current) return
    setPresses((current) => {
      const next = Math.min(pressesNeeded, current + 1)
      if (next >= pressesNeeded) {
        finishedRef.current = true
        window.queueMicrotask(onComplete)
      }
      return next
    })
  }, [onComplete, pressesNeeded])

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.code !== 'Space' || event.repeat) return
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation?.()
      squeeze()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [squeeze])

  return (
    <section className="suppression-layer" aria-label="Suppress">
      <div className="suppression-grip" style={{ '--squeeze': presses / pressesNeeded }}>
        <span>OVERLOAD</span>
        <strong>SUPPRESS</strong>
        <div className="suppression-meter"><i style={{ width: `${(presses / pressesNeeded) * 100}%` }} /></div>
        <button type="button" onClick={squeeze}>MASH SPACE</button>
      </div>
    </section>
  )
}

function TutorialCallout({ step, overloadLimit, onProceed }) {
  if (step === 'summary') {
    return (
      <section className="tutorial-layer tutorial-layer-summary" role="dialog" aria-modal="true">
        <div className="tutorial-callout tutorial-callout-summary">
          <span>HOW THE DAY WORKS</span>
          <strong>Keep the screen clear.</strong>
          <p>Clear minigames before {overloadLimit} pile up and you become overwhelmed.</p>
          <button type="button" onClick={onProceed}>PROCEED</button>
        </div>
      </section>
    )
  }

  const copy = step === 'first'
    ? { eyebrow: 'FIRST MINIGAME', title: 'Hold to clear it.', body: 'Hold the button or Space until it clears.' }
    : step === 'second'
      ? { eyebrow: 'A DIFFERENT MINIGAME', title: 'This one uses movement.', body: 'Use the arrow keys or WASD to reach the exit.' }
      : { eyebrow: 'WHEN IT IS TOO MUCH', title: 'Go Home if you feel overwhelmed.', body: '' }

  return (
    <section className={`tutorial-layer tutorial-layer-${step}`} aria-live="polite">
      <aside className={`tutorial-callout tutorial-callout-${step}`}>
        <span>{copy.eyebrow}</span>
        <strong>{copy.title}</strong>
        {copy.body && <p>{copy.body}</p>}
        {step === 'home' && <button type="button" onClick={onProceed}>GOT IT</button>}
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
      <button type="button" onClick={shift} style={{ transform: `translateX(${(presses % 3 - 1) * 16}px)` }}>ADJUST</button>
      <div className="tiny-progress"><i style={{ width: `${(presses / needed) * 100}%` }} /></div>
    </div>
  )
}

function AnxietyGame({ onResolve }) {
  const [hits, setHits] = useState(0)
  const targets = useMemo(() => [[18, 22], [72, 18], [43, 48], [78, 72], [24, 76]], [])
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
          if (next >= needed) window.queueMicrotask(onResolve)
          return next
        })
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [onResolve])

  const stopHolding = () => { holdingRef.current = false }

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

export default App
