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
    "  CONVERSATION: 'conversation',\n  RUPTURE: 'rupture',\n",
    "  CONVERSATION: 'conversation',\n  INTERLUDE: 'interlude',\n  RUPTURE: 'rupture',\n",
    'add interlude phase',
)
replace_once(
    cafe_beat,
    "export const CAFE_BEAT_TIMINGS = Object.freeze({\n  ruptureMs: 2100,\n",
    "export const CAFE_BEAT_TIMINGS = Object.freeze({\n  interludeMs: 5000,\n  ruptureMs: 2100,\n",
    'add interlude timing',
)
replace_once(
    cafe_beat,
    "      phase: CAFE_BEAT_PHASES.CONVERSATION,\n      dialogueIndex: dialogueIndex + 1,\n",
    "      phase: CAFE_BEAT_PHASES.INTERLUDE,\n      dialogueIndex: dialogueIndex + 1,\n",
    'route early answers through interlude',
)

app = Path('src/App.jsx')
replace_once(
    app,
    """  useEffect(() => {\n    if (cafeBeatPhase === CAFE_BEAT_PHASES.RUPTURE) {\n""",
    """  useEffect(() => {\n    if (cafeBeatPhase === CAFE_BEAT_PHASES.INTERLUDE) {\n      const timer = window.setTimeout(\n        () => setCafeBeatPhase(CAFE_BEAT_PHASES.CONVERSATION),\n        CAFE_BEAT_TIMINGS.interludeMs,\n      )\n      return () => window.clearTimeout(timer)\n    }\n    if (cafeBeatPhase === CAFE_BEAT_PHASES.RUPTURE) {\n""",
    'add five-second dialogue interlude',
)

journey = Path('src/world/JourneyScene.jsx')
replace_once(
    journey,
    """  { at: 36, position: [-0.6, 1.65, -89], look: [5.7, 1.35, -86.3], walk: 0, fov: 66 },\n\n  // Sitting down: use the aisle beside the table, approach the seat from behind, then lower into it.\n  { at: 40.5, position: [5.7, 1.65, -86.3], look: [5.7, 1.3, -90], walk: 0.74, fov: 66 },\n  { at: 44, position: [5.7, 1.65, -88.25], look: [4.2, 1.25, -90], walk: 0.58, fov: 65 },\n  { at: 46, position: [4.2, 1.65, -88.25], look: [0.5, 1.3, -90], walk: 0.35, fov: 64 },\n  { at: 48, position: [4.2, 1.15, -88.25], look: [0.5, 1.25, -90], walk: 0, fov: 63 },\n  { at: 50, position: [4.2, 1.15, -88.25], look: [0.5, 1.25, -90], walk: 0, fov: 63 },\n""",
    """  { at: 36, position: [-0.6, 1.65, -89], look: [4.2, 1.42, -91.6], walk: 0, fov: 66 },\n\n  // Sitting down: move directly to the player's side of the table, then settle.\n  { at: 40.5, position: [4.2, 1.65, -88.25], look: [4.2, 1.42, -91.6], walk: 0.78, fov: 64 },\n  { at: 41.2, position: [4.2, 1.38, -88.25], look: [4.2, 1.42, -91.6], walk: 0, fov: 63 },\n  { at: 50, position: [4.2, 1.38, -88.25], look: [4.2, 1.42, -91.6], walk: 0, fov: 63 },\n""",
    'replace wonky table route',
)

beat_scene = Path('src/narrative/CafeNarrativeBeatScene.jsx')
replace_once(
    beat_scene,
    "const CAMERA_POSITION = new THREE.Vector3(4.2, 1.18, -88.15)\n",
    "const CAMERA_POSITION = new THREE.Vector3(4.2, 1.38, -88.25)\n",
    'align cafe beat camera with seated endpoint',
)

test_file = Path('test/cafeBeat.test.js')
replace_once(
    test_file,
    "  CAFE_BEAT_PHASES,\n  CAFE_DIALOGUE,\n",
    "  CAFE_BEAT_PHASES,\n  CAFE_BEAT_TIMINGS,\n  CAFE_DIALOGUE,\n",
    'import cafe timings',
)
replace_once(
    test_file,
    """  assert.deepEqual(advanceCafeConversation(0), {\n    phase: CAFE_BEAT_PHASES.CONVERSATION,\n    dialogueIndex: 1,\n  })\n  assert.deepEqual(advanceCafeConversation(1), {\n    phase: CAFE_BEAT_PHASES.CONVERSATION,\n    dialogueIndex: 2,\n  })\n""",
    """  assert.deepEqual(advanceCafeConversation(0), {\n    phase: CAFE_BEAT_PHASES.INTERLUDE,\n    dialogueIndex: 1,\n  })\n  assert.deepEqual(advanceCafeConversation(1), {\n    phase: CAFE_BEAT_PHASES.INTERLUDE,\n    dialogueIndex: 2,\n  })\n""",
    'expect interludes between exchanges',
)
replace_once(
    test_file,
    """test('microgames freeze only after the rupture begins', () => {\n  assert.equal(isCafeBeatFrozen(CAFE_BEAT_PHASES.INACTIVE), false)\n  assert.equal(isCafeBeatFrozen(CAFE_BEAT_PHASES.CONVERSATION), false)\n""",
    """test('dialogue interludes give each exchange five seconds of space', () => {\n  assert.equal(CAFE_BEAT_TIMINGS.interludeMs, 5000)\n})\n\ntest('microgames freeze only after the rupture begins', () => {\n  assert.equal(isCafeBeatFrozen(CAFE_BEAT_PHASES.INACTIVE), false)\n  assert.equal(isCafeBeatFrozen(CAFE_BEAT_PHASES.CONVERSATION), false)\n  assert.equal(isCafeBeatFrozen(CAFE_BEAT_PHASES.INTERLUDE), false)\n""",
    'test timing and unfrozen interlude',
)
