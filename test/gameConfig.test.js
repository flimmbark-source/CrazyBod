import test from 'node:test'
import assert from 'node:assert/strict'

import {
  DAY_LENGTH,
  MAX_SCORE,
  PHASES,
  phaseFor,
  phaseLabel,
  scoreForElapsed,
} from '../src/config/gameConfig.js'

test('phases cover the full scored day contiguously', () => {
  assert.equal(PHASES[0].start, 0)
  assert.equal(PHASES[PHASES.length - 1].end, DAY_LENGTH)
  for (let i = 1; i < PHASES.length; i += 1) {
    assert.equal(PHASES[i].start, PHASES[i - 1].end)
  }
})

// The scored day now starts on the doorstep: waking and getting ready happen
// in the untimed Morning, so the first scored phase is stepping outside.
test('phaseFor maps day time to the right phase', () => {
  assert.equal(phaseFor(0).id, 'headingOut')
  assert.equal(phaseFor(3.9).id, 'headingOut')
  assert.equal(phaseFor(4).id, 'walking')
  assert.equal(phaseFor(20).id, 'walking')  // the long stretch of the day
  assert.equal(phaseFor(29).id, 'meeting')  // Mara outside the cafe
  assert.equal(phaseFor(41).id, 'ordering')
  assert.equal(phaseFor(50).id, 'sitting')
  assert.equal(phaseLabel(0), 'LEAVING THE HOUSE')
})

test('score is clamped to the day ceiling regardless of extra time', () => {
  assert.equal(scoreForElapsed(0), 0)
  assert.equal(scoreForElapsed(25), 250)
  assert.equal(scoreForElapsed(DAY_LENGTH), MAX_SCORE)
  assert.equal(scoreForElapsed(DAY_LENGTH + 20), MAX_SCORE) // unscored technique time cannot exceed max
  assert.equal(MAX_SCORE, 560)
})
