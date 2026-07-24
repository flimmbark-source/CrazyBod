import { Canvas, useFrame } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { AuthoredJourneyScene } from './world/JourneyScene.jsx'
import { MICROGAME_NAMES as EXPANDED_MICROGAME_NAMES, NewMicrogameContent } from './minigames/catalog.jsx'
import { TUTORIAL_SEQUENCE } from './pacingConfig.js'
import {
  createPacingDirector,
  initializePacingDirector,
  takeSpawnBatch,
} from './pacingDirector.js'

const DAY_LENGTH = 50
const OVERLOAD_LIMIT = 6
const SCORE_PER_SECOND = 10
const TUTORIAL_STORAGE_KEY = 'crazybod:tutorial-complete'

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

const DIALOGUE = {
  speaker: 'Mara',
  line: 'Hey! You made it. Do you still want to sit by the window?',
  options: [
    'Yeah, the window is good.',
    'Sorry, could you say that again?',
    'Anywhere is fine. I just need to sit.',
  ],
}

function getPhase(elapsed) {
  if (elapsed < 8) return 'WAKING UP'
  if (elapsed < 16) return 'GETTING READY'
  if (elapsed < 25) return 'WALKING TO THE CAFÉ'
  if (elapsed < 42) return 'ORDERING'
  return 'SITTING DOWN'
}

function positionFor(index) {
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
    left: `${left + ((index * 7) % 5)}%`,
    top: `${top + ((index * 11) % 7)}%`,
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
  const [elapsed, setElapsed] = useState(0)
  const [microgames, setMicrogames] = useState([])
  const [dialogueOpen, setDialogueOpen] = useState(false)
  const [dialogueAnswered, setDialogueAnswered] = useState(false)
  const [finalScore, setFinalScore] = useState(0)
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
  const startTimeRef = useRef(0)
  const directorRef = useRef(createPacingDirector())
  const spawnCounterRef = useRef(0)
  const microgamesRef = useRef([])
  const resolvedGamesRef = useRef(new Set())
  const completionEffectIdRef = useRef(0)
  const pauseStartedRef = useRef(null)
  const pausedDurationRef = useRef(0)
  const tutorialFirstSeenRef = useRef(false)
  const tutorialSecondSeenRef = useRef(false)

  const score = Math.floor(elapsed * SCORE_PER_SECOND)
  const load = microgames.length
  const distortion = load >= 5 ? 3 : load >= 4 ? 2 : load >= 3 ? 1 : 0
  const tutorialPaused = status === 'playing' && tutorialStep !== 'none'

  const beginGame = useCallback((withTutorial) => {
    const seed = (Date.now() ^ Math.floor(performance.now() * 1000)) >>> 0
    startTimeRef.current = performance.now()
    pausedDurationRef.current = 0
    pauseStartedRef.current = null
    directorRef.current = createPacingDirector(seed)
    spawnCounterRef.current = 0
    microgamesRef.current = []
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
    setDirectorReady(!withTutorial)
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
  }

  const spawnMicrogame = useCallback((kind, tutorialRole = null) => {
    const index = spawnCounterRef.current
    spawnCounterRef.current += 1
    const game = {
      id: `${kind}-${directorRef.current.seed}-${index}`,
      kind,
      tutorialRole,
      position: positionFor(index),
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
    if (status !== 'playing' || !tutorialRun || tutorialStep !== 'none') return

    const first = TUTORIAL_SEQUENCE[0]
    const second = TUTORIAL_SEQUENCE[1]

    if (!tutorialFirstSeenRef.current && elapsed >= first.at) {
      tutorialFirstSeenRef.current = true
      spawnMicrogame(first.kind, first.role)
      setTutorialStep(first.role)
      return
    }

    if (
      tutorialFirstSeenRef.current
      && !tutorialSecondSeenRef.current
      && elapsed >= second.at
    ) {
      tutorialSecondSeenRef.current = true
      spawnMicrogame(second.kind, second.role)
      setTutorialStep(second.role)
    }
  }, [elapsed, spawnMicrogame, status, tutorialRun, tutorialStep])

  useEffect(() => {
    if (status !== 'playing' || tutorialPaused || !directorReady) return

    const director = directorRef.current
    if (director.nextSpawnAt === null) {
      initializePacingDirector(director, elapsed)
      return
    }
    if (elapsed < director.nextSpawnAt) return

    const batch = takeSpawnBatch(director, {
      elapsed,
      activeGames: load,
      overloadLimit: OVERLOAD_LIMIT,
    })
    batch.kinds.forEach((kind) => spawnMicrogame(kind))
  }, [directorReady, elapsed, load, spawnMicrogame, status, tutorialPaused])

  useEffect(() => {
    if (status !== 'playing') return
    if (elapsed >= 25 && !dialogueAnswered) setDialogueOpen(true)
  }, [elapsed, status, dialogueAnswered])

  useEffect(() => {
    if (status !== 'playing' || load < OVERLOAD_LIMIT) return
    const penalizedScore = Math.floor(score * 0.25)
    setFinalScore(penalizedScore)
    setStatus('overload')
  }, [load, score, status])

  useEffect(() => {
    if (status !== 'playing' || elapsed < DAY_LENGTH) return
    setFinalScore(score)
    setStatus('complete')
  }, [elapsed, score, status])

  const resolveMicrogame = useCallback((id) => {
    if (resolvedGamesRef.current.has(id)) return
    resolvedGamesRef.current.add(id)

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
    setFinalScore(score)
    setStatus('home')
  }

  const answerDialogue = () => {
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
    setDirectorReady(true)
    setTutorialStep('none')
  }

  const tutorialTarget = tutorialStep === 'first' || tutorialStep === 'second'
    ? microgames.find((game) => game.tutorialRole === tutorialStep)
    : null

  return (
    <main className={`game-shell load-${Math.min(load, 5)}`}>
      <div className="world-layer">
        <Canvas shadows camera={{ position: [-1.8, 0.92, 2.8], fov: 71, near: 0.08, far: 150 }} dpr={[1, 1.5]}>
          <AuthoredJourneyScene
            elapsed={elapsed}
            active={status === 'playing' && !tutorialPaused}
            dialogueOpen={dialogueOpen}
            dialogueAnswered={dialogueAnswered}
          />
        </Canvas>
      </div>

      {status === 'playing' && (
        <>
          <header className="hud">
            <div className="hud-panel">
              <span className="hud-label">OUT</span>
              <strong>{Math.floor(elapsed)}s</strong>
            </div>
            <div className="phase-label">{getPhase(elapsed)}</div>
            <div className="hud-panel score-panel">
              <span className="hud-label">SCORE</span>
              <strong>{score}</strong>
            </div>
          </header>

          <div className="load-meter" aria-label={`Overload ${load} of ${OVERLOAD_LIMIT}`}>
            <span>OVERLOAD</span>
            <div className="load-pips">
              {Array.from({ length: OVERLOAD_LIMIT }).map((_, index) => (
                <i key={index} className={index < load ? 'filled' : ''} />
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
              onProceed={finishTutorial}
            />
          )}

          <section className="completion-fx-layer" aria-hidden="true">
            {completionEffects.map((effect) => (
              <CompletionBurst key={effect.id} effect={effect} />
            ))}
          </section>

          {dialogueOpen && (
            <DialogueBox
              load={load}
              distortion={distortion}
              onAnswer={answerDialogue}
            />
          )}

          <button className="go-home" type="button" onClick={goHome} disabled={tutorialPaused}>
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
        </OverlayCard>
      )}

      {status !== 'intro' && status !== 'playing' && (
        <EndCard status={status} score={finalScore} onRestart={startGame} />
      )}
    </main>
  )
}

function TutorialCallout({ step, target, onProceed }) {
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
    <section className={`tutorial-layer tutorial-layer-${step}`} aria-live="polite">
      <aside
        className={`tutorial-callout tutorial-callout-${step}`}
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

function EndCard({ status, score, onRestart }) {
  const copy = {
    home: {
      eyebrow: 'YOU WENT HOME',
      title: 'ENOUGH FOR TODAY',
      body: 'You kept what you had. The rest of the day can wait.',
    },
    overload: {
      eyebrow: 'OVERLOAD',
      title: 'EVERYTHING AT ONCE',
      body: 'The day ended for you. Most of the score slipped away with it.',
    },
    complete: {
      eyebrow: 'DESTINATION REACHED',
      title: 'YOU MADE IT',
      body: 'You got to the café, ordered, and finally sat down.',
    },
  }[status]

  return (
    <OverlayCard eyebrow={copy.eyebrow} title={copy.title}>
      <p>{copy.body}</p>
      <div className="final-score">
        <span>SCORE</span>
        <strong>{score}</strong>
      </div>
      <button type="button" onClick={onRestart}>TRY ANOTHER DAY</button>
    </OverlayCard>
  )
}

function DialogueBox({ load, distortion, onAnswer }) {
  return (
    <section className={`dialogue-box distortion-${distortion}`}>
      <div className="speaker-row">
        <span className="portrait">M</span>
        <div>
          <strong>{DIALOGUE.speaker}</strong>
          <p>{scrambleText(DIALOGUE.line, distortion)}</p>
        </div>
      </div>
      <div className="dialogue-options">
        {DIALOGUE.options.map((option, index) => (
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

function MicrogameWindow({ game, index, load, tutorialTarget, onResolve }) {
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
}

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
