import test from 'node:test'
import assert from 'node:assert/strict'

import {
  MANDALA_PHASES,
  ENCOUNTER_STATES,
  createMandalaRun,
  toTravelling,
  spawnEncounter,
  advanceMandala,
  resolveEncounter,
  activeLoad,
  travelSpeedFor,
} from '../src/modes/mandala/mandalaState.js'
import { MANDALA_CONFIG } from '../src/modes/mandala/mandalaConfig.js'

function advanceBy(state, { seconds, speed, step = 1 / 60 }) {
  let next = state
  let remaining = seconds
  while (remaining > 1e-9) {
    const dt = Math.min(step, remaining)
    next = advanceMandala(next, { deltaSeconds: dt, travelSpeed: speed })
    remaining -= dt
  }
  return next
}

function withOne(seed = 1, kind = 'checking') {
  return spawnEncounter(toTravelling(createMandalaRun(MANDALA_CONFIG, seed)), { kind })
}

function firstEncounter(state) {
  return [...state.encounters].sort((a, b) => a.routeZ - b.routeZ)[0]
}

test('a new run starts entering, empty, with zero load (spawns are director-driven)', () => {
  const run = createMandalaRun(MANDALA_CONFIG, 42)
  assert.equal(run.phase, MANDALA_PHASES.ENTERING)
  assert.equal(run.encounters.length, 0)
  assert.equal(activeLoad(run), 0)
})

test('spawnEncounter injects a distant foe ahead of the player carrying its microgame kind', () => {
  const run = withOne(42, 'racingHeart')
  assert.equal(run.encounters.length, 1)
  const e = run.encounters[0]
  assert.equal(e.state, ENCOUNTER_STATES.DISTANT)
  assert.equal(e.sourceMicrogameKind, 'racingHeart')
  assert.ok(e.routeZ - run.travelDistance > MANDALA_CONFIG.INTERACTION_DISTANCE)
})

test('entering advances to travelling', () => {
  const run = toTravelling(createMandalaRun(MANDALA_CONFIG, 1))
  assert.equal(run.phase, MANDALA_PHASES.TRAVELLING)
})

test('travel does not itself spawn encounters', () => {
  const run = toTravelling(createMandalaRun(MANDALA_CONFIG, 7))
  const after = advanceBy(run, { seconds: 3, speed: MANDALA_CONFIG.BASE_TRAVEL_SPEED })
  assert.equal(after.encounters.length, 0)
})

test('travel increases distance travelled and closes a spawned encounter distance', () => {
  const run = withOne(7)
  const before = firstEncounter(run)
  const after = advanceBy(run, { seconds: 1, speed: MANDALA_CONFIG.BASE_TRAVEL_SPEED })
  assert.ok(after.travelDistance > run.travelDistance)
  const same = after.encounters.find((e) => e.id === before.id)
  assert.ok(same.routeZ - after.travelDistance < before.routeZ - run.travelDistance)
})

test('distant encounters do not count toward load; arriving at the plane makes them active', () => {
  const run = withOne(3)
  assert.equal(activeLoad(run), 0)
  const nearest = firstEncounter(run)
  const distanceToActivate = nearest.routeZ - MANDALA_CONFIG.INTERACTION_DISTANCE + 1
  const seconds = distanceToActivate / MANDALA_CONFIG.BASE_TRAVEL_SPEED
  const arrived = advanceBy(run, { seconds, speed: MANDALA_CONFIG.BASE_TRAVEL_SPEED })
  const activated = arrived.encounters.find((e) => e.id === nearest.id)
  assert.equal(activated.state, ENCOUNTER_STATES.ACTIVE)
  assert.ok(activeLoad(arrived) >= 1)
})

test('resolving an active encounter stops it counting toward load', () => {
  let run = withOne(9)
  const nearest = firstEncounter(run)
  const seconds = (nearest.routeZ - MANDALA_CONFIG.INTERACTION_DISTANCE + 1) / MANDALA_CONFIG.BASE_TRAVEL_SPEED
  run = advanceBy(run, { seconds, speed: MANDALA_CONFIG.BASE_TRAVEL_SPEED })
  const loadBefore = activeLoad(run)
  assert.ok(loadBefore >= 1)
  run = resolveEncounter(run, nearest.id)
  assert.equal(activeLoad(run), loadBefore - 1)
  const again = resolveEncounter(run, nearest.id)
  assert.equal(activeLoad(again), activeLoad(run))
  assert.equal(again.resolvedCount, run.resolvedCount)
})

test('unresolved active encounters accumulate toward capacity', () => {
  // Spawn several at the plane distance and let them all arrive.
  let run = toTravelling(createMandalaRun(MANDALA_CONFIG, 21))
  for (let i = 0; i < 4; i += 1) run = spawnEncounter(run, { kind: 'checking', distanceAhead: MANDALA_CONFIG.INTERACTION_DISTANCE + 2 })
  run = advanceBy(run, { seconds: 1, speed: MANDALA_CONFIG.BASE_TRAVEL_SPEED })
  assert.ok(activeLoad(run) >= 3)
})

// --- Dive ----------------------------------------------------------------

test('forward input without Dive leaves travel at base speed', () => {
  assert.equal(travelSpeedFor({ diving: false }), MANDALA_CONFIG.BASE_TRAVEL_SPEED)
})

test('Dive plus forward input accelerates travel; releasing returns to base', () => {
  const diving = travelSpeedFor({ diving: true })
  const base = travelSpeedFor({ diving: false })
  assert.ok(diving > base)
  assert.equal(diving, MANDALA_CONFIG.BASE_TRAVEL_SPEED * MANDALA_CONFIG.DIVE_SPEED_MULTIPLIER)
  assert.equal(travelSpeedFor({ diving: false }), base)
})

test('Dive makes a spawned encounter arrive sooner (same elapsed time)', () => {
  const run = withOne(5)
  const target = firstEncounter(run)
  const walk = advanceBy(run, { seconds: 1, speed: travelSpeedFor({ diving: false }) })
  const dive = advanceBy(run, { seconds: 1, speed: travelSpeedFor({ diving: true }) })
  const walkAhead = walk.encounters.find((e) => e.id === target.id).routeZ - walk.travelDistance
  const diveAhead = dive.encounters.find((e) => e.id === target.id).routeZ - dive.travelDistance
  assert.ok(diveAhead < walkAhead) // closer sooner while diving
})

test('Dive does not generate extra encounters (travel never spawns)', () => {
  const run = withOne(11)
  const slow = advanceMandala(run, { deltaSeconds: 2, travelSpeed: 10 })
  const fast = advanceMandala(run, { deltaSeconds: 1, travelSpeed: 20 })
  assert.equal(slow.encounters.length, run.encounters.length)
  assert.equal(fast.encounters.length, run.encounters.length)
})
