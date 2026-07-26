from pathlib import Path


def replace_once(path, old, new, label):
    source = path.read_text()
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected exactly one match, found {count}')
    path.write_text(source.replace(old, new, 1))


cafe_beat = Path('src/narrative/cafeBeat.js')
replace_once(
    cafe_beat,
    "  AFTERMATH: 'aftermath',\n})\n\nexport const CAFE_BEAT_TIMINGS = Object.freeze({\n",
    "  AFTERMATH: 'aftermath',\n  CELEBRATION: 'celebration',\n})\n\nexport const CAFE_BEAT_START_AT = 45\n\nexport const CAFE_BEAT_TIMINGS = Object.freeze({\n",
    'add celebration phase and earlier start',
)
replace_once(
    cafe_beat,
    "  aftermathMs: 3000,\n})\n",
    "  aftermathMs: 3000,\n  celebrationMs: 1800,\n})\n",
    'add celebration timing',
)
replace_once(
    cafe_beat,
    "    || phase === CAFE_BEAT_PHASES.AFTERMATH\n",
    "    || phase === CAFE_BEAT_PHASES.AFTERMATH\n    || phase === CAFE_BEAT_PHASES.CELEBRATION\n",
    'freeze during celebration',
)

app = Path('src/App.jsx')
replace_once(
    app,
    "  CAFE_BEAT_PHASES,\n  CAFE_BEAT_TIMINGS,\n",
    "  CAFE_BEAT_PHASES,\n  CAFE_BEAT_START_AT,\n  CAFE_BEAT_TIMINGS,\n",
    'import earlier cafe start',
)
replace_once(
    app,
    "  const cafeBeatActive = status === 'playing' && cafeBeatPhase !== CAFE_BEAT_PHASES.INACTIVE\n  const cafeBeatFrozen = isCafeBeatFrozen(cafeBeatPhase)\n  const gameplayPaused = tutorialPaused || orderingPaused || cafeBeatFrozen\n",
    "  const cafeBeatActive = status === 'playing' && cafeBeatPhase !== CAFE_BEAT_PHASES.INACTIVE\n  const cafeBeatKeepsDayMoving = cafeBeatPhase === CAFE_BEAT_PHASES.CONVERSATION\n    || cafeBeatPhase === CAFE_BEAT_PHASES.INTERLUDE\n  const cafeBeatFrozen = isCafeBeatFrozen(cafeBeatPhase)\n  const gameplayPaused = tutorialPaused || orderingPaused || cafeBeatFrozen\n",
    'allow day clock during cafe dialogue',
)
replace_once(
    app,
    "    && !suppressing\n    && !cafeBeatActive\n    && !activeTechnique?.pausesDay\n",
    "    && !suppressing\n    && (!cafeBeatActive || cafeBeatKeepsDayMoving)\n    && !activeTechnique?.pausesDay\n",
    'keep score clock running through conversation',
)
replace_once(
    app,
    "    if (status !== 'playing' || dayElapsed < DAY_LENGTH || cafeBeatPhase !== CAFE_BEAT_PHASES.INACTIVE) return\n",
    "    if (status !== 'playing' || dayElapsed < CAFE_BEAT_START_AT || cafeBeatPhase !== CAFE_BEAT_PHASES.INACTIVE) return\n",
    'start conversation five seconds earlier',
)
replace_once(
    app,
    "    if (cafeBeatPhase === CAFE_BEAT_PHASES.AFTERMATH) {\n      const timer = window.setTimeout(\n        () => finishRun('complete'),\n        CAFE_BEAT_TIMINGS.aftermathMs,\n      )\n      return () => window.clearTimeout(timer)\n    }\n",
    "    if (cafeBeatPhase === CAFE_BEAT_PHASES.AFTERMATH) {\n      const timer = window.setTimeout(\n        () => setCafeBeatPhase(CAFE_BEAT_PHASES.CELEBRATION),\n        CAFE_BEAT_TIMINGS.aftermathMs,\n      )\n      return () => window.clearTimeout(timer)\n    }\n    if (cafeBeatPhase === CAFE_BEAT_PHASES.CELEBRATION) {\n      const timer = window.setTimeout(\n        () => finishRun('complete'),\n        CAFE_BEAT_TIMINGS.celebrationMs,\n      )\n      return () => window.clearTimeout(timer)\n    }\n",
    'insert celebration before results',
)
replace_once(
    app,
    "          {cafeBeatPhase === CAFE_BEAT_PHASES.RUPTURE && (\n            <DialogueBox\n              dialogue={CAFE_RUPTURE_DIALOGUE}\n              load={load}\n              distortion={0}\n              onAnswer={() => {}}\n              className=\"cafe-rupture-dialogue\"\n              ariaLabel=\"Mara is shouting\"\n            />\n          )}\n",
    "          {cafeBeatPhase === CAFE_BEAT_PHASES.RUPTURE && (\n            <DialogueBox\n              dialogue={CAFE_RUPTURE_DIALOGUE}\n              load={load}\n              distortion={0}\n              onAnswer={() => {}}\n              className=\"cafe-rupture-dialogue\"\n              ariaLabel=\"Mara is shouting\"\n            />\n          )}\n\n          {cafeBeatPhase === CAFE_BEAT_PHASES.CELEBRATION && (\n            <section className=\"cafe-celebration\" role=\"status\" aria-live=\"assertive\">\n              <strong>YOU DID IT!</strong>\n            </section>\n          )}\n",
    'render centered celebration',
)

scene = Path('src/narrative/CafeNarrativeBeatScene.jsx')
replace_once(
    scene,
    "const EMPTY_CHAIR_LOOK = new THREE.Vector3(4.2, 1.08, -91.55)\n",
    "const CAFE_DOOR_LOOK = new THREE.Vector3(0, 1.65, -73.5)\n",
    'replace empty chair target with cafe door',
)
replace_once(
    scene,
    "  const smoothedLook = useMemo(() => EMPTY_CHAIR_LOOK.clone(), [])\n",
    "  const smoothedLook = useMemo(() => CAFE_DOOR_LOOK.clone(), [])\n",
    'initialize camera look at door target',
)
replace_once(
    scene,
    "      } else if (currentPhase === CAFE_BEAT_PHASES.AFTERMATH) {\n        rootRef.current.visible = false\n",
    "      } else if (currentPhase === CAFE_BEAT_PHASES.AFTERMATH\n        || currentPhase === CAFE_BEAT_PHASES.CELEBRATION) {\n        rootRef.current.visible = false\n",
    'hide Mara through aftermath and celebration',
)
replace_once(
    scene,
    "    } else if (currentPhase === CAFE_BEAT_PHASES.AFTERMATH) {\n      lookTarget.copy(EMPTY_CHAIR_LOOK)\n",
    "    } else if (currentPhase === CAFE_BEAT_PHASES.AFTERMATH\n      || currentPhase === CAFE_BEAT_PHASES.CELEBRATION) {\n      lookTarget.copy(CAFE_DOOR_LOOK)\n",
    'linger camera on cafe door',
)
replace_once(
    scene,
    "    const targetFov = currentPhase === CAFE_BEAT_PHASES.AFTERMATH ? 61 : 57\n",
    "    const lookingAtDoor = currentPhase === CAFE_BEAT_PHASES.AFTERMATH\n      || currentPhase === CAFE_BEAT_PHASES.CELEBRATION\n    const targetFov = lookingAtDoor ? 61 : 57\n",
    'hold wider door view',
)

css = Path('src/cafeBeat.css')
source = css.read_text()
source = source.replace(
    ".cafe-beat-aftermath .microgame {",
    ".cafe-beat-aftermath .microgame,\n.cafe-beat-celebration .microgame {",
)
source = source.replace(
    ".cafe-beat-aftermath .microgame * {",
    ".cafe-beat-aftermath .microgame *,\n.cafe-beat-celebration .microgame * {",
)
source = source.replace(
    ".cafe-beat-aftermath .microgame {\n  opacity: 0.72;",
    ".cafe-beat-aftermath .microgame,\n.cafe-beat-celebration .microgame {\n  opacity: 0.72;",
)
source = source.replace(
    ".cafe-beat-aftermath .go-home {",
    ".cafe-beat-aftermath .go-home,\n.cafe-beat-celebration .go-home {",
)
source = source.replace(
    ".cafe-beat-aftermath .microgame {\n    transform:",
    ".cafe-beat-aftermath .microgame,\n  .cafe-beat-celebration .microgame {\n    transform:",
)
source += """

.cafe-celebration {
  position: fixed;
  inset: 0;
  z-index: 70;
  display: grid;
  place-items: center;
  pointer-events: none;
  isolation: isolate;
}

.cafe-celebration::before {
  content: '';
  position: absolute;
  width: min(68vw, 760px);
  aspect-ratio: 1;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 244, 181, 0.44), rgba(255, 244, 181, 0) 68%);
  animation: cafe-celebration-flash 1800ms ease-out both;
}

.cafe-celebration strong {
  position: relative;
  font-size: clamp(4rem, 12vw, 10rem);
  line-height: 0.9;
  text-align: center;
  letter-spacing: -0.055em;
  color: #fff4b5;
  -webkit-text-stroke: 3px #302b38;
  text-shadow: 8px 9px 0 #302b38, 14px 16px 0 rgba(48, 43, 56, 0.28);
  transform-origin: center;
  animation: cafe-celebration-pop 1800ms cubic-bezier(.16,.9,.25,1) both;
}

@keyframes cafe-celebration-pop {
  0% { opacity: 0; transform: scale(0.42) rotate(-4deg); }
  18% { opacity: 1; transform: scale(1.14) rotate(1deg); }
  32% { transform: scale(0.98) rotate(0); }
  78% { opacity: 1; transform: scale(1); }
  100% { opacity: 0; transform: scale(1.08); }
}

@keyframes cafe-celebration-flash {
  0% { opacity: 0; transform: scale(0.45); }
  22% { opacity: 1; transform: scale(1); }
  100% { opacity: 0; transform: scale(1.25); }
}

@media (prefers-reduced-motion: reduce) {
  .cafe-celebration::before,
  .cafe-celebration strong {
    animation: none;
  }
}
"""
css.write_text(source)

test_file = Path('test/cafeBeat.test.js')
replace_once(
    test_file,
    "  CAFE_BEAT_PHASES,\n  CAFE_BEAT_TIMINGS,\n",
    "  CAFE_BEAT_PHASES,\n  CAFE_BEAT_START_AT,\n  CAFE_BEAT_TIMINGS,\n",
    'import earlier start in tests',
)
replace_once(
    test_file,
    "test('dialogue interludes give each exchange five seconds of space', () => {\n  assert.equal(CAFE_BEAT_TIMINGS.interludeMs, 5000)\n})\n",
    "test('the café conversation begins five seconds before the day ends', () => {\n  assert.equal(CAFE_BEAT_START_AT, 45)\n})\n\ntest('dialogue interludes give each exchange five seconds of space', () => {\n  assert.equal(CAFE_BEAT_TIMINGS.interludeMs, 5000)\n})\n\ntest('the celebration appears before results', () => {\n  assert.equal(CAFE_BEAT_TIMINGS.celebrationMs, 1800)\n})\n",
    'test earlier start and celebration duration',
)
replace_once(
    test_file,
    "  assert.equal(isCafeBeatFrozen(CAFE_BEAT_PHASES.AFTERMATH), true)\n",
    "  assert.equal(isCafeBeatFrozen(CAFE_BEAT_PHASES.AFTERMATH), true)\n  assert.equal(isCafeBeatFrozen(CAFE_BEAT_PHASES.CELEBRATION), true)\n",
    'test celebration freeze',
)
