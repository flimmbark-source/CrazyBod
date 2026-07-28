import test from 'node:test'
import assert from 'node:assert/strict'

import {
  MANDALA_PHASES,
  ENCOUNTER_STATES,
  createMandalaRun,
  toTravelling,
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

function firstEncounter(state) {
  return [...state.encounters].sort((a, b) => a.routeZ - b.routeZ)[0]
}

test('a new run starts entering, with encounters placed ahead and zero load', () => {
  const run = createMandalaRun(MANDALA_CONFIG, 42)
  assert.equal(run.phase, MANDALA_PHASES.ENTERING)
  assert.ok(run.encounters.length > 0)
  assert.equal(activeLoad(run), 0)
  // Everything starts distant / ahead of the interaction plane.
  for (const e of run.encounters) {
    assert.ok(e.routeZ - run.travelDistance > MANDALA_CONFIG.INTERACTION_DISTANCE)
  }
})

test('entering advances to travelling', () => {
  const run = toTravelling(createMandalaRun(MANDALA_CONFIG, 1))
  assert.equal(run.phase, MANDALA_PHASES.TRAVELLING)
})

test('travel increases distance travelled and closes encounter distance', () => {
  const run = toTravelling(createMandalaRun(MANDALA_CONFIG, 7))
  const before = firstEncounter(run)
  const after = advanceBy(run, { seconds: 1, speed: MANDALA_CONFIG.BASE_TRAVEL_SPEED })
  assert.ok(after.travelDistance > run.travelDistance)
  const sameAfter = after.encounters.find((e) => e.id === before.id)
  assert.ok(sameAfter.routeZ - after.travelDistance < before.routeZ - run.travelDistance)
})

test('distant encounters do not count toward load; arriving at the plane makes them active', () => {
  const run = toTravelling(createMandalaRun(MANDALA_CONFIG, 3))
  assert.equal(activeLoad(run), 0)
  const nearest = firstEncounter(run)
  // Travel just past the interaction plane for the nearest encounter.
  const distanceToActivate = nearest.routeZ - MANDALA_CONFIG.INTERACTION_DISTANCE + 1
  const seconds = distanceToActivate / MANDALA_CONFIG.BASE_TRAVEL_SPEED
  const arrived = advanceBy(run, { seconds, speed: MANDALA_CONFIG.BASE_TRAVEL_SPEED })
  const activated = arrived.encounters.find((e) => e.id === nearest.id)
  assert.equal(activated.state, ENCOUNTER_STATES.ACTIVE)
  assert.ok(activeLoad(arrived) >= 1)
})

test('resolving an active encounter stops it counting toward load', () => {
  let run = toTravelling(createMandalaRun(MANDALA_CONFIG, 9))
  const nearest = firstEncounter(run)
  const seconds = (nearest.routeZ - MANDALA_CONFIG.INTERACTION_DISTANCE + 1) / MANDALA_CONFIG.BASE_TRAVEL_SPEED
  run = advanceBy(run, { seconds, speed: MANDALA_CONFIG.BASE_TRAVEL_SPEED })
  const loadBefore = activeLoad(run)
  assert.ok(loadBefore >= 1)
  run = resolveEncounter(run, nearest.id)
  assert.equal(activeLoad(run), loadBefore - 1)
  // Resolving again is a no-op (resolve once per target).
  const again = resolveEncounter(run, nearest.id)
  assert.equal(activeLoad(again), activeLoad(run))
  assert.equal(again.resolvedCount, run.resolvedCount)
})

test('unresolved active encounters accumulate and can exceed capacity (overload reachable)', () => {
  let run = toTravelling(createMandalaRun(MANDALA_CONFIG, 21))
  const capacity = 3
  let overloadReached = false
  for (let i = 0; i < 60 && !overloadReached; i += 1) {
    run = advanceBy(run, { seconds: 0.5, speed: MANDALA_CONFIG.BASE_TRAVEL_SPEED })
    if (activeLoad(run) >= capacity) overloadReached = true
  }
  assert.equal(overloadReached, true)
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

test('Dive makes a spatially positioned encounter arrive sooner (same elapsed time)', () => {
  const run = toTravelling(createMandalaRun(MANDALA_CONFIG, 5))
  const target = firstEncounter(run)
  const walk = advanceBy(run, { seconds: 1, speed: travelSpeedFor({ diving: false }) })
  const dive = advanceBy(run, { seconds: 1, speed: travelSpeedFor({ diving: true }) })
  const walkAhead = walk.encounters.find((e) => e.id === target.id).routeZ - walk.travelDistance
  const diveAhead = dive.encounters.find((e) => e.id === target.id).routeZ - dive.travelDistance
  assert.ok(diveAhead < walkAhead) // closer sooner while diving
})

test('Dive does not generate extra encounters: placement depends only on distance', () => {
  const run = toTravelling(createMandalaRun(MANDALA_CONFIG, 11))
  // Reach the same travel distance two ways: slow-long vs fast-short.
  const slow = advanceMandala(run, { deltaSeconds: 2, travelSpeed: 10 })
  const fast = advanceMandala(run, { deltaSeconds: 1, travelSpeed: 20 })
  assert.equal(slow.travelDistance, fast.travelDistance)
  assert.deepEqual(
    slow.encounters.map((e) => `${e.id}@${e.routeZ.toFixed(3)}`),
    fast.encounters.map((e) => `${e.id}@${e.routeZ.toFixed(3)}`),
  )
})
