import { Canvas } from '@react-three/fiber'
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AuthoredJourneyScene } from './world/JourneyScene.jsx'
import SnapshotCaptureBridge from './world/SnapshotCaptureBridge.jsx'
import { deriveProgressionEffects } from './progression/deriveProgressionEffects.js'
import { useMandalaRun } from './modes/mandala/useMandalaRun.js'
import MandalaScene from './modes/mandala/MandalaScene.jsx'
import MandalaEnemyLayer from './modes/mandala/MandalaEnemyLayer.jsx'
import SwordCursor from './modes/sword/SwordCursor.jsx'
import { NewMicrogameContent } from './minigames/catalog.jsx'
import { TUTORIAL_SEQUENCE } from './pacingConfig.js'
import {
  createPacingDirector,
  initializePacingDirector,
  takeSpawnBatch,
  drawSpawnKinds,
} from './pacingDirector.js'
import RehearsalTechnique from './techniques/RehearsalTechnique.jsx'
import PlanTechnique from './techniques/PlanTechnique.jsx'
import StretchTechnique from './techniques/StretchTechnique.jsx'
import SuppressionTechnique from './techniques/SuppressionTechnique.jsx'
import {
  REHEARSAL_SEQUENCE,
  PLAN_SEQUENCE,
  STRETCH_SEQUENCE,
  PHYSICAL_SYMPTOM_KINDS,
  rehearsalSucceeded,
  scheduledSucceeded,
  stretchSucceeded,
  suppressionSplit,
} from './techniques/techniqueEngine.js'

const PHYSICAL_SYMPTOM_KIND_SET = new Set(PHYSICAL_SYMPTOM_KINDS)
import { getNode } from './progression/skillTreeConfig.js'
import { setAutoTargetEnabled } from './microgameEnhancements.js'
import {
  DAY_LENGTH,
  OVERLOAD_SCORE_MULTIPLIER,
  phaseFor,
  scoreForElapsed,
} from './config/gameConfig.js'
import ResultsScreen from './results/ResultsScreen.jsx'
import { useProgression } from './progression/useProgression.js'
import { computeCapacity } from './progression/progressionStore.js'
import SkillTreeScreen from './progression/SkillTreeScreen.jsx'
import SettingsMenu from './settings/SettingsMenu.jsx'
import { useT } from './i18n/i18n.js'
import DialogueBox from './dialogue/DialogueBox.jsx'
import CafeNarrativeBeatScene from './narrative/CafeNarrativeBeatScene.jsx'
import {
  CAFE_BEAT_PHASES,
  CAFE_BEAT_START_AT,
  CAFE_BEAT_TIMINGS,
  CAFE_DIALOGUE,
  advanceCafeConversation,
  isCafeBeatFrozen,
} from './narrative/cafeBeat.js'

const TUTORIAL_STORAGE_KEY = 'crazybod:tutorial-complete'
const READY_CUE_MS = 1150
const START_CUE_MS = 650

// Run snapshots: a handful of candid shots taken before the first conversation,
// then one at every dialogue choice. Kept in memory for the run only.
const MAX_RUN_SNAPSHOTS = 14
const AMBIENT_SNAPSHOT_COUNT = 3
// The first conversation (Mara) opens at day 25s; keep the candid shots before
// it, spaced out across the early walk.
const AMBIENT_SNAPSHOT_WINDOW = [4, 23]

// Pick a few ascending, well-spaced random day-times for the candid snapshots.
function buildAmbientSnapshotTimes() {
  const [start, end] = AMBIENT_SNAPSHOT_WINDOW
  const span = (end - start) / AMBIENT_SNAPSHOT_COUNT
  const times = []
  for (let index = 0; index < AMBIENT_SNAPSHOT_COUNT; index += 1) {
    const slotStart = start + span * index
    times.push(slotStart + Math.random() * span * 0.8)
  }
  return times
}

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

// Build the translated one-off conversations from the current translate fn.
function buildMaraDialogue(t) {
  return {
    speaker: t('speaker.Mara'),
    line: t('mara.line'),
    options: [t('mara.opt.0'), t('mara.opt.1'), t('mara.opt.2')],
  }
}

function buildOrderDialogue(t) {
  return {
    speaker: t('speaker.Barista'),
    line: t('order.line'),
    options: [t('order.opt.0'), t('order.opt.1'), t('order.opt.2')],
  }
}

// Translate the café finale conversation while keeping its shape aligned with
// the authored (English) source that the tests assert against.
function buildCafeDialogue(t) {
  return CAFE_DIALOGUE.map((exchange, index) => ({
    speaker: t('speaker.Mara'),
    line: t(`cafe.${index}.line`),
    options: exchange.options.map((_, optionIndex) => t(`cafe.${index}.opt.${optionIndex}`)),
  }))
}

function buildCafeRuptureDialogue(t) {
  return {
    speaker: t('speaker.Mara'),
    line: t('cafe.rupture.line'),
    options: [],
  }
}

// Caption for a choice snapshot: the line the player picked, in quotes.
function quoteChoice(dialogue, index) {
  const option = dialogue?.options?.[index]
  const text = typeof option === 'string' ? option : option?.label ?? ''
  return text ? `“${text}”` : ''
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

function edgeOffsetFor(position) {
  const { viewportWidth, viewportHeight, width, height } = microgameViewportSize()
  const left = (Number.parseFloat(position.left) / 100) * viewportWidth
  const top = (Number.parseFloat(position.top) / 100) * viewportHeight
  const centerX = left + width / 2
  const centerY = top + height / 2
  const horizontal = centerX - viewportWidth / 2
  const vertical = centerY - viewportHeight / 2
  const edge = 12

  if (Math.abs(horizontal) >= Math.abs(vertical)) {
    return {
      x: horizontal < 0 ? edge - left : viewportWidth - width - edge - left,
      y: 0,
    }
  }

  return {
    x: 0,
    y: vertical < 0 ? edge - top : viewportHeight - height - edge - top,
  }
}

function App() {
  const t = useT()
  const [status, setStatus] = useState('intro')
  // Three clocks, split from the single `elapsed` value:
  //  - dayElapsed  : scored day time. Drives score, phase, world, completion.
  //                  Pauses during techniques, tutorial and order dialogue.
  //  - spawnElapsed: the spawn clock. Advances only while spawning is enabled.
  //  - runElapsed  : real time since the run began. Kept in a ref only
  //                  (runElapsedRef) and read at end-of-run for statistics.
  //                  It is never rendered, so it must not be React state — a
  //                  per-tick setState here forced the whole tree (including the
  //                  3D café) to reconcile ten times a second.
  const [dayElapsed, setDayElapsed] = useState(0)
  const [spawnElapsed, setSpawnElapsed] = useState(0)
  const [activeTechnique, setActiveTechnique] = useState(null)
  const [microgames, setMicrogames] = useState([])
  const [dialogueOpen, setDialogueOpen] = useState(false)
  const [dialogueAnswered, setDialogueAnswered] = useState(false)
  const [orderDialogueOpen, setOrderDialogueOpen] = useState(false)
  const [orderDialogueAnswered, setOrderDialogueAnswered] = useState(false)
  const [cafeBeatPhase, setCafeBeatPhase] = useState(CAFE_BEAT_PHASES.INACTIVE)
  const [cafeDialogueIndex, setCafeDialogueIndex] = useState(0)
  const [result, setResult] = useState(null)
  const [runSnapshots, setRunSnapshots] = useState([])
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
  // Central capability derivation (Sword / Mandala / Dive) from enabled nodes.
  const progressionEffects = deriveProgressionEffects(progression.enabledNodeIds)
  // Mandala travel simulation. Owned by its own hook; App only coordinates.
  const mandala = useMandalaRun()
  // Screen-space slash targets: encounters (inside the Canvas) project into this
  // Map every frame; the Sword overlay (DOM) reads it to test slashes.
  const mandalaRegistryRef = useRef(new Map())
  // Screen-space enemy projections (id -> {kind,x,y,pixelRadius,state,...}) the
  // DOM minigame-enemy layer renders from, plus the set of ids the sword just
  // cut (drained by the enemy layer to play death animations).
  const mandalaEnemiesRef = useRef(new Map())
  // id -> cut info {cx,cy,ax,ay,bx,by} (screen px) for foes the sword just cut;
  // drained by the enemy layer to slice each panel along the actual blade path.
  const mandalaDeathsRef = useRef(new Map())
  // Live inputs the in-Canvas stepper reads each frame. A stable object mutated
  // imperatively so key events never need a React re-render.
  const mandalaInputsRef = useRef({ diveEnabled: false, forwardHeld: false, capacity: 5 })
  const mandalaRunIdRef = useRef(null)
  const [firstUnlockPending, setFirstUnlockPending] = useState(false)
  const [treeFirstView, setTreeFirstView] = useState(false)
  const [runCapacityBonus, setRunCapacityBonus] = useState(0)
  const [spawnPaused, setSpawnPaused] = useState(false)
  const [suppressing, setSuppressing] = useState(false)
  const suppressUsedRef = useRef(false)
  const prevUnlockedRef = useRef(progression.treeUnlocked)
  const capacityRef = useRef(0)
  const rehearsalFiredRef = useRef(false)
  const planFiredRef = useRef(false)
  const adrenalineFiredRef = useRef(false)
  const planStaggerRemainingRef = useRef(0)
  const stretchFiredRef = useRef(false)
  // While the day clock is below this value, a completed stretch thins the
  // physical-symptom spawns. 0 means the benefit is inactive.
  const stretchThinUntilRef = useRef(0)
  const pendingSpawnsRef = useRef([])
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
  const walkoutClockStartRef = useRef(null)
  const dayAdvancingRef = useRef(false)
  const spawningEnabledRef = useRef(false)
  const clearedCountRef = useRef(0)
  const peakLoadRef = useRef(0)
  const spawnedCountRef = useRef(0)
  const suppressedCountRef = useRef(0)
  const runFinishedRef = useRef(false)
  // Registered by the in-Canvas SnapshotCaptureBridge; returns a JPEG data URL
  // of the current 3D frame, or null if capture is unavailable.
  const captureSnapshotRef = useRef(null)
  const snapshotIdRef = useRef(0)
  // Ascending day-times still awaiting a candid snapshot this run.
  const pendingSnapshotTimesRef = useRef([])

  const registerSnapshotCapture = useCallback((fn) => {
    captureSnapshotRef.current = fn
  }, [])

  // Grab the current frame and file it as a run snapshot. Safe to call from a
  // click handler: it reads the last rendered frame, it does not force a render.
  const takeSnapshot = useCallback((caption, kind) => {
    const capture = captureSnapshotRef.current
    if (typeof capture !== 'function') return
    const src = capture()
    if (!src) return
    const id = snapshotIdRef.current
    snapshotIdRef.current += 1
    setRunSnapshots((current) => {
      const next = [...current, { id, src, caption: caption ?? '', kind: kind ?? 'ambient' }]
      return next.length > MAX_RUN_SNAPSHOTS ? next.slice(next.length - MAX_RUN_SNAPSHOTS) : next
    })
  }, [])

  // Translated, per-render conversation data and phase label. Built from the
  // authored English source so the rendered UI follows the selected language.
  const maraDialogue = buildMaraDialogue(t)
  const orderDialogue = buildOrderDialogue(t)
  const cafeDialogue = buildCafeDialogue(t)
  const cafeRuptureDialogue = buildCafeRuptureDialogue(t)
  const phaseName = (elapsed) => t(`phase.${phaseFor(elapsed).id}`)

  const score = scoreForElapsed(dayElapsed)
  const remainingTime = Math.max(0, Math.ceil(DAY_LENGTH - dayElapsed))
  const currentPhaseId = phaseFor(dayElapsed).id
  // The 3D scene only animates during the countdown, an active run, or a mandala
  // descent. Every other screen shows a still backdrop, so the render loop can
  // idle (see the Canvas `frameloop` prop below).
  const sceneAnimating = status === 'countdown' || status === 'playing' || status === 'mandala'
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
  const cafeBeatActive = status === 'playing' && cafeBeatPhase !== CAFE_BEAT_PHASES.INACTIVE
  // Mara's walk-out (her outburst, then leaving) is when the day's final seconds
  // tick away to zero — see the walk-out clock effect below.
  const cafeBeatWalkingOut = cafeBeatPhase === CAFE_BEAT_PHASES.RUPTURE
    || cafeBeatPhase === CAFE_BEAT_PHASES.DEPARTURE
  const cafeBeatFrozen = isCafeBeatFrozen(cafeBeatPhase)
  const gameplayPaused = tutorialPaused || orderingPaused || cafeBeatFrozen
  // Subsystem gates. Techniques (added later) can pause the day and/or spawns
  // independently; the tutorial and order dialogue pause both.
  // The main clock does not advance the day during the café beat: the timer
  // holds at its remaining value through the conversation, then the walk-out
  // clock effect below drives it down to zero as Mara leaves.
  const dayAdvancing = status === 'playing'
    && !tutorialPaused
    && !orderingPaused
    && !suppressing
    && !cafeBeatActive
    && !activeTechnique?.pausesDay
  // Spawning keeps going through Mara's conversation: the symptoms don't stop
  // just because you sat down. The café dialogue reads `distortion` off `load`,
  // so the talk garbles as the board fills. Spawning only stops once she erupts
  // and leaves (the frozen phases), when the board is already inert.
  const spawningEnabled = status === 'playing'
    && directorReady
    && !tutorialPaused
    && !orderingPaused
    && !spawnPaused
    && !suppressing
    && !cafeBeatFrozen
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
    planFiredRef.current = false
    adrenalineFiredRef.current = false
    planStaggerRemainingRef.current = 0
    stretchFiredRef.current = false
    stretchThinUntilRef.current = 0
    pendingSpawnsRef.current = []
    suppressUsedRef.current = false
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
    snapshotIdRef.current = 0
    pendingSnapshotTimesRef.current = buildAmbientSnapshotTimes()
    setRunSnapshots([])
    setDayElapsed(0)
    setSpawnElapsed(0)
    setActiveTechnique(null)
    setRunCapacityBonus(0)
    setSpawnPaused(false)
    setSuppressing(false)
    setMicrogames([])
    setCompletionEffects([])
    setDialogueOpen(false)
    setDialogueAnswered(false)
    setOrderDialogueOpen(false)
    setOrderDialogueAnswered(false)
    setCafeBeatPhase(CAFE_BEAT_PHASES.INACTIVE)
    setCafeDialogueIndex(0)
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

  // Route director spawns through the spawn-control hooks. A game is either
  // placed now or pushed onto the pending queue for later release.
  const requestSpawns = useCallback((entries) => {
    const planActive = planStaggerRemainingRef.current > 0
    const planDelay = getNode('plan').effect.staggerDelaySeconds ?? 3
    let staggeredThisBatch = false

    // Stretch Every Joint: while the warm-up still holds, loosened joints let
    // some of the physical symptoms slide off before they land.
    const stretchActive = dayElapsedRef.current < stretchThinUntilRef.current
    const thinChance = getNode('stretch').effect.thinChance ?? 0.5

    entries.forEach((entry) => {
      // Run Through the Plan: delay the second game of the next pair spawns.
      if (planActive && entry.slot === 'pair') {
        pendingSpawnsRef.current.push({
          kind: entry.kind,
          releaseAt: spawnElapsedRef.current + planDelay,
          releaseCondition: 'time',
        })
        staggeredThisBatch = true
        return
      }
      if (
        stretchActive
        && PHYSICAL_SYMPTOM_KIND_SET.has(entry.kind)
        && Math.random() < thinChance
      ) {
        return
      }
      spawnMicrogame(entry.kind)
    })

    if (staggeredThisBatch && planStaggerRemainingRef.current > 0) {
      planStaggerRemainingRef.current -= 1
    }
  }, [spawnMicrogame])

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

      // runElapsedRef is intentionally not mirrored into state: it is only read
      // once, at end-of-run, for statistics. Keeping it out of the render path
      // avoids ten forced reconciliations per second.
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
      purchasedUpgrades: progression.purchasedNodeIds.length,
    })
    requestSpawns(batch.kinds)
  }, [spawningEnabled, spawnElapsed, currentPhaseId, requestSpawns, progression.purchasedNodeIds.length])

  // Release pending (staggered) spawns once their delay has elapsed. Held only
  // while the board is frozen (Mara's walk-out), not during the conversation.
  useEffect(() => {
    if (status !== 'playing' || spawnPaused || cafeBeatFrozen) return
    const queue = pendingSpawnsRef.current
    if (queue.length === 0) return

    const now = spawnElapsedRef.current
    const ready = []
    const rest = []
    for (const item of queue) {
      ;(now >= item.releaseAt ? ready : rest).push(item)
    }
    if (ready.length) {
      pendingSpawnsRef.current = rest
      ready.forEach((item) => spawnMicrogame(item.kind))
    }
  }, [spawnElapsed, load, status, spawnPaused, cafeBeatFrozen, spawnMicrogame])

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

  // Candid run snapshots: fire the pending random shots as the day crosses each
  // scheduled time (all before the first conversation).
  useEffect(() => {
    if (status !== 'playing') return
    const pending = pendingSnapshotTimesRef.current
    if (pending.length === 0 || dayElapsed < pending[0]) return
    let fired = false
    while (pending.length > 0 && dayElapsed >= pending[0]) {
      pending.shift()
      fired = true
    }
    if (fired) takeSnapshot(phaseName(dayElapsed), 'ambient')
  }, [dayElapsed, status, takeSnapshot])

  // One authoritative end-of-run transaction. Builds the result from real run
  // data (not from rendered DOM), so it survives unscored technique time. A
  // Mandala descent passes its own summary and reuses this exact path, so
  // results + banking happen once through the same flow as a surface run.
  const finishRun = useCallback((outcome, mandalaSummary = null) => {
    if (runFinishedRef.current) return
    runFinishedRef.current = true

    if (mandalaSummary) {
      const capacity = capacityRef.current
      const finalScore = Math.max(0, Math.round(mandalaSummary.depth) + mandalaSummary.resolvedCount * 5)
      setResult({
        runId: mandalaSummary.runId ?? `mandala-${Date.now()}`,
        outcome,
        source: 'mandala',
        rawScore: finalScore,
        finalScore,
        penalty: 0,
        dayElapsed: 0,
        runElapsed: 0,
        clearedCount: mandalaSummary.resolvedCount,
        suppressedCount: 0,
        peakLoad: capacity,
        capacity,
        activeAtEnd: capacity,
        appeared: mandalaSummary.resolvedCount,
        mandalaDepth: Math.round(mandalaSummary.depth),
        techniques: {},
      })
      setStatus(outcome)
      return
    }

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

  // --- Mandala mode ------------------------------------------------------
  // Overload during a descent routes straight into the existing results path.
  const handleMandalaOverload = useCallback((summary) => {
    finishRun('overload', { ...summary, runId: mandalaRunIdRef.current })
  }, [finishRun])

  // A cut foe: resolve it in the sim (removes its load) and record the cut
  // geometry so the enemy layer slices its panel along the actual blade path.
  const handleMandalaResolve = useCallback((id, cut = null) => {
    mandala.resolveEncounter(id)
    mandalaDeathsRef.current.set(id, cut)
  }, [mandala])

  // TEMPORARY dev entry: available from the skill tree whenever the Sword is
  // enabled. This is a documented prototype entry point, not the final trigger.
  const enterMandala = useCallback(() => {
    mandalaRunIdRef.current = `mandala-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
    runFinishedRef.current = false
    mandalaInputsRef.current.forwardHeld = false
    setResult(null)
    setRunSnapshots([])
    setMicrogames([])
    microgamesRef.current = []
    mandala.enter()
    setStatus('mandala')
  }, [mandala])

  const exitMandala = useCallback(() => {
    mandalaInputsRef.current.forwardHeld = false
    mandala.exit()
    setStatus('skillTree')
  }, [mandala])

  // Keep the live inputs the in-Canvas stepper reads each frame up to date.
  useEffect(() => {
    mandalaInputsRef.current.diveEnabled = progressionEffects.diveEnabled
    mandalaInputsRef.current.capacity = capacity
  })

  // Dive input: hold W / ArrowUp to accelerate. Only while in the Mandala, only
  // when Dive is enabled. The held flag is cleared on every exit path (mode
  // exit, overload -> results, window blur, unmount) so it never sticks.
  useEffect(() => {
    if (status !== 'mandala') {
      mandalaInputsRef.current.forwardHeld = false
      return undefined
    }
    const isForwardKey = (key) => key === 'w' || key === 'W' || key === 'ArrowUp'
    const onKeyDown = (event) => {
      if (isForwardKey(event.key)) mandalaInputsRef.current.forwardHeld = true
    }
    const onKeyUp = (event) => {
      if (isForwardKey(event.key)) mandalaInputsRef.current.forwardHeld = false
    }
    const clear = () => {
      mandalaInputsRef.current.forwardHeld = false
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', clear)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', clear)
      mandalaInputsRef.current.forwardHeld = false
    }
  }, [status])

  const handleResetFull = useCallback(() => {
    resetFull()
    setTutorialEnabled(true)
  }, [resetFull])

  // Fire the rehearsal once per run, at its configured day-time trigger, but
  // only when the node is enabled and nothing else is active.
  useEffect(() => {
    if (status !== 'playing' || cafeBeatActive || activeTechnique || rehearsalFiredRef.current) return
    if (!progression.enabledNodeIds.includes('rehearse')) return
    if (dayElapsed < getNode('rehearse').effect.triggerDay) return
    rehearsalFiredRef.current = true
    setActiveTechnique({ id: 'rehearsal', pausesDay: true, pausesSpawns: false })
  }, [status, cafeBeatActive, activeTechnique, dayElapsed, progression.enabledNodeIds])

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

  // Stretch Every Joint: a pre-departure warm-up. Fires once per run at its
  // trigger, before you leave for the walk, while nothing else is active.
  useEffect(() => {
    if (status !== 'playing' || cafeBeatActive || activeTechnique || stretchFiredRef.current) return
    if (!progression.enabledNodeIds.includes('stretch')) return
    if (dayElapsed < getNode('stretch').effect.triggerDay) return
    stretchFiredRef.current = true
    setActiveTechnique({ id: 'stretch', pausesDay: true, pausesSpawns: false })
  }, [status, cafeBeatActive, activeTechnique, dayElapsed, progression.enabledNodeIds])

  const completeStretch = useCallback((outcome) => {
    const node = getNode('stretch')
    const success = stretchSucceeded(outcome)
    techniqueOutcomesRef.current.stretch = success ? 'success' : 'failure'
    if (success) {
      // Thin the physical symptoms for a stretch of the early walk. Gentle
      // failure: nothing happens, you just carry the stiffness with you.
      stretchThinUntilRef.current = dayElapsedRef.current + (node.effect.windowSeconds ?? 12)
    }
    setActiveTechnique(null)
  }, [])

  // Run Through the Plan: scheduled technique that staggers the next pairs.
  useEffect(() => {
    if (status !== 'playing' || cafeBeatActive || activeTechnique || planFiredRef.current) return
    if (!progression.enabledNodeIds.includes('plan')) return
    if (dayElapsed < getNode('plan').effect.triggerDay) return
    planFiredRef.current = true
    setActiveTechnique({ id: 'plan', pausesDay: true, pausesSpawns: false })
  }, [status, cafeBeatActive, activeTechnique, dayElapsed, progression.enabledNodeIds])

  const completePlan = useCallback((outcome) => {
    const node = getNode('plan')
    const success = scheduledSucceeded(outcome)
    techniqueOutcomesRef.current.plan = success ? 'success' : 'failure'
    if (success) planStaggerRemainingRef.current = node.effect.staggerPairs ?? 2
    setActiveTechnique(null)
  }, [])

  // Auto Target: while enabled during a run, clearing the focused
  // minigame moves keyboard focus to the next one on screen.
  useEffect(() => {
    const on = status === 'playing' && progression.enabledNodeIds.includes('autotarget')
    setAutoTargetEnabled(on)
    return () => setAutoTargetEnabled(false)
  }, [status, progression.enabledNodeIds])

  // Run on Adrenaline: pause new spawns for a window when load reaches one
  // below capacity. Day and score keep going; existing minigames stay.
  useEffect(() => {
    if (status !== 'playing' || cafeBeatActive || adrenalineFiredRef.current) return
    if (!progression.enabledNodeIds.includes('adrenaline')) return
    const belowLimit = getNode('adrenaline').effect.belowLimit ?? 1
    if (load < capacity - belowLimit) return
    adrenalineFiredRef.current = true
    techniqueOutcomesRef.current.adrenaline = 'used'
    setSpawnPaused(true)
  }, [load, capacity, status, cafeBeatActive, progression.enabledNodeIds])

  useEffect(() => {
    if (!spawnPaused) return undefined
    const seconds = getNode('adrenaline').effect.pauseSeconds ?? 6
    const id = window.setTimeout(() => setSpawnPaused(false), seconds * 1000)
    return () => window.clearTimeout(id)
  }, [spawnPaused])

  // Suppress Visible Distress: intercept the overload before the run ends, once
  // per run, if the node is enabled. Otherwise overload normally.
  const completeSuppression = useCallback(() => {
    const games = microgamesRef.current
    const currentLoad = games.length
    const { suppressed: suppressCount } = suppressionSplit(currentLoad)
    // Choose random targets now that the squeeze is done — the player may have
    // cleared some by hand while mashing.
    const order = games.map((_, index) => index)
    for (let i = order.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[order[i], order[j]] = [order[j], order[i]]
    }
    const targetIds = new Set(order.slice(0, suppressCount).map((index) => games[index].id))
    suppressedCountRef.current += targetIds.size
    // Mark as resolved so they cannot also be counted as cleared, then remove
    // them without touching the cleared counter.
    targetIds.forEach((id) => resolvedGamesRef.current.add(id))
    setMicrogames((current) => {
      const next = current.filter((game) => !targetIds.has(game.id))
      microgamesRef.current = next
      return next
    })
    techniqueOutcomesRef.current.suppress = 'used'
    setSuppressing(false)
  }, [])

  useEffect(() => {
    if (status !== 'playing' || dayElapsed >= DAY_LENGTH || cafeBeatActive || load < capacity || suppressing) return
    if (!suppressUsedRef.current && progression.enabledNodeIds.includes('suppress')) {
      suppressUsedRef.current = true
      setSuppressing(true)
      return
    }
    finishRun('overload')
  }, [load, dayElapsed, status, capacity, suppressing, cafeBeatActive, progression.enabledNodeIds, finishRun])

  useEffect(() => {
    if (status !== 'playing' || dayElapsed < CAFE_BEAT_START_AT || cafeBeatPhase !== CAFE_BEAT_PHASES.INACTIVE) return
    pendingSpawnsRef.current = []
    setActiveTechnique(null)
    setSuppressing(false)
    setCafeDialogueIndex(0)
    setCafeBeatPhase(CAFE_BEAT_PHASES.CONVERSATION)
  }, [dayElapsed, status, cafeBeatPhase])

  useEffect(() => {
    if (cafeBeatPhase === CAFE_BEAT_PHASES.INTERLUDE) {
      const timer = window.setTimeout(
        () => setCafeBeatPhase(CAFE_BEAT_PHASES.CONVERSATION),
        CAFE_BEAT_TIMINGS.interludeMs,
      )
      return () => window.clearTimeout(timer)
    }
    if (cafeBeatPhase === CAFE_BEAT_PHASES.RUPTURE) {
      const timer = window.setTimeout(
        () => setCafeBeatPhase(CAFE_BEAT_PHASES.DEPARTURE),
        CAFE_BEAT_TIMINGS.ruptureMs,
      )
      return () => window.clearTimeout(timer)
    }
    if (cafeBeatPhase === CAFE_BEAT_PHASES.DEPARTURE) {
      const timer = window.setTimeout(
        () => setCafeBeatPhase(CAFE_BEAT_PHASES.AFTERMATH),
        CAFE_BEAT_TIMINGS.departureMs,
      )
      return () => window.clearTimeout(timer)
    }
    if (cafeBeatPhase === CAFE_BEAT_PHASES.AFTERMATH) {
      const timer = window.setTimeout(
        () => setCafeBeatPhase(CAFE_BEAT_PHASES.CELEBRATION),
        CAFE_BEAT_TIMINGS.aftermathMs,
      )
      return () => window.clearTimeout(timer)
    }
    if (cafeBeatPhase === CAFE_BEAT_PHASES.CELEBRATION) {
      const timer = window.setTimeout(
        () => finishRun('complete'),
        CAFE_BEAT_TIMINGS.celebrationMs,
      )
      return () => window.clearTimeout(timer)
    }
    return undefined
  }, [cafeBeatPhase, finishRun])

  // Walk-out clock. The day timer is frozen for the whole café beat, so it holds
  // at its remaining value while Mara talks. Once she erupts and leaves, run the
  // day's final seconds down to zero across the rupture-and-departure so the
  // timer reaches the full end exactly as she walks out.
  useEffect(() => {
    if (!cafeBeatWalkingOut) {
      walkoutClockStartRef.current = null
      return undefined
    }
    if (walkoutClockStartRef.current === null) {
      walkoutClockStartRef.current = performance.now()
    }
    const totalMs = CAFE_BEAT_TIMINGS.ruptureMs + CAFE_BEAT_TIMINGS.departureMs
    const advance = () => {
      const progress = Math.min(1, (performance.now() - walkoutClockStartRef.current) / totalMs)
      const nextDay = CAFE_BEAT_START_AT + progress * (DAY_LENGTH - CAFE_BEAT_START_AT)
      dayElapsedRef.current = nextDay
      setDayElapsed(nextDay)
    }
    advance()
    const id = window.setInterval(advance, 100)
    return () => window.clearInterval(id)
  }, [cafeBeatWalkingOut])

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
      setTutorialStep('summary')
    }
  }, [tutorialRun, tutorialStep])

  const goHome = () => {
    finishRun('home')
  }

  const answerDialogue = (index) => {
    // Snapshot the scene as it looks at the click, before the box closes.
    takeSnapshot(quoteChoice(maraDialogue, index), 'choice')
    setDialogueAnswered(true)
    setDialogueOpen(false)
  }

  const answerOrderDialogue = (index) => {
    takeSnapshot(quoteChoice(orderDialogue, index), 'choice')
    setOrderDialogueAnswered(true)
    setOrderDialogueOpen(false)
  }

  const answerCafeDialogue = (index) => {
    takeSnapshot(quoteChoice(cafeDialogue[cafeDialogueIndex], index), 'choice')
    const next = advanceCafeConversation(cafeDialogueIndex)
    setCafeDialogueIndex(next.dialogueIndex)
    setCafeBeatPhase(next.phase)
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
  if (tutorialStep === 'summary') {
    setTutorialStep('home')
    return
  }
  finishTutorial()
}

  const tutorialTarget = tutorialStep === 'first' || tutorialStep === 'second'
    ? microgames.find((game) => game.tutorialRole === tutorialStep)
    : null

  return (
    <main className={`game-shell status-${status} load-${Math.min(load, 5)} cafe-beat-${cafeBeatPhase}`}>
      <div className="world-layer">
        <Canvas
          shadows="basic"
          // Only run the 60fps render loop while something in the 3D scene is
          // actually moving. On the intro, skill tree and results screens the
          // world is a frozen backdrop, so switch to on-demand rendering to stop
          // burning CPU/GPU (and battery) drawing identical frames — a real win
          // on laptops, mobile and lower-powered browsers.
          frameloop={sceneAnimating ? 'always' : 'demand'}
          camera={{ position: [0.55, 1.65, 3.1], fov: 68, near: 0.08, far: 150 }}
          dpr={[1, 1.25]}
          gl={{
            antialias: false,
            alpha: false,
            stencil: false,
            powerPreference: 'high-performance',
            precision: 'mediump',
            // Snapshots re-render one frame on demand (see SnapshotCaptureBridge),
            // so preserveDrawingBuffer stays off — it costs every browser a bit of
            // per-frame work and blocks some compositor fast-paths.
          }}
          performance={{ min: 0.6 }}
        >
          {status === 'mandala' ? (
            <MandalaScene
              runRef={mandala.runRef}
              step={mandala.step}
              registryRef={mandalaRegistryRef}
              enemiesRef={mandalaEnemiesRef}
              inputsRef={mandalaInputsRef}
              onOverload={handleMandalaOverload}
              background={mandala.sample.effects.background}
              twistScale={mandala.sample.effects.interaction.twistScale ?? 1}
            />
          ) : (
            <>
              <AuthoredJourneyScene
                elapsed={dayElapsed}
                active={dayAdvancing}
                cameraEnabled={!cafeBeatActive}
                dialogueStage={dialogueOpen ? 'mara' : orderDialogueOpen ? 'order' : null}
              />
              <CafeNarrativeBeatScene elapsed={dayElapsed} phase={cafeBeatPhase} />
            </>
          )}
          <SnapshotCaptureBridge registerCapture={registerSnapshotCapture} />
        </Canvas>
      </div>

      {status === 'mandala' && (
        <>
          <MandalaEnemyLayer enemiesRef={mandalaEnemiesRef} deathsRef={mandalaDeathsRef} />
          <SwordCursor
            enabled={progressionEffects.swordEnabled}
            registryRef={mandalaRegistryRef}
            onResolve={handleMandalaResolve}
            perception={mandala.sample.effects.perception}
          />
          <div className="mandala-hud" aria-live="polite">
            {mandala.sample.sectionName && (
              <span className="mandala-section">
                {mandala.sample.sectionName}
                {mandala.sample.waveCount > 0 && (
                  <em> · {t('mandala.wave', { index: mandala.sample.waveIndex + 1, count: mandala.sample.waveCount })}</em>
                )}
              </span>
            )}
            <span className="mandala-depth">{t('mandala.depth', { depth: Math.round(mandala.sample.depth) })}</span>
            <span className={`mandala-load${mandala.sample.activeCount >= capacity - 1 ? ' near-capacity' : ''}`}>
              {t('mandala.load', { load: mandala.sample.activeCount, capacity })}
            </span>
          </div>
          <div className="mandala-hint">
            {progressionEffects.diveEnabled ? t('mandala.hintDive') : t('mandala.hint')}
          </div>
          <button type="button" className="mandala-exit" onClick={exitMandala}>
            {t('mandala.leave')}
          </button>
        </>
      )}

      {startCue && (
        <section
          className={`race-start-cue race-start-cue-${startCue}`}
          aria-live="assertive"
          aria-atomic="true"
        >
          <strong key={startCue}>{startCue === 'ready' ? t('cue.ready') : t('cue.start')}</strong>
        </section>
      )}

      {['countdown', 'playing'].includes(status) && (
        <>
          <header className="hud">
            <div className="hud-panel">
              <span className="hud-label">{t('hud.time')}</span>
              <strong>{t('hud.timeValue', { n: remainingTime })}</strong>
            </div>
            <div className="phase-label">{phaseName(dayElapsed)}</div>
            <div className="hud-panel score-panel">
              <span className="hud-label">{t('hud.score')}</span>
              <strong>{score}</strong>
            </div>
          </header>

          <div
            className="load-meter"
            aria-label={t('overload.aria', { load, capacity })}
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
            <span>{t('overload.label')}</span>
            <div className="load-pips">
              {Array.from({ length: capacity }).map((_, index) => (
                <i key={index} className={index >= capacity - load ? 'filled' : ''} />
              ))}
            </div>
          </div>

          <section
            className="microgame-layer"
            aria-live="polite"
            aria-hidden={cafeBeatFrozen || undefined}
            inert={cafeBeatFrozen ? true : undefined}
          >
            {microgames.map((game, index) => (
              <MicrogameWindow
                key={game.id}
                game={game}
                index={index}
                load={load}
                tutorialTarget={tutorialTarget?.id === game.id}
                onResolve={resolveMicrogame}
                frozen={cafeBeatFrozen}
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
              dialogue={maraDialogue}
              load={load}
              distortion={distortion}
              onAnswer={answerDialogue}
            />
          )}

          {orderDialogueOpen && (
            <DialogueBox
              dialogue={orderDialogue}
              load={load}
              distortion={distortion}
              onAnswer={answerOrderDialogue}
            />
          )}

          {cafeBeatPhase === CAFE_BEAT_PHASES.CONVERSATION && (
            <DialogueBox
              dialogue={cafeDialogue[cafeDialogueIndex]}
              load={load}
              distortion={distortion}
              onAnswer={answerCafeDialogue}
              className="cafe-conversation-dialogue"
              ariaLabel={t('cafe.conversationAria', { part: cafeDialogueIndex + 1, total: cafeDialogue.length })}
            />
          )}

          {cafeBeatPhase === CAFE_BEAT_PHASES.RUPTURE && (
            <DialogueBox
              dialogue={cafeRuptureDialogue}
              load={load}
              distortion={0}
              onAnswer={() => {}}
              className="cafe-rupture-dialogue"
              ariaLabel={t('cafe.ruptureAria')}
            />
          )}

          {cafeBeatPhase === CAFE_BEAT_PHASES.CELEBRATION && (
            <section className="cafe-celebration" role="status" aria-live="assertive">
              <strong>{t('celebration.title')}</strong>
            </section>
          )}

          {activeTechnique?.id === 'rehearsal' && (
            <RehearsalTechnique
              prompts={REHEARSAL_SEQUENCE.prompts}
              timeLimitSeconds={getNode('rehearse').effect.addedSeconds}
              onComplete={completeRehearsal}
            />
          )}

          {activeTechnique?.id === 'plan' && (
            <PlanTechnique
              steps={PLAN_SEQUENCE.steps}
              timeLimitSeconds={getNode('plan').effect.addedSeconds}
              onComplete={completePlan}
            />
          )}

          {activeTechnique?.id === 'stretch' && (
            <StretchTechnique
              joints={STRETCH_SEQUENCE.joints}
              timeLimitSeconds={getNode('stretch').effect.addedSeconds}
              holdSeconds={getNode('stretch').effect.holdSeconds}
              onComplete={completeStretch}
            />
          )}

          {suppressing && (
            <SuppressionTechnique
              requiredPresses={getNode('suppress').effect.requiredPresses}
              onComplete={completeSuppression}
            />
          )}

          <button
            className={`go-home${tutorialStep === 'home' ? ' tutorial-target tutorial-home-target' : ''}`}
            type="button"
            onClick={goHome}
            disabled={gameplayPaused || cafeBeatActive}
            style={{
              '--overload': overloadRatio,
              '--home-scale': 1 + overloadRatio * 0.1,
              '--home-shake': `${homeShake}px`,
              '--home-shake-neg': `${-homeShake}px`,
            }}
          >
            <span>{t('goHome.title')}</span>
            <small>{t('goHome.cashOut', { score })}</small>
          </button>
        </>
      )}

      {status === 'intro' && (
        <OverlayCard eyebrow="" title={t('intro.title')}>
          <SettingsMenu variant="embedded" />
          <p>{t('intro.body')}</p>
          <button
            className="tutorial-toggle"
            type="button"
            aria-pressed={tutorialEnabled}
            onClick={toggleTutorial}
          >
            <span>{t('intro.tutorial')}</span>
            <strong>{tutorialEnabled ? t('common.on') : t('common.off')}</strong>
          </button>
          <button type="button" onClick={startGame}>{t('common.startDay')}</button>
          {progression.treeUnlocked && (
            <button type="button" className="title-skill-tree" onClick={() => openSkillTree(false)}>
              {t('common.skillTree')}
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
          onEnterMandala={enterMandala}
        />
      )}

      {['overload', 'home', 'complete'].includes(status) && result && (
        <ResultsScreen
          result={result}
          capacity={result.capacity}
          banked={progression.treeUnlocked ? progression.bank : null}
          onRestart={startGame}
          onTutorial={startTutorialGame}
          onSkillTree={progression.treeUnlocked
            ? () => openSkillTree(firstUnlockPending)
            : undefined}
          emphasizeSkillTree={firstUnlockPending}
          snapshots={runSnapshots}
        />
      )}
    </main>
  )
}

function TutorialCallout({ step, target, onProceed }) {
  const t = useT()
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

      // The Go Home lesson fires while play is paused and the board is crowded
      // with idle minigames; ignore them as blockers so the callout stays pinned
      // to the Go Home button instead of fleeing to a far corner.
      const blockedRects = step === 'home'
        ? [targetRect]
        : [
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
          <span>{t('tutorial.summary.eyebrow')}</span>
          <strong>{t('tutorial.summary.title')}</strong>
          <p>{t('tutorial.summary.body')}</p>
          <button type="button" onClick={onProceed}>{t('tutorial.proceed')}</button>
        </div>
      </section>
    )
  }

  const copy = step === 'first'
    ? {
        eyebrow: t('tutorial.first.eyebrow'),
        title: t('tutorial.first.title'),
        body: t('tutorial.first.body'),
      }
    : step === 'second'
      ? {
          eyebrow: t('tutorial.second.eyebrow'),
          title: t('tutorial.second.title'),
          body: t('tutorial.second.body'),
        }
      : {
          eyebrow: '',
          title: t('tutorial.home.title'),
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
          <button className="tutorial-next" type="button" onClick={onProceed}>{t('common.gotIt')}</button>
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

const MicrogameWindow = memo(function MicrogameWindow({ game, index, load, tutorialTarget, onResolve, frozen = false }) {
  const t = useT()
  const resolve = useCallback(() => {
    if (!frozen) onResolve(game.id)
  }, [frozen, game.id, onResolve])
  const beatOffset = useMemo(() => edgeOffsetFor(game.position), [game.position])

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
        '--beat-x': `${beatOffset.x}px`,
        '--beat-y': `${beatOffset.y}px`,
      }}
    >
      <div className="microgame-header">
        <span>{t(`microgame.${game.kind}`)}</span>
        <i />
      </div>
      <div className="microgame-body">
        {game.kind === 'discomfort' && <DiscomfortGame onResolve={resolve} />}
        {game.kind === 'anxiety' && <AnxietyGame onResolve={resolve} />}
        {game.kind === 'brainFog' && <BrainFogGame onResolve={resolve} />}
        {game.kind === 'fatigue' && <FatigueGame onResolve={resolve} paused={frozen} />}
        <NewMicrogameContent kind={game.kind} onResolve={resolve} />
      </div>
    </article>
  )
})

function DiscomfortGame({ onResolve }) {
  const t = useT()
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
        {t('mg.adjust')}
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

function FatigueGame({ onResolve, paused = false }) {
  const t = useT()
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
      if (holdingRef.current && !paused) {
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
  }, [onResolve, paused])

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
        {t('mg.hold')}
      </button>
      <div className="tiny-progress"><i style={{ width: `${(held / needed) * 100}%` }} /></div>
    </div>
  )
}

export default App
