from pathlib import Path

path = Path('src/App.jsx')
source = path.read_text()


def replace_once(old, new, label):
    global source
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected exactly one match, found {count}')
    source = source.replace(old, new, 1)


def replace_first(old, new, label):
    global source
    count = source.count(old)
    if count < 1:
        raise RuntimeError(f'{label}: expected at least one match, found {count}')
    source = source.replace(old, new, 1)


replace_once(
    "import SkillTreeScreen from './progression/SkillTreeScreen.jsx'\n",
    "import SkillTreeScreen from './progression/SkillTreeScreen.jsx'\n"
    "import DialogueBox from './dialogue/DialogueBox.jsx'\n"
    "import CafeNarrativeBeatScene from './narrative/CafeNarrativeBeatScene.jsx'\n"
    "import {\n"
    "  CAFE_BEAT_PHASES,\n"
    "  CAFE_BEAT_TIMINGS,\n"
    "  CAFE_DIALOGUE,\n"
    "  CAFE_RUPTURE_DIALOGUE,\n"
    "  advanceCafeConversation,\n"
    "  isCafeBeatFrozen,\n"
    "} from './narrative/cafeBeat.js'\n",
    'imports',
)

replace_once(
    """function scrambleText(text, intensity) {
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
""",
    """function edgeOffsetFor(position) {
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
""",
    'edge displacement helper',
)

replace_once(
    "  const [orderDialogueAnswered, setOrderDialogueAnswered] = useState(false)\n",
    "  const [orderDialogueAnswered, setOrderDialogueAnswered] = useState(false)\n"
    "  const [cafeBeatPhase, setCafeBeatPhase] = useState(CAFE_BEAT_PHASES.INACTIVE)\n"
    "  const [cafeDialogueIndex, setCafeDialogueIndex] = useState(0)\n",
    'cafe state',
)

replace_once(
    "  const orderingPaused = status === 'playing' && orderDialogueOpen\n"
    "  const gameplayPaused = tutorialPaused || orderingPaused\n",
    "  const orderingPaused = status === 'playing' && orderDialogueOpen\n"
    "  const cafeBeatActive = status === 'playing' && cafeBeatPhase !== CAFE_BEAT_PHASES.INACTIVE\n"
    "  const cafeBeatFrozen = isCafeBeatFrozen(cafeBeatPhase)\n"
    "  const gameplayPaused = tutorialPaused || orderingPaused || cafeBeatFrozen\n",
    'cafe subsystem gates',
)

replace_once(
    "    && !suppressing\n    && !activeTechnique?.pausesDay\n",
    "    && !suppressing\n    && !cafeBeatActive\n    && !activeTechnique?.pausesDay\n",
    'day gate',
)
replace_once(
    "    && !suppressing\n    && !activeTechnique?.pausesSpawns\n",
    "    && !suppressing\n    && !cafeBeatActive\n    && !activeTechnique?.pausesSpawns\n",
    'spawn gate',
)

replace_once(
    "    setOrderDialogueOpen(false)\n    setOrderDialogueAnswered(false)\n",
    "    setOrderDialogueOpen(false)\n    setOrderDialogueAnswered(false)\n"
    "    setCafeBeatPhase(CAFE_BEAT_PHASES.INACTIVE)\n"
    "    setCafeDialogueIndex(0)\n",
    'run reset',
)

replace_once(
    "    if (status !== 'playing' || spawnPaused) return\n",
    "    if (status !== 'playing' || spawnPaused || cafeBeatActive) return\n",
    'pending spawn gate',
)
replace_once(
    "  }, [spawnElapsed, load, status, spawnPaused, spawnMicrogame])\n",
    "  }, [spawnElapsed, load, status, spawnPaused, cafeBeatActive, spawnMicrogame])\n",
    'pending spawn dependencies',
)

replace_once(
    "    if (status !== 'playing' || activeTechnique || rehearsalFiredRef.current) return\n",
    "    if (status !== 'playing' || cafeBeatActive || activeTechnique || rehearsalFiredRef.current) return\n",
    'rehearsal gate',
)
replace_first(
    "  }, [status, activeTechnique, dayElapsed, progression.enabledNodeIds])\n",
    "  }, [status, cafeBeatActive, activeTechnique, dayElapsed, progression.enabledNodeIds])\n",
    'rehearsal dependencies',
)
replace_once(
    "    if (status !== 'playing' || activeTechnique || planFiredRef.current) return\n",
    "    if (status !== 'playing' || cafeBeatActive || activeTechnique || planFiredRef.current) return\n",
    'plan gate',
)
replace_once(
    "  }, [status, activeTechnique, dayElapsed, progression.enabledNodeIds])\n",
    "  }, [status, cafeBeatActive, activeTechnique, dayElapsed, progression.enabledNodeIds])\n",
    'plan dependencies',
)
replace_once(
    "    if (status !== 'playing' || adrenalineFiredRef.current) return\n",
    "    if (status !== 'playing' || cafeBeatActive || adrenalineFiredRef.current) return\n",
    'adrenaline gate',
)
replace_once(
    "  }, [load, capacity, status, progression.enabledNodeIds])\n",
    "  }, [load, capacity, status, cafeBeatActive, progression.enabledNodeIds])\n",
    'adrenaline dependencies',
)

replace_once(
    """  useEffect(() => {
    if (status !== 'playing' || load < capacity || suppressing) return
    if (!suppressUsedRef.current && progression.enabledNodeIds.includes('suppress')) {
      suppressUsedRef.current = true
      setSuppressing(true)
      return
    }
    finishRun('overload')
  }, [load, status, capacity, suppressing, progression.enabledNodeIds, finishRun])

  useEffect(() => {
    if (status !== 'playing' || dayElapsed < DAY_LENGTH) return
    finishRun('complete')
  }, [dayElapsed, status, finishRun])
""",
    """  useEffect(() => {
    if (status !== 'playing' || dayElapsed >= DAY_LENGTH || cafeBeatActive || load < capacity || suppressing) return
    if (!suppressUsedRef.current && progression.enabledNodeIds.includes('suppress')) {
      suppressUsedRef.current = true
      setSuppressing(true)
      return
    }
    finishRun('overload')
  }, [load, dayElapsed, status, capacity, suppressing, cafeBeatActive, progression.enabledNodeIds, finishRun])

  useEffect(() => {
    if (status !== 'playing' || dayElapsed < DAY_LENGTH || cafeBeatPhase !== CAFE_BEAT_PHASES.INACTIVE) return
    pendingSpawnsRef.current = []
    setActiveTechnique(null)
    setSuppressing(false)
    setCafeDialogueIndex(0)
    setCafeBeatPhase(CAFE_BEAT_PHASES.CONVERSATION)
  }, [dayElapsed, status, cafeBeatPhase])

  useEffect(() => {
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
        () => finishRun('complete'),
        CAFE_BEAT_TIMINGS.aftermathMs,
      )
      return () => window.clearTimeout(timer)
    }
    return undefined
  }, [cafeBeatPhase, finishRun])
""",
    'end-of-day cafe transaction',
)

replace_once(
    """  const answerOrderDialogue = () => {
    setOrderDialogueAnswered(true)
    setOrderDialogueOpen(false)
  }
""",
    """  const answerOrderDialogue = () => {
    setOrderDialogueAnswered(true)
    setOrderDialogueOpen(false)
  }

  const answerCafeDialogue = () => {
    const next = advanceCafeConversation(cafeDialogueIndex)
    setCafeDialogueIndex(next.dialogueIndex)
    setCafeBeatPhase(next.phase)
  }
""",
    'cafe answer handler',
)

replace_once(
    "    <main className={`game-shell status-${status} load-${Math.min(load, 5)}`}>",
    "    <main className={`game-shell status-${status} load-${Math.min(load, 5)} cafe-beat-${cafeBeatPhase}`}>",
    'root phase class',
)

replace_once(
    """          <AuthoredJourneyScene
            elapsed={dayElapsed}
            active={dayAdvancing}
            dialogueStage={dialogueOpen ? 'mara' : orderDialogueOpen ? 'order' : null}
          />
""",
    """          <AuthoredJourneyScene
            elapsed={dayElapsed}
            active={dayAdvancing}
            dialogueStage={dialogueOpen ? 'mara' : orderDialogueOpen ? 'order' : null}
          />
          <CafeNarrativeBeatScene elapsed={dayElapsed} phase={cafeBeatPhase} />
""",
    'cafe scene layer',
)

replace_once(
    "          <section className=\"microgame-layer\" aria-live=\"polite\">\n",
    "          <section\n"
    "            className=\"microgame-layer\"\n"
    "            aria-live=\"polite\"\n"
    "            aria-hidden={cafeBeatFrozen || undefined}\n"
    "            inert={cafeBeatFrozen ? true : undefined}\n"
    "          >\n",
    'frozen microgame layer',
)
replace_once(
    "                onResolve={resolveMicrogame}\n",
    "                onResolve={resolveMicrogame}\n                frozen={cafeBeatFrozen}\n",
    'frozen microgame prop',
)

replace_once(
    """          {orderDialogueOpen && (
            <DialogueBox
              dialogue={ORDER_DIALOGUE}
              load={load}
              distortion={distortion}
              onAnswer={answerOrderDialogue}
            />
          )}
""",
    """          {orderDialogueOpen && (
            <DialogueBox
              dialogue={ORDER_DIALOGUE}
              load={load}
              distortion={distortion}
              onAnswer={answerOrderDialogue}
            />
          )}

          {cafeBeatPhase === CAFE_BEAT_PHASES.CONVERSATION && (
            <DialogueBox
              dialogue={CAFE_DIALOGUE[cafeDialogueIndex]}
              load={load}
              distortion={distortion}
              onAnswer={answerCafeDialogue}
              className=\"cafe-conversation-dialogue\"
              ariaLabel={`Conversation with Mara, part ${cafeDialogueIndex + 1} of ${CAFE_DIALOGUE.length}`}
            />
          )}

          {cafeBeatPhase === CAFE_BEAT_PHASES.RUPTURE && (
            <DialogueBox
              dialogue={CAFE_RUPTURE_DIALOGUE}
              load={load}
              distortion={0}
              onAnswer={() => {}}
              className=\"cafe-rupture-dialogue\"
              ariaLabel=\"Mara is shouting\"
            />
          )}
""",
    'cafe dialogue rendering',
)

replace_once(
    "            disabled={gameplayPaused}\n",
    "            disabled={gameplayPaused || cafeBeatActive}\n",
    'go home lock',
)

replace_once(
    """function DialogueBox({ dialogue, load, distortion, onAnswer }) {
  return (
    <section className={`dialogue-box distortion-${distortion}`}>
      <div className=\"speaker-row\">
        <span className=\"portrait\">{dialogue.speaker.slice(0, 1)}</span>
        <div>
          <strong>{dialogue.speaker}</strong>
          <p>{scrambleText(dialogue.line, distortion)}</p>
        </div>
      </div>
      <div className=\"dialogue-options\">
        {dialogue.options.map((option, index) => (
          <button
            key={option}
            type=\"button\"
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

""",
    "",
    'remove duplicate dialogue component',
)

replace_once(
    """const MicrogameWindow = memo(function MicrogameWindow({ game, index, load, tutorialTarget, onResolve }) {
  const resolve = useCallback(() => onResolve(game.id), [game.id, onResolve])
""",
    """const MicrogameWindow = memo(function MicrogameWindow({ game, index, load, tutorialTarget, onResolve, frozen = false }) {
  const resolve = useCallback(() => {
    if (!frozen) onResolve(game.id)
  }, [frozen, game.id, onResolve])
  const beatOffset = useMemo(() => edgeOffsetFor(game.position), [game.position])
""",
    'microgame freeze handler',
)
replace_once(
    "        '--jitter-duration': `${Math.max(0.2, 0.5 - Math.min(load, 4) * 0.06)}s`,\n",
    "        '--jitter-duration': `${Math.max(0.2, 0.5 - Math.min(load, 4) * 0.06)}s`,\n"
    "        '--beat-x': `${beatOffset.x}px`,\n"
    "        '--beat-y': `${beatOffset.y}px`,\n",
    'microgame displacement variables',
)
replace_once(
    "        {game.kind === 'fatigue' && <FatigueGame onResolve={resolve} />}\n",
    "        {game.kind === 'fatigue' && <FatigueGame onResolve={resolve} paused={frozen} />}\n",
    'fatigue pause prop',
)
replace_once(
    "function FatigueGame({ onResolve }) {\n",
    "function FatigueGame({ onResolve, paused = false }) {\n",
    'fatigue signature',
)
replace_once(
    "      if (holdingRef.current) {\n",
    "      if (holdingRef.current && !paused) {\n",
    'fatigue timer gate',
)
replace_once(
    "  }, [onResolve])\n\n  const stopHolding",
    "  }, [onResolve, paused])\n\n  const stopHolding",
    'fatigue dependencies',
)

path.write_text(source)
