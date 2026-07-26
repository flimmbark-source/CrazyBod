import test from 'node:test'
import assert from 'node:assert/strict'

import {
  REHEARSAL_SEQUENCE,
  PLAN_SEQUENCE,
  STRETCH_SEQUENCE,
  PHYSICAL_SYMPTOM_KINDS,
  scoredPromptCount,
  rehearsalSucceeded,
  scheduledSucceeded,
  stretchSucceeded,
  suppressionSplit,
} from '../src/techniques/techniqueEngine.js'
import { drawSpawnKinds, createPacingDirector } from '../src/pacingDirector.js'

test('rehearsal sequence mixes free-response and scored prompts', () => {
  const scored = scoredPromptCount(REHEARSAL_SEQUENCE.prompts)
  const free = REHEARSAL_SEQUENCE.prompts.length - scored
  assert.equal(free, 1) // one free-response prompt
  assert.equal(scored, 2) // two anticipated-answer prompts
})

test('rehearsal succeeds only when finished with no wrong scored answers', () => {
  assert.equal(rehearsalSucceeded({ finished: true, wrongScoredAnswers: 0 }), true)
  assert.equal(rehearsalSucceeded({ finished: true, wrongScoredAnswers: 1 }), false)
  assert.equal(rehearsalSucceeded({ finished: false, wrongScoredAnswers: 0 }), false) // timeout
})

test('scheduled techniques succeed only when finished without a wrong pick', () => {
  assert.equal(scheduledSucceeded({ finished: true, wrong: false }), true)
  assert.equal(scheduledSucceeded({ finished: true, wrong: true }), false)
  assert.equal(scheduledSucceeded({ finished: false, wrong: false }), false)
})

test('plan sequence has ordered steps', () => {
  const orders = PLAN_SEQUENCE.steps.map((s) => s.order)
  assert.deepEqual(orders, [...orders].sort((a, b) => a - b))
})

test('stretch succeeds only when the warm-up was finished in time', () => {
  assert.equal(stretchSucceeded({ finished: true }), true)
  assert.equal(stretchSucceeded({ finished: false }), false) // ran out of time
})

test('stretch has joints and thins only the physical symptoms', () => {
  assert.ok(STRETCH_SEQUENCE.joints.length >= 4)
  for (const joint of STRETCH_SEQUENCE.joints) assert.equal(typeof joint.key, 'string')
  // The thinned kinds are exactly the physical.jsx minigames — no cognitive or
  // sensory symptoms leak in.
  assert.deepEqual(
    [...PHYSICAL_SYMPTOM_KINDS].sort(),
    ['balance', 'jointSlip', 'muscleLock', 'pressurePoint', 'spiral', 'tremor', 'weakGrip'],
  )
})

test('drawSpawnKinds returns the requested count from a phase pool', () => {
  const director = createPacingDirector(99)
  const kinds = drawSpawnKinds(director, { phaseId: 'gettingReady', count: 2 })
  assert.equal(kinds.length, 2)
  for (const kind of kinds) assert.equal(typeof kind, 'string')
})

test('suppression split matches the specified table', () => {
  const cases = [[5,3,2],[6,3,3],[7,4,3],[8,4,4]]
  for (const [load, suppressed, remaining] of cases) {
    const s = suppressionSplit(load)
    if (s.suppressed !== suppressed || s.remaining !== remaining) {
      throw new Error(`load ${load} -> ${JSON.stringify(s)}`)
    }
    if (s.suppressed + s.remaining !== load) throw new Error('parts must sum to load')
  }
})
