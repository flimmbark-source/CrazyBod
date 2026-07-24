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

const namesBlock = `const MICROGAME_NAMES = {
  discomfort: 'DISCOMFORT',
  anxiety: 'ANXIETY',
  brainFog: 'BRAIN FOG',
  fatigue: 'FATIGUE',
}`

const variantsBlock = `${namesBlock}

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
}`

app = replaceOnce(app, namesBlock, variantsBlock, 'microgame names block')

app = replaceOnce(
  app,
  `  const [finalScore, setFinalScore] = useState(0)
  const startTimeRef = useRef(0)
  const spawnedRef = useRef(new Set())`,
  `  const [finalScore, setFinalScore] = useState(0)
  const [activeGameId, setActiveGameId] = useState(null)
  const startTimeRef = useRef(0)
  const spawnedRef = useRef(new Set())
  const variantBagsRef = useRef(makeVariantBags())`,
  'App state block',
)

app = replaceOnce(
  app,
  `    spawnedRef.current = new Set()
    setElapsed(0)
    setMicrogames([])`,
  `    spawnedRef.current = new Set()
    variantBagsRef.current = makeVariantBags()
    setElapsed(0)
    setMicrogames([])
    setActiveGameId(null)`,
  'start reset block',
)

app = replaceOnce(
  app,
  `            kind: event.kind,
            position: positionFor(scriptIndex),`,
  `            kind: event.kind,
            variant: drawVariant(event.kind, variantBagsRef.current),
            position: positionFor(scriptIndex),`,
  'spawned microgame object',
)

app = replaceOnce(
  app,
  `  const resolveMicrogame = useCallback((id) => {
    setMicrogames((current) => current.filter((game) => game.id !== id))
  }, [])`,
  `  const resolveMicrogame = useCallback((id) => {
    setMicrogames((current) => current.filter((game) => game.id !== id))
    setActiveGameId((current) => current === id ? null : current)
  }, [])`,
  'resolve microgame function',
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

  return (`,
  'dialogue keyboard effect',
)

app = replaceOnce(
  app,
  `                load={load}
                onResolve={resolveMicrogame}`,
  `                load={load}
                active={activeGameId === game.id}
                onActivate={setActiveGameId}
                onResolve={resolveMicrogame}`,
  'microgame props',
)

const dialogueStart = app.indexOf('function DialogueBox(')
const microgameStart = app.indexOf('function MicrogameWindow(')
if (dialogueStart < 0 || microgameStart < 0 || microgameStart <= dialogueStart) {
  throw new Error('Could not locate dialogue/microgame component boundary')
}

const dialogueReplacement = `function DialogueBox({ load, distortion, onAnswer }) {
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

`
app = app.slice(0, dialogueStart) + dialogueReplacement + app.slice(microgameStart)

const sectionStart = app.indexOf('function MicrogameWindow(')
const journeyStart = app.indexOf('function JourneyScene(')
if (sectionStart < 0 || journeyStart < 0 || journeyStart <= sectionStart) {
  throw new Error('Could not locate microgame section')
}

const microgameReplacement = `function MicrogameWindow({ game, index, load, active, onActivate, onResolve }) {
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

`

app = app.slice(0, sectionStart) + microgameReplacement + app.slice(journeyStart)

if (!main.includes("import './variation.css'")) {
  main = replaceOnce(main, "import './styles.css'", "import './styles.css'\nimport './variation.css'", 'variation stylesheet import')
}

fs.writeFileSync(appPath, app)
fs.writeFileSync(mainPath, main)
console.log('Applied CrazyBod microgame variation pass.')
