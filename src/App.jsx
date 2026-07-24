import { Canvas, useFrame } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'

const DAY_LENGTH = 92
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
]

const MICROGAME_NAMES = {
  discomfort: 'DISCOMFORT',
  anxiety: 'ANXIETY',
  brainFog: 'BRAIN FOG',
  fatigue: 'FATIGUE',
}

const MICROGAME_VARIANTS = {
  discomfort: [
    { id: 'alternating', sequence: ['left', 'right', 'left', 'right', 'left', 'right'], pressureOffset: 0 },
    { id: 'double-back', sequence: ['right', 'right', 'left', 'right', 'left', 'left'], pressureOffset: 1 },
    { id: 'uneven', sequence: ['left', 'right', 'right', 'left', 'right'], pressureOffset: 2 },
  ],
  anxiety: [
    { id: 'scatter', targets: [[18, 22], [72, 18], [43, 48], [78, 72], [24, 76]] },
    { id: 'clockwise', targets: [[25, 20], [74, 24], [78, 70], [28, 78], [48, 48]] },
    { id: 'zigzag', targets: [[15, 18], [76, 28], [25, 47], [82, 61], [38, 80]] },
    { id: 'opposites', targets: [[18, 18], [82, 82], [80, 20], [20, 80], [50, 48]] },
    { id: 'inward', targets: [[14, 24], [82, 20], [76, 78], [23, 75], [50, 51]] },
    { id: 'steps', targets: [[20, 70], [34, 52], [48, 35], [63, 52], [79, 29]] },
  ],
  brainFog: [
    { id: 'right-bend', start: 0, exit: 8, path: [1, 4, 5, 8] },
    { id: 'left-bend', start: 0, exit: 8, path: [3, 4, 7, 8] },
    { id: 'cross-left', start: 2, exit: 6, path: [1, 4, 3, 6] },
    { id: 'cross-right', start: 6, exit: 2, path: [3, 4, 1, 2] },
    { id: 'backtrack', start: 8, exit: 0, path: [7, 4, 3, 0] },
    { id: 'drop-turn', start: 2, exit: 8, path: [5, 4, 7, 8] },
  ],
  fatigue: [
    { id: 'steady', pulses: 1, perPulse: 2200 },
    { id: 'two-pushes', pulses: 2, perPulse: 1050 },
    { id: 'three-pushes', pulses: 3, perPulse: 700 },
  ],
}

function shuffled(values) {
  const next = [...values]
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[next[index], next[swapIndex]] = [next[swapIndex], next[index]]
  }
  return next
}

function makeVariantBags() {
  return Object.fromEntries(
    Object.entries(MICROGAME_VARIANTS).map(([kind, variants]) => [kind, shuffled(variants)]),
  )
}

function drawVariant(kind, bags) {
  if (!bags[kind] || bags[kind].length === 0) bags[kind] = shuffled(MICROGAME_VARIANTS[kind])
  return bags[kind].shift()
}

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
  if (elapsed < 12) return 'WAKING UP'
  if (elapsed < 28) return 'GETTING READY'
  if (elapsed < 61) return 'WALKING TO THE CAFÉ'
  if (elapsed < 84) return 'ORDERING'
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
  const [activeGameId, setActiveGameId] = useState(null)
  const startTimeRef = useRef(0)
  const spawnedRef = useRef(new Set())
  const variantBagsRef = useRef(makeVariantBags())

  const score = Math.floor(elapsed * SCORE_PER_SECOND)
  const load = microgames.length
  const distortion = load >= 5 ? 3 : load >= 4 ? 2 : load >= 3 ? 1 : 0

  const startGame = useCallback(() => {
    startTimeRef.current = performance.now()
    spawnedRef.current = new Set()
    variantBagsRef.current = makeVariantBags()
    setElapsed(0)
    setMicrogames([])
    setActiveGameId(null)
    setDialogueOpen(false)
    setDialogueAnswered(false)
    setFinalScore(0)
    setStatus('playing')
  }, [])

  useEffect(() => {
    if (status !== 'playing') return undefined

    const timer = window.setInterval(() => {
      const nextElapsed = Math.min((performance.now() - startTimeRef.current) / 1000, DAY_LENGTH)
      setElapsed(nextElapsed)
    }, 100)

    return () => window.clearInterval(timer)
  }, [status])

  useEffect(() => {
    if (status !== 'playing') return

    const due = MICROGAME_SCRIPT.filter(
      (event, index) => elapsed >= event.at && !spawnedRef.current.has(index),
    )

    if (due.length > 0) {
      setMicrogames((current) => {
        const next = [...current]
        for (const event of due) {
          const scriptIndex = MICROGAME_SCRIPT.indexOf(event)
          spawnedRef.current.add(scriptIndex)
          next.push({
            id: `${event.kind}-${scriptIndex}`,
            kind: event.kind,
            variant: drawVariant(event.kind, variantBagsRef.current),
            position: positionFor(scriptIndex),
          })
        }
        return next
      })
    }

    if (elapsed >= 64 && !dialogueAnswered) setDialogueOpen(true)
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
    setMicrogames((current) => current.filter((game) => game.id !== id))
    setActiveGameId((current) => current === id ? null : current)
  }, [])

  const goHome = () => {
    setFinalScore(score)
    setStatus('home')
  }

  const answerDialogue = () => {
    setDialogueAnswered(true)
    setDialogueOpen(false)
  }

  useEffect(() => {
    if (status !== 'playing' || !dialogueOpen) return undefined
    const handleDialogueKeys = (event) => {
      if (!['1', '2', '3'].includes(event.key)) return
      event.preventDefault()
      answerDialogue()
    }
    window.addEventListener('keydown', handleDialogueKeys)
    return () => window.removeEventListener('keydown', handleDialogueKeys)
  }, [dialogueOpen, status])

  return (
    <main className={`game-shell load-${Math.min(load, 5)}`}>
      <div className="world-layer">
        <Canvas camera={{ position: [0, 1.65, 5], fov: 67 }} dpr={[1, 1.5]}>
          <JourneyScene elapsed={elapsed} active={status === 'playing'} />
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
                active={activeGameId === game.id}
                onActivate={setActiveGameId}
                onResolve={resolveMicrogame}
              />
            ))}
          </section>

          {dialogueOpen && (
            <DialogueBox
              load={load}
              distortion={distortion}
              onAnswer={answerDialogue}
            />
          )}

          <button className="go-home" type="button" onClick={goHome}>
            <span>GO HOME</span>
            <small>cash out {score}</small>
          </button>
        </>
      )}

      {status === 'intro' && (
        <OverlayCard eyebrow="COUNTDOWN" title="CRAZYBOD">
          <p>
            The day moves without waiting. Clear whatever surfaces, stay out for points,
            and go home before everything becomes too much.
          </p>
          <button type="button" onClick={startGame}>START THE DAY</button>
        </OverlayCard>
      )}

      {status !== 'intro' && status !== 'playing' && (
        <EndCard status={status} score={finalScore} onRestart={startGame} />
      )}
    </main>
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
    <section className={'dialogue-box distortion-' + distortion}>
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
            <span className="dialogue-key">{index + 1}</span>
            {scrambleText(option, distortion >= 3 ? 2 : distortion - 1)}
          </button>
        ))}
      </div>
    </section>
  )
}

function MicrogameWindow({ game, index, load, active, onActivate, onResolve }) {
  const windowRef = useRef(null)
  const resolve = useCallback(() => onResolve(game.id), [game.id, onResolve])
  const activate = () => {
    onActivate(game.id)
    windowRef.current?.focus({ preventScroll: true })
  }

  return (
    <article
      ref={windowRef}
      tabIndex={0}
      className={'microgame microgame-' + game.kind + (active ? ' is-active' : '')}
      style={{
        ...game.position,
        '--window-index': index,
        '--load': load,
        '--jitter': Math.max(0, load - 3) + 'px',
        '--jitter-duration': Math.max(0.2, 0.5 - Math.min(load, 4) * 0.06) + 's',
      }}
      onPointerDownCapture={activate}
      onFocus={activate}
      aria-label={MICROGAME_NAMES[game.kind] + (active ? ', keyboard active' : '')}
    >
      <div className="microgame-header">
        <span>{MICROGAME_NAMES[game.kind]}</span>
        <i title={active ? 'Keyboard active' : 'Click to use keyboard'} />
      </div>
      <div className="microgame-body">
        {game.kind === 'discomfort' && <DiscomfortGame variant={game.variant} active={active} onResolve={resolve} />}
        {game.kind === 'anxiety' && <AnxietyGame variant={game.variant} onResolve={resolve} />}
        {game.kind === 'brainFog' && <BrainFogGame variant={game.variant} active={active} onResolve={resolve} />}
        {game.kind === 'fatigue' && <FatigueGame variant={game.variant} active={active} onResolve={resolve} />}
      </div>
    </article>
  )
}

function DiscomfortGame({ variant, active, onResolve }) {
  const [step, setStep] = useState(0)
  const direction = variant.sequence[step]

  const adjust = useCallback((nextDirection) => {
    if (nextDirection !== direction) return
    const next = step + 1
    if (next >= variant.sequence.length) onResolve()
    else setStep(next)
  }, [direction, onResolve, step, variant.sequence.length])

  useEffect(() => {
    if (!active) return undefined
    const handleKey = (event) => {
      const nextDirection = event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a'
        ? 'left'
        : event.key === 'ArrowRight' || event.key.toLowerCase() === 'd'
          ? 'right'
          : null
      if (!nextDirection) return
      event.preventDefault()
      adjust(nextDirection)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [active, adjust])

  return (
    <div className="discomfort-game">
      <div className="body-shape">
        {Array.from({ length: 4 }).map((_, index) => (
          <span key={index} style={{ opacity: (step + index + variant.pressureOffset) % 4 === 0 ? 1 : 0.35 }} />
        ))}
      </div>
      <div className="adjust-controls">
        <button type="button" className={direction === 'left' ? 'active-adjust' : ''} onClick={() => adjust('left')} aria-label="Adjust left">←</button>
        <button type="button" className={direction === 'right' ? 'active-adjust' : ''} onClick={() => adjust('right')} aria-label="Adjust right">→</button>
      </div>
      <div className="key-hint">A / D OR ARROWS</div>
      <div className="tiny-progress"><i style={{ width: (step / variant.sequence.length) * 100 + '%' }} /></div>
    </div>
  )
}

function AnxietyGame({ variant, onResolve }) {
  const [hits, setHits] = useState(0)
  const targets = variant.targets

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
          key={index + '-' + left + '-' + top}
          type="button"
          className={index === hits ? 'active-target' : index < hits ? 'hit-target' : ''}
          style={{ left: left + '%', top: top + '%' }}
          onClick={index === hits ? hit : undefined}
          aria-label={index === hits ? 'Catch pulse' : undefined}
        />
      ))}
    </div>
  )
}

function BrainFogGame({ variant, active, onResolve }) {
  const [position, setPosition] = useState(variant.start)

  const move = useCallback((direction) => {
    const next = position + direction
    if (next < 0 || next > 8) return
    const currentRow = Math.floor(position / 3)
    const nextRow = Math.floor(next / 3)
    if (Math.abs(direction) === 1 && currentRow !== nextRow) return
    if (!variant.path.includes(next) && next !== variant.start) {
      setPosition(variant.start)
      return
    }
    setPosition(next)
    if (next === variant.exit) onResolve()
  }, [onResolve, position, variant])

  useEffect(() => {
    if (!active) return undefined
    const handleKey = (event) => {
      const directions = {
        ArrowUp: -3,
        w: -3,
        ArrowLeft: -1,
        a: -1,
        ArrowRight: 1,
        d: 1,
        ArrowDown: 3,
        s: 3,
      }
      const direction = directions[event.key] ?? directions[event.key.toLowerCase()]
      if (direction === undefined) return
      event.preventDefault()
      move(direction)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [active, move])

  return (
    <div className="fog-game">
      <div className="fog-grid">
        {Array.from({ length: 9 }).map((_, index) => (
          <span key={index} className={(variant.path.includes(index) || index === variant.start ? 'path ' : '') + (position === index ? 'you ' : '') + (index === variant.exit ? 'exit' : '')} />
        ))}
      </div>
      <div className="fog-side">
        <div className="fog-controls">
          <button type="button" onClick={() => move(-3)}>↑</button>
          <button type="button" onClick={() => move(-1)}>←</button>
          <button type="button" onClick={() => move(1)}>→</button>
          <button type="button" onClick={() => move(3)}>↓</button>
        </div>
        <div className="key-hint">CLICK BOX, THEN ARROWS</div>
      </div>
    </div>
  )
}

function FatigueGame({ variant, active, onResolve }) {
  const [held, setHeld] = useState(0)
  const [pulse, setPulse] = useState(0)
  const holdingRef = useRef(false)
  const awaitingReleaseRef = useRef(false)
  const progressRef = useRef(0)
  const pulseRef = useRef(0)
  const resolvedRef = useRef(false)
  const lastRef = useRef(0)

  const startHolding = useCallback(() => {
    if (!awaitingReleaseRef.current) holdingRef.current = true
  }, [])

  const stopHolding = useCallback(() => {
    holdingRef.current = false
    awaitingReleaseRef.current = false
  }, [])

  useEffect(() => {
    let frame
    const tick = (now) => {
      if (!lastRef.current) lastRef.current = now
      const delta = now - lastRef.current
      lastRef.current = now
      if (holdingRef.current && !awaitingReleaseRef.current && !resolvedRef.current) {
        const next = Math.min(progressRef.current + delta, variant.perPulse)
        progressRef.current = next
        setHeld(next)
        if (next >= variant.perPulse) {
          const nextPulse = pulseRef.current + 1
          if (nextPulse >= variant.pulses) {
            resolvedRef.current = true
            holdingRef.current = false
            queueMicrotask(onResolve)
          } else {
            pulseRef.current = nextPulse
            setPulse(nextPulse)
            progressRef.current = 0
            setHeld(0)
            holdingRef.current = false
            awaitingReleaseRef.current = true
          }
        }
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [onResolve, variant])

  useEffect(() => {
    if (!active) {
      stopHolding()
      return undefined
    }
    const keyDown = (event) => {
      if (event.code !== 'Space' || event.repeat) return
      event.preventDefault()
      startHolding()
    }
    const keyUp = (event) => {
      if (event.code !== 'Space') return
      event.preventDefault()
      stopHolding()
    }
    window.addEventListener('keydown', keyDown)
    window.addEventListener('keyup', keyUp)
    return () => {
      window.removeEventListener('keydown', keyDown)
      window.removeEventListener('keyup', keyUp)
      stopHolding()
    }
  }, [active, startHolding, stopHolding])

  const progress = held / variant.perPulse

  return (
    <div className="fatigue-game">
      <div className="fatigue-eye">
        <div className="heavy-lid" style={{ transform: 'translateY(' + (42 - progress * 42) + 'px)' }} />
      </div>
      <div className="fatigue-controls">
        <button
          type="button"
          onPointerDown={startHolding}
          onPointerUp={stopHolding}
          onPointerLeave={stopHolding}
          onPointerCancel={stopHolding}
        >
          HOLD {variant.pulses > 1 ? pulse + 1 + '/' + variant.pulses : ''}
        </button>
        <span className="key-hint">SPACE</span>
      </div>
      <div className="tiny-progress"><i style={{ width: progress * 100 + '%' }} /></div>
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
