import test from 'node:test'
import assert from 'node:assert/strict'

import {
  REHEARSAL_SEQUENCE,
  PLAN_SEQUENCE,
  scoredPromptCount,
  rehearsalSucceeded,
  scheduledSucceeded,
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

test('drawSpawnKinds returns the requested count from a phase pool', () => {
  const director = createPacingDirector(99)
  const kinds = drawSpawnKinds(director, { phaseId: 'gettingReady', count: 2 })
  assert.equal(kinds.length, 2)
  for (const kind of kinds) assert.equal(typeof kind, 'string')
})
